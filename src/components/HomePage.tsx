/**
 * HomePage — wallet dashboard.
 *
 * Disconnected: full-screen hero with feature list and connect button.
 * Connected: balance, action buttons, USDC asset row, groups link, recent activity.
 */
import {
  ArrowUpRight, ArrowDownLeft, RefreshCw, Split,
  ChevronRight, Eye, EyeOff,
  Clock, Plus, Zap, Shield,
  ArrowUpRightFromSquare,
} from 'lucide-react'
import { useAccount }     from 'wagmi'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { useActivity }    from '@/hooks/useActivity'
import { useGroupCount }  from '@/hooks/useSplitContract'
import { usePreferences } from '@/hooks/usePreferences'
import { WalletButton }   from '@/components/WalletButton'
import { shortAddress, txUrl, formatTimestamp } from '@/lib/utils'
import { SPLIT_PAY_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/lib/constants'
import type { View } from '@/App'

interface HomePageProps { onNavigate: (v: View) => void }

export function HomePage({ onNavigate }: HomePageProps) {
  const { address, isConnected, chainId } = useAccount()
  const { formatted, raw, isLoading }     = useUsdcBalance()
  const { entries }                       = useActivity()
  const { data: groupCount }              = useGroupCount()
  const { prefs, update }                 = usePreferences()

  const onArc       = chainId === ACTIVE_CHAIN_ID
  const recent      = entries.slice(0, 4)
  const groupCountN = groupCount !== undefined ? Number(groupCount) : 0

  /* Disconnected */
  if (!isConnected) {
    return (
      <div
        className="flex flex-col items-center justify-center px-5 text-center animate-fade-in-up"
        style={{ minHeight: 'calc(100dvh - 52px)', paddingBottom: 72 }}
      >
        <h1 className="text-[26px] font-bold mb-2 tracking-tight" style={{ color: 'var(--ink)' }}>
          USDC Payments on Arc
        </h1>
        <p className="text-[14px] leading-relaxed mb-8 max-w-[260px]" style={{ color: 'var(--muted)' }}>
          Send USDC to any address or split one payment across a group. Non-custodial.
        </p>

        <div
          className="flex flex-col w-full max-w-[340px] mb-8 overflow-hidden rounded-2xl"
          style={{ background: 'var(--border)' }}
        >
          {[
            { Icon: Zap,    title: 'Instant payments',        desc: 'Sub-second finality on Arc'            },
            { Icon: Split,  title: 'Programmable split pay',  desc: 'Distribute across up to 20 recipients' },
            { Icon: Shield, title: 'Non-custodial',           desc: 'Your keys. Direct payer to recipient.' },
          ].map(({ Icon, title, desc }, idx, arr) => (
            <div
              key={title}
              className="flex items-center gap-3 px-4 py-[14px]"
              style={{
                background:   'var(--surface)',
                borderBottom: idx < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div
                className="flex items-center justify-center rounded-xl shrink-0"
                style={{ width: 36, height: 36, background: 'var(--surface-3)' }}
              >
                <Icon className="size-4" style={{ color: 'var(--accent)', strokeWidth: 2 }} />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <WalletButton variant="primary" />

        <p className="text-[11px] mt-4" style={{ color: 'var(--subtle)' }}>
          {NETWORK_LABEL} / USDC / Non-custodial
        </p>
      </div>
    )
  }

  /* Connected */
  return (
    <div className="w-full max-w-md mx-auto animate-fade-in-up">

      {/* Balance section */}
      <div className="px-4 pt-5 pb-4">

        {/* Address + network row */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="size-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ background: `hsl(${address ? (parseInt(address.slice(2,6),16)%360) : 270},65%,55%)` }}
          >
            {address?.slice(2,4).toUpperCase()}
          </div>
          <span className="mono text-[12px]" style={{ color: 'var(--muted)' }}>
            {shortAddress(address ?? '', 5)}
          </span>
          {onArc ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--success)' }}>
              <span
                className="size-[5px] rounded-full shrink-0 pulse-dot"
                style={{ background: 'var(--success)' }}
              />
              {NETWORK_LABEL}
            </span>
          ) : (
            <span className="text-[10px] font-semibold" style={{ color: 'var(--danger)' }}>
              Wrong network
            </span>
          )}
        </div>

        {/* Balance label + number + eye toggle on same row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-medium" style={{ color: 'var(--subtle)' }}>
              USDC Balance
            </span>
            <p
              className="font-bold tabular-nums leading-none mt-[3px] truncate"
              style={{ fontSize: 42, letterSpacing: '-0.03em', color: 'var(--ink)' }}
            >
              {prefs.hideBalance
                ? <span style={{ fontSize: 32, letterSpacing: '0.1em' }}>••••••</span>
                : isLoading
                  ? <span style={{ color: 'var(--subtle)', fontSize: 36 }}>...</span>
                  : formatted
              }
            </p>
            {raw !== undefined && !prefs.hideBalance && (
              <p className="text-[13px] mt-[2px]" style={{ color: 'var(--muted)' }}>
                {formatted} USDC / {NETWORK_LABEL}
              </p>
            )}
          </div>

          {/* Eye toggle — fixed to top-right of balance block */}
          <button
            onClick={() => update({ hideBalance: !prefs.hideBalance })}
            className="flex items-center justify-center rounded-full shrink-0 mt-[18px]"
            style={{
              width:      34,
              height:     34,
              background: 'var(--surface-2)',
              border:     '1px solid var(--border)',
              color:      'var(--muted)',
            }}
            aria-label={prefs.hideBalance ? 'Show balance' : 'Hide balance'}
          >
            {prefs.hideBalance
              ? <EyeOff className="size-[15px]" strokeWidth={2} />
              : <Eye    className="size-[15px]" strokeWidth={2} />
            }
          </button>
        </div>
      </div>

      {/* Setup pending notice */}
      {!SPLIT_PAY_ADDRESS && (
        <div
          className="mx-4 flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3 text-[12px]"
          style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-border)' }}
        >
          <span
            className="size-1.5 rounded-full shrink-0 pulse-dot"
            style={{ background: 'var(--warning)' }}
          />
          <span style={{ color: 'var(--warning)' }}>
            <strong>Wallet setup pending.</strong> Payments activate after contract deployment.
          </span>
        </div>
      )}

      {/* Action buttons (MetaMask style grid) */}
      <div
        className="mx-4 flex rounded-2xl overflow-hidden mb-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <button
          className="wallet-action"
          onClick={() => onNavigate('send')}
          disabled={!SPLIT_PAY_ADDRESS}
          title={!SPLIT_PAY_ADDRESS ? 'Contract not deployed yet' : 'Send USDC'}
        >
          <div className="wallet-action-icon">
            <ArrowUpRight className="size-5" style={{ color: 'var(--action-icon)' }} strokeWidth={2} />
          </div>
          <span className="wallet-action-label">Send</span>
        </button>

        <button
          className="wallet-action"
          onClick={() => onNavigate('receive')}
        >
          <div className="wallet-action-icon">
            <ArrowDownLeft className="size-5" style={{ color: 'var(--action-icon)' }} strokeWidth={2} />
          </div>
          <span className="wallet-action-label">Receive</span>
        </button>

        <button
          className="wallet-action"
          onClick={() => onNavigate('groups')}
          disabled={!SPLIT_PAY_ADDRESS}
          title={!SPLIT_PAY_ADDRESS ? 'Contract not deployed yet' : 'Split payment'}
        >
          <div className="wallet-action-icon">
            <Split className="size-5" style={{ color: 'var(--action-icon)' }} strokeWidth={2} />
          </div>
          <span className="wallet-action-label">Split</span>
        </button>

        <button
          className="wallet-action"
          disabled
          title="Swap is not available on this network"
        >
          <div className="wallet-action-icon">
            <RefreshCw className="size-5" style={{ color: 'var(--action-icon)' }} strokeWidth={2} />
          </div>
          <span className="wallet-action-label">Swap</span>
        </button>
      </div>

      {/* Tokens */}
      <div className="mx-4 mb-4">
        <p className="section-label px-1 mb-2">Tokens</p>
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <div className="token-row px-4">
            <div
              className="token-logo shrink-0 text-[16px] font-black text-white"
              style={{ background: '#2775CA' }}
            >
              $
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>USDC</p>
              <p className="text-[12px]" style={{ color: 'var(--muted)' }}>{NETWORK_LABEL}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                {prefs.hideBalance ? '••••' : isLoading ? '...' : formatted}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>USDC</p>
            </div>
          </div>
        </div>
      </div>

      {/* Groups quick link */}
      <div className="mx-4 mb-4">
        <div
          className="flex items-center justify-between rounded-2xl px-4 py-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
            >
              <Plus className="size-4" style={{ color: 'var(--accent)' }} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Recipient groups</p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {groupCountN === 0
                  ? 'No groups yet'
                  : `${groupCountN} group${groupCountN === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('groups')}
            disabled={groupCountN === 0 && !SPLIT_PAY_ADDRESS}
            title={groupCountN === 0 && !SPLIT_PAY_ADDRESS ? 'Contract deployment required' : undefined}
            className="flex items-center gap-1 text-[12px] font-semibold rounded-full px-3 py-1.5 transition-opacity hover:opacity-75 disabled:opacity-40"
            style={{ background: 'var(--surface-3)', color: 'var(--ink-2)' }}
          >
            {groupCountN === 0 ? 'Create' : 'View'}
            <ChevronRight className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="mx-4 mb-4">
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="section-label">Recent</p>
          {recent.length > 0 && (
            <button
              onClick={() => onNavigate('activity')}
              className="text-[11px] font-semibold"
              style={{ color: 'var(--accent-text)' }}
            >
              See all
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-2xl py-8 text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <Clock className="size-5" style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No transactions yet</p>
            {SPLIT_PAY_ADDRESS && (
              <button
                onClick={() => onNavigate('send')}
                className="text-[12px] font-semibold"
                style={{ color: 'var(--accent-text)' }}
              >
                Make your first payment
              </button>
            )}
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {recent.map((entry, i) => {
              const KindIcon = entry.kind === 'single-payment' ? ArrowUpRight
                             : entry.kind === 'split-payment'  ? Split
                             : Plus
              const color = entry.kind === 'single-payment' ? 'var(--accent)'
                          : entry.kind === 'split-payment'  ? 'var(--success)'
                          : 'var(--warning)'
              const label = entry.kind === 'single-payment' ? 'Sent'
                          : entry.kind === 'split-payment'  ? 'Split'
                          : 'Group created'
              return (
                <div
                  key={entry.txHash}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < recent.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{ width: 36, height: 36, background: 'var(--surface-2)' }}
                  >
                    <KindIcon className="size-4" style={{ color }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{label}</p>
                    <p className="mono text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                      {entry.txHash.slice(0,10)}...
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {entry.amount && (
                      <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                        {entry.amount} USDC
                      </p>
                    )}
                    <p className="text-[11px]" style={{ color: 'var(--subtle)' }}>
                      {formatTimestamp(entry.timestamp)}
                    </p>
                  </div>
                  <a
                    href={txUrl(entry.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 transition-opacity hover:opacity-60"
                    style={{ color: 'var(--subtle)' }}
                    aria-label="View on explorer"
                  >
                    <ArrowUpRightFromSquare className="size-3.5" strokeWidth={2} />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
