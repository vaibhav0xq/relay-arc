/**
 * GroupPayment — group split payment flow.
 * Renders the PayPage in split mode, pre-selecting the given groupId.
 * Back button returns to Groups tab.
 */
import { PayPage } from './PayPage'
import type { View } from '@/App'

interface GroupPaymentProps {
  groupId:    number
  onNavigate: (v: View) => void
}

export function GroupPayment({ groupId, onNavigate }: GroupPaymentProps) {
  return (
    <PayPage
      onNavigate={onNavigate}
      initialMode="split"
      initialGroupId={groupId}
      backTo="groups"
    />
  )
}
