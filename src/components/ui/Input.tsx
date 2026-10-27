import { type InputHTMLAttributes, type ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:  string
  hint?:   string
  error?:  string
  right?:  ReactNode
}

export function Input({ label, hint, error, right, className = '', ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--subtle)', letterSpacing: '0.09em' }}>
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          {...rest}
          className={['w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-colors', right ? 'pr-12' : '', className].join(' ')}
          style={{
            background: 'var(--surface)',
            border: `1.5px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            color: 'var(--ink)',
            fontFamily: "'DM Sans', sans-serif",
            ...(rest.style ?? {}),
          }}
        />
        {right && (
          <div className="absolute right-3 flex items-center" style={{ color: 'var(--subtle)' }}>
            {right}
          </div>
        )}
      </div>
      {error  && <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>{error}</p>}
      {!error && hint && <p className="text-xs" style={{ color: 'var(--subtle)' }}>{hint}</p>}
    </div>
  )
}
