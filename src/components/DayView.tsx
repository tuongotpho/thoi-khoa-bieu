import { useEffect, useRef, useState } from 'react'
import { DAY_NAMES } from '../types'
import {
  addDays, daysBetween, formatDateVN, formatDuration, fromISODate, lessonsOn, nowState, toISODate, toMinutes, weekday,
} from '../time'
import type { Store } from '../store'
import { Empty } from './ui'

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    const vis = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return now
}

/** "11A4 - Hóa học" → ["11A4", "Hóa học"] */
function splitText(t: string): [string, string] {
  const i = t.indexOf(' - ')
  return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : [t, '']
}

export function DayView({ store, goTimetable }: { store: Store; goTimetable: () => void }) {
  const { timetables, tasks, settings } = store.data
  const now = useNow()
  const [offset, setOffset] = useState(0)
  const date = addDays(now, offset)
  const isToday = offset === 0
  const list = lessonsOn(date, timetables, settings.bell)
  const dueTasks = tasks.filter((t) => !t.done && t.due === toISODate(date))
  const state = nowState(now, list)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const upcoming = timetables
    .filter((t) => t.effectiveFrom > toISODate(now))
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0]
  const upcomingIn = upcoming ? daysBetween(now, fromISODate(upcoming.effectiveFrom)) : 99

  // Vuốt trái/phải để sang ngày kế / ngày trước.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setOffset((o) => o + (dx < 0 ? 1 : -1))
  }

  if (timetables.length === 0) {
    return (
      <div className="pt-6 text-center">
        <Empty icon="📷" title="Chưa có thời khoá biểu"
          hint="Nhập thời khoá biểu một lần, app tự xếp lịch từng ngày cho bạn." />
        <button className="rounded-xl bg-accent px-5 py-3 font-semibold text-white" onClick={goTimetable}>
          Thêm thời khoá biểu
        </button>
      </div>
    )
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="min-h-[70dvh]">
      <div className="mb-4 flex items-center gap-2">
        <button aria-label="Ngày trước" className="h-10 w-10 rounded-full bg-card text-xl text-accent" onClick={() => setOffset((o) => o - 1)}>‹</button>
        <div className="flex-1 text-center">
          <div className="text-lg font-semibold">
            {isToday ? 'Hôm nay' : offset === 1 ? 'Ngày mai' : offset === -1 ? 'Hôm qua' : DAY_NAMES[weekday(date)]}
          </div>
          <div className="text-sm text-muted">{DAY_NAMES[weekday(date)]}, {formatDateVN(date)}</div>
        </div>
        <button aria-label="Ngày sau" className="h-10 w-10 rounded-full bg-card text-xl text-accent" onClick={() => setOffset((o) => o + 1)}>›</button>
      </div>
      {!isToday && (
        <div className="-mt-2 mb-3 text-center">
          <button className="text-sm text-accent" onClick={() => setOffset(0)}>Về hôm nay</button>
        </div>
      )}

      {isToday && upcoming && upcomingIn <= 7 && (
        <button onClick={goTimetable} className="mb-3 w-full rounded-xl bg-orange-500/10 px-4 py-2.5 text-left text-sm text-orange-600 dark:text-orange-400">
          🔔 Từ {DAY_NAMES[weekday(fromISODate(upcoming.effectiveFrom))]} {formatDateVN(upcoming.effectiveFrom)} áp dụng thời khoá biểu mới ›
        </button>
      )}

      {isToday && state.kind !== 'free' && (
        <div className="mb-4 rounded-2xl p-4 text-white shadow-sm"
          style={{ background: state.kind === 'now' || state.kind === 'next' ? state.lesson.color : '#8e8e93' }}>
          {state.kind === 'now' && (<>
            <div className="text-xs font-semibold uppercase opacity-80">Đang học · Tiết {state.lesson.period}</div>
            <div className="text-2xl font-bold">{state.lesson.text}</div>
            <div className="opacity-90">còn {formatDuration(state.minutesLeft)} (đến {state.lesson.end})</div>
          </>)}
          {state.kind === 'next' && (<>
            <div className="text-xs font-semibold uppercase opacity-80">Tiết tiếp theo · Tiết {state.lesson.period} {state.lesson.session === 'am' ? 'sáng' : 'chiều'}</div>
            <div className="text-2xl font-bold">{state.lesson.text}</div>
            <div className="opacity-90">sau {formatDuration(state.minutesUntil)} · vào lúc {state.lesson.start}</div>
          </>)}
          {state.kind === 'done' && <div className="font-semibold">Hết tiết hôm nay 🎉</div>}
        </div>
      )}

      {list.length === 0 ? (
        <Empty icon="☕" title="Không có tiết nào" hint="Vuốt sang trái/phải để xem ngày khác." />
      ) : (
        <ul className="space-y-2">
          {list.map((l, i) => {
            const past = isToday && toMinutes(l.end) <= nowMin
            const live = isToday && state.kind === 'now' && state.lesson === l
            const [main, sub] = splitText(l.text)
            const newSession = i > 0 && list[i - 1].session !== l.session
            return (
              <li key={`${l.session}-${l.period}`} className={newSession ? 'pt-3' : ''}>
                <div className={`flex items-stretch gap-3 rounded-xl bg-card p-3 ${past ? 'opacity-50' : ''} ${live ? 'ring-2' : ''}`}
                  style={{ ['--tw-ring-color' as string]: l.color }}>
                  <div className="w-12 shrink-0 text-sm tabular-nums">
                    <div className="font-semibold">{l.start}</div>
                    <div className="text-muted">{l.end}</div>
                  </div>
                  <div className="w-1 shrink-0 rounded-full" style={{ background: l.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{main}</div>
                    <div className="truncate text-sm text-muted">
                      {sub && `${sub} · `}Tiết {l.period} {l.session === 'am' ? 'sáng' : 'chiều'}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dueTasks.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-1.5 px-1 text-xs uppercase tracking-wide text-muted">Việc đến hạn</h3>
          <ul className="divide-y divide-sep overflow-hidden rounded-xl bg-card">
            {dueTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <button aria-label="Đánh dấu xong" onClick={() => store.toggleTask(t.id)}
                  className="h-6 w-6 shrink-0 rounded-full border-2 border-muted" />
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                {t.category && <span className="text-sm text-muted">{t.category}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
