import { z } from 'zod'

/**
 * Schema de Zod para un enum del backend (CLAUDE.md §5.4).
 *
 * El backend no registra ningún `JsonStringEnumConverter` (`AddControllers()`
 * sin opciones), así que sus enums llegan como NÚMERO (`UploadSessionStatus`,
 * `BackupStatus`, `BackupLevel`…). `map` traduce el valor del wire a una unión
 * de literales propia del front, para no propagar números mágicos por los
 * componentes. Acepta también el nombre como string (clave de `map`) por
 * tolerancia: si el backend añade el converter más adelante, el front no se
 * rompe. Un valor que no esté en `map` falla la validación — es la red de
 * seguridad ante un valor nuevo del backend, igual que el resto de Zod (§2).
 */
export function wireEnum<Value extends string>(map: Record<string, Value>) {
  const wireValues = Object.keys(map) as [string, ...string[]]
  return z
    .union([z.number(), z.string()])
    .transform((value) => String(value))
    .pipe(z.enum(wireValues))
    .transform((wire): Value => map[wire])
}
