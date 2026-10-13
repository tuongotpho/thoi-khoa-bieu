import { COLORS, type BellSchedule, type Lesson, type Settings, type Slot, type Timetable } from './types'

const MS_DAY = 86_400_000

/** Ngày theo giờ máy → "YYYY-MM-DD" (không qua UTC để khỏi lệch múi giờ). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** 0 = Thứ 2 … 6 = Chủ nhật */
export function weekday(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function mondayOf(d: Date): Date {
  return addDays(d, -weekday(d))
}

export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / MS_DAY)
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Chuẩn hoá giờ viết kiểu Việt Nam: "7h15", "7h", "07:15", "13h00" → "HH:MM".
 * Không hiểu được thì trả "".
 */
export function normalizeTime(raw: string): string {
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})\s*[h:.giờ]+\s*(\d{1,2})?\s*(?:p|phút)?$/)
  if (!m) return ''
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** "dd/mm/yyyy" hoặc "yyyy-mm-dd" → "YYYY-MM-DD"; sai thì "". */
export function normalizeDate(raw: string): string {
  const s = raw.trim()
  let y: number, mo: number, d: number
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  else return ''
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return ''
  return toISODate(dt)
}

/** Bản thời khoá biểu đang có hiệu lực vào ngày d (bản có ngày hiệu lực gần nhất ≤ d). */
export function activeTimetable(d: Date, tts: Timetable[]): Timetable | undefined {
  const iso = toISODate(d)
  return [...tts]
    .filter((t) => t.effectiveFrom <= iso)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : a.effectiveFrom > b.effectiveFrom ? -1 : b.createdAt.localeCompare(a.createdAt)))[0]
}

/** Khoá tô màu: phần trước " - " (thường là lớp), để mỗi lớp một màu. */
export function colorKey(text: string): string {
  const t = text.trim().toLowerCase()
  const i = t.indexOf(' - ')
  return i > 0 ? t.slice(0, i) : t
}

/** Gán màu lần lượt theo thứ tự tên lớp — dưới 12 lớp thì không bao giờ trùng màu. */
export function buildPalette(slots: Slot[]): (text: string) => string {
  const keys = [...new Set(slots.map((s) => colorKey(s.text)))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }))
  const map = new Map(keys.map((k, i) => [k, COLORS[i % COLORS.length]]))
  return (text) => map.get(colorKey(text)) ?? COLORS[COLORS.length - 1]
}

export function periodTime(bell: BellSchedule, s: Slot) {
  return bell[s.session][s.period - 1]
}

export function slotOrder(s: Slot): number {
  return s.day * 100 + (s.session === 'am' ? 0 : 50) + s.period
}

export function toLesson(s: Slot, bell: BellSchedule, color = COLORS[6]): Lesson | null {
  const p = periodTime(bell, s)
  if (!p || !p.start || !p.end) return null
  return { ...s, start: p.start, end: p.end, color }
}

/** Các tiết của ngày d theo bản thời khoá biểu đang hiệu lực, xếp theo giờ. */
export function lessonsOn(d: Date, tts: Timetable[], bell: BellSchedule): Lesson[] {
  const tt = activeTimetable(d, tts)
  if (!tt) return []
  const wd = weekday(d)
  const color = buildPalette(tts.flatMap((t) => t.slots))
  return tt.slots
    .filter((s) => s.day === wd && s.text.trim())
    .map((s) => toLesson(s, bell, color(s.text)))
    .filter((l): l is Lesson => !!l)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
}

export type NowState =
  | { kind: 'now'; lesson: Lesson; minutesLeft: number }
  | { kind: 'next'; lesson: Lesson; minutesUntil: number }
  | { kind: 'done' }
  | { kind: 'free' }

export function nowState(now: Date, todays: Lesson[]): NowState {
  if (todays.length === 0) return { kind: 'free' }
  const m = now.getHours() * 60 + now.getMinutes()
  const cur = todays.find((l) => toMinutes(l.start) <= m && m < toMinutes(l.end))
  if (cur) return { kind: 'now', lesson: cur, minutesLeft: toMinutes(cur.end) - m }
  const next = todays.find((l) => toMinutes(l.start) > m)
  if (next) return { kind: 'next', lesson: next, minutesUntil: toMinutes(next.start) - m }
  return { kind: 'done' }
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} phút`
  const h = Math.floor(min / 60)
  const r = min % 60
  return r ? `${h} giờ ${r} phút` : `${h} giờ`
}

export function formatDateVN(d: Date | string): string {
  const x = typeof d === 'string' ? fromISODate(d) : d
  return `${x.getDate()}/${x.getMonth() + 1}/${x.getFullYear()}`
}

/** "11A4 - Hóa học" → ["11A4", "Hóa học"]; không có " - " thì phần sau rỗng. */
export function splitText(text: string): [string, string] {
  const i = text.indexOf(' - ')
  return i > 0 ? [text.slice(0, i).trim(), text.slice(i + 3).trim()] : [text.trim(), '']
}

/** Môn xuất hiện nhiều nhất — môn chính, khỏi ghi lặp lại trên mỗi dòng. */
export function mainSubject(texts: string[]): string {
  const count = new Map<string, number>()
  for (const t of texts) {
    const s = splitText(t)[1]
    if (s) count.set(s, (count.get(s) ?? 0) + 1)
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

// ---------- Xuất sang Lịch iPhone (.ics) ----------

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

function icsLocal(dateISO: string, hhmm: string): string {
  return `${dateISO.replace(/-/g, '')}T${hhmm.replace(':', '')}00`
}

/**
 * Mỗi tiết thành một sự kiện lặp hằng tuần, chạy từ ngày hiệu lực của bản
 * thời khoá biểu tới hết ngày trước bản kế tiếp. Bỏ qua các bản đã hết hạn.
 * Giờ "trôi" (không gắn múi giờ) nên iPhone hiểu là giờ địa phương.
 */
export function buildICS(tts: Timetable[], s: Pick<Settings, 'bell' | 'reminderMinutes'>, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const today = toISODate(now)
  const sorted = [...tts].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  const main = mainSubject(tts.flatMap((t) => t.slots.map((x) => x.text)))
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//August87//Thoi khoa bieu//VI',
    'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Thời khoá biểu',
  ]
  sorted.forEach((tt, i) => {
    const next = sorted.slice(i + 1).find((x) => x.effectiveFrom > tt.effectiveFrom)
    const lastDay = next ? toISODate(addDays(fromISODate(next.effectiveFrom), -1)) : ''
    if (lastDay && lastDay < today) return
    const from = fromISODate(tt.effectiveFrom)
    for (const slot of tt.slots) {
      const l = toLesson(slot, s.bell)
      if (!l || !l.text.trim()) continue
      const [title, subject] = splitText(l.text)
      const date = toISODate(addDays(from, (l.day - weekday(from) + 7) % 7))
      if (lastDay && date > lastDay) continue
      lines.push(
        'BEGIN:VEVENT',
        `UID:${tt.id}-${l.day}-${l.session}-${l.period}@thoikhoabieu`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsLocal(date, l.start)}`,
        `DTEND:${icsLocal(date, l.end)}`,
        `RRULE:FREQ=WEEKLY${lastDay ? `;UNTIL=${lastDay.replace(/-/g, '')}T235959` : ''}`,
        // Giống widget Lịch mẫu: tiêu đề "Tiết 1: 11A4", môn phụ (GDĐP) nằm ở ô địa điểm → hiện bên phải.
        `SUMMARY:${icsEscape(`Tiết ${l.period}: ${title}`)}`,
        `DESCRIPTION:${icsEscape(`${l.text.trim()} · Tiết ${l.period} ${l.session === 'am' ? 'sáng' : 'chiều'}`)}`,
      )
      if (subject && subject !== main) lines.push(`LOCATION:${icsEscape(subject)}`)
      if (s.reminderMinutes > 0) {
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(`Tiết ${l.period}: ${l.text.trim()}`)}`,
          `TRIGGER:-PT${s.reminderMinutes}M`, 'END:VALARM')
      }
      lines.push('END:VEVENT')
    }
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
