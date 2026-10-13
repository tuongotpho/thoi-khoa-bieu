import { describe, expect, it } from 'vitest'
import { decide, newSyncId, parseSyncInput } from './sync'
import { parseData } from './store'

describe('mã đồng bộ', () => {
  it('24 ký tự, không trùng', () => {
    const ids = new Set(Array.from({ length: 1000 }, newSyncId))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{24}$/)
  })
  it('đọc mã từ link hoặc mã dán vào', () => {
    const id = 'AbCdEfGhJkMnPqRsTuVwXyZ2'
    expect(parseSyncInput(`https://tuongotpho.github.io/thoi-khoa-bieu/#sync=${id}`)).toBe(id)
    expect(parseSyncInput(`  ${id}  `)).toBe(id)
    expect(parseSyncInput('#sync=ngan')).toBe('')
    expect(parseSyncInput('linh tinh')).toBe('')
  })
})

describe('quyết định khi đồng bộ', () => {
  const remote = (updatedAt: number) => ({ data: parseData({ timetables: [], tasks: [] }), updatedAt })
  const m = (localUpdatedAt: number, syncedAt: number) => ({ id: 'x', localUpdatedAt, syncedAt })
  it('máy chủ chưa có → gửi lên', () => expect(decide(m(5, 0), null)).toBe('push'))
  it('máy khác vừa sửa, máy này không sửa → lấy về', () => expect(decide(m(10, 10), remote(20))).toBe('take-remote'))
  it('máy này sửa, máy chủ không đổi → gửi lên', () => expect(decide(m(30, 10), remote(10))).toBe('push'))
  it('không ai sửa → thôi', () => expect(decide(m(10, 10), remote(10))).toBe('nothing'))
  it('cả hai cùng sửa → bản sửa sau cùng thắng', () => {
    expect(decide(m(30, 10), remote(40))).toBe('take-remote')
    expect(decide(m(50, 10), remote(40))).toBe('push')
  })
  it('vừa kết nối link (máy này chưa có gì) → lấy về', () => expect(decide(m(0, 0), remote(40))).toBe('take-remote'))
})
