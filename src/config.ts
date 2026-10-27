/**
 * wagmi configuration
 *
 * Active chain is selected by VITE_NETWORK:
 *   testnet (default) — Arc Testnet (5042002)
 *   mainnet           — Arc Mainnet  (5042)
 *
 * Ethereum mainnet is always included for ENS resolution only.
 * No mainnet transactions are possible via this app unless IS_MAINNET is true.
 */
import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { IS_MAINNET, ARC_MAINNET_CHAIN_ID } from './lib/constants'

// Arc Mainnet chain definition (not yet in viem/chains as of this build).
// Values sourced from onchain-facts.ts registry.
const arcMainnet = {
  id:        ARC_MAINNET_CHAIN_ID,
  name:      'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
} as const

// Register chain RPC URLs for trace events
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
if (IS_MAINNET) {
  registerChain(ARC_MAINNET_CHAIN_ID, arcMainnet.rpcUrls.default.http[0])
}

export const config = IS_MAINNET
  ? createConfig({
      chains:     [arcMainnet, mainnet],
      connectors: [injected()],
      transports: {
        [arcMainnet.id]: http(),
        [mainnet.id]:    http(),
      },
    })
  : createConfig({
      chains:     [arcTestnet, mainnet],
      connectors: [injected()],
      transports: {
        [arcTestnet.id]: http(),
        [mainnet.id]:    http(),
      },
    })
