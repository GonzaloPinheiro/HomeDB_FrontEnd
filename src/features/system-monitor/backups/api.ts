import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { api, toApiError, unwrap } from '@/shared/api/client'
import type { ApiObjResponse } from '@/shared/types/api'

import { SAMPLE_INTERVAL_MS } from '../api'
import { summarizeBackups } from './summary'
import { backupEntrySchema, backupHistorySchema } from './types'

// Entradas que muestra el panel (scroll interno). El backend admite hasta 200
// por página (`GetBackupHistoryRequestDto`), pero solo se conservan dos copias
// físicas — el resto del historial es solo auditoría, no hace falta paginarlo aquí.
export const BACKUP_HISTORY_PAGE_SIZE = 10

// Mientras hay un backup en curso el panel sondea más rápido para reflejar el
// final sin esperar al ciclo normal. Muy por debajo del rate limit global del
// backend (100 req/min por IP, §7.4).
export const BACKUP_RUNNING_POLL_MS = 5_000

const TRIGGER_MUTATION_KEY = ['system-monitor', 'backups', 'trigger'] as const

export const backupKeys = {
  all: ['system-monitor', 'backups'] as const,
  history: ['system-monitor', 'backups', 'history'] as const,
}

/** true mientras hay un `POST /backup/{level}/trigger` en vuelo (en cualquier componente). */
export function useIsBackupTriggering(): boolean {
  return useIsMutating({ mutationKey: TRIGGER_MUTATION_KEY }) > 0
}

/**
 * Aviso nativo de `beforeunload` mientras un backup forzado está en vuelo.
 * El backend ata la ejecución a la petición HTTP (`TriggerBackupAsync` recibe
 * el `CancellationToken` de la request): cerrar o recargar la pestaña corta la
 * conexión y cancela rsync/pg_dump a medias. Mismo criterio que el aviso de las
 * subidas (§7.4).
 */
export function useBackupUnloadGuard(): void {
  const isTriggering = useIsBackupTriggering()
  useEffect(() => {
    if (!isTriggering) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isTriggering])
}

/**
 * GET /backup/history — solo Admin + módulo SystemMonitor (BackupController).
 * `level=Daily` acota el panel al backup diario: cuando exista el mensual
 * (hoy lanza `BackupLevelNotSupported`, §5.4) tendrá su propia vista.
 * `enabled` permite no disparar la petición para quien no es Admin (daría 403).
 */
export function useBackupHistory(enabled: boolean) {
  // Mientras una ejecución manual está en vuelo, el POST no responde hasta que
  // termina — el estado "en curso" solo se ve consultando el historial aparte.
  const isTriggering = useIsBackupTriggering()

  return useQuery({
    queryKey: backupKeys.history,
    enabled,
    queryFn: async () => {
      const response = await api.get<ApiObjResponse<unknown>>('/backup/history', {
        params: { level: 'Daily', page: 1, pageSize: BACKUP_HISTORY_PAGE_SIZE },
      })
      return backupHistorySchema.parse(unwrap(response.data))
    },
    refetchInterval: (query) => {
      const running = isTriggering || (query.state.data ? summarizeBackups(query.state.data.items).isRunning : false)
      return running ? BACKUP_RUNNING_POLL_MS : SAMPLE_INTERVAL_MS
    },
  })
}

/**
 * POST /backup/Daily/trigger — fuerza un backup diario ahora.
 *
 * CLAUDE.md §5.4: el endpoint es SÍNCRONO — no responde hasta que rsync y
 * pg_dump terminan, y puede tardar minutos con muchos archivos. Por eso desactiva
 * el timeout de 30s de la instancia de axios (mismo criterio que `sendChunk` y
 * `downloadFile`, §7.4): una respuesta lenta no es un fallo.
 *
 * Si la respuesta no llega (corte de red, proxy intermedio que cierra la
 * conexión antes de tiempo) el error no trae `errorCode`, pero el backup puede
 * seguir corriendo en el servidor: no se anuncia como fallo, se refresca el
 * historial para que el panel muestre el estado real.
 *
 * PENDIENTE (CLAUDE.md §5.4): si el backend pasa a lanzar el backup en segundo
 * plano y responder 202, este hook deja de necesitar timeout 0, el guard de
 * `beforeunload` y el sondeo por mutation en vuelo — bastaría con el historial.
 */
export function useTriggerBackup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: TRIGGER_MUTATION_KEY,
    mutationFn: async () => {
      const response = await api.post<ApiObjResponse<unknown>>('/backup/Daily/trigger', undefined, {
        timeout: 0,
      })
      return backupEntrySchema.parse(unwrap(response.data))
    },
    onSuccess: (entry) => {
      // El endpoint responde 200 aunque el backup termine en Failed (el fallo
      // queda registrado en la propia entrada) — el toast debe distinguirlo.
      if (entry.status === 'success') {
        toast.success('Backup completado')
      } else {
        toast.error(entry.errorMessage ?? 'El backup ha fallado')
      }
    },
    onError: (error) => {
      const apiError = toApiError(error)
      if (apiError.errorCode === null) {
        toast.info('No se recibió respuesta del servidor. El backup puede seguir en curso: revisa el historial.')
      } else {
        toast.error(apiError.message)
      }
    },
    // Éxito o error, el historial manda: en ambos casos ya hay (o puede haber) un registro nuevo.
    onSettled: () => queryClient.invalidateQueries({ queryKey: backupKeys.all }),
  })
}
