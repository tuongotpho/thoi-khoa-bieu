// Thời khoá biểu — widget màn hình chính (chạy trong app Scriptable)
// (C) August87 - 0982722036
// Mã này do web app Thời khoá biểu tạo ra, đã kèm sẵn thời khoá biểu của bạn.
// Khi trường đổi thời khoá biểu: vào web app bấm "Chép mã widget" rồi dán đè lên mã này.

const DATA = __DATA__
const APP_URL = __APP_URL__

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
const pad = (n) => String(n).padStart(2, '0')
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const weekday = (d) => (d.getDay() + 6) % 7

function at(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const r = new Date(day)
  r.setHours(h, m, 0, 0)
  return r
}

/** Các tiết của một ngày theo bản thời khoá biểu đang hiệu lực ngày đó. */
function lessonsOn(day) {
  const key = dateKey(day)
  let v = null
  for (const x of DATA.versions) if (x.from <= key && (!v || x.from >= v.from)) v = x
  return v ? v.week[weekday(day)] : []
}

/** Hôm nay nếu còn tiết chưa xong, không thì ngày gần nhất có tiết (trong 2 tuần). */
function pick(now) {
  for (let i = 0; i < 15; i++) {
    const day = new Date(now)
    day.setDate(day.getDate() + i)
    day.setHours(0, 0, 0, 0)
    const ls = lessonsOn(day)
    if (!ls.length) continue
    if (i === 0 && !ls.some((l) => at(day, l.e) > now)) continue
    const heading = i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : `${DAYS[weekday(day)]}, ${day.getDate()}/${day.getMonth() + 1}`
    return { day, heading, ls }
  }
  return null
}

function stateOf(day, l, now) {
  if (at(day, l.e) <= now) return 'past'
  if (at(day, l.s) <= now) return 'now'
  return 'future'
}

/** Lần tới cần vẽ lại: lúc vào/ra tiết gần nhất, hoặc nửa đêm. */
function nextRefresh(now) {
  const times = []
  for (let i = 0; i < 2; i++) {
    const day = new Date(now)
    day.setDate(day.getDate() + i)
    day.setHours(0, 0, 0, 0)
    if (i > 0) times.push(new Date(day))
    for (const l of lessonsOn(day)) times.push(at(day, l.s), at(day, l.e))
  }
  return times.filter((t) => t > now).sort((a, b) => a - b)[0] || new Date(now.getTime() + 6 * 3600e3)
}

const BG = Color.dynamic(new Color('#ffffff'), new Color('#1c1c1e'))
const TEXT = Color.dynamic(new Color('#000000'), new Color('#ffffff'))
const MUTED = Color.dynamic(new Color('#6e6e73'), new Color('#98989f'))

function addRow(w, l, st, compact) {
  const alpha = st === 'past' ? 0.4 : 1
  const row = w.addStack()
  row.layoutHorizontally()
  row.centerAlignContent()
  row.backgroundColor = new Color(l.c, alpha)
  row.cornerRadius = 7
  row.setPadding(compact ? 4 : 7, 10, compact ? 4 : 7, 10)
  if (st === 'now') {
    row.borderWidth = 2
    row.borderColor = TEXT
  }
  const white = new Color('#ffffff', alpha)
  const time = row.addText(l.s)
  time.font = Font.mediumMonospacedSystemFont(compact ? 11 : 13)
  time.textColor = white
  row.addSpacer(8)
  const title = row.addText(`Tiết ${l.p}: ${l.t}`)
  title.font = Font.boldSystemFont(compact ? 13 : 16)
  title.textColor = white
  title.lineLimit = 1
  row.addSpacer()
  if (l.d) {
    const d = row.addText(l.d)
    d.font = Font.mediumSystemFont(compact ? 11 : 13)
    d.textColor = white
    d.lineLimit = 1
  }
}

function build(family, now) {
  const w = new ListWidget()
  w.url = APP_URL
  w.refreshAfterDate = nextRefresh(now)
  const accessory = family.startsWith('accessory')
  if (!accessory) {
    w.backgroundColor = BG
    w.setPadding(14, 14, 12, 14)
  }

  const shown = pick(now)
  if (!shown) {
    const t = w.addText(DATA.versions.length ? 'Không có tiết nào trong 2 tuần tới' : 'Chưa có thời khoá biểu')
    t.font = Font.mediumSystemFont(13)
    if (!accessory) t.textColor = MUTED
    return w
  }
  const { day, heading, ls } = shown
  const next = ls.find((l) => stateOf(day, l, now) !== 'past') || ls[0]

  if (family === 'accessoryInline') {
    w.addText(`${next.s} Tiết ${next.p}: ${next.t}`)
    return w
  }
  if (family === 'accessoryRectangular') {
    const a = w.addText(`${heading} · ${next.s}`)
    a.font = Font.semiboldSystemFont(12)
    const b = w.addText(`Tiết ${next.p}: ${next.t}`)
    b.font = Font.boldSystemFont(15)
    b.lineLimit = 1
    if (next.d) {
      const c = w.addText(next.d)
      c.font = Font.systemFont(12)
    }
    return w
  }
  if (family === 'accessoryCircular') {
    const a = w.addText(next.s)
    a.font = Font.semiboldSystemFont(11)
    a.centerAlignText()
    const b = w.addText(next.t)
    b.font = Font.boldSystemFont(13)
    b.centerAlignText()
    b.minimumScaleFactor = 0.5
    return w
  }

  if (family === 'small') {
    const isNow = stateOf(day, next, now) === 'now'
    const h = w.addText(isNow ? 'ĐANG DẠY' : heading.toUpperCase())
    h.font = Font.boldSystemFont(11)
    h.textColor = new Color(next.c)
    const t = w.addText(next.t)
    t.font = Font.boldSystemFont(28)
    t.textColor = TEXT
    t.minimumScaleFactor = 0.6
    t.lineLimit = 1
    const s = w.addText(next.d ? `Tiết ${next.p} · ${next.d}` : `Tiết ${next.p}`)
    s.font = Font.systemFont(14)
    s.textColor = MUTED
    w.addSpacer()
    const tm = w.addText(isNow ? `đến ${next.e}` : next.s)
    tm.font = Font.semiboldMonospacedSystemFont(20)
    tm.textColor = TEXT
    return w
  }

  // medium / large — giống mẫu: tiêu đề, các dải màu, số tiết ở cuối
  const compact = family === 'medium'
  const max = compact ? 4 : 9
  const upcoming = ls.filter((l) => stateOf(day, l, now) !== 'past')
  const rows = compact && ls.length > max ? upcoming.slice(0, max) : ls.slice(0, max)
  const h = w.addText(heading)
  h.font = Font.boldSystemFont(compact ? 14 : 17)
  h.textColor = TEXT
  w.addSpacer(compact ? 4 : 8)
  rows.forEach((l, i) => {
    if (i) w.addSpacer(compact ? 4 : 6)
    addRow(w, l, stateOf(day, l, now), compact)
  })
  w.addSpacer()
  if (!compact) {
    const f = w.addText(`${ls.length} tiết`)
    f.font = Font.systemFont(13)
    f.textColor = MUTED
  }
  return w
}

const widget = build(config.widgetFamily || 'large', new Date())
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentLarge()
}
Script.complete()
