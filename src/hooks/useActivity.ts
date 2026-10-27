import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ACTIVE_CHAIN_ID } from '@/lib/constants'

export type ActivityKind = 'single-payment' | 'split-payment' | 'create-group'

export interface ActivityEntry {
  id:        string       // unique key (timestamp + random)
  kind:      ActivityKind
  txHash:    string
  chainId:   number
  timestamp: number       // Date.now()
  label:     string       // human-readable description
  groupId?:  number       // for split-payment and create-group
  amount?:   string       // formatted USDC amount
}

const STORAGE_KEY_PREFIX = 'splitpay:activity:'

function storageKey(address: string): string {
  return `${STORAGE_KEY_PREFIX}${address.toLowerCase()}`
}

function loadEntries(address: string): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(address))
    if (!raw) return []
    return JSON.parse(raw) as ActivityEntry[]
  } catch {
    return []
  }
}

function saveEntries(address: string, entries: ActivityEntry[]): void {
  try {
    // Keep most recent 100 entries per wallet
    const trimmed = entries.slice(0, 100)
    localStorage.setItem(storageKey(address), JSON.stringify(trimmed))
  } catch {
    // localStorage may be unavailable (private browsing, quota)
  }
}

interface UseActivityResult {
  entries:     ActivityEntry[]
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'chainId'>) => void
  clear:       () => void
}

export function useActivity(): UseActivityResult {
  const { address } = useAccount()

  const [entries, setEntries] = useState<ActivityEntry[]>(() => {
    if (!address) return []
    return loadEntries(address)
  })

  const addActivity = useCallback((entry: Omit<ActivityEntry, 'id' | 'timestamp' | 'chainId'>) => {
    if (!address) return
    const full: ActivityEntry = {
      ...entry,
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      chainId:   ACTIVE_CHAIN_ID,
    }
    setEntries((prev) => {
      const next = [full, ...prev]
      saveEntries(address, next)
      return next
    })
  }, [address])

  const clear = useCallback(() => {
    if (!address) return
    setEntries([])
    localStorage.removeItem(storageKey(address))
  }, [address])

  return { entries, addActivity, clear }
}
