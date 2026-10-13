import { useState } from 'react'
import type { Task } from '../types'
import { addDays, formatDateVN, toISODate } from '../time'
import { uid, type Store } from '../store'
import { Empty, Fab, Group, Sheet, inputCls } from './ui'
import { ask } from './dialog'

function TaskForm({ store, initial, onClose }: { store: Store; initial?: Task; onClose: () => void }) {
  const { categories } = store.data.settings
  const [t, setT] = useState<Task>(
    initial ?? { id: uid(), title: '', notes: '', due: toISODate(addDays(new Date(), 1)), category: categories[0] ?? '', done: false },
  )
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }))
  return (
    <Sheet title={initial ? 'Sửa việc' : 'Việc mới'} onClose={onClose} saveDisabled={!t.title.trim()}
      onSave={() => { store.saveTask({ ...t, title: t.title.trim() }); onClose() }}>
      <Group>
        <input className={inputCls} placeholder="Việc cần làm (VD: Chấm bài 11A4)" autoFocus={!initial}
          value={t.title} onChange={(e) => set({ title: e.target.value })} />
        <textarea className={`${inputCls} min-h-24 resize-none`} placeholder="Ghi chú" value={t.notes}
          onChange={(e) => set({ notes: e.target.value })} />
      </Group>
      <Group>
        <label className="flex items-center px-4 py-2">
          <span>Hạn</span>
          <input type="date" className="ml-auto bg-transparent text-accent outline-none" value={t.due}
            onChange={(e) => set({ due: e.target.value })} />
        </label>
        <label className="flex items-center px-4 py-2">
          <span>Loại</span>
          <select className="ml-auto bg-transparent text-right text-accent outline-none" value={t.category}
            onChange={(e) => set({ category: e.target.value })}>
            <option value="">—</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </Group>
      {initial && (
        <Group>
          <button className="w-full px-4 py-3 text-red-500"
            onClick={async () => { if (await ask(`Xoá "${t.title}"?`, { ok: 'Xoá', danger: true })) { store.deleteTask(t.id); onClose() } }}>Xoá việc</button>
        </Group>
      )}
    </Sheet>
  )
}

export function TasksView({ store }: { store: Store }) {
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const today = toISODate(new Date())
  const tomorrow = toISODate(addDays(new Date(), 1))
  const list = store.data.tasks
    .filter((t) => t.done === showDone)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))

  const groups: [string, Task[]][] = showDone
    ? [['Đã xong', list]]
    : [
        ['Quá hạn', list.filter((t) => t.due && t.due < today)],
        ['Hôm nay', list.filter((t) => t.due === today)],
        ['Ngày mai', list.filter((t) => t.due === tomorrow)],
        ['Sắp tới', list.filter((t) => t.due > tomorrow)],
        ['Không hạn', list.filter((t) => !t.due)],
      ]

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-zinc-200 p-0.5 text-sm dark:bg-zinc-800">
        {[false, true].map((v) => (
          <button key={String(v)} onClick={() => setShowDone(v)}
            className={`rounded-md py-1.5 ${showDone === v ? 'bg-card font-semibold shadow-sm' : ''}`}>
            {v ? 'Đã xong' : 'Chưa xong'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty icon={showDone ? '📋' : '✅'} title={showDone ? 'Chưa có việc nào xong' : 'Không còn việc nào'}
          hint={showDone ? undefined : 'Bấm + để thêm việc: soạn bài, chấm bài, họp tổ…'} />
      ) : groups.filter(([, ts]) => ts.length).map(([title, ts]) => (
        <Group key={title} title={title}>
          {ts.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <button aria-label={t.done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'} onClick={() => store.toggleTask(t.id)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs text-white ${t.done ? 'border-accent bg-accent' : 'border-muted'}`}>
                {t.done && '✓'}
              </button>
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)}>
                <div className={`truncate ${t.done ? 'text-muted line-through' : ''}`}>{t.title}</div>
                <div className={`truncate text-xs ${title === 'Quá hạn' ? 'text-red-500' : 'text-muted'}`}>
                  {[t.category, t.due && formatDateVN(t.due)].filter(Boolean).join(' · ')}
                </div>
              </button>
            </div>
          ))}
        </Group>
      ))}

      <Fab label="Thêm việc" onClick={() => setEditing('new')} />
      {editing && <TaskForm store={store} initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
