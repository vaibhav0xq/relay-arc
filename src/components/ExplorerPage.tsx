/**
 * ExplorerPage — in-wallet browser.
 *
 * Renders visited pages inside an iframe so the user never leaves the app.
 * Sites that block framing (X-Frame-Options / CSP frame-ancestors) will fail
 * to load; we detect that with a timeout and offer an external fallback.
 *
 * History is kept in a simple stack so Back/Forward work without reload.
 */
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  Search,
  Globe,
  X,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  ExternalLink,
  Home,
  Shield,
  AlertTriangle,
} from 'lucide-react'

/* ── URL resolver ────────────────────────────────────────────── */

function resolveInput(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[^\s]+\.[^\s]{2,}$/.test(s) && !s.includes(' ')) return `https://${s}`
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}

function isSecure(url: string): boolean {
  return url.startsWith('https://')
}

/**
 * Only the curated sites below are ever framed inside the app.
 *
 * Framing an arbitrary site inside a wallet's own chrome is a phishing surface:
 * the user sees this app's header and trusts what is underneath it. Anything
 * not on this list is handed to the real browser, where it gets a real address
 * bar and the browser's own warnings.
 */
function isFramingAllowed(url: string): boolean {
  let host: string
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    host = u.hostname.toLowerCase()
  } catch {
    return false
  }

  return FRAMEABLE_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed))
}

/* ── Featured dapps ──────────────────────────────────────────── */

interface DApp {
  name:     string
  desc:     string
  url:      string
  category: string
  icon:     string
}

const FEATURED: DApp[] = [
  { name: 'Arc Explorer',        desc: 'Transactions, addresses, and contracts on Arc.',      url: 'https://explorer.testnet.arc.io',  category: 'Tools',  icon: '🔍' },
  { name: 'Circle Faucet',       desc: 'Get testnet USDC for Arc Testnet.',                   url: 'https://faucet.circle.com',         category: 'Tools',  icon: '🚰' },
  { name: 'Arc Bridge',          desc: 'Bridge USDC to and from Arc via CCTP.',               url: 'https://bridge.arc.io',             category: 'Bridge', icon: '🌉' },
  { name: 'Uniswap',             desc: 'Token swaps (Ethereum, not Arc).',                   url: 'https://app.uniswap.org',           category: 'DeFi',   icon: '🦄' },
  { name: 'Aave',                desc: 'Lending and borrowing (Ethereum, not Arc).',         url: 'https://app.aave.com',              category: 'DeFi',   icon: '👻' },
  { name: 'Circle Developers',   desc: 'Documentation for Arc and Circle products.',          url: 'https://developers.circle.com',     category: 'Docs',   icon: '📖' },
  { name: 'Google',              desc: 'Search the web.',                                     url: 'https://www.google.com',            category: 'Search', icon: '🔎' },
  { name: 'DuckDuckGo',          desc: 'Search without tracking.',                            url: 'https://duckduckgo.com',            category: 'Search', icon: '🦆' },
  { name: 'DefiLlama',           desc: 'Cross-chain DeFi protocol analytics.',               url: 'https://defillama.com',             category: 'DeFi',   icon: '🦙' },
  { name: 'Etherscan',           desc: 'Ethereum block explorer.',                            url: 'https://etherscan.io',              category: 'Tools',  icon: '🧭' },
]

const CATEGORIES = [...new Set(FEATURED.map(d => d.category))]

/** Hostnames the in-app frame may load. Everything else goes to the real browser. */
const FRAMEABLE_HOSTS: string[] = FEATURED.map(d => new URL(d.url).hostname.toLowerCase())

/* ── Component ───────────────────────────────────────────────── */

type BrowserState = 'home' | 'loading' | 'loaded' | 'blocked'

export function ExplorerPage() {
  /* Address bar state */
  const [barValue,    setBarValue]    = useState('')
  const [barFocused,  setBarFocused]  = useState(false)
  const inputRef                      = useRef<HTMLInputElement>(null)

  /* Browser state */
  const [state,       setState]       = useState<BrowserState>('home')
  const [currentUrl,  setCurrentUrl]  = useState('')
  /* Why the page is not being framed: the site refused, or this app refused. */
  const [blockReason, setBlockReason] = useState<'headers' | 'policy'>('headers')
  const iframeRef                     = useRef<HTMLIFrameElement>(null)

  /* History stack — stored as state so Back/Forward buttons re-render */
  const [history,  setHistory]  = useState<string[]>([])
  const [histIdx,  setHistIdx]  = useState<number>(-1)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canBack    = histIdx > 0
  const canForward = histIdx < history.length - 1

  /* Search bar filter (only on home screen) */
  const filterTerm = barValue.trim().toLowerCase()
  const filtered = state === 'home' && filterTerm
    ? FEATURED.filter(d =>
        d.name.toLowerCase().includes(filterTerm) ||
        d.category.toLowerCase().includes(filterTerm) ||
        d.desc.toLowerCase().includes(filterTerm),
      )
    : null

  function startLoadTimer() {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    loadTimerRef.current = setTimeout(() => {
      setState(prev => prev === 'loading' ? 'blocked' : prev)
    }, 8000)
  }

  /* Navigate to a URL */
  const navigate = useCallback((rawUrl: string) => {
    const url = resolveInput(rawUrl)
    if (!url) return

    // Not on the curated list: never frame it, hand it to the real browser.
    if (!isFramingAllowed(url)) {
      setCurrentUrl(url)
      setBarValue(url)
      setBlockReason('policy')
      setState('blocked')
      return
    }

    setBlockReason('headers')
    setHistory(prev => {
      const stack = prev.slice(0, histIdx + 1)
      stack.push(url)
      setHistIdx(stack.length - 1)
      return stack
    })
    setCurrentUrl(url)
    setBarValue(url)
    setState('loading')
    startLoadTimer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histIdx])

  /* Handle iframe load */
  function handleIframeLoad() {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    setState('loaded')
  }

  /* Handle iframe error */
  function handleIframeError() {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    setState('blocked')
  }

  /* Clean up timer on unmount */
  useEffect(() => {
    return () => { if (loadTimerRef.current) clearTimeout(loadTimerRef.current) }
  }, [])

  function goBack() {
    if (!canBack) return
    const newIdx = histIdx - 1
    const url = history[newIdx]
    setHistIdx(newIdx)
    setCurrentUrl(url)
    setBarValue(url)
    setState('loading')
    startLoadTimer()
  }

  function goForward() {
    if (!canForward) return
    const newIdx = histIdx + 1
    const url = history[newIdx]
    setHistIdx(newIdx)
    setCurrentUrl(url)
    setBarValue(url)
    setState('loading')
    startLoadTimer()
  }

  function reload() {
    if (!currentUrl) return
    setState('loading')
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank'
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = currentUrl
      }, 50)
    }
    startLoadTimer()
  }

  function goHome() {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    setState('home')
    setCurrentUrl('')
    setBarValue('')
    setHistory([])
    setHistIdx(-1)
  }

  /* Address bar form submit */
  function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const url = resolveInput(barValue)
    if (url) {
      navigate(url)
      inputRef.current?.blur()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setBarValue(state === 'home' ? '' : currentUrl)
      inputRef.current?.blur()
    }
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col w-full"
      style={{ height: 'calc(100dvh - 110px)', minHeight: 0 }}
    >
      {/* ── Browser chrome ──────────────────────────────────── */}
      <div
        className="shrink-0 px-3 py-2.5 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        {/* Back + Forward — only shown when browsing */}
        {state !== 'home' && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={goBack}
              disabled={!canBack}
              className="flex items-center justify-center rounded-lg transition-opacity"
              style={{
                width: 30, height: 30,
                color:   canBack ? 'var(--ink)' : 'var(--subtle)',
                opacity: canBack ? 1 : 0.3,
              }}
              aria-label="Back"
            >
              <ArrowLeft className="size-[16px]" strokeWidth={2.2} />
            </button>
            <button
              onClick={goForward}
              disabled={!canForward}
              className="flex items-center justify-center rounded-lg transition-opacity"
              style={{
                width: 30, height: 30,
                color:   canForward ? 'var(--ink)' : 'var(--subtle)',
                opacity: canForward ? 1 : 0.3,
              }}
              aria-label="Forward"
            >
              <ArrowRight className="size-[16px]" strokeWidth={2.2} />
            </button>
          </div>
        )}

        {/* Address bar — takes all remaining space */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <div
            className="flex items-center gap-2 rounded-[10px] px-3 py-0"
            style={{
              height:     36,
              background: barFocused ? 'var(--bg)' : 'var(--surface-2)',
              border:     `1.5px solid ${barFocused ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            {/* Status icon — lock when loaded, search otherwise */}
            {state === 'loaded' && !barFocused ? (
              isSecure(currentUrl)
                ? <Shield className="size-[13px] shrink-0" style={{ color: 'var(--success)' }} strokeWidth={2} />
                : <AlertTriangle className="size-[13px] shrink-0" style={{ color: 'var(--warning)' }} strokeWidth={2} />
            ) : (
              <Search
                className="size-[13px] shrink-0"
                style={{ color: barFocused ? 'var(--accent)' : 'var(--subtle)' }}
                strokeWidth={2}
              />
            )}

            <input
              ref={inputRef}
              type="text"
              value={barFocused ? barValue : (state === 'home' ? barValue : displayUrl(currentUrl))}
              onChange={e => setBarValue(e.target.value)}
              onFocus={() => { setBarFocused(true); setBarValue(currentUrl || barValue) }}
              onBlur={() => setBarFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Search or enter a URL"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-[13px] outline-none min-w-0"
              style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)' }}
            />

            {/* Clear button — only while focused and input has value */}
            {barValue && barFocused && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setBarValue('')}
                className="shrink-0 flex items-center justify-center size-4 rounded-full"
                style={{ background: 'var(--border-2)', color: 'var(--muted)' }}
                aria-label="Clear"
              >
                <X className="size-[9px]" strokeWidth={3} />
              </button>
            )}

            {/* Go button — only when focused */}
            {barFocused && barValue && (
              <button
                type="submit"
                onMouseDown={e => e.preventDefault()}
                className="shrink-0 flex items-center justify-center size-6 rounded-lg"
                style={{ background: 'var(--accent)', color: '#fff' }}
                aria-label="Go"
              >
                <ArrowRight className="size-[12px]" strokeWidth={2.5} />
              </button>
            )}
          </div>
        </form>

        {/* Right controls: reload/stop + home (only when browsing) */}
        {state !== 'home' && (
          <div className="flex items-center gap-0.5 shrink-0">
            {state === 'loading' ? (
              <button
                onClick={reload}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 30, height: 30, color: 'var(--ink)' }}
                aria-label="Stop"
              >
                <X className="size-[16px]" strokeWidth={2.2} />
              </button>
            ) : (
              <button
                onClick={reload}
                className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                style={{ width: 30, height: 30, color: 'var(--ink)' }}
                aria-label="Reload"
              >
                <RotateCw className="size-[15px]" strokeWidth={2.2} />
              </button>
            )}
            <button
              onClick={goHome}
              className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
              style={{ width: 30, height: 30, color: 'var(--ink)' }}
              aria-label="Home"
            >
              <Home className="size-[16px]" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* ── Loading bar ───────────────────────────────────────── */}
      {state === 'loading' && (
        <div className="h-[2px] w-full shrink-0" style={{ background: 'var(--border)' }}>
          <div
            className="h-full animate-pulse"
            style={{ width: '60%', background: 'var(--accent)', borderRadius: 2 }}
          />
        </div>
      )}

      {/* ── Home screen ───────────────────────────────────────── */}
      {state === 'home' && (
        <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>

          {/* Search results while typing */}
          {filtered !== null ? (
            <div className="px-4 pt-3">
              {filtered.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 rounded-2xl py-8 text-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <Globe className="size-5" style={{ color: 'var(--subtle)' }} strokeWidth={1.5} />
                  <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                    No saved apps match &ldquo;{barValue}&rdquo;
                  </p>
                  <button
                    onClick={() => handleSubmit()}
                    className="text-[12px] font-semibold"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    Search the web
                  </button>
                </div>
              ) : (
                <>
                  <p className="section-label mb-2">Apps</p>
                  <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
                    {filtered.map((d, i) => (
                      <DAppRow key={d.url} dapp={d} last={i === filtered.length - 1} onClick={() => navigate(d.url)} />
                    ))}
                  </div>
                  <button
                    onClick={() => handleSubmit()}
                    className="w-full flex items-center gap-2 mt-2 px-3 py-2.5 rounded-xl text-[13px] transition-opacity hover:opacity-70"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  >
                    <Search className="size-4 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={2} />
                    Search for &ldquo;{barValue}&rdquo;
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Default: featured apps by category */
            <div className="pt-2 pb-4">
              {CATEGORIES.map(cat => (
                <div key={cat} className="mb-4">
                  <p className="section-label px-5 mb-2">{cat}</p>
                  <div className="mx-4 overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
                    {FEATURED.filter(d => d.category === cat).map((d, i, arr) => (
                      <DAppRow key={d.url} dapp={d} last={i === arr.length - 1} onClick={() => navigate(d.url)} />
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-center px-6 pt-1" style={{ color: 'var(--subtle)' }}>
                Your wallet is available on any WalletConnect-compatible site.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Blocked screen ────────────────────────────────────── */}
      {state === 'blocked' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div
            className="flex items-center justify-center size-12 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <Shield className="size-6" style={{ color: 'var(--warning)' }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              {blockReason === 'policy' ? 'Opens outside the app' : 'This site cannot be embedded'}
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              {blockReason === 'policy'
                ? `${displayUrl(currentUrl)} is not one of the sites Relay will display inside the app. Open it in your browser, where you get a real address bar.`
                : `${displayUrl(currentUrl)} blocks in-app browsers using security headers. Open it in your system browser instead.`}
            </p>
          </div>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold mt-1 transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}
          >
            <ExternalLink className="size-4" strokeWidth={2} />
            Open in browser
          </a>
          <button
            onClick={goHome}
            className="text-[12px]"
            style={{ color: 'var(--accent-text)' }}
          >
            Back to Explorer
          </button>
        </div>
      )}

      {/* ── Iframe ───────────────────────────────────────────── */}
      {(state === 'loading' || state === 'loaded') && (
        <iframe
          ref={iframeRef}
          src={currentUrl}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="In-app browser"
          /*
           * Deliberately narrow. Three permissions were removed:
           *
           *   allow-same-origin  — with allow-scripts this lets a page served
           *     from this app's own origin break out of the sandbox entirely
           *     and reach the wallet session. Any URL could be typed in, this
           *     app's own included.
           *   allow-popups-to-escape-sandbox — a popup opened by a framed page
           *     would have run with no sandbox at all.
           *   clipboard-read (via `allow`) — in a wallet the clipboard holds
           *     addresses and worse, and no framed site has any business
           *     reading it.
           *
           * allow-popups is kept so a legitimate sign-in popup still works,
           * but it now inherits this sandbox rather than escaping it.
           */
          sandbox="allow-scripts allow-forms allow-popups allow-storage-access-by-user-activation"
          referrerPolicy="no-referrer"
          className="flex-1 w-full border-0"
          style={{
            opacity:    state === 'loaded' ? 1 : 0,
            transition: 'opacity 0.2s ease',
            minHeight:  0,
          }}
        />
      )}
    </div>
  )
}

/* ── DApp row ────────────────────────────────────────────────── */

function DAppRow({ dapp, last, onClick }: { dapp: DApp; last: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-75"
      style={{ background: 'var(--surface)', borderBottom: last ? 'none' : '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-center rounded-xl shrink-0 text-[18px]"
        style={{ width: 38, height: 38, background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}
      >
        {dapp.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{dapp.name}</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{dapp.desc}</p>
      </div>
      <ExternalLink className="size-3.5 shrink-0" style={{ color: 'var(--subtle)' }} strokeWidth={1.8} />
    </button>
  )
}
