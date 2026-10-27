import {
  isAddress,
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  TransactionNotFoundError,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { ACTIVE_CHAIN_ID, NETWORK_LABEL, buildTxExplorerUrl, buildAddressExplorerUrl } from './constants'

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

/**
 * Turn a wallet or contract error into something a user can act on.
 *
 * Written against what Arc Testnet actually returns, verified on chain:
 *
 *   - USDC at 0x3600...0000 is Circle's FiatTokenProxy. It REVERTS with a
 *     legacy string ("ERC20: transfer amount exceeds allowance"), it does not
 *     return false. So `USDCSplitPay.PayoutFailed` is unreachable in practice
 *     and the useful text lives in `ContractFunctionRevertedError.reason`.
 *   - A dropped transaction produces no receipt at all (Arc discards anything
 *     under the 20 Gwei base fee), which surfaces as a receipt timeout rather
 *     than a revert.
 *
 * The raw error always goes to the console so `console-capture.ts` records it.
 */
export function parseContractError(error: unknown): string {
  console.error('[relay] tx error', error)

  if (!(error instanceof BaseError)) {
    const bare = (error as Error)?.message
    return bare ? `Unexpected error: ${bare}` : 'Something went wrong. Please try again.'
  }

  // ── The user said no ────────────────────────────────────────────────────
  if (error.walk((e) => e instanceof UserRejectedRequestError)) {
    return 'You cancelled the request in your wallet.'
  }

  // ── Wallet is on the wrong network ──────────────────────────────────────
  if (error.walk((e) => e instanceof ChainMismatchError)) {
    return `Your wallet is on a different network. Switch it to ${NETWORK_LABEL} and try again.`
  }

  // ── Submitted, then never mined ─────────────────────────────────────────
  if (error.walk((e) => e instanceof WaitForTransactionReceiptTimeoutError)) {
    return 'The transaction was accepted by your wallet but never confirmed. '
         + `On ${NETWORK_LABEL} a transaction below the 20 Gwei base fee is discarded `
         + 'without a receipt. Raise the gas fee in your wallet and retry.'
  }
  if (error.walk((e) => e instanceof TransactionNotFoundError)) {
    return 'The network has no record of that transaction. It was most likely dropped before it was mined.'
  }

  // ── A real revert ───────────────────────────────────────────────────────
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError)
  if (reverted instanceof ContractFunctionRevertedError) {
    // Legacy string reverts: what Circle's FiatToken actually emits.
    const reason = reverted.reason ?? ''
    if (reason.includes('exceeds allowance')) {
      return 'USDC has not approved this contract to move your funds. '
           + 'The approval step did not complete, so start over.'
    }
    if (reason.includes('exceeds balance')) return 'Your USDC balance is lower than the amount you are sending.'
    if (reason.includes('blacklisted'))     return 'This address is blocked by the USDC issuer and cannot send or receive.'
    if (reason.toLowerCase().includes('paused')) return 'USDC transfers are paused on this network right now.'

    // Custom errors from USDCSplitPay.
    const name = reverted.data?.errorName
    const args = (reverted.data?.args ?? []) as readonly unknown[]
    switch (name) {
      case 'PayoutFailed':
        return `USDC refused to move ${formatUsdcFixed(args[1] as bigint)} USDC to ${shortAddress(String(args[0]))}.`
      case 'ZeroAmount':            return 'Enter an amount greater than zero.'
      case 'ZeroAddress':           return 'That recipient address is not valid.'
      case 'InvalidGroupId':        return `Group ${args[0]} does not exist.`
      case 'NotGroupOwner':         return 'Only the wallet that created this group can pay into it.'
      case 'InvalidShareTotal':     return 'The shares must add up to exactly 100%.'
      case 'DuplicateRecipient':    return `${shortAddress(String(args[0]))} appears twice in the group.`
      case 'InvalidRecipientCount': return 'A group needs between 1 and 20 recipients.'
    }

    if (reason) return `The contract rejected this: ${reason}`
    if (name)   return `The contract rejected this: ${name}.`
  }

  // ── Not enough native USDC to pay for gas ───────────────────────────────
  const short = error.shortMessage ?? error.message ?? ''
  if (/insufficient funds/i.test(short)) {
    return `Not enough USDC to cover gas. On ${NETWORK_LABEL} gas is paid in USDC.`
  }

  return short || 'Something went wrong. Please try again.'
}
