import { type ReactNode, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  children:  ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  style,
  ...rest
}: ButtonProps) {

  const base = 'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-40'

  const variants: Record<Variant, { className: string; style: React.CSSProperties }> = {
    primary:   { className: 'text-white hover:opacity-90 active:scale-[0.98]', style: { background: 'var(--accent)' } },
    secondary: { className: 'hover:opacity-90 active:scale-[0.98]', style: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' } },
    ghost:     { className: 'hover:opacity-70 active:scale-[0.98]', style: { background: 'transparent', color: 'var(--muted)' } },
    danger:    { className: 'text-white hover:opacity-90 active:scale-[0.98]', style: { background: 'var(--danger)' } },
  }

  const sizes: Record<Size, string> = {
    sm: 'h-9 px-4 text-sm rounded-xl',
    md: 'h-11 px-5 text-sm rounded-xl',
    lg: 'h-13 px-6 text-base rounded-xl',
  }

  const v = variants[variant]

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{ ...v.style, fontFamily: "'DM Sans', sans-serif", ...style }}
      className={[base, v.className, sizes[size], fullWidth ? 'w-full' : '', className].join(' ')}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}
