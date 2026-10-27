import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { splitAbi } from '@/lib/splitAbi'
import { ACTIVE_CHAIN_ID, SPLIT_PAY_ADDRESS } from '@/lib/constants'

const CONTRACT = {
  address: SPLIT_PAY_ADDRESS,
  abi:     splitAbi,
  chainId: ACTIVE_CHAIN_ID,
} as const

// ── Reads ──────────────────────────────────────────────────────────────────

export function useGroupCount() {
  return useReadContract({
    ...CONTRACT,
    functionName: 'groupCount',
    query: {
      enabled:         !!SPLIT_PAY_ADDRESS,
      refetchInterval: 10_000,
    },
  })
}

/**
 * Group IDs belonging to the connected wallet.
 *
 * Groups are global on the contract, so listing 1..groupCount showed every
 * wallet's groups to everyone. This reads only the caller's own.
 */
export function useMyGroupIds() {
  const { address } = useAccount()

  const query = useReadContract({
    ...CONTRACT,
    functionName: 'groupsOf',
    args:         address ? [address] : undefined,
    query: {
      enabled:         !!SPLIT_PAY_ADDRESS && !!address,
      refetchInterval: 10_000,
    },
  })

  const ids = query.data !== undefined
    ? (query.data as readonly bigint[]).map(Number)
    : undefined

  return { ...query, ids }
}

export function useGetSplit(groupId: number | undefined) {
  return useReadContract({
    ...CONTRACT,
    functionName: 'getSplit',
    args:         groupId !== undefined ? [BigInt(groupId)] : undefined,
    query: {
      enabled:         !!SPLIT_PAY_ADDRESS && groupId !== undefined && groupId > 0,
      refetchInterval: 15_000,
    },
  })
}

export function usePreviewSplit(groupId: number | undefined, amount: bigint | undefined) {
  return useReadContract({
    ...CONTRACT,
    functionName: 'previewSplit',
    args: groupId !== undefined && amount !== undefined
      ? [BigInt(groupId), amount]
      : undefined,
    query: {
      enabled: !!SPLIT_PAY_ADDRESS && groupId !== undefined && groupId > 0 && !!amount && amount > 0n,
    },
  })
}

// ── Writes ─────────────────────────────────────────────────────────────────

export function useCreateSplit() {
  return useWriteContract()
}

export function usePaySingle() {
  return useWriteContract()
}

export function useSplitPayment() {
  return useWriteContract()
}
