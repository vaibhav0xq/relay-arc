/**
 * SinglePayment — now handled inside PayPage (Single mode).
 * This stub redirects to the Pay tab for backwards navigation compatibility.
 */
import { useEffect } from 'react'
import type { View } from '@/App'

interface SinglePaymentProps { onNavigate: (v: View) => void }

export function SinglePayment({ onNavigate }: SinglePaymentProps) {
  useEffect(() => { onNavigate('send') }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
