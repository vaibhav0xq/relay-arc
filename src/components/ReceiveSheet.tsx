/**
 * ReceiveSheet — show connected address for receiving USDC.
 * Copy address, open in Arc Explorer, share via Web Share API.
 */
import { useState } from 'react'
import { ArrowLeft, Copy, ExternalLink, Check, Share2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { addressUrl } from '@/lib/utils'
import { NETWORK_LABEL } from '@/lib/constants'

interface ReceiveSheetProps { onBack: () => void }

export function ReceiveSheet({ onBack }: ReceiveSheetProps) {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)

  function copyAddress() {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  function shareAddress() {
    if (!address || !('share' in navigator)) return
    void (navigator as Navigator & { share: (d: ShareData) => Promise<void> })
      .share({ title: 'My wallet address', text: address })
      .catch(() => {})
  }

  return (
    <div className="mx-auto max-w-md px-4" style={{ paddingTop: 16, paddingBottom: 24 }}>

      {/* Back header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="size-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          aria-label="Back"
        >
          <ArrowLeft className="size-4" style={{ color: 'var(--muted)' }} />
        </button>
        <h2 className="text-base font-bold" style={{ color: 'var(--ink)' }}>Receive USDC</h2>
      </div>

      {/* Address display */}
      <div
        className="rounded-xl px-4 py-4 mb-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--subtle)' }}
        >
          Your {NETWORK_LABEL} address
        </p>
        <p
          className="mono text-sm leading-relaxed break-all"
          style={{ color: 'var(--ink)' }}
        >
          {address ?? 'Not connected'}
        </p>
      </div>

      {/* Actions */}
      <div
        className="rounded-xl overflow-hidden mb-4"
        style={{ border: '1px solid var(--border)' }}
      >
        <button
          onClick={copyAddress}
          className="w-full flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          {copied
            ? <Check    className="size-4 shrink-0" style={{ color: 'var(--success)' }} />
            : <Copy     className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
          }
          <span
            className="text-sm font-semibold"
            style={{ color: copied ? 'var(--success)' : 'var(--ink)' }}
          >
            {copied ? 'Copied!' : 'Copy address'}
          </span>
        </button>

        <a
          href={addressUrl(address ?? '')}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-80"
          style={{
            background:     'var(--surface)',
            borderBottom:   'share' in navigator ? '1px solid var(--border)' : undefined,
            textDecoration: 'none',
            display:        'flex',
          }}
        >
          <ExternalLink className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Open in Arc Explorer
          </span>
        </a>

        {'share' in navigator && (
          <button
            onClick={shareAddress}
            className="w-full flex items-center gap-3 px-4 py-3 transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface)' }}
          >
            <Share2 className="size-4 shrink-0" style={{ color: 'var(--muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              Share address
            </span>
          </button>
        )}
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
        Only send USDC on {NETWORK_LABEL} to this address.
      </p>
    </div>
  )
}
