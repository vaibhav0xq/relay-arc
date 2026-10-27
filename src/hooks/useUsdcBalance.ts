import { useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { useAccount } from 'wagmi'
import { ACTIVE_CHAIN_ID, ARC_USDC } from '@/lib/constants'
import { formatUsdcFixed } from '@/lib/utils'

interface UsdcBalanceResult {
  raw:       bigint | undefined
  formatted: string           // "1234.56"
  isLoading: boolean
  refetch:   () => Promise<unknown>
}

export function useUsdcBalance(): UsdcBalanceResult {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useReadContract({
    address:      ARC_USDC.address as `0x${string}`,
    abi:          erc20Abi,
    functionName: 'balanceOf',
    args:         address ? [address] : undefined,
    chainId:      ACTIVE_CHAIN_ID,
    query: {
      enabled:        !!address,
      refetchInterval: 10_000,
    },
  })

  const raw       = data
  const formatted = raw !== undefined ? formatUsdcFixed(raw, ARC_USDC.decimals) : '—'

  return { raw, formatted, isLoading, refetch }
}
