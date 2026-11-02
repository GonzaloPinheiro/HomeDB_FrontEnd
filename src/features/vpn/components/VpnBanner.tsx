import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

// Aviso de tono Warning (§6.7) sobre la lista: datos desactualizados o revocación atascada.
export function VpnBanner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-border bg-warning-bg px-4 py-3.5 text-warning-text"
    >
      <TriangleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        <p className="mt-[3px] text-[13px] leading-snug">{children}</p>
      </div>
    </div>
  )
}
