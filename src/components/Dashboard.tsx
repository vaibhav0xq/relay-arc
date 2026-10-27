/**
 * Dashboard — redirects to HomePage. Kept for file-list compatibility.
 */
import { useEffect } from 'react'
import type { View } from '@/App'

interface DashboardProps { onNavigate: (v: View) => void }

export function Dashboard({ onNavigate }: DashboardProps) {
  useEffect(() => { onNavigate('home') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
