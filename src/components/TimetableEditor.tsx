import { useMemo, useState } from 'react'
import { DAY_NAMES, SESSION_NAMES, type Session, type Slot, type Timetable } from '../types'
import { buildPalette, daysBetween, formatDateVN, fromISODate, toISODate } from '../time'
import { uid, type Store } from '../store'
import { Group, Sheet, inputCls, useVisibleViewport } from './ui'
import { ask } from './dialog'
import { TimetableGrid } from './TimetableGrid'

export interface Draft {
  id?: string
  effectiveFrom: string
  title: string
  slots: Slot[]
}

/** Nhập / sửa thời khoá biểu trên lưới rồi lưu thành một bản có ngày áp dụng. */
export function TimetableEditor({
  store, draft, heading, onClose,
}: {
  store: Store
  draft: Draft
  heading: string
  onClose: () => void
}) {
  const { timetables, settings } = store.data
  const [d, setD] = useState<Draft>(draft)
  const [cell, setCell] = useState<{ day: number; session: Session; period: number } | null>(null)

  const suggestions = useMemo(
    () => [...new Set([...d.slots, ...timetables.flatMap((t) => t.slots)].map((s) => s.text))].sort(),
    [d.slots, timetables],
  )

  // Cảnh báo ngày hiệu lực lạ — ví dụ gõ nhầm 12/10/2027 trong khi đang năm học 2026–2027.
  const today = new Date()
  const gap = d.effectiveFrom ? daysBetween(today, fromISODate(d.effectiveFrom)) : 0
  const suspicious = d.effectiveFrom && Math.abs(gap) > 120
  const fixedYear = d.effectiveFrom
    ? toISODate(new Date(today.getFullYear(), fromISODate(d.effectiveFrom).getMonth(), fromISODate(d.effectiveFrom).getDate()))
    : ''
  const clash = timetables.find((t) => t.effectiveFrom === d.effectiveFrom && t.id !== d.id)

  const save = async () => {
    if (d.slots.length === 0 && !(await ask('Bản này chưa có tiết nào. Vẫn lưu?', { ok: 'Vẫn lưu' }))) return
    if (clash && !(await ask(`Đã có một bản áp dụng từ ${formatDateVN(d.effectiveFrom)}. Thay bản đó bằng bản này?`, { ok: 'Thay' }))) return
    if (clash) store.deleteTimetable(clash.id)
    const tt: Timetable = {
      id: d.id ?? uid(),
      effectiveFrom: d.effectiveFrom,
      title: d.title.trim(),
      slots: d.slots,
      createdAt: new Date().toISOString(),
    }
    store.saveTimetable(tt)
    onClose()
  }

  const key = (s: { day: number; session: Session; period: number }) => `${s.day}-${s.session}-${s.period}`
  const current = cell ? d.slots.find((s) => key(s) === key(cell))?.text ?? '' : ''
  const setCellText = (text: string) => {
    if (!cell) return
    const rest = d.slots.filter((s) => key(s) !== key(cell))
    setD({ ...d, slots: text.trim() ? [...rest, { ...cell, text: text.trim() }] : rest })
  }

  return (
    <Sheet title={heading} onClose={onClose} onSave={save} saveDisabled={!d.effectiveFrom}>
      <Group
        footer={
          !d.effectiveFrom ? <span className="text-red-500">Cần chọn ngày bắt đầu áp dụng.</span>
          : suspicious ? (
            <span className="text-orange-500">
              Ngày này cách hôm nay {Math.abs(gap)} ngày — có thể nhầm năm.{' '}
              {fixedYear !== d.effectiveFrom && (
                <button className="font-semibold text-accent underline" onClick={() => setD({ ...d, effectiveFrom: fixedYear })}>
                  Đổi thành {formatDateVN(fixedYear)}
                </button>
              )}
            </span>
          ) : 'Từ ngày này app tự chuyển sang bản thời khoá biểu này. Bản cũ vẫn được giữ.'
        }
      >
        <label className="flex items-center px-4 py-2">
          <span>Áp dụng từ ngày</span>
          <input type="date" className="ml-auto bg-transparent text-accent outline-none" value={d.effectiveFrom}
            onChange={(e) => setD({ ...d, effectiveFrom: e.target.value })} />
        </label>
        <input className={inputCls} placeholder="Ghi chú (tên GV, lớp…)" value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })} />
      </Group>

      <p className="mb-2 px-1 text-sm text-muted">
        Có {d.slots.length} tiết. Bấm vào ô để sửa, ô trống để thêm.
      </p>
      <TimetableGrid colorOf={buildPalette([...timetables.flatMap((t) => t.slots), ...d.slots])} slots={d.slots} bell={settings.bell} showSunday={settings.showSunday}
        onCell={(day, session, period) => setCell({ day, session, period })} />
      <div className="h-6" />

      {d.id && (
        <Group>
          <button className="w-full px-4 py-3 text-red-500" onClick={async () => {
            if (await ask(`Xoá bản thời khoá biểu áp dụng từ ${formatDateVN(draft.effectiveFrom)}?`, { ok: 'Xoá', danger: true })) {
              store.deleteTimetable(d.id!)
              onClose()
            }
          }}>Xoá bản này</button>
        </Group>
      )}

      {cell && (
        <CellEditor
          label={`${DAY_NAMES[cell.day]} · ${SESSION_NAMES[cell.session]} · Tiết ${cell.period}`}
          value={current}
          suggestions={suggestions}
          onDone={(v) => { setCellText(v); setCell(null) }}
          onCancel={() => setCell(null)}
        />
      )}
    </Sheet>
  )
}

function CellEditor({ label, value, suggestions, onDone, onCancel }: {
  label: string
  value: string
  suggestions: string[]
  onDone: (v: string) => void
  onCancel: () => void
}) {
  const [v, setV] = useState(value)
  const viewport = useVisibleViewport()
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center" style={viewport} onClick={onCancel}>
      <div className="sheet-in w-full max-w-lg rounded-t-2xl bg-grouped p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center font-semibold">{label}</div>
        <div className="mb-3 overflow-hidden rounded-xl bg-card">
          <input className={inputCls} autoFocus value={v} placeholder="VD: 11A4 - Hóa học"
            onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onDone(v)} />
        </div>
        {suggestions.length > 0 && (
          <div className="mb-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {suggestions.map((s) => (
              <button key={s} onClick={() => onDone(s)} className="rounded-full bg-card px-3 py-1.5 text-sm">{s}</button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {value && <button className="flex-1 rounded-xl bg-card py-3 text-red-500" onClick={() => onDone('')}>Xoá tiết</button>}
          <button className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white" onClick={() => onDone(v)}>Xong</button>
        </div>
      </div>
    </div>
  )
}
