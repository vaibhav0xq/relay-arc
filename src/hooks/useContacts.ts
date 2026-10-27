/**
 * Lightweight local address book.
 * Labels are stored in localStorage keyed by wallet address.
 */
import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'

export interface Contact {
  address: string   // checksummed EVM address
  label:   string   // user-defined name
  addedAt: number   // Date.now()
}

const KEY_PREFIX = 'relay:contacts:'
function storageKey(wallet: string) { return `${KEY_PREFIX}${wallet.toLowerCase()}` }

function load(wallet: string): Contact[] {
  try { return JSON.parse(localStorage.getItem(storageKey(wallet)) ?? '[]') as Contact[] }
  catch { return [] }
}
function save(wallet: string, contacts: Contact[]) {
  try { localStorage.setItem(storageKey(wallet), JSON.stringify(contacts)) } catch {}
}

export function useContacts() {
  const { address } = useAccount()
  const [contacts, setContacts] = useState<Contact[]>(() => address ? load(address) : [])

  const addContact = useCallback((addr: string, label: string) => {
    if (!address) return
    setContacts(prev => {
      const next = [
        { address: addr, label: label.trim(), addedAt: Date.now() },
        ...prev.filter(c => c.address.toLowerCase() !== addr.toLowerCase()),
      ]
      save(address, next)
      return next
    })
  }, [address])

  const removeContact = useCallback((addr: string) => {
    if (!address) return
    setContacts(prev => {
      const next = prev.filter(c => c.address.toLowerCase() !== addr.toLowerCase())
      save(address, next)
      return next
    })
  }, [address])

  const getLabel = useCallback((addr: string): string | undefined =>
    contacts.find(c => c.address.toLowerCase() === addr.toLowerCase())?.label
  , [contacts])

  return { contacts, addContact, removeContact, getLabel }
}
