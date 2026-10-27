import { Plus, Users, ArrowRight, ArrowUpRightFromSquare } from 'lucide-react'
import { WalletButton }   from '@/components/WalletButton'
import { useAccount }     from 'wagmi'
import { useGroupCount, useGetSplit } from '@/hooks/useSplitContract'
import { formatUsdcFixed, shortAddress, bpToPercent } from '@/lib/utils'
import { SPLIT_PAY_ADDRESS } from '@/lib/constants'
import type { View } from '@/App'

interface GroupsPageProps {
  onNavigate: (v: View) => void
  onPayGroup: (groupId: number) => void
}

export function GroupsPage({ onNavigate, onPayGroup }: GroupsPageProps) {
  const { isConnected } = useAccount()
  const { data: groupCount, isLoading } = useGroupCount()
  const count = groupCount !== undefined ? Number(groupCount) : undefined

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 flex flex-col items-center gap-4 text-center animate-fade-in-up">
        <div
          className="size-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Users className="size-6" style={{ color: 'var(--subtle)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--ink)' }}>
            Connect to manage groups
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Saved recipient groups live in your wallet session.
          </p>
        </div>
        <WalletButton variant="compact" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-4 animate-fade-in-up" style={{ paddingTop: 16 }}>

      {/* Title row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-base font-bold" style={{ color: 'var(--ink)' }}>Groups</h1>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Saved recipient groups for split payments
          </p>
        </div>
        <button
          onClick={() => onNavigate('create-group')}
          disabled={!SPLIT_PAY_ADDRESS}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          <Plus className="size-3.5" />
          New group
        </button>
      </div>

      {/* Contract pending — single compact row */}
      {!SPLIT_PAY_ADDRESS && (
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 mb-4 text-xs"
          style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-border)' }}
        >
          <span className="size-1.5 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
          <span style={{ color: 'var(--warning)' }}>
            <span className="font-semibold">Contract pending.</span> Groups activate after deployment.
          </span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map(i => (
            <div
              key={i}
              className="rounded-2xl animate-pulse"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 80 }}
            />
          ))}
        </div>
      ) : count === 0 ? (
        <EmptyState onNavigate={onNavigate} />
      ) : count !== undefined ? (
        <div className="space-y-3">
          {Array.from({ length: count }, (_, i) => i + 1).map(id => (
            <GroupRow key={id} groupId={id} onPay={() => onPayGroup(id)} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* ── Group row ─────────────────────────────────────────────── */

function GroupRow({ groupId, onPay }: { groupId: number; onPay: () => void }) {
  const { data, isLoading } = useGetSplit(groupId)

  if (isLoading || !data) {
    return (
      <div
        className="rounded-2xl animate-pulse"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 80 }}
      />
    )
  }

  const recipients   = data[0]
  const shares       = data[1]
  const paymentCount = Number(data[2])
  const totalPaid    = data[3]
  const shareSummary = shares.slice(0, 3).map(s => bpToPercent(s)).join(' · ')

  return (
    <div
      className="rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Icon */}
        <div
          className="size-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
        >
          <ArrowUpRightFromSquare className="size-4" style={{ color: 'var(--accent)' }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
            Group {groupId}
          </p>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} / {shareSummary}
            {shares.length > 3 ? '…' : ''}
          </p>
        </div>

        {/* Pay button */}
        <button
          onClick={onPay}
          disabled={!SPLIT_PAY_ADDRESS}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold shrink-0 transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Pay <ArrowRight className="size-3.5" />
        </button>
      </div>

      {/* Stats strip */}
      <div
        className="flex items-center gap-5 px-4 py-2.5"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        <Stat label="Payments"   value={String(paymentCount)} />
        <Stat label="Total paid" value={totalPaid > 0n ? `${formatUsdcFixed(totalPaid)} USDC` : '0'} />
        <div className="flex flex-wrap gap-1.5 flex-1 justify-end">
          {recipients.slice(0, 3).map(addr => (
            <span
              key={addr}
              className="mono text-[9px] rounded-md px-1.5 py-0.5"
              style={{ background: 'var(--surface-3)', color: 'var(--subtle)', border: '1px solid var(--border-2)' }}
            >
              {shortAddress(addr)}
            </span>
          ))}
          {recipients.length > 3 && (
            <span
              className="text-[9px] rounded-md px-1.5 py-0.5"
              style={{ background: 'var(--surface-3)', color: 'var(--subtle)', border: '1px solid var(--border-2)' }}
            >
              +{recipients.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--subtle)' }}>{label}</p>
      <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--ink-2)' }}>{value}</p>
    </div>
  )
}

function EmptyState({ onNavigate }: { onNavigate: (v: View) => void }) {
  return (
    <div className="py-12 flex flex-col items-center gap-4 text-center animate-fade-in-up">
      <div
        className="size-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <Users className="size-6" style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <p className="text-base font-bold mb-1" style={{ color: 'var(--ink)' }}>No groups yet</p>
        <p className="text-xs leading-relaxed max-w-[240px]" style={{ color: 'var(--muted)' }}>
          Create a recipient group to split one USDC payment across multiple people by percentage.
        </p>
      </div>
      <button
        onClick={() => onNavigate('create-group')}
        disabled={!SPLIT_PAY_ADDRESS}
        className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent)' }}
      >
        <Plus className="size-4" />
        Create first group
      </button>
    </div>
  )
}
