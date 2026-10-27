/**
 * AppShell — sticky header + scroll wrapper.
 *
 * ConnectKit safety: ConnectKitButton.Custom only.
 * No brand name or logo in the header.
 * All screens use WalletButton. No bare ConnectKitButton in any screen.
 */
import { type ReactNode } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount }      from 'wagmi'
import { ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/lib/constants'
import { shortAddress }    from '@/lib/utils'

export const APP_NAME = 'Relay'

interface AppShellProps {
  children: ReactNode
  theme?:   string
}

export function AppShell({ children }: AppShellProps) {
  const { isConnected, address, chainId } = useAccount()
  const onArc = chainId === ACTIVE_CHAIN_ID
  const avatarHue = address ? (parseInt(address.slice(2, 6), 16) % 360) : 270

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* Header — network chip left, account pill right */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-4 shrink-0"
        style={{
          background:           'var(--header-bg)',
          backdropFilter:       'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom:         '1px solid var(--border)',
          height:               52,
        }}
      >
        {/* Left: network status when connected, empty otherwise */}
        <div>
          {isConnected && (
            <div
              className="flex items-center gap-[5px] rounded-full px-2.5 py-[5px] text-[11px] font-semibold"
              style={{
                background: onArc ? 'var(--success-dim)' : 'var(--danger-dim)',
                color:      onArc ? 'var(--success)'     : 'var(--danger)',
                border:    `1px solid ${onArc ? 'var(--success-border)' : 'var(--danger-border)'}`,
              }}
            >
              <span
                className="size-[5px] rounded-full pulse-dot shrink-0"
                style={{ background: onArc ? 'var(--success)' : 'var(--danger)' }}
              />
              {onArc ? NETWORK_LABEL : 'Wrong network'}
            </div>
          )}
        </div>

        {/* Right: connect button or account pill */}
        <ConnectKitButton.Custom>
          {({ isConnected: ckConnected, show }) =>
            ckConnected ? (
              <button
                onClick={show}
                className="flex items-center gap-[6px] rounded-full px-2.5 py-[5px] text-[12px] font-semibold transition-opacity hover:opacity-75"
                style={{
                  background: 'var(--surface-2)',
                  border:     '1px solid var(--border-2)',
                  color:      'var(--ink-2)',
                }}
              >
                <span
                  className="size-[18px] rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ background: `hsl(${avatarHue},65%,55%)` }}
                >
                  {address?.slice(2, 4).toUpperCase()}
                </span>
                <span className="mono">{shortAddress(address ?? '', 4)}</span>
              </button>
            ) : (
              <button
                onClick={show}
                className="rounded-full px-3.5 py-[7px] text-[13px] font-bold transition-opacity hover:opacity-85"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Connect
              </button>
            )
          }
        </ConnectKitButton.Custom>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col" style={{ paddingBottom: 64 }}>
        {children}
      </main>
    </div>
  )
}
