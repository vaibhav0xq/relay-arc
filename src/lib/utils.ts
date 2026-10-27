import { isAddress } from 'viem'
import { ACTIVE_CHAIN_ID, buildTxExplorerUrl, buildAddressExplorerUrl } from './constants'

/** Shorten a hex address to 0x1234…abcd. chars controls leading chars (default 6). */
export function shortAddress(addr: string, chars = 6): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, chars)}…${addr.slice(-4)}`
}

/** Validate that a string is a checksummed or lowercase EVM address */
export function isValidAddress(value: string): boolean {
  return isAddress(value)
}

/** Format a bigint USDC raw amount (6 decimals) to a human-readable string */
export function formatUsdcRaw(raw: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`
}

/** Format USDC to always show 2 decimal places */
export function formatUsdcFixed(raw: bigint, decimals = 6): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 2)
  return `${whole}.${fracStr}`
}

/** Parse a user-entered decimal string to 6-decimal USDC bigint */
export function parseUsdcInput(value: string): bigint | null {
  if (!value || value === '.') return null
  const match = value.match(/^(\d+)(?:\.(\d{0,6}))?$/)
  if (!match) return null
  const whole = BigInt(match[1] ?? '0')
  const fracRaw = (match[2] ?? '').padEnd(6, '0').slice(0, 6)
  const frac = BigInt(fracRaw)
  return whole * 1_000_000n + frac
}

/** Explorer URL helpers scoped to the active chain. */
export function txUrl(hash: string): string {
  return buildTxExplorerUrl(ACTIVE_CHAIN_ID, hash)
}

export function addressUrl(addr: string): string {
  return buildAddressExplorerUrl(ACTIVE_CHAIN_ID, addr)
}

/** Format a basis-point share (0–10000) as a percentage string, e.g. "60%" */
export function bpToPercent(bp: number | bigint): string {
  const n = Number(bp)
  const pct = n / 100
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(2)}%`
}

/** Parse a user-entered percentage string to basis points */
export function percentToBp(pct: string): number | null {
  const n = parseFloat(pct)
  if (isNaN(n) || n <= 0 || n > 100) return null
  return Math.round(n * 100)
}

/** Timestamp (ms) → relative or absolute label */
export function formatTimestamp(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000)  return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ms).toLocaleDateString()
}

/** Parse a contract error into a user-friendly message */
export function parseContractError(error: unknown): string {
  const msg = (error as Error)?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('insufficientallowance') || msg.includes('allowance')) return 'USDC allowance too low. Approve the exact amount first.'
  if (msg.includes('zeroapproximation') || msg.includes('zeroamount')) return 'Amount must be greater than zero.'
  if (msg.includes('invalidgroupid')) return 'Invalid group ID.'
  if (msg.includes('reverted')) return 'Transaction failed. Check your balance and allowance.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Please retry.'
  return 'Something went wrong. Please try again.'
}
