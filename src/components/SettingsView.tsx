import { useRef } from 'react'
import { SESSION_NAMES, type BellSchedule, type Period, type Session } from '../types'
import { buildICS, toISODate } from '../time'
import { emptyData, parseData, type Store } from '../store'
import { Group, Row, Toggle } from './ui'
import { ask, notify } from './dialog'
import { isNative } from '../native'

/** Trên iPhone: mở bảng Chia sẻ (lưu vào Tệp, gửi Zalo…); máy khác: tải file về. */
async function saveFile(name: string, type: string, content: string) {
  const file = new File([content], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

function BellEditor({ bell, onChange }: { bell: BellSchedule; onChange: (b: BellSchedule) => void }) {
  const set = (s: Session, i: number, p: Partial<Period>) =>
    onChange({ ...bell, [s]: bell[s].map((x, j) => (j === i ? { ...x, ...p } : x)) })
  return (
    <>
      {(['am', 'pm'] as Session[]).map((s) => (
        <Group key={s} title={`Thời gian biểu · ${SESSION_NAMES[s]}`}>
          {bell[s].map((p, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-1.5">
              <span className="w-14 shrink-0">Tiết {i + 1}</span>
              <input type="time" aria-label={`Tiết ${i + 1} bắt đầu`} value={p.start}
                className="ml-auto bg-transparent text-accent outline-none" onChange={(e) => set(s, i, { start: e.target.value })} />
              <span className="text-muted">–</span>
              <input type="time" aria-label={`Tiết ${i + 1} kết thúc`} value={p.end}
                className="bg-transparent text-accent outline-none" onChange={(e) => set(s, i, { end: e.target.value })} />
            </div>
          ))}
          <div className="flex">
            <button className="flex-1 px-4 py-2.5 text-accent" onClick={() => {
              const last = bell[s][bell[s].length - 1]
              onChange({ ...bell, [s]: [...bell[s], { start: last?.end ?? '', end: '' }] })
            }}>+ Thêm tiết</button>
            {bell[s].length > 0 && (
              <button className="flex-1 border-l border-sep px-4 py-2.5 text-red-500"
                onClick={() => onChange({ ...bell, [s]: bell[s].slice(0, -1) })}>− Bớt tiết cuối</button>
            )}
          </div>
        </Group>
      ))}
    </>
  )
}

export function SettingsView({ store }: { store: Store }) {
  const { settings, timetables } = store.data
  const importRef = useRef<HTMLInputElement>(null)
  const standalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches

  return (
    <div>
      <p className="mb-3 px-4 text-xs text-muted">Giờ từng tiết, gần như cố định cả học kỳ. Mặc định là giờ của THPT Nguyễn Trãi – Ba Đình.</p>
      <BellEditor bell={settings.bell} onChange={(bell) => store.updateSettings({ bell })} />

      <Group title="Hiển thị">
        <Row label="Hiện Chủ nhật">
          <Toggle label="Hiện Chủ nhật" checked={settings.showSunday} onChange={(v) => store.updateSettings({ showSunday: v })} />
        </Row>
      </Group>

      <Group title={isNative ? 'Chuông báo giờ vào lớp' : 'Chuông nhắc trên iPhone'}
        footer={isNative
          ? 'App tự báo trước giờ vào lớp, kể cả khi không mở app. Đổi thời khoá biểu thì chuông tự đổi theo.'
          : 'Xuất toàn bộ tiết dạy sang ứng dụng Lịch của iPhone để iPhone tự báo trước giờ vào lớp. Khi đổi thời khoá biểu: xoá lịch cũ trong ứng dụng Lịch rồi xuất lại.'}>
        <label className="flex items-center px-4 py-2">
          <span>Nhắc trước</span>
          <select className="ml-auto bg-transparent text-right text-accent outline-none" value={settings.reminderMinutes}
            onChange={(e) => store.updateSettings({ reminderMinutes: Number(e.target.value) })}>
            {[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m ? `${m} phút` : 'Không nhắc'}</option>)}
          </select>
        </label>
        {!isNative && (
        <button className="w-full px-4 py-3 text-left text-accent disabled:opacity-40" disabled={timetables.length === 0}
          onClick={() => saveFile('thoi-khoa-bieu.ics', 'text/calendar', buildICS(timetables, settings))}>
          📅 Xuất sang Lịch iPhone
        </button>
        )}
      </Group>

      <Group title="Dữ liệu" footer="Dữ liệu chỉ nằm trên máy này. Nên sao lưu sau mỗi lần cập nhật thời khoá biểu.">
        <button className="w-full px-4 py-3 text-left text-accent" onClick={() => {
          saveFile(`tkb-sao-luu-${toISODate(new Date())}.json`, 'application/json',
            JSON.stringify(store.data, null, 2))
        }}>⬆️ Sao lưu ra file</button>
        <button className="w-full px-4 py-3 text-left text-accent" onClick={() => importRef.current?.click()}>⬇️ Khôi phục từ file</button>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const d = parseData(JSON.parse(await f.text()))
            if (await ask(`File có ${d.timetables.length} bản thời khoá biểu, ${d.tasks.length} việc. Thay toàn bộ dữ liệu hiện tại?`, { ok: 'Thay', danger: true })) {
              store.replaceAll(d)
            }
          } catch (err) {
            await notify(`Không đọc được file: ${(err as Error).message}`)
          }
        }} />
        <button className="w-full px-4 py-3 text-left text-red-500" onClick={async () => {
          if (await ask('Xoá TOÀN BỘ thời khoá biểu và việc cần làm? Không hoàn tác được.', { ok: 'Xoá hết', danger: true })) {
            store.replaceAll(emptyData())
          }
        }}>Xoá tất cả dữ liệu</button>
      </Group>

      {!standalone && !isNative && (
        <Group title="Cài lên màn hình iPhone">
          <p className="px-4 py-3 text-sm leading-relaxed">
            Mở trang này bằng <b>Safari</b> → bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) → chọn{' '}
            <b>“Thêm vào MH chính”</b>. App sẽ có biểu tượng riêng, mở toàn màn hình và dùng được cả khi không có mạng.
          </p>
        </Group>
      )}

      <Group title="Giới thiệu">
        <p className="px-4 py-3 text-sm leading-relaxed">
          Thời khoá biểu — xem lịch dạy/học theo ngày, theo tuần; mỗi lần trường đổi thời khoá biểu thì nhập bản mới kèm ngày áp dụng.
          <br /><span className="text-muted">(C) August87 - 0982722036</span>
        </p>
      </Group>

    </div>
  )
}
