import { useState } from 'react'
import { activeTimetable, buildPalette, addDays, formatDateVN, mondayOf, toISODate, weekday } from '../time'
import type { Store } from '../store'
import type { Timetable } from '../types'
import { TimetableGrid } from './TimetableGrid'
import { TimetableEditor, type Draft } from './TimetableEditor'
import { Empty, Group, Row } from './ui'

export function TimetableTab({ store }: { store: Store }) {
  const { timetables, settings } = store.data
  const [weekOffset, setWeekOffset] = useState(0)
  const [editing, setEditing] = useState<{ draft: Draft; heading: string } | null>(null)

  const today = new Date()
  const monday = addDays(mondayOf(today), weekOffset * 7)
  // Bản áp dụng cho tuần đang xem: lấy theo ngày cuối tuần để thấy luôn bản đổi giữa tuần.
  const tt = activeTimetable(addDays(monday, 6), timetables)
  const ttStart = activeTimetable(monday, timetables)
  const sorted = [...timetables].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  const current = activeTimetable(today, timetables)

  // Nhập tay: nếu hôm nay đã có bản bắt đầu đúng hôm nay thì sửa luôn bản đó, khỏi tạo bản trùng ngày.
  const manualDraft = (): Draft =>
    current && current.effectiveFrom === toISODate(today)
      ? { id: current.id, effectiveFrom: current.effectiveFrom, title: current.title, slots: current.slots }
      : { effectiveFrom: toISODate(today), title: current?.title ?? '', slots: current?.slots ?? [] }

  const edit = (t: Timetable) =>
    setEditing({ draft: { id: t.id, effectiveFrom: t.effectiveFrom, title: t.title, slots: t.slots }, heading: 'Sửa thời khoá biểu' })

  return (
    <div>
      <div className="mb-4">
        <button onClick={() => setEditing({ draft: manualDraft(), heading: 'Nhập thời khoá biểu' })} className="w-full rounded-xl bg-accent px-3 py-3 font-semibold text-white">
          ✏️ Nhập / sửa thời khoá biểu
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button aria-label="Tuần trước" className="h-10 w-10 rounded-full bg-card text-xl text-accent" onClick={() => setWeekOffset((w) => w - 1)}>‹</button>
        <div className="flex-1 text-center">
          <div className="font-semibold">
            {weekOffset === 0 ? 'Tuần này' : weekOffset === 1 ? 'Tuần sau' : weekOffset === -1 ? 'Tuần trước' : `Tuần ${formatDateVN(monday)}`}
          </div>
          <div className="text-xs text-muted">{formatDateVN(monday)} – {formatDateVN(addDays(monday, 6))}</div>
        </div>
        <button aria-label="Tuần sau" className="h-10 w-10 rounded-full bg-card text-xl text-accent" onClick={() => setWeekOffset((w) => w + 1)}>›</button>
      </div>

      {!tt ? (
        <Empty icon="🗓️" title="Chưa có thời khoá biểu cho tuần này"
          hint="Bấm “Nhập / sửa thời khoá biểu” rồi bấm vào từng ô để điền lớp, môn." />
      ) : (
        <>
          <p className="mb-2 px-1 text-sm text-muted">
            Áp dụng từ <b>{formatDateVN(tt.effectiveFrom)}</b>{tt.title && ` · ${tt.title}`}
            {ttStart && ttStart.id !== tt.id && <span className="text-orange-500"> · đổi bản giữa tuần, lưới hiện bản mới</span>}
          </p>
          <TimetableGrid colorOf={buildPalette(timetables.flatMap((t) => t.slots))} slots={tt.slots} bell={settings.bell} showSunday={settings.showSunday}
            highlightDay={weekOffset === 0 ? weekday(today) : undefined} />
          <div className="h-6" />
        </>
      )}

      {sorted.length > 0 && (
        <Group title="Các bản thời khoá biểu" footer="Bấm để sửa. App tự dùng bản có ngày áp dụng gần nhất.">
          {sorted.map((t) => (
            <Row key={t.id} onClick={() => edit(t)}
              label={<span>Từ {formatDateVN(t.effectiveFrom)}{t.title && <span className="text-muted"> · {t.title}</span>}</span>}>
              {t.id === current?.id ? <span className="text-green-600">Đang dùng</span>
                : t.effectiveFrom > toISODate(today) ? <span className="text-accent">Sắp tới</span> : <span>Cũ</span>}
              <span className="text-xs">{t.slots.length} tiết ›</span>
            </Row>
          ))}
        </Group>
      )}

      {editing && (
        <TimetableEditor store={store} draft={editing.draft} heading={editing.heading}
          onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
