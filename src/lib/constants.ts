/**
 * App-wide constants.
 *
 * Network selection:
 *   VITE_NETWORK=testnet  (default) — uses Arc Testnet, chain ID 5042002
 *   VITE_NETWORK=mainnet            — uses Arc Mainnet, chain ID 5042
 *
 * Contract address:
 *   VITE_SPLIT_PAY_ADDRESS — set after deployment. Empty string = not deployed.
 *
 * Both are VITE_ prefixed because they are public values (contract address,
 * chain ID). Never put private keys or API secrets under VITE_.
 */
import { getUsdc, requireChain, buildTxExplorerUrl, buildAddressExplorerUrl } from '@/onchain-facts'

// ── Network selection ────────────────────────────────────────────────────────

const VITE_NETWORK = import.meta.env.VITE_NETWORK as string | undefined

/** True when the build is configured for Arc Mainnet. */
export const IS_MAINNET = VITE_NETWORK === 'mainnet'

// ── Chain IDs ────────────────────────────────────────────────────────────────

export const ARC_TESTNET_CHAIN_ID = 5042002
export const ARC_MAINNET_CHAIN_ID = 5042

/** The active chain ID for this build. */
export const ACTIVE_CHAIN_ID = IS_MAINNET ? ARC_MAINNET_CHAIN_ID : ARC_TESTNET_CHAIN_ID

// ── Gas on Arc ───────────────────────────────────────────────────────────────

/**
 * Arc discards any transaction whose maxFeePerGas is under 20 Gwei, and it does
 * so silently: there is no receipt and no record on the explorer, so the app
 * waits on a confirmation that can never arrive.
 *
 * Measured on Arc Testnet (2026-10-25): baseFeePerGas sat at exactly
 * 20 Gwei across every recent block, eth_gasPrice reported 25 Gwei and
 * eth_maxPriorityFeePerGas 5 Gwei. A wallet-chosen fee can therefore land
 * right on the floor, so both writes pass these values explicitly instead of
 * trusting the wallet's estimate.
 *
 * 40 Gwei is twice the base fee, matching what the deploy transaction used.
 * Unused priority fee is refunded, so the headroom costs nothing.
 */
export const ARC_MAX_FEE_PER_GAS          = 40_000_000_000n // 40 Gwei
export const ARC_MAX_PRIORITY_FEE_PER_GAS =  1_000_000_000n //  1 Gwei

/** The documented floor. Anything below this is dropped without a receipt. */
export const ARC_MIN_FEE_PER_GAS = 20_000_000_000n // 20 Gwei

/**
 * USDC (6-decimal units) the Max button leaves behind for gas.
 *
 * Gas on Arc is paid in USDC out of the same balance the ERC-20 interface
 * reports, so approving the entire balance leaves nothing to pay for the
 * payment transaction and `transferFrom` comes up short. Measured cost of the
 * two transactions is well under 0.01 USDC; 0.10 is comfortable headroom.
 */
export const GAS_RESERVE = 100_000n // 0.10 USDC

// ── Chain facts (name, explorerBase, nativeCurrency …) ──────────────────────

export const arcTestnetChain = requireChain(ARC_TESTNET_CHAIN_ID)
export const arcMainnetChain = requireChain(ARC_MAINNET_CHAIN_ID)

/** The active chain facts for this build. */
export const activeChain = IS_MAINNET ? arcMainnetChain : arcTestnetChain

// ── USDC (ERC-20) ─────────────────────────────────────────────────────────────

const _usdc = getUsdc(ACTIVE_CHAIN_ID)
if (!_usdc) throw new Error(`USDC not found for chain ${ACTIVE_CHAIN_ID} in onchain-facts`)

/** USDC token facts (address + decimals) for the active chain. */
export const ARC_USDC = _usdc

// The USDC address is identical on Arc Testnet and Arc Mainnet:
// 0x3600000000000000000000000000000000000000

// ── Contract address ──────────────────────────────────────────────────────────

/**
 * USDCSplitPay deployed address.
 * Set VITE_SPLIT_PAY_ADDRESS after deployment.
 * Empty string = contract not yet deployed; all payment actions are disabled.
 */
export const SPLIT_PAY_ADDRESS =
  (import.meta.env.VITE_SPLIT_PAY_ADDRESS as string | undefined ?? '') as `0x${string}`

// ── Explorer helpers ──────────────────────────────────────────────────────────

/** Explorer base URL for the active chain. */
export const EXPLORER_BASE: string = activeChain.explorerBase

// Re-export for convenience; all explorer links must go through these.
export { buildTxExplorerUrl, buildAddressExplorerUrl }

// ── Network display ───────────────────────────────────────────────────────────

export const NETWORK_LABEL = IS_MAINNET ? 'Arc' : 'Arc Testnet'
export const NETWORK_IS_TESTNET = !IS_MAINNET
