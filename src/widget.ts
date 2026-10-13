import type { AppData, Lesson } from './types'
import { addDays, lessonsOn, toISODate } from './time'

/**
 * Dữ liệu gửi sang widget màn hình chính (Swift đọc lại, xem ios/App/TKBWidget).
 * Tính sẵn 14 ngày tới để widget tự chuyển "Hôm nay" → "Ngày mai" mà không cần mở app.
 */
export interface WidgetLesson {
  start: string
  end: string
  period: number
  session: 'am' | 'pm'
  /** Phần chính, ví dụ "11A4" */
  title: string
  /** Môn, chỉ ghi khi khác môn mình dạy nhiều nhất (ví dụ "GDĐP"), không thì rỗng */
  detail: string
  color: string
}

export interface WidgetFeed {
  v: 1
  days: { date: string; lessons: WidgetLesson[] }[]
}

function split(text: string): [string, string] {
  const i = text.indexOf(' - ')
  return i > 0 ? [text.slice(0, i).trim(), text.slice(i + 3).trim()] : [text.trim(), '']
}

/** Môn xuất hiện nhiều nhất — môn chính, khỏi ghi lặp lại trên mỗi dòng. */
export function mainSubject(texts: string[]): string {
  const count = new Map<string, number>()
  for (const t of texts) {
    const s = split(t)[1]
    if (s) count.set(s, (count.get(s) ?? 0) + 1)
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

export function buildWidgetFeed(data: AppData, now = new Date(), days = 14): WidgetFeed {
  const main = mainSubject(data.timetables.flatMap((t) => t.slots.map((s) => s.text)))
  const toW = (l: Lesson): WidgetLesson => {
    const [title, subject] = split(l.text)
    return {
      start: l.start, end: l.end, period: l.period, session: l.session,
      title, detail: subject && subject !== main ? subject : '', color: l.color,
    }
  }
  return {
    v: 1,
    days: Array.from({ length: days }, (_, i) => {
      const d = addDays(now, i)
      return { date: toISODate(d), lessons: lessonsOn(d, data.timetables, data.settings.bell).map(toW) }
    }),
  }
}
