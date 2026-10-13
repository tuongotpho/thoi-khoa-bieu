import { DAY_SHORT, SESSION_NAMES, type BellSchedule, type Session, type Slot } from '../types'


export function gridDays(slots: Slot[], showSunday: boolean): number[] {
  return showSunday || slots.some((s) => s.day === 6) ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5]
}

export function gridPeriods(slots: Slot[], bell: BellSchedule, session: Session): number {
  return Math.max(bell[session].length, ...slots.filter((s) => s.session === session).map((s) => s.period), 0)
}

/** Lưới giống tờ thời khoá biểu giấy: hai bảng sáng/chiều, cột là thứ, hàng là tiết. */
export function TimetableGrid({
  slots, bell, showSunday, onCell, highlightDay, colorOf,
}: {
  slots: Slot[]
  colorOf: (text: string) => string
  bell: BellSchedule
  showSunday: boolean
  onCell?: (day: number, session: Session, period: number) => void
  highlightDay?: number
}) {
  const days = gridDays(slots, showSunday)
  const at = new Map(slots.map((s) => [`${s.day}-${s.session}-${s.period}`, s]))
  return (
    <div className="space-y-4">
      {(['am', 'pm'] as Session[]).map((session) => {
        const n = gridPeriods(slots, bell, session)
        if (n === 0) return null
        return (
          <div key={session}>
            <h3 className="mb-1.5 px-1 text-xs uppercase tracking-wide text-muted">{SESSION_NAMES[session]}</h3>
            <div className="overflow-hidden rounded-xl bg-card">
              <table className="w-full table-fixed border-collapse text-[11px] leading-tight">
                <thead>
                  <tr>
                    <th className="w-9 py-1.5 text-muted">Tiết</th>
                    {days.map((d) => (
                      <th key={d} className={`py-1.5 font-semibold ${d === highlightDay ? 'text-accent' : ''}`}>{DAY_SHORT[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
                    <tr key={p} className="border-t border-sep">
                      <td className="py-1 text-center align-middle">
                        <div className="font-semibold">{p}</div>
                        <div className="text-[9px] text-muted">{bell[session][p - 1]?.start ?? ''}</div>
                      </td>
                      {days.map((d) => {
                        const s = at.get(`${d}-${session}-${p}`)
                        const Tag = onCell ? 'button' : 'div'
                        return (
                          <td key={d} className={`border-l border-sep p-0.5 align-top ${d === highlightDay ? 'bg-accent/5' : ''}`}>
                            <Tag
                              onClick={onCell ? () => onCell(d, session, p) : undefined}
                              aria-label={onCell ? `${DAY_SHORT[d]} ${SESSION_NAMES[session]} tiết ${p}` : undefined}
                              className={`flex min-h-11 w-full items-center justify-center rounded-md px-0.5 text-center break-words ${s ? 'font-medium text-white' : onCell ? 'text-muted/50' : ''}`}
                              style={s ? { background: colorOf(s.text) } : undefined}
                            >
                              {s ? s.text : onCell ? '+' : ''}
                            </Tag>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
