import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

type CopyButtonProps = {
  value: string
  className?: string
}

// CLAUDE.md §11/§6.8: feedback de "Copiado" al usar el botón de copiar del
// detalle de logs — micro-feedback en el propio botón, 1.5s, sin toast.
export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('gap-1.5', className)}
      onClick={() => void handleCopy()}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  )
}
