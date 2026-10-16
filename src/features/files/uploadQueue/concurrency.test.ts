import { describe, expect, it } from 'vitest'

import { AsyncSemaphore, runWithConcurrency } from './concurrency'

/** Cede el turno al bucle de eventos, para dejar que otras tareas avancen. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Promesa resoluble desde fuera, para controlar cuándo termina una "petición" simulada. */
function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('AsyncSemaphore', () => {
  it('concede huecos hasta su capacidad y encola el resto', async () => {
    const semaphore = new AsyncSemaphore(2)
    const signal = new AbortController().signal
    await semaphore.acquire(signal)
    await semaphore.acquire(signal)

    let thirdGranted = false
    void semaphore.acquire(signal).then(() => {
      thirdGranted = true
    })
    await tick()
    expect(thirdGranted).toBe(false)
  })

  it('al liberar, el hueco pasa al siguiente en orden FIFO', async () => {
    const semaphore = new AsyncSemaphore(1)
    const signal = new AbortController().signal
    const releaseFirst = await semaphore.acquire(signal)

    const order: string[] = []
    const second = semaphore.acquire(signal).then((release) => {
      order.push('segundo')
      return release
    })
    const third = semaphore.acquire(signal).then((release) => {
      order.push('tercero')
      return release
    })

    releaseFirst()
    ;(await second)()
    ;(await third)()
    expect(order).toEqual(['segundo', 'tercero'])
  })

  it('liberar dos veces el mismo hueco no regala capacidad extra', async () => {
    const semaphore = new AsyncSemaphore(1)
    const signal = new AbortController().signal
    const release = await semaphore.acquire(signal)
    release()
    release()

    await semaphore.acquire(signal) // toma el único hueco
    let secondGranted = false
    void semaphore.acquire(signal).then(() => {
      secondGranted = true
    })
    await tick()
    expect(secondGranted).toBe(false)
  })

  it('un acquire abortado mientras espera rechaza y no consume el hueco que se libere después', async () => {
    const semaphore = new AsyncSemaphore(1)
    const holder = new AbortController()
    const releaseHolder = await semaphore.acquire(holder.signal)

    const waiting = new AbortController()
    const waitingAcquire = semaphore.acquire(waiting.signal)
    waiting.abort()
    await expect(waitingAcquire).rejects.toMatchObject({ name: 'AbortError' })

    releaseHolder()
    // El hueco debe seguir disponible para un tercero, no haberse perdido con el abortado.
    const release = await semaphore.acquire(new AbortController().signal)
    expect(typeof release).toBe('function')
  })

  it('rechaza de inmediato si el signal ya viene abortado', async () => {
    const semaphore = new AsyncSemaphore(1)
    const controller = new AbortController()
    controller.abort()
    await expect(semaphore.acquire(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('una capacidad inválida se sube a 1 en vez de bloquear todo para siempre', async () => {
    const semaphore = new AsyncSemaphore(0)
    const release = await semaphore.acquire(new AbortController().signal)
    expect(typeof release).toBe('function')
  })
})

describe('runWithConcurrency', () => {
  /** Tarea simulada que registra cuántas hay en vuelo a la vez y el máximo alcanzado. */
  function trackedTask() {
    const stats = { inFlight: 0, maxInFlight: 0, started: [] as number[], finished: [] as number[] }
    const task = async (item: number) => {
      stats.started.push(item)
      stats.inFlight += 1
      stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight)
      await tick()
      stats.inFlight -= 1
      stats.finished.push(item)
    }
    return { stats, task }
  }

  it('ejecuta todos los elementos', async () => {
    const { stats, task } = trackedTask()
    await runWithConcurrency([1, 2, 3, 4, 5], { concurrency: 3, semaphore: new AsyncSemaphore(10), signal: new AbortController().signal }, task)
    expect([...stats.finished].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('no supera el paralelismo del lote', async () => {
    const { stats, task } = trackedTask()
    await runWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      { concurrency: 3, semaphore: new AsyncSemaphore(10), signal: new AbortController().signal },
      task,
    )
    expect(stats.maxInFlight).toBe(3)
  })

  it('con concurrencia 1 se comporta como el bucle secuencial de antes y en orden', async () => {
    const { stats, task } = trackedTask()
    await runWithConcurrency([1, 2, 3, 4], { concurrency: 1, semaphore: new AsyncSemaphore(4), signal: new AbortController().signal }, task)
    expect(stats.maxInFlight).toBe(1)
    expect(stats.finished).toEqual([1, 2, 3, 4])
  })

  it('el semáforo global limita la suma de varios lotes a la vez', async () => {
    const stats = { inFlight: 0, maxInFlight: 0 }
    const task = async () => {
      stats.inFlight += 1
      stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight)
      await tick()
      stats.inFlight -= 1
    }
    const semaphore = new AsyncSemaphore(4)
    const signal = new AbortController().signal
    const items = Array.from({ length: 10 }, (_, i) => i)
    // Dos "archivos" con 4 workers cada uno = 8 posibles, pero el tope global es 4.
    await Promise.all([
      runWithConcurrency(items, { concurrency: 4, semaphore, signal }, task),
      runWithConcurrency(items, { concurrency: 4, semaphore, signal }, task),
    ])
    expect(stats.maxInFlight).toBe(4)
  })

  it('resuelve sin hacer nada con una lista vacía', async () => {
    await expect(
      runWithConcurrency([], { concurrency: 4, semaphore: new AsyncSemaphore(4), signal: new AbortController().signal }, async () => {
        throw new Error('no debería ejecutarse')
      }),
    ).resolves.toBeUndefined()
  })

  it('al primer fallo rechaza con ese error, aborta las tareas en vuelo y no arranca más', async () => {
    const gate = deferred()
    const started: number[] = []
    const abortedItems: number[] = []

    const run = runWithConcurrency(
      [1, 2, 3, 4, 5, 6],
      { concurrency: 3, semaphore: new AsyncSemaphore(10), signal: new AbortController().signal },
      async (item, signal) => {
        started.push(item)
        if (item === 1) {
          await gate.promise
          throw new Error('fallo del chunk 1')
        }
        // Las demás se quedan "subiendo" hasta que las aborten.
        await new Promise<void>((_, reject) =>
          signal.addEventListener('abort', () => {
            abortedItems.push(item)
            reject(new DOMException('Aborted', 'AbortError'))
          }),
        )
      },
    )

    await tick()
    gate.resolve()

    await expect(run).rejects.toThrow('fallo del chunk 1')
    expect(started).toEqual([1, 2, 3]) // nada nuevo tras el fallo
    expect(abortedItems.sort()).toEqual([2, 3])
  })

  it('el error que se propaga es el primero real, no los AbortError colaterales', async () => {
    await expect(
      runWithConcurrency(
        [1, 2],
        { concurrency: 2, semaphore: new AsyncSemaphore(2), signal: new AbortController().signal },
        async (item, signal) => {
          if (item === 1) throw new Error('real')
          await new Promise<void>((_, reject) =>
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
          )
        },
      ),
    ).rejects.toThrow('real')
  })

  it('espera a que todas las tareas terminen antes de rechazar (sin peticiones huérfanas)', async () => {
    let lateTaskFinished = false
    await expect(
      runWithConcurrency(
        [1, 2],
        { concurrency: 2, semaphore: new AsyncSemaphore(2), signal: new AbortController().signal },
        async (item, signal) => {
          if (item === 1) throw new Error('fallo')
          await new Promise<void>((resolve) => signal.addEventListener('abort', () => setTimeout(resolve, 5)))
          lateTaskFinished = true
        },
      ),
    ).rejects.toThrow('fallo')
    expect(lateTaskFinished).toBe(true)
  })

  it('la cancelación externa aborta las tareas y rechaza con AbortError', async () => {
    const external = new AbortController()
    const started: number[] = []
    const run = runWithConcurrency(
      [1, 2, 3, 4],
      { concurrency: 2, semaphore: new AsyncSemaphore(2), signal: external.signal },
      async (item, signal) => {
        started.push(item)
        await new Promise<void>((_, reject) =>
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
        )
      },
    )
    await tick()
    external.abort()

    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(started).toEqual([1, 2])
  })

  it('un archivo cancelado mientras espera hueco global no arranca ninguna tarea ni bloquea al resto', async () => {
    const semaphore = new AsyncSemaphore(1)
    const holder = new AbortController()
    const releaseHolder = await semaphore.acquire(holder.signal)

    const external = new AbortController()
    const started: number[] = []
    const run = runWithConcurrency(
      [1, 2],
      { concurrency: 2, semaphore, signal: external.signal },
      async (item) => {
        started.push(item)
      },
    )
    await tick()
    external.abort()
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(started).toEqual([])

    releaseHolder()
    // El hueco sigue libre para otro lote.
    await expect(
      runWithConcurrency([1], { concurrency: 1, semaphore, signal: new AbortController().signal }, async () => {}),
    ).resolves.toBeUndefined()
  })

  it('libera el hueco global también cuando la tarea falla', async () => {
    const semaphore = new AsyncSemaphore(1)
    await expect(
      runWithConcurrency([1], { concurrency: 1, semaphore, signal: new AbortController().signal }, async () => {
        throw new Error('fallo')
      }),
    ).rejects.toThrow('fallo')

    await expect(
      runWithConcurrency([1], { concurrency: 1, semaphore, signal: new AbortController().signal }, async () => {}),
    ).resolves.toBeUndefined()
  })
})
