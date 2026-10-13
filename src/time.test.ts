import { describe, expect, it } from 'vitest'
import {
  activeTimetable, buildICS, lessonsOn, normalizeDate, normalizeTime, nowState, weekday,
} from './time'
import { DEFAULT_BELL, cleanSlots, parseData } from './store'
import type { Timetable } from './types'

/** Nội dung tấm TKB mẫu người dùng gửi, chép tay (day: 2 = Thứ 2 … 7 = Thứ 7). */
const SAMPLE = {
  effectiveFrom: '12/10/2027', // đúng như in trên ảnh (nhiều khả năng gõ nhầm 2026)
  title: 'GV mẫu',
  cells: [
    { day: 4, session: 'am', period: 1, text: '11A4 - Hóa học' },
    { day: 7, session: 'am', period: 1, text: '11A4 - Hóa học' },
    { day: 3, session: 'am', period: 2, text: '11A8 - Hóa học' },
    { day: 4, session: 'am', period: 2, text: '11A8 - Hóa học' },
    { day: 5, session: 'am', period: 2, text: '11A6 - Hóa học' },
    { day: 7, session: 'am', period: 3, text: '11A6 - Hóa học' },
    { day: 3, session: 'am', period: 4, text: '11A4 - Hóa học' },
    { day: 5, session: 'am', period: 4, text: '11A8 - Hóa học' },
    { day: 3, session: 'am', period: 5, text: '11A6 - Hóa học' },
    { day: 2, session: 'pm', period: 1, text: '10A4 - Hóa học' },
    { day: 4, session: 'pm', period: 1, text: '10A4 - Hóa học' },
    { day: 3, session: 'pm', period: 2, text: '10A4 - Hóa học' },
    { day: 7, session: 'pm', period: 2, text: '10A3 - Hóa học' },
    { day: 2, session: 'pm', period: 3, text: '10A3 - Hóa học' },
    { day: 4, session: 'pm', period: 3, text: '10A4 - GDĐP' },
    { day: 3, session: 'pm', period: 4, text: '10A3 - Hóa học' },
    { day: 7, session: 'pm', period: 4, text: '10A3 - GDĐP' },
  ],
}

/** Đổi Thứ 2..7 → 0..5 rồi làm sạch như khi đọc dữ liệu đã lưu. */
const sampleSlots = () => cleanSlots(SAMPLE.cells.map((c) => ({ ...c, day: c.day - 2 })))

const TT = (p: Partial<Timetable>): Timetable => ({
  id: 'x', effectiveFrom: '2026-10-12', title: '', slots: [], createdAt: '2026-10-01T00:00:00Z', ...p,
})

describe('chuẩn hoá giờ & ngày kiểu Việt Nam', () => {
  it('giờ', () => {
    expect(normalizeTime('7h15')).toBe('07:15')
    expect(normalizeTime('13h00')).toBe('13:00')
    expect(normalizeTime('7h')).toBe('07:00')
    expect(normalizeTime('08:05')).toBe('08:05')
    expect(normalizeTime('25h00')).toBe('')
    expect(normalizeTime('abc')).toBe('')
  })
  it('ngày', () => {
    expect(normalizeDate('12/10/2027')).toBe('2027-10-12')
    expect(normalizeDate('5/9/2026')).toBe('2026-09-05')
    expect(normalizeDate('2026-10-12')).toBe('2026-10-12')
    expect(normalizeDate('31/02/2026')).toBe('')
    expect(normalizeDate('')).toBe('')
  })
  it('Thứ 2 = 0, Chủ nhật = 6', () => {
    expect(weekday(new Date(2026, 9, 12))).toBe(0)
    expect(weekday(new Date(2026, 9, 18))).toBe(6)
  })
})

describe('làm sạch ô thời khoá biểu', () => {
  it('TKB mẫu đủ 17 ô', () => {
    const slots = sampleSlots()
    expect(slots).toHaveLength(17)
    expect(slots[0]).toEqual({ day: 2, session: 'am', period: 1, text: '11A4 - Hóa học' })
  })
  it('bỏ ô hỏng, ô trống, ô trùng vị trí', () => {
    expect(cleanSlots([
      { day: 7, session: 'am', period: 1, text: 'x' },
      { day: 0, session: 'noon', period: 1, text: 'x' },
      { day: 0, session: 'am', period: 1, text: '   ' },
      { day: 0, session: 'am', period: 1, text: 'A' },
      { day: 0, session: 'am', period: 1, text: 'B' },
    ])).toEqual([{ day: 0, session: 'am', period: 1, text: 'A' }])
    expect(cleanSlots(null)).toEqual([])
  })
})

describe('lịch theo ngày + nhiều bản TKB', () => {
  const v1 = TT({ id: 'v1', slots: sampleSlots() })
  const v2 = TT({ id: 'v2', effectiveFrom: '2026-10-19', slots: [{ day: 0, session: 'am', period: 1, text: '12A1 - Hóa học' }] })

  it('Thứ 3 13/10: 3 tiết sáng + 2 tiết chiều, giờ lấy từ thời gian biểu', () => {
    const ls = lessonsOn(new Date(2026, 9, 13), [v1], DEFAULT_BELL)
    expect(ls.map((l) => `${l.start} ${l.text}`)).toEqual([
      '08:05 11A8 - Hóa học', '09:50 11A4 - Hóa học', '10:40 11A6 - Hóa học',
      '13:50 10A4 - Hóa học', '15:35 10A3 - Hóa học',
    ])
  })
  it('chọn đúng bản theo ngày hiệu lực', () => {
    expect(activeTimetable(new Date(2026, 9, 11), [v1, v2])).toBeUndefined()
    expect(activeTimetable(new Date(2026, 9, 18), [v1, v2])?.id).toBe('v1')
    expect(activeTimetable(new Date(2026, 9, 19), [v1, v2])?.id).toBe('v2')
    expect(lessonsOn(new Date(2026, 9, 19), [v1, v2], DEFAULT_BELL).map((l) => l.text)).toEqual(['12A1 - Hóa học'])
  })
  it('đang dạy / tiết kế tiếp / hết tiết', () => {
    const ls = lessonsOn(new Date(2026, 9, 13), [v1], DEFAULT_BELL)
    expect(nowState(new Date(2026, 9, 13, 8, 30), ls)).toMatchObject({ kind: 'now', minutesLeft: 20 })
    expect(nowState(new Date(2026, 9, 13, 8, 50), ls)).toMatchObject({ kind: 'next', minutesUntil: 60 })
    expect(nowState(new Date(2026, 9, 13, 17, 0), ls)).toEqual({ kind: 'done' })
  })

  it('xuất .ics: bản cũ có UNTIL tới trước bản mới, có nhắc', () => {
    const ics = buildICS([v1, v2], { bell: DEFAULT_BELL, reminderMinutes: 5 }, new Date(2026, 9, 13))
    expect(ics.split('\r\n').filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(18)
    // Thứ 2 chiều tiết 1 của v1 → lần đầu 12/10 13:00, dừng 18/10
    expect(ics).toContain('DTSTART:20261012T130000')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;UNTIL=20261018T235959')
    // v2 không có hạn
    expect(ics).toContain('DTSTART:20261019T071500')
    expect(ics).toContain('RRULE:FREQ=WEEKLY\r\n')
    expect(ics).toContain('TRIGGER:-PT5M')
  })
  it('tên sự kiện kiểu widget Lịch: "Tiết 1: 11A4", môn phụ ở ô địa điểm', () => {
    const v = TT({ slots: sampleSlots() })
    const ics = buildICS([v], { bell: DEFAULT_BELL, reminderMinutes: 0 }, new Date(2026, 9, 13))
    expect(ics).toContain('SUMMARY:Tiết 1: 11A4')
    expect(ics).toContain('SUMMARY:Tiết 3: 10A4\r\nDESCRIPTION:10A4 - GDĐP')
    expect(ics.match(/LOCATION:GDĐP/g)).toHaveLength(2)
    expect(ics).not.toContain('LOCATION:Hóa học')
  })
  it('bỏ bản đã hết hạn khi xuất', () => {
    const ics = buildICS([v1, v2], { bell: DEFAULT_BELL, reminderMinutes: 0 }, new Date(2026, 9, 25))
    expect(ics.split('\r\n').filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(1)
    expect(ics).not.toContain('VALARM')
  })
})

describe('nhập file sao lưu', () => {
  it('từ chối file sai định dạng', () => {
    expect(() => parseData({ foo: 1 })).toThrow()
    expect(() => parseData(null)).toThrow()
  })
  it('bỏ bản ghi hỏng, bổ sung trường thiếu', () => {
    const d = parseData({
      timetables: [{ id: 'a', effectiveFrom: '2026-10-12', slots: [{ day: 0, session: 'am', period: 1, text: 'X' }] }, { id: 'b' }],
      tasks: [{ id: 't', title: 'Chấm bài' }],
    })
    expect(d.timetables).toHaveLength(1)
    expect(d.tasks[0].done).toBe(false)
    expect(d.settings.bell.am).toHaveLength(5)
  })
})

describe('tô màu theo lớp', () => {
  it('6 lớp của TKB mẫu → 6 màu khác nhau; cùng lớp khác môn cùng màu', async () => {
    const { buildPalette } = await import('./time')
    const slots = sampleSlots()
    const color = buildPalette(slots)
    const classes = ['11A4', '11A6', '11A8', '10A3', '10A4']
    expect(new Set(classes.map((c) => color(`${c} - Hóa học`))).size).toBe(5)
    expect(color('10A4 - GDĐP')).toBe(color('10A4 - Hóa học'))
  })
})

describe('dữ liệu cho widget màn hình chính', () => {
  it('Thứ 4 14/10 ra đúng 4 dòng như widget mẫu, chỉ ghi môn khác môn chính', async () => {
    const { buildWidgetFeed } = await import('./widget')
    const data = { ...parseData({ timetables: [], tasks: [] }), timetables: [TT({ slots: sampleSlots() })] }
    const feed = buildWidgetFeed(data, new Date(2026, 9, 13, 21, 13))
    expect(feed.days).toHaveLength(14)
    expect(feed.days[0].date).toBe('2026-10-13')
    const wed = feed.days[1]
    expect(wed.lessons.map((l) => `${l.start} Tiết ${l.period}: ${l.title}${l.detail ? ' | ' + l.detail : ''}`)).toEqual([
      '07:15 Tiết 1: 11A4', '08:05 Tiết 2: 11A8', '13:00 Tiết 1: 10A4', '14:45 Tiết 3: 10A4 | GDĐP',
    ])
    expect(feed.days[5].lessons).toEqual([]) // Chủ nhật
  })
})
