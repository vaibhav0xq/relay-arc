import { Check, Loader2 } from 'lucide-react'

export type TxStep = 'idle' | 'approving' | 'awaiting-approval' | 'paying' | 'success' | 'error'

const STEPS = [
  { label: 'Approve USDC', sub: 'Exact amount' },
  { label: 'Send Payment', sub: 'Confirm tx' },
]

function stepIndex(step: TxStep): number {
  if (step === 'idle') return -1
  if (step === 'approving' || step === 'awaiting-approval') return 0
  return 1
}

export function StepIndicator({ step }: { step: TxStep }) {
  const active = stepIndex(step)
  return (
    <div className="flex items-center w-full gap-0">
      {STEPS.map((s, i) => {
        const done    = active > i || step === 'success'
        const current = active === i
        const spinning = current && (step === 'approving' || step === 'awaiting-approval' || step === 'paying')
        return (
          <div key={s.label} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className="size-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background: done    ? 'var(--success-dim)'
                            : current ? 'var(--accent-dim)'
                            : 'var(--surface)',
                  border: done    ? '1.5px solid var(--success-border)'
                        : current ? '1.5px solid var(--accent-border)'
                        : '1.5px solid var(--border)',
                  color: done ? 'var(--success)' : current ? 'var(--accent)' : 'var(--subtle)',
                }}
              >
                {done    ? <Check className="size-4" />
                 : spinning ? <Loader2 className="size-4 animate-spin" />
                 : <span>{i + 1}</span>}
              </div>
              <p className="mt-1.5 text-xs font-semibold text-center"
                style={{ color: current ? 'var(--ink)' : done ? 'var(--success)' : 'var(--subtle)' }}>
                {s.label}
              </p>
              <p className="text-[10px] text-center" style={{ color: 'var(--subtle)' }}>{s.sub}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 mx-2 rounded-full transition-all"
                style={{ background: active > i ? 'var(--success-border)' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
