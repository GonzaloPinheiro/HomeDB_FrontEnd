import { RotateCcw, RotateCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/shared/components/ui/button'

import { clampSeek, SEEK_STEP_SECONDS, streamUrl, type FileExplorerItem } from './media'
import { useMediaRetry } from './useMediaRetry'
import { ViewerError } from './ViewerError'

type ViewerVideoProps = {
  item: FileExplorerItem
  onDownload: () => void
}

// CLAUDE.md §6.3c: vídeo con los CONTROLES NATIVOS del navegador (play/pausa, barra
// de progreso, volumen, pantalla completa, PiP, velocidad según navegador). Es una
// decisión de fiabilidad: unos controles propios multiplican los fallos (pantalla
// completa en iOS, buffering, accesibilidad, táctil) por muy poco. Lo único propio
// es saltar ±10 s, con botones (sirven también en táctil) y las teclas J/L; ambos
// van por `seekBy`. Las flechas ←/→ las gestiona el propio <video> (±5 s) cuando
// tiene el foco.
// `preload="metadata"`: solo pide lo justo para mostrar duración y primer cuadro, y
// el resto por rangos (el endpoint de streaming soporta `Range`, §5.4).
export function ViewerVideo({ item, onDownload }: ViewerVideoProps) {
  const { attempt, failed, onError, retry } = useMediaRetry()
  const videoRef = useRef<HTMLVideoElement>(null)
  // Dónde estaba al fallar, para retomar ahí tras recuperar la sesión (§6.3c)
  const lastTimeRef = useRef(0)
  const [noPicture, setNoPicture] = useState(false)

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current
    if (video) video.currentTime = clampSeek(video.currentTime, delta, video.duration)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'j') seekBy(-SEEK_STEP_SECONDS)
      else if (key === 'l') seekBy(SEEK_STEP_SECONDS)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [seekBy])

  if (failed) {
    return (
      <ViewerError
        title="No se pudo reproducir el vídeo"
        // Chrome informa de "formato no soportado" también cuando el servidor responde
        // con un error HTTP (401, 404…), así que el mensaje no afirma una sola causa.
        description="El navegador no ha podido reproducirlo: el formato puede no ser compatible (por ejemplo, HEVC de algunos iPhone), el archivo puede no estar disponible o la conexión haber fallado. Puedes descargarlo y verlo con otro reproductor."
        onRetry={() => void retry()}
        onDownload={onDownload}
      />
    )
  }

  if (noPicture) {
    return (
      <ViewerError
        title="El navegador no puede mostrar la imagen de este vídeo"
        description="Es probable que use un formato (por ejemplo, HEVC) que este navegador no admite, aunque sí reproduzca su audio. Descárgalo para verlo con otro reproductor."
        onDownload={onDownload}
      />
    )
  }

  const bar =
    'bg-header-surface text-header-text hover:bg-header-border hover:text-header-text'
  return (
    <div className="flex h-full w-full min-h-0 flex-col items-center gap-2">
      <video
        key={attempt}
        ref={videoRef}
        src={streamUrl(item.id)}
        aria-label={item.name}
        controls
        playsInline
        preload="metadata"
        // La descarga tiene su botón en la cabecera: la nativa bajaría el archivo como "stream"
        controlsList="nodownload"
        onError={onError}
        onTimeUpdate={(event) => {
          lastTimeRef.current = event.currentTarget.currentTime
        }}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          // Chrome sin soporte para el códec de vídeo pero sí para el de audio carga
          // los metadatos, no da error y reproduce solo el sonido sobre negro.
          if (video.videoWidth === 0 && video.videoHeight === 0) {
            setNoPicture(true)
            return
          }
          if (attempt > 0 && lastTimeRef.current > 0) video.currentTime = lastTimeRef.current
        }}
        className="min-h-0 w-full flex-1 bg-black object-contain"
      />
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={() => seekBy(-SEEK_STEP_SECONDS)} title="Retroceder 10 s (J)" className={bar}>
          <RotateCcw />
          10 s
        </Button>
        <Button variant="ghost" size="sm" onClick={() => seekBy(SEEK_STEP_SECONDS)} title="Adelantar 10 s (L)" className={bar}>
          10 s
          <RotateCw />
        </Button>
      </div>
    </div>
  )
}
