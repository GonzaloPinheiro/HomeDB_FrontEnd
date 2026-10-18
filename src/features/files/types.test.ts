import { describe, expect, it } from 'vitest'

import { uploadCompleteResponseSchema, uploadStatusResponseSchema } from './types'

// Forma real del wire (UploadStatusResponseDto): `status` llega como número
// porque el backend no registra JsonStringEnumConverter.
const WIRE_STATUS = {
  sessionId: '3f2c1d3e-0000-0000-0000-000000000001',
  totalChunks: 2,
  receivedChunks: [1, 2],
  status: 4,
  file: null,
  errorCode: null,
}

describe('uploadStatusResponseSchema', () => {
  it.each([
    [1, 'inProgress'],
    [2, 'completed'],
    [3, 'cancelled'],
    [4, 'processing'],
  ] as const)('status %i -> %s', (wire, expected) => {
    expect(uploadStatusResponseSchema.parse({ ...WIRE_STATUS, status: wire }).status).toBe(expected)
  })

  it('acepta el nombre del estado como string por tolerancia', () => {
    expect(uploadStatusResponseSchema.parse({ ...WIRE_STATUS, status: 'Completed' }).status).toBe('completed')
  })

  it('rechaza un estado que el front no conoce', () => {
    expect(uploadStatusResponseSchema.safeParse({ ...WIRE_STATUS, status: 9 }).success).toBe(false)
  })

  it('una sesión completada trae el archivo creado', () => {
    const parsed = uploadStatusResponseSchema.parse({
      ...WIRE_STATUS,
      status: 2,
      file: {
        id: 12,
        fileName: 'a.png',
        sizeBytes: 10,
        contentType: 'image/png',
        folderId: null,
        ownerId: 1,
        uploadedAt: '2026-10-18T17:00:00Z',
      },
    })
    expect(parsed.file?.id).toBe(12)
  })

  it('una sesión cancelada por fallo de ensamblado trae el código de error', () => {
    const parsed = uploadStatusResponseSchema.parse({ ...WIRE_STATUS, status: 3, errorCode: 1027 })
    expect(parsed.status).toBe('cancelled')
    expect(parsed.errorCode).toBe(1027)
  })

  it('exige los campos nuevos: un backend sin la cola en background no valida', () => {
    const legacy = { sessionId: WIRE_STATUS.sessionId, totalChunks: 2, receivedChunks: [1, 2] }
    expect(uploadStatusResponseSchema.safeParse(legacy).success).toBe(false)
  })
})

describe('uploadCompleteResponseSchema', () => {
  it('`complete` responde 202 con un mensaje, no con el archivo', () => {
    expect(uploadCompleteResponseSchema.parse('La subida se está procesando.')).toBe('La subida se está procesando.')
  })
})
