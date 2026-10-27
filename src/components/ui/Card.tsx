import { type ReactNode, type HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children:  ReactNode
  glass?:    boolean
  padding?:  'sm' | 'md' | 'lg'
}

export function Card({
  children,
  glass = false,
  padding = 'md',
  className = '',
  style,
  ...rest
}: CardProps) {
  const padClass = { sm: 'p-4', md: 'p-5', lg: 'p-6' }[padding]
  return (
    <div
      {...rest}
      className={[padClass, 'rounded-2xl', className].join(' ')}
      style={{
        background: glass ? 'rgba(255,255,255,0.06)' : 'var(--surface)',
        border: '1px solid var(--border)',
        ...(glass ? {
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
