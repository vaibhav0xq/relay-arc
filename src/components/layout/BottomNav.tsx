import { Home, Users, UserCircle, Clock, Compass } from 'lucide-react'

export type Tab = 'home' | 'groups' | 'activity' | 'explorer' | 'account'

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: 'home',     label: 'Home',     Icon: Home       },
  { id: 'groups',   label: 'Groups',   Icon: Users      },
  { id: 'activity', label: 'Activity', Icon: Clock      },
  { id: 'explorer', label: 'Explorer', Icon: Compass    },
  { id: 'account',  label: 'Account',  Icon: UserCircle },
]

interface BottomNavProps {
  current:  Tab
  onChange: (v: Tab) => void
}

export function BottomNav({ current, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex"
      style={{
        background:           'var(--nav-bg)',
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:            '1px solid var(--border)',
        height:               56,
        paddingBottom:        'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const active = current === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-label={label}
            className="flex flex-1 flex-col items-center justify-center gap-[3px]"
            style={{
              background:              'transparent',
              border:                  'none',
              cursor:                  'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon
              className="size-[20px]"
              strokeWidth={active ? 2.2 : 1.6}
              style={{ color: active ? 'var(--accent)' : 'var(--subtle)' }}
            />
            <span
              className="text-[9px] font-semibold"
              style={{ color: active ? 'var(--accent)' : 'var(--subtle)' }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
