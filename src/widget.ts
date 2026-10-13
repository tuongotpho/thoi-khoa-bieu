import type { AppData, Lesson } from './types'
import scriptTemplate from './scriptable-widget.js?raw'
import { addDays, buildPalette, lessonsOn, mainSubject, splitText as split, toISODate, toLesson, toMinutes } from './time'

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

// ---------- Widget qua app Scriptable (dùng cho bản web) ----------


/** Một tiết, viết gọn: s/e = giờ vào/ra, p = tiết, t = lớp, d = môn phụ, c = màu */
export interface ScriptLesson { s: string; e: string; p: number; t: string; d: string; c: string }
export interface ScriptData { versions: { from: string; week: ScriptLesson[][] }[] }

/** Toàn bộ các bản thời khoá biểu, mỗi bản chia sẵn theo thứ — widget tự tính ngày nào dùng bản nào. */
export function buildScriptableData(data: AppData): ScriptData {
  const all = data.timetables.flatMap((t) => t.slots)
  const main = mainSubject(all.map((s) => s.text))
  const color = buildPalette(all)
  return {
    versions: [...data.timetables]
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
      .map((tt) => ({
        from: tt.effectiveFrom,
        week: Array.from({ length: 7 }, (_, day) =>
          tt.slots
            .filter((s) => s.day === day && s.text.trim())
            .map((s) => toLesson(s, data.settings.bell, color(s.text)))
            .filter((l): l is Lesson => !!l)
            .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
            .map((l) => {
              const [t, subject] = split(l.text)
              return { s: l.start, e: l.end, p: l.period, t, d: subject && subject !== main ? subject : '', c: l.color }
            }),
        ),
      })),
  }
}

export function buildScriptableScript(data: AppData, appUrl: string): string {
  return scriptTemplate
    .replace('__DATA__', JSON.stringify(buildScriptableData(data)))
    .replace('__APP_URL__', JSON.stringify(appUrl))
}
