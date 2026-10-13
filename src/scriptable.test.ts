import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildScriptableScript } from './widget'
import { cleanSlots, parseData } from './store'

/** Giả lập các đối tượng của app Scriptable: ghi lại widget được vẽ thành danh sách dòng chữ. */
function runInFakeScriptable(script: string, family: string, net: { json?: unknown; fail?: boolean } = {}, files: Record<string, string> = {}) {
  const lines: string[] = []
  class Txt { font: unknown; textColor: unknown; lineLimit = 0; minimumScaleFactor = 1; centerAlignText() {} }
  class Stack {
    parts: string[] = []
    backgroundColor: unknown; cornerRadius = 0; borderWidth = 0; borderColor: unknown
    layoutHorizontally() {} centerAlignContent() {} setPadding() {}
    addText(t: string) { this.parts.push(t); return new Txt() }
    addSpacer() {}
  }
  class ListWidget {
    url = ''; refreshAfterDate: Date | null = null; backgroundColor: unknown
    setPadding() {}
    addText(t: string) { lines.push(t); return new Txt() }
    addSpacer() {}
    addStack() { const s = new Stack(); lines.push(''); const i = lines.length - 1
      return new Proxy(s, { get(o, k) { if (k === 'addText') return (t: string) => { o.parts.push(t); lines[i] = o.parts.join(' | ') + (o.borderWidth ? ' [đang dạy]' : ''); return new Txt() }
        return Reflect.get(o, k) } }) }
    async presentLarge() {}
  }
  class Color { constructor(public hex: string, public alpha = 1) {} static dynamic(a: Color) { return a } }
  const Font = new Proxy({}, { get: () => () => ({}) })
  let set: ListWidget | null = null
  const Script = { setWidget: (w: ListWidget) => { set = w }, complete() {} }
  const config = { runsInWidget: true, widgetFamily: family }
  class Request {
    timeoutInterval = 60
    constructor(public url: string) {}
    async loadJSON() { if (net.fail) throw new Error('mất mạng'); return net.json }
  }
  const FileManager = { local: () => ({
    documentsDirectory: () => '/docs', joinPath: (a: string, b: string) => `${a}/${b}`,
    fileExists: (p: string) => p in files, readString: (p: string) => files[p],
    writeString: (p: string, t: string) => { files[p] = t },
  }) }
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return AsyncFunction('ListWidget', 'Color', 'Font', 'Script', 'config', 'Request', 'FileManager', script)(ListWidget, Color, Font, Script, config, Request, FileManager)
    .then(() => ({ lines, widget: set as unknown as ListWidget }))
}

const C = (day: number, session: string, period: number, text: string) => ({ day: day - 2, session, period, text })
const data = {
  ...parseData({ timetables: [], tasks: [] }),
  timetables: [{
    id: 'v1', effectiveFrom: '2026-10-12', title: '', createdAt: '', slots: cleanSlots([
      C(4, 'am', 1, '11A4 - Hóa học'), C(7, 'am', 1, '11A4 - Hóa học'), C(3, 'am', 2, '11A8 - Hóa học'),
      C(4, 'am', 2, '11A8 - Hóa học'), C(5, 'am', 2, '11A6 - Hóa học'), C(3, 'am', 4, '11A4 - Hóa học'),
      C(3, 'am', 5, '11A6 - Hóa học'), C(4, 'pm', 1, '10A4 - Hóa học'), C(3, 'pm', 2, '10A4 - Hóa học'),
      C(4, 'pm', 3, '10A4 - GDĐP'), C(3, 'pm', 4, '10A3 - Hóa học'),
    ]),
  }],
}
const script = buildScriptableScript(data, 'https://example.test/tkb/')

afterEach(() => { vi.useRealTimers() })

describe('widget Scriptable', () => {
  it('có đồng bộ: lấy lịch mới từ máy chủ; mất mạng thì dùng bản đã lưu', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 14, 9, 0))
    const { buildScriptableData } = await import('./widget')
    const newer = { ...data, timetables: [{ ...data.timetables[0], slots: cleanSlots([C(4, 'pm', 2, '12A1 - Hóa học')]) }] }
    const synced = buildScriptableScript(data, 'u', 'https://sync.test/doc')
    const files: Record<string, string> = {}
    const doc = { fields: { widget: { stringValue: JSON.stringify(buildScriptableData(newer)) } } }
    expect((await runInFakeScriptable(synced, 'accessoryInline', { json: doc }, files)).lines).toEqual(['13:50 Tiết 2: 12A1'])
    expect(Object.keys(files)).toEqual(['/docs/tkb-widget-cache.json'])
    // mất mạng → bản đã lưu (lịch mới), không quay về lịch gắn sẵn
    expect((await runInFakeScriptable(synced, 'accessoryInline', { fail: true }, files)).lines).toEqual(['13:50 Tiết 2: 12A1'])
    // mất mạng, chưa từng lưu → lịch gắn sẵn trong mã
    expect((await runInFakeScriptable(synced, 'accessoryInline', { fail: true }, {})).lines).toEqual(['13:00 Tiết 1: 10A4'])
  })
  it('dữ liệu có ký tự $ không làm hỏng mã', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 14, 9, 0))
    const odd = { ...data, timetables: [{ ...data.timetables[0], slots: cleanSlots([C(4, 'pm', 1, "10A4 - $& $' $1")]) }] }
    const lines = (await runInFakeScriptable(buildScriptableScript(odd, 'u'), 'accessoryRectangular')).lines
    expect(lines).toContain("Tiết 1: 10A4")
  })
  it('21:13 Thứ 3 → cỡ lớn hiện "Ngày mai" đúng như widget mẫu', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 13, 21, 13))
    const { lines, widget } = await runInFakeScriptable(script, 'large')
    expect(lines).toEqual([
      'Ngày mai',
      '07:15 | Tiết 1: 11A4', '08:05 | Tiết 2: 11A8', '13:00 | Tiết 1: 10A4', '14:45 | Tiết 3: 10A4 | GDĐP',
      '4 tiết',
    ])
    expect(widget.url).toBe('https://example.test/tkb/')
    expect(widget.refreshAfterDate).toEqual(new Date(2026, 9, 14, 0, 0)) // nửa đêm vẽ lại
  })
  it('đang trong tiết → viền "đang dạy", tiết đã qua vẫn hiện', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 13, 8, 30))
    const { lines, widget } = await runInFakeScriptable(script, 'large')
    expect(lines[0]).toBe('Hôm nay')
    expect(lines[1]).toBe('08:05 | Tiết 2: 11A8 [đang dạy]')
    expect(widget.refreshAfterDate).toEqual(new Date(2026, 9, 13, 8, 50))
  })
  it('cỡ nhỏ và màn hình khoá', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 14, 9, 0))
    expect((await runInFakeScriptable(script, 'small')).lines).toEqual(['HÔM NAY', '10A4', 'Tiết 1', '13:00'])
    expect((await runInFakeScriptable(script, 'accessoryInline')).lines).toEqual(['13:00 Tiết 1: 10A4'])
    expect((await runInFakeScriptable(script, 'accessoryRectangular')).lines).toEqual(['Hôm nay · 13:00', 'Tiết 1: 10A4'])
  })
  it('chưa có thời khoá biểu', async () => {
    const empty = buildScriptableScript(parseData({ timetables: [], tasks: [] }), 'x')
    expect((await runInFakeScriptable(empty, 'large')).lines).toEqual(['Chưa có thời khoá biểu'])
  })
})
