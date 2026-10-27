/**
 * WalletButton — the ONE place ConnectKitButton.Custom is used.
 *
 * Use this component everywhere a wallet connect/disconnect button is needed.
 * Never import ConnectKitButton directly in any screen component — doing so
 * risks the dual-module-instance crash that blanks the preview.
 *
 * ConnectKitButton.Custom defers its internal useContext call to the render-prop
 * child, which is React StrictMode–safe and avoids the stale-chunk issue.
 */
import { ConnectKitButton } from 'connectkit'

interface WalletButtonProps {
  variant?: 'primary' | 'compact'
}

export function WalletButton({ variant = 'primary' }: WalletButtonProps) {
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, address, truncatedAddress }) => {
        if (isConnected) {
          // When connected the header account button handles wallet actions.
          // This variant is used inside screens that need a fallback connect prompt.
          return null
        }
        if (variant === 'compact') {
          return (
            <button
              onClick={show}
              className="rounded-xl px-3 py-2 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Connect wallet
            </button>
          )
        }
        // address and truncatedAddress are part of the CK API — unused here
        void address; void truncatedAddress
        return (
          <button
            onClick={show}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.97]"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Connect wallet to continue
          </button>
        )
      }}
    </ConnectKitButton.Custom>
  )
}
