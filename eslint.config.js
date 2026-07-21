import { defineConfig, globalIgnores } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Base: typescript-eslint recommended (incluye el parser y las reglas TS) +
// reglas de hooks de React. No se extiende @eslint/js porque pnpm >=10 no
// hoistea dependencias transitivas y no es una dependencia directa aprobada.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended, reactHooks.configs.flat.recommended],
  },
])
