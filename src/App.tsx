import { useEffect, useState, type ReactNode } from 'react'
import { useAppData } from './store'
import { DayView } from './components/DayView'
import { TimetableTab } from './components/TimetableTab'
import { TasksView } from './components/TasksView'
import { SettingsView } from './components/SettingsView'
import { DialogHost } from './components/dialog'
import { syncNative } from './native'
import { useSync } from './useSync'

type Tab = 'today' | 'week' | 'tasks' | 'settings'

const ICONS: Record<Tab, ReactNode> = {
  today: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  week: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M9 9v12M15 9v12M8 2v4M16 2v4" /></>,
  tasks: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
}
const LABELS: Record<Tab, string> = { today: 'Hôm nay', week: 'Thời khoá biểu', tasks: 'Việc cần làm', settings: 'Cài đặt' }
const SHORT: Record<Tab, string> = { today: 'Hôm nay', week: 'TKB', tasks: 'Việc', settings: 'Cài đặt' }

export default function App() {
  const store = useAppData()
  const sync = useSync(store)
  const [tab, setTab] = useState<Tab>('today')

  // App iPhone: cập nhật widget + chuông báo khi dữ liệu đổi và mỗi lần mở lại app.
  useEffect(() => { void syncNative(store.data) }, [store.data])
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && void syncNative(store.data)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [store.data])
  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0) }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <h1 className="mb-4 text-3xl font-bold tracking-tight">{LABELS[tab]}</h1>
      {tab === 'today' && <DayView store={store} goTimetable={() => go('week')} />}
      {tab === 'week' && <TimetableTab store={store} goSettings={() => go('settings')} />}
      {tab === 'tasks' && <TasksView store={store} />}
      {tab === 'settings' && <SettingsView store={store} sync={sync} />}

      <DialogHost />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sep bg-bar/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {(Object.keys(ICONS) as Tab[]).map((t) => (
            <button key={t} onClick={() => go(t)} aria-current={tab === t ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] ${tab === t ? 'text-accent' : 'text-muted'}`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[t]}</svg>
              {SHORT[t]}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
