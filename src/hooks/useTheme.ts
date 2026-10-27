/**
 * Manages dark/light theme preference.
 * Applies [data-theme="light"] to <html> and persists to localStorage.
 */
import { useState, useEffect, useCallback } from 'react'

type Theme = 'dark' | 'light'
const KEY = 'relay:theme'

function getInitial(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch {}
  return 'dark'
}

function apply(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = getInitial()
    apply(t)
    return t
  })

  useEffect(() => { apply(theme) }, [theme])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(KEY, next) } catch {}
      return next
    })
  }, [])

  return { theme, toggle, isDark: theme === 'dark' }
}
