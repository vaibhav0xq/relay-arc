/**
 * User display preferences (persisted in localStorage).
 * - hideBalance: mask USDC balance
 * - reducedMotion: skip animations
 */
import { useState, useCallback } from 'react'

interface Prefs {
  hideBalance:   boolean
  reducedMotion: boolean
}

const KEY = 'relay:prefs'

function loadPrefs(): Prefs {
  const defaults: Prefs = { hideBalance: false, reducedMotion: false }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    return { ...defaults, ...raw }
  } catch {
    return defaults
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs(p => {
      const next = { ...p, ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  return { prefs, update }
}
