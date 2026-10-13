import { useEffect, useState } from 'react'
import type { AppData, BellSchedule, Period, Settings, Slot, Task, Timetable } from './types'
import { normalizeDate, normalizeTime } from './time'

const KEY = 'tkb-data-v2'

/** Mặc định: thời gian biểu HK I 2026–2027 của THPT Nguyễn Trãi – Ba Đình (sửa được trong Cài đặt). */
export const DEFAULT_BELL: BellSchedule = {
  am: [
    { start: '07:15', end: '08:00' }, { start: '08:05', end: '08:50' }, { start: '09:00', end: '09:45' },
    { start: '09:50', end: '10:35' }, { start: '10:40', end: '11:25' },
  ],
  pm: [
    { start: '13:00', end: '13:45' }, { start: '13:50', end: '14:35' }, { start: '14:45', end: '15:30' },
    { start: '15:35', end: '16:20' }, { start: '16:25', end: '17:10' },
  ],
}

export const DEFAULT_SETTINGS: Settings = {
  bell: DEFAULT_BELL,
  showSunday: false,
  reminderMinutes: 5,
  categories: ['Soạn bài', 'Chấm bài', 'Họp', 'Khác'],
}

export function emptyData(): AppData {
  return { version: 2, timetables: [], tasks: [], settings: structuredClone(DEFAULT_SETTINGS) }
}

const isStr = (v: unknown): v is string => typeof v === 'string'

export function cleanPeriods(raw: unknown): Period[] {
  if (!Array.isArray(raw)) return []
  return raw.map((p) => ({
    start: normalizeTime(String(p?.start ?? '')),
    end: normalizeTime(String(p?.end ?? '')),
  }))
}

export function cleanSlots(raw: unknown): Slot[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Slot[] = []
  for (const s of raw) {
    if (!s || !isStr(s.text) || !s.text.trim()) continue
    const day = Number(s.day)
    const period = Number(s.period)
    if (!Number.isInteger(day) || day < 0 || day > 6) continue
    if (!Number.isInteger(period) || period < 1 || period > 12) continue
    if (s.session !== 'am' && s.session !== 'pm') continue
    const k = `${day}-${s.session}-${period}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ day, session: s.session, period, text: s.text.trim().replace(/\s+/g, ' ') })
  }
  return out
}

/** Kiểm tra file sao lưu trước khi nhận — sai thì báo lỗi, không ghi đè dữ liệu đang có. */
export function parseData(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('File không phải dữ liệu thời khoá biểu')
  const r = raw as Partial<AppData>
  if (!Array.isArray(r.timetables) || !Array.isArray(r.tasks)) {
    throw new Error('File thiếu thời khoá biểu hoặc danh sách việc')
  }
  const timetables: Timetable[] = r.timetables
    .filter((t) => t && isStr(t.id) && normalizeDate(String(t.effectiveFrom ?? '')))
    .map((t) => ({
      id: t.id,
      effectiveFrom: normalizeDate(t.effectiveFrom),
      title: isStr(t.title) ? t.title : '',
      slots: cleanSlots(t.slots),
      createdAt: isStr(t.createdAt) ? t.createdAt : new Date().toISOString(),
    }))
  const tasks: Task[] = r.tasks
    .filter((t) => !!t && isStr(t.id) && isStr(t.title))
    .map((t) => ({ notes: '', due: '', category: '', done: false, ...(t as Partial<Task>) }) as Task)
  // Bỏ các trường cũ không còn dùng (khoá Gemini của bản trước).
  const { geminiKey: _k, geminiModel: _m, ...st } = (r.settings ?? {}) as Partial<Settings> & { geminiKey?: unknown; geminiModel?: unknown }
  void _k; void _m
  const bell = st.bell ? { am: cleanPeriods(st.bell.am), pm: cleanPeriods(st.bell.pm) } : DEFAULT_SETTINGS.bell
  return { version: 2, timetables, tasks, settings: { ...structuredClone(DEFAULT_SETTINGS), ...st, bell } }
}

function load(): AppData {
  try {
    const s = localStorage.getItem(KEY)
    if (s) return parseData(JSON.parse(s))
  } catch {
    /* hỏng thì bắt đầu lại từ dữ liệu trống */
  }
  return emptyData()
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function useAppData() {
  const [data, setData] = useState<AppData>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* bộ nhớ đầy / chế độ riêng tư */
    }
  }, [data])

  return {
    data,
    replaceAll: (d: AppData) => setData(d),
    saveTimetable: (t: Timetable) =>
      setData((d) => ({
        ...d,
        timetables: d.timetables.some((x) => x.id === t.id)
          ? d.timetables.map((x) => (x.id === t.id ? t : x))
          : [...d.timetables, t],
      })),
    deleteTimetable: (id: string) =>
      setData((d) => ({ ...d, timetables: d.timetables.filter((x) => x.id !== id) })),
    saveTask: (t: Task) =>
      setData((d) => ({
        ...d,
        tasks: d.tasks.some((x) => x.id === t.id) ? d.tasks.map((x) => (x.id === t.id ? t : x)) : [...d.tasks, t],
      })),
    deleteTask: (id: string) => setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) })),
    toggleTask: (id: string) =>
      setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) })),
    updateSettings: (p: Partial<Settings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...p } })),
  }
}

export type Store = ReturnType<typeof useAppData>
