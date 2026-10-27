/**
 * AccountPage — settings, wallet info, activity history.
 * Primary nav tab; no back button.
 */
import { useState } from 'react'
import {
  Copy, ExternalLink, LogOut, Check,
  Eye, EyeOff, Sun, Moon, Activity,
  Shield, FileText, ChevronRight,
  ArrowUpRight, Users, Plus,
} from 'lucide-react'
import { useAccount, useDisconnect } from 'wagmi'
import { WalletButton }  from '@/components/WalletButton'
import { useActivity, type ActivityKind } from '@/hooks/useActivity'
import { usePreferences } from '@/hooks/usePreferences'
import { useTheme }       from '@/hooks/useTheme'
import { shortAddress, addressUrl, txUrl, formatTimestamp } from '@/lib/utils'
import { SPLIT_PAY_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/lib/constants'
import type { View } from '@/App'

interface AccountPageProps { onNavigate: (v: View) => void }

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

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-checked={on}
      role="switch"
      className={`toggle-track ${on ? 'toggle-on' : 'toggle-off'}`}
    >
      <div className="toggle-thumb" />
    </button>
  )
}

export function AccountPage({ onNavigate: _onNavigate }: AccountPageProps) {
  const { address, isConnected, chainId } = useAccount()
  const { disconnect }                    = useDisconnect()
  const { entries }                       = useActivity()
  const { prefs, update }                 = usePreferences()
  const { theme, toggle: toggleTheme }    = useTheme()
  const [copied, setCopied]               = useState(false)

  const onArc = chainId === ACTIVE_CHAIN_ID
  const avatarHue = address ? (parseInt(address.slice(2,6),16) % 360) : 270

  function copyAddress() {
    if (!address) return
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  /* ── Not connected ──────────────────────────────────── */
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
          <Shield className="size-7" style={{ color: 'var(--subtle)' }} />
        </div>
        <div>
          <p className="text-[18px] font-bold mb-1" style={{ color: 'var(--ink)' }}>Account</p>
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            Connect a wallet to view your account and settings.
          </p>
        </div>
        <WalletButton variant="primary" />
      </div>
    )
  }

  /* ── Connected ────────────────────────────────────────── */
  return (
    <div className="w-full max-w-md mx-auto animate-fade-in-up" style={{ paddingBottom: 24 }}>

      {/* ── Profile header ────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-4 py-5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="size-14 rounded-full flex items-center justify-center text-[18px] font-bold text-white shrink-0"
          style={{ background: `hsl(${avatarHue},65%,55%)` }}
        >
          {address?.slice(2,4).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold mb-[2px]" style={{ color: 'var(--ink)' }}>
            My Wallet
          </p>
          <p className="mono text-[12px] truncate" style={{ color: 'var(--muted)' }}>
            {address}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="size-[6px] rounded-full pulse-dot shrink-0"
              style={{ background: onArc ? 'var(--success)' : 'var(--danger)' }}
            />
            <span className="text-[11px] font-semibold" style={{ color: onArc ? 'var(--success)' : 'var(--danger)' }}>
              {onArc ? NETWORK_LABEL : 'Wrong network'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Quick actions row ──────────────────────────────── */}
      <div
        className="flex gap-[1px] mx-4 mt-4 mb-4 overflow-hidden rounded-2xl"
        style={{ background: 'var(--border)' }}
      >
        {/* Copy */}
        <button
          onClick={copyAddress}
          className="flex flex-1 flex-col items-center gap-[6px] py-3.5 transition-opacity hover:opacity-75"
          style={{ background: 'var(--surface)' }}
        >
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: 'var(--surface-3)' }}
          >
            {copied
              ? <Check className="size-4" style={{ color: 'var(--success)' }} strokeWidth={2.5} />
              : <Copy  className="size-4" style={{ color: 'var(--ink-2)'   }} strokeWidth={2}   />
            }
          </div>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>
            {copied ? 'Copied' : 'Copy'}
          </span>
        </button>

        {/* Explorer */}
        <a
          href={addressUrl(address as `0x${string}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 flex-col items-center gap-[6px] py-3.5 transition-opacity hover:opacity-75"
          style={{ background: 'var(--surface)' }}
        >
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: 'var(--surface-3)' }}
          >
            <ExternalLink className="size-4" style={{ color: 'var(--ink-2)' }} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--ink-2)' }}>Explorer</span>
        </a>

        {/* Disconnect */}
        <button
          onClick={() => void disconnect()}
          className="flex flex-1 flex-col items-center gap-[6px] py-3.5 transition-opacity hover:opacity-75"
          style={{ background: 'var(--surface)' }}
        >
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 36, height: 36, background: 'var(--danger-dim)' }}
          >
            <LogOut className="size-4" style={{ color: 'var(--danger)' }} strokeWidth={2} />
          </div>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--danger)' }}>Disconnect</span>
        </button>
      </div>

      {/* ── Preferences ────────────────────────────────────── */}
      <p className="section-label px-5 mb-2">Preferences</p>
      <div
        className="mx-4 mb-5 overflow-hidden rounded-2xl"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Theme */}
        <div className="settings-row">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 32, height: 32, background: 'var(--surface-2)' }}
          >
            {theme === 'dark'
              ? <Moon className="size-4" style={{ color: 'var(--ink-2)' }} strokeWidth={2} />
              : <Sun  className="size-4" style={{ color: 'var(--ink-2)' }} strokeWidth={2} />
            }
          </div>
          <span className="flex-1 text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
            {theme === 'dark' ? 'Dark mode' : 'Light mode'}
          </span>
          <Toggle on={theme === 'dark'} onToggle={toggleTheme} />
        </div>

        {/* Hide balance */}
        <div className="settings-row">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 32, height: 32, background: 'var(--surface-2)' }}
          >
            {prefs.hideBalance
              ? <EyeOff className="size-4" style={{ color: 'var(--ink-2)' }} strokeWidth={2} />
              : <Eye    className="size-4" style={{ color: 'var(--ink-2)' }} strokeWidth={2} />
            }
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>Hide balance</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Mask amounts across the app</p>
          </div>
          <Toggle on={prefs.hideBalance} onToggle={() => update({ hideBalance: !prefs.hideBalance })} />
        </div>
      </div>

      {/* ── About ─────────────────────────────────────────── */}
      <p className="section-label px-5 mb-2">About</p>
      <div
        className="mx-4 mb-5 overflow-hidden rounded-2xl"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="settings-row">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 32, height: 32, background: 'var(--surface-2)' }}
          >
            <Shield className="size-4" style={{ color: 'var(--ink-2)' }} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>This app</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Non-custodial USDC payments on Arc</p>
          </div>
        </div>

        <div className="settings-row">
          <div
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 32, height: 32, background: 'var(--surface-2)' }}
          >
            <FileText className="size-4" style={{ color: 'var(--ink-2)' }} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>Contract status</p>
            <p className="text-[11px]" style={{ color: SPLIT_PAY_ADDRESS ? 'var(--success)' : 'var(--warning)' }}>
              {SPLIT_PAY_ADDRESS
                ? `Deployed: ${shortAddress(SPLIT_PAY_ADDRESS, 5)}`
                : 'Pending deployment'
              }
            </p>
          </div>
          {SPLIT_PAY_ADDRESS && (
            <a
              href={addressUrl(SPLIT_PAY_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--subtle)' }}
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </a>
          )}
        </div>
      </div>

      {/* ── Activity ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 mb-2">
        <p className="section-label">Activity</p>
        {entries.length > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--subtle)' }}>
            {entries.length} transaction{entries.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {entries.length === 0 ? (
        <div
          className="mx-4 flex flex-col items-center gap-2 rounded-2xl py-8 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Activity className="size-5" style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No transactions yet</p>
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
                  style={{ width: 36, height: 36, background: 'var(--surface-2)' }}
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
                    {entry.txHash.slice(0,12)}…
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
