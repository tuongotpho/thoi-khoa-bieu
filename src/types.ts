export type Session = 'am' | 'pm'

/** Giờ của một tiết, "HH:MM" */
export interface Period {
  start: string
  end: string
}

/** Thời gian biểu: tiết mấy học lúc mấy giờ (gần như cố định cả học kỳ). */
export interface BellSchedule {
  am: Period[]
  pm: Period[]
}

/** Một ô trong thời khoá biểu, ví dụ Thứ 3 · sáng · tiết 2 · "11A8 - Hóa học". */
export interface Slot {
  /** 0 = Thứ 2 … 6 = Chủ nhật */
  day: number
  session: Session
  /** 1, 2, 3… */
  period: number
  text: string
}

/** Một bản thời khoá biểu, áp dụng từ ngày effectiveFrom tới khi có bản mới hơn. */
export interface Timetable {
  id: string
  /** "YYYY-MM-DD" */
  effectiveFrom: string
  title: string
  slots: Slot[]
  createdAt: string
}

export interface Task {
  id: string
  title: string
  notes: string
  /** "YYYY-MM-DD", rỗng = không hạn */
  due: string
  category: string
  done: boolean
}

export interface Settings {
  bell: BellSchedule
  showSunday: boolean
  /** Nhắc trước bao nhiêu phút khi xuất sang Lịch iPhone */
  reminderMinutes: number
  categories: string[]
}

export interface AppData {
  version: 2
  timetables: Timetable[]
  tasks: Task[]
  settings: Settings
}

/** Một tiết học cụ thể trong một ngày, đã ghép giờ từ thời gian biểu. */
export interface Lesson extends Slot {
  start: string
  end: string
  color: string
}

export const COLORS = [
  '#ff3b30', '#ff9500', '#d4a500', '#34c759', '#00a8a0', '#30b0c7',
  '#007aff', '#5856d6', '#af52de', '#ff2d55', '#a2845e', '#64748b',
]

export const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
export const DAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
export const SESSION_NAMES: Record<Session, string> = { am: 'Buổi sáng', pm: 'Buổi chiều' }
