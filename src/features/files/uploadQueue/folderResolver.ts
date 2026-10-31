// CLAUDE.md §7.4: crea (o reutiliza) las carpetas de destino de una subida de
// carpeta. Lógica sin React ni axios — las peticiones se inyectan — para poder
// testearla directamente (§9). Las peticiones reales (con el rate limit) las
// monta `UploadQueueContext`.
//
// Por qué existe, verificado contra el backend (octubre 2026): `POST /folders` no
// valida unicidad (`FoldersService.CreateFolderAsync` crea otra carpeta con el
// mismo nombre sin comprobar nada) y no hay ningún endpoint para crear un árbol de
// una vez. Sin esta capa, subir "Fotos" dos veces (o reintentar tras un fallo
// parcial) crearía dos carpetas "Fotos" y repartiría los archivos entre ambas.

export type FolderRequests = {
  /** Subcarpetas directas de `parentId` (`null` = raíz). */
  listSubfolders: (parentId: number | null) => Promise<Array<{ id: number; name: string }>>
  /** Crea `name` dentro de `parentId` (`null` = raíz) y devuelve su id. */
  createFolder: (name: string, parentId: number | null) => Promise<number>
}

type Children = Map<string, number>

function parentKey(parentId: number | null): string {
  return String(parentId)
}

// JSON y no una concatenación con "/": así ningún nombre puede colisionar con otro.
function folderKey(parentId: number | null, name: string): string {
  return JSON.stringify([parentId, name])
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

/**
 * Espera a `promise` pero se suelta si `signal` se aborta, SIN cancelar la
 * promesa en sí. El trabajo de crear una carpeta lo comparten todos los archivos
 * que la necesitan: cancelar uno de ellos no puede romper la espera de los demás.
 */
function raceWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

export class FolderResolver {
  private readonly requests: FolderRequests
  private readonly onFolderCreated?: (parentId: number | null) => void

  // Contenido (nombre -> id) de las carpetas que ya se han consultado o creado.
  private readonly childrenByParent = new Map<string, Promise<Children>>()
  // "Esta carpeta ya existe y su id es este", por (padre, nombre).
  private readonly ensured = new Map<string, Promise<number>>()

  // Sin parameter properties: el tsconfig activa `erasableSyntaxOnly`.
  constructor(requests: FolderRequests, onFolderCreated?: (parentId: number | null) => void) {
    this.requests = requests
    this.onFolderCreated = onFolderCreated
  }

  /**
   * Id de la carpeta `path` (nombres de fuera adentro) dentro de `baseFolderId`,
   * creando las que falten y reutilizando las que ya existen con ese nombre
   * exacto. Con `path` vacío devuelve `baseFolderId`.
   *
   * Es seguro llamarla a la vez desde varios archivos: cada carpeta se crea una
   * sola vez. Un fallo no se memoiza — el siguiente intento vuelve a probar.
   * `signal` solo suelta a quien llama; el trabajo compartido sigue su curso.
   */
  async resolve(
    baseFolderId: number | null,
    path: readonly string[],
    signal: AbortSignal,
  ): Promise<number | null> {
    let current = baseFolderId
    for (const name of path) {
      // Antes de arrancar cada tramo, no dentro de él: un archivo ya cancelado no
      // debe provocar peticiones nuevas.
      if (signal.aborted) throw abortError()
      current = await raceWithAbort(this.ensureChild(current, name), signal)
    }
    return current
  }

  /**
   * Olvida todo lo aprendido. Hay que llamarlo cuando la cola queda inactiva (lo
   * que se recordó puede haber cambiado: el usuario borra o crea carpetas) y
   * cuando un destino resulta no existir (`FolderNotFound`).
   */
  clear(): void {
    this.childrenByParent.clear()
    this.ensured.clear()
  }

  private ensureChild(parentId: number | null, name: string): Promise<number> {
    const key = folderKey(parentId, name)
    const cached = this.ensured.get(key)
    if (cached) return cached

    const pending = this.findOrCreate(parentId, name)
    this.ensured.set(key, pending)
    // Un fallo no se queda en memoria; se comprueba la identidad por si un
    // `clear()` + otra llamada ya dejó ahí una promesa nueva.
    pending.catch(() => {
      if (this.ensured.get(key) === pending) this.ensured.delete(key)
    })
    return pending
  }

  private async findOrCreate(parentId: number | null, name: string): Promise<number> {
    const children = await this.children(parentId)
    const existing = children.get(name)
    if (existing !== undefined) return existing

    const id = await this.requests.createFolder(name, parentId)
    children.set(name, id)
    // Recién creada, se sabe vacía: no hace falta preguntar al servidor por su contenido.
    this.childrenByParent.set(parentKey(id), Promise.resolve(new Map()))
    this.onFolderCreated?.(parentId)
    return id
  }

  private children(parentId: number | null): Promise<Children> {
    const key = parentKey(parentId)
    const cached = this.childrenByParent.get(key)
    if (cached) return cached

    const pending = this.requests.listSubfolders(parentId).then((folders) => {
      // El backend permite nombres repetidos: se usa siempre la más antigua (menor
      // id), así la elección no depende del orden en que responda.
      const byName: Children = new Map()
      for (const folder of [...folders].sort((a, b) => a.id - b.id)) {
        if (!byName.has(folder.name)) byName.set(folder.name, folder.id)
      }
      return byName
    })
    this.childrenByParent.set(key, pending)
    pending.catch(() => {
      if (this.childrenByParent.get(key) === pending) this.childrenByParent.delete(key)
    })
    return pending
  }
}
