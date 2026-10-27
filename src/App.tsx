import { useState, useEffect }  from 'react'
import { useTheme }             from './hooks/useTheme'
import { AppShell }             from './components/layout/AppShell'
import { BottomNav, type Tab }  from './components/layout/BottomNav'
import { HomePage }             from './components/HomePage'
import { GroupsPage }           from './components/GroupsPage'
import { CreateGroupSheet }     from './components/CreateGroupSheet'
import { GroupPayment }         from './components/GroupPayment'
import { AccountPage }          from './components/AccountPage'
import { ActivityPage }         from './components/ActivityPage'
import { ExplorerPage }         from './components/ExplorerPage'
import { PayPage }              from './components/PayPage'
import { ReceiveSheet }         from './components/ReceiveSheet'

/**
 * Primary nav tabs: home | groups | activity | explorer | account
 * Sub-views (not in nav): send | receive | create-group | group-payment
 */
export type View =
  | 'home'
  | 'groups'
  | 'activity'
  | 'explorer'
  | 'account'
  | 'send'
  | 'receive'
  | 'create-group'
  | 'group-payment'

// Which tab each view maps to for BottomNav highlight
function toTab(view: View): Tab {
  if (view === 'send' || view === 'receive') return 'home'
  if (view === 'create-group' || view === 'group-payment') return 'groups'
  return view
}

// Sub-views that hide the bottom nav
const SUB_VIEWS: View[] = ['send', 'receive', 'create-group', 'group-payment']

export default function App() {
  const [view,       setView]       = useState<View>('home')
  const [payGroupId, setPayGroupId] = useState<number>(0)
  const { theme, toggle: toggleTheme } = useTheme()

  // Theme toggle event bridge used by AccountPage
  useEffect(() => {
    const handler = () => toggleTheme()
    window.addEventListener('relay:toggle-theme', handler)
    return () => window.removeEventListener('relay:toggle-theme', handler)
  }, [toggleTheme])

  function navigate(v: View) { setView(v) }

  function navigateToGroupPayment(groupId: number) {
    setPayGroupId(groupId)
    setView('group-payment')
  }

  const activeTab    = toTab(view)
  const showNav      = !SUB_VIEWS.includes(view)

  return (
    <AppShell theme={theme}>
      {view === 'home'          && <HomePage        onNavigate={navigate} />}
      {view === 'send'          && <PayPage          onNavigate={navigate} initialMode="single" backTo="home" />}
      {view === 'receive'       && <ReceiveSheet     onBack={() => navigate('home')} />}
      {view === 'groups'        && <GroupsPage       onNavigate={navigate} onPayGroup={navigateToGroupPayment} />}
      {view === 'create-group'  && <CreateGroupSheet onNavigate={navigate} />}
      {view === 'group-payment' && <GroupPayment     groupId={payGroupId} onNavigate={navigate} />}
      {view === 'activity'      && <ActivityPage />}
      {view === 'explorer'      && <ExplorerPage />}
      {view === 'account'       && <AccountPage      onNavigate={navigate} />}

      {showNav && (
        <BottomNav current={activeTab} onChange={(v) => navigate(v)} />
      )}
    </AppShell>
  )
}
