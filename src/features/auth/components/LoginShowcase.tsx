import { Database } from 'lucide-react'

// Sombras duras del diseño 2b ("archivo apilado"): desplazadas y sin difuminado,
// derivadas de --text-primary para que funcionen igual en claro y en oscuro
// (CLAUDE.md §6.1). Clases literales: Tailwind no detecta las construidas dinámicamente.
const SHADOW_DOCS = 'shadow-[8px_8px_0_color-mix(in_srgb,var(--text-primary)_8%,transparent)]'
const SHADOW_PORTFOLIO =
  'shadow-[10px_12px_0_color-mix(in_srgb,var(--text-primary)_9%,transparent)]'
const SHADOW_EXPENSES = 'shadow-[8px_10px_0_color-mix(in_srgb,var(--text-primary)_7%,transparent)]'
const SHADOW_BACKUP = 'shadow-[6px_8px_0_color-mix(in_srgb,var(--text-primary)_16%,transparent)]'

// Variante del acento a media intensidad, para barras secundarias (el modificador
// de opacidad de Tailwind no funciona con colores definidos como var() sin canal alfa)
const ACCENT_SOFT = 'bg-[color-mix(in_srgb,var(--accent)_60%,transparent)]'

// Alturas (%) y si la barra va resaltada en acento del minigráfico de "Cartera"
const PORTFOLIO_BARS: ReadonlyArray<{ height: number; tone: 'base' | 'soft' | 'accent' }> = [
  { height: 38, tone: 'base' },
  { height: 52, tone: 'base' },
  { height: 44, tone: 'base' },
  { height: 68, tone: 'soft' },
  { height: 60, tone: 'base' },
  { height: 82, tone: 'accent' },
  { height: 100, tone: 'accent' },
]

const BAR_TONE: Record<'base' | 'soft' | 'accent', string> = {
  base: 'bg-border',
  soft: ACCENT_SOFT,
  accent: 'bg-accent',
}

// Panel izquierdo del login (diseño 2b, "archivo apilado"): tarjetas de datos en
// abanico con sombra dura. Es puramente decorativo — las cifras (documentos, cartera,
// gastos, backup) son ilustrativas, NO datos reales — por eso va oculto a los
// lectores de pantalla. Solo se muestra en pantallas anchas (xl+); por debajo, el
// login queda a una columna (CLAUDE.md §10).
export function LoginShowcase() {
  return (
    <aside
      aria-hidden
      className="relative hidden min-w-0 flex-1 overflow-hidden bg-surface-alt px-11 py-10 xl:flex"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 4.5%, transparent) 0 1px, transparent 1px 9px)',
        }}
      />

      {/* Contenido centrado con ancho máximo (el de la maqueta, 512px): el panel ocupa todo el espacio sobrante a la izquierda del login */}
      <div className="relative mx-auto flex w-full max-w-[512px] flex-col gap-[26px]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-text-on-accent">
            <Database className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-text-primary">HomeDB</span>
        </div>

        <div>
          <h1 className="max-w-[420px] text-[38px] font-bold leading-[1.1] tracking-[-1px] text-text-primary">
            Todo lo de casa,
            <br />
            en un solo sitio.
          </h1>
          <p className="mt-3.5 max-w-[400px] text-[15px] leading-[1.55] text-text-secondary">
            Documentos, gastos e inversiones bajo el mismo techo y el mismo disco duro.
          </p>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            className={`absolute left-9 top-[30px] w-[300px] rotate-[-4deg] rounded-xl border border-border bg-bg px-[18px] py-4 ${SHADOW_DOCS}`}
          >
            <div className="flex items-center justify-between gap-3 text-xs text-text-secondary">
              Documentos
              <span className="font-mono">2 481</span>
            </div>
            <div className="mt-3 flex flex-col gap-[7px]">
              <span className="h-2 rounded bg-border" />
              <span className="h-2 w-[76%] rounded bg-border" />
              <span className="h-2 w-[52%] rounded bg-border" />
            </div>
          </div>

          <div
            className={`absolute left-[150px] top-[104px] w-[316px] rotate-[2.5deg] rounded-xl border border-border bg-card px-5 py-[18px] ${SHADOW_PORTFOLIO}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary">Cartera</span>
              <span className="font-mono text-xs text-positive-text">+4,8 %</span>
            </div>
            <div className="mt-2 font-mono text-2xl tracking-[-0.5px] text-text-primary">
              48 210 €
            </div>
            <div className="mt-3.5 flex h-[46px] items-end gap-[5px]">
              {PORTFOLIO_BARS.map((bar, index) => (
                <span
                  key={index}
                  className={`flex-1 rounded-t-[3px] ${BAR_TONE[bar.tone]}`}
                  style={{ height: `${bar.height}%` }}
                />
              ))}
            </div>
          </div>

          <div
            className={`absolute left-[62px] top-[268px] w-[282px] rotate-[-1.5deg] rounded-xl border border-border bg-bg px-[18px] py-4 ${SHADOW_EXPENSES}`}
          >
            <div className="text-xs text-text-secondary">Gastos de septiembre</div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="font-mono text-xl text-text-primary">1 240 €</span>
              <span className="text-xs text-text-muted">de 1 500 €</span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded bg-border">
              <span className={`block h-full w-[82%] ${ACCENT_SOFT}`} />
            </div>
          </div>

          <div
            className={`absolute bottom-[46px] right-[26px] rotate-3 rounded-[10px] bg-text-primary px-4 py-[13px] text-bg ${SHADOW_BACKUP}`}
          >
            <div className="font-mono text-[11px] tracking-[1px] opacity-50">BACKUP</div>
            <div className="mt-1 font-mono text-sm">hoy 03:15 ✓</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
