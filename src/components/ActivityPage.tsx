/**
 * ActivityPage — full transaction history.
 * Primary nav tab. No back button.
 */
import { ArrowUpRight, Users, Plus, ExternalLink, Clock } from 'lucide-react'
import { useAccount }                from 'wagmi'
import { useActivity, type ActivityKind } from '@/hooks/useActivity'
import { WalletButton }              from '@/components/WalletButton'
import { txUrl, formatTimestamp }    from '@/lib/utils'

const KIND_ICON: Record<ActivityKind, typeof ArrowUpRight> = {
  'single-payment': ArrowUpRight,
  'split-payment':  Users,
  'create-group':   Plus,
}

const KIND_LABEL: Record<ActivityKind, string> = {
  'single-payment': 'Sent',
  'split-payment':  'Split payment',
  'create-group':   'Group created',
}

const KIND_COLOR: Record<ActivityKind, string> = {
  'single-payment': 'var(--accent)',
  'split-payment':  'var(--success)',
  'create-group':   'var(--warning)',
}

export function ActivityPage() {
  const { isConnected } = useAccount()
  const { entries }     = useActivity()

  if (!isConnected) {
    return (
      <div
        className="flex flex-col items-center gap-5 text-center px-4 animate-fade-in-up"
        style={{ paddingTop: 64, paddingBottom: 80 }}
      >
        <div
          className="size-16 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-2)', border: '2px solid var(--border-2)' }}
        >
          <Clock className="size-7" style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[18px] font-bold mb-1" style={{ color: 'var(--ink)' }}>Activity</p>
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            Connect a wallet to see your transaction history.
          </p>
        </div>
        <WalletButton variant="primary" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in-up" style={{ paddingBottom: 24 }}>

      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-[18px] font-bold" style={{ color: 'var(--ink)' }}>Activity</h1>
        {entries.length > 0 && (
          <p className="text-[12px] mt-[2px]" style={{ color: 'var(--muted)' }}>
            {entries.length} transaction{entries.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <div
          className="mx-4 flex flex-col items-center gap-3 rounded-2xl py-12 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Clock className="size-6" style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
          <div>
            <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              No transactions yet
            </p>
            <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
              Your payments and group activity will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="mx-4 overflow-hidden rounded-2xl"
          style={{ border: '1px solid var(--border)' }}
        >
          {entries.map((entry, i) => {
            const KindIcon = KIND_ICON[entry.kind]
            const color    = KIND_COLOR[entry.kind]
            return (
              <div
                key={`${entry.txHash}-${i}`}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background:   'var(--surface)',
                  borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 38, height: 38, background: 'var(--surface-2)' }}
                >
                  <KindIcon className="size-4" style={{ color }} strokeWidth={2} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {KIND_LABEL[entry.kind]}
                  </p>
                  {entry.amount && (
                    <p className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--muted)' }}>
                      {entry.amount} USDC
                    </p>
                  )}
                  <p className="mono text-[11px] truncate" style={{ color: 'var(--subtle)' }}>
                    {entry.txHash.slice(0, 14)}...
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-[10px]" style={{ color: 'var(--subtle)' }}>
                    {formatTimestamp(entry.timestamp)}
                  </p>
                  <a
                    href={txUrl(entry.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-opacity hover:opacity-60"
                    style={{ color: 'var(--subtle)' }}
                    aria-label="View on explorer"
                  >
                    <ExternalLink className="size-3.5" strokeWidth={2} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
