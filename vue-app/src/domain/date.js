export function formatDateStr(dateObj) {
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getIsoWeekNumber(dateObj) {
  const date = new Date(dateObj)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() || 7
  date.setDate(date.getDate() + 4 - day)
  const yearStart = new Date(date.getFullYear(), 0, 1)
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
}

export function timeToMinutes(timeStr) {
  const [hour, minute] = String(timeStr || '00:00').split(':').map(Number)
  return hour * 60 + minute
}

export function normalizeTimeToAxisMinute(timeStr, axisStartMinutes = 6 * 60) {
  const raw = timeToMinutes(timeStr)
  return raw < axisStartMinutes ? raw + 24 * 60 : raw
}

export function getBusinessDateInfo(dateObj, axisStartMinutes = 6 * 60) {
  const d = new Date(dateObj)
  const rawMinutes = d.getHours() * 60 + d.getMinutes()
  const businessDate = new Date(d)
  const axisMinute = rawMinutes < axisStartMinutes ? rawMinutes + 24 * 60 : rawMinutes
  if (rawMinutes < axisStartMinutes) {
    businessDate.setDate(businessDate.getDate() - 1)
  }
  return {
    dateStr: formatDateStr(businessDate),
    axisMinute,
  }
}

export function getNormalizedBlockRange(block, axisStartMinutes = 6 * 60) {
  const axisEndMinutes = axisStartMinutes + 24 * 60
  const start = normalizeTimeToAxisMinute(block.start, axisStartMinutes)
  let end = normalizeTimeToAxisMinute(block.end, axisStartMinutes)
  if (end <= start) end += 24 * 60

  const clampedStart = Math.max(axisStartMinutes, Math.min(start, axisEndMinutes))
  const clampedEnd = Math.max(axisStartMinutes, Math.min(end, axisEndMinutes))
  if (clampedEnd <= clampedStart) return null

  return { start: clampedStart, end: clampedEnd }
}

export function getRepeatDates(baseDateStr, repeatMode) {
  if (repeatMode === 'none') return [baseDateStr]

  const startDate = new Date(`${baseDateStr}T00:00:00`)
  const year = startDate.getFullYear()
  const endDate = new Date(year, 11, 31)
  const dates = []

  for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (repeatMode === 'daily') {
      dates.push(formatDateStr(d))
    } else if (repeatMode === 'workdays') {
      if (day >= 1 && day <= 5) dates.push(formatDateStr(d))
    } else if (repeatMode === 'weekly') {
      if (d.getDay() === startDate.getDay()) dates.push(formatDateStr(d))
    }
  }

  return dates
}

export function truncateTextByChars(text, maxChars) {
  const chars = Array.from(String(text || ''))
  if (chars.length <= maxChars) return chars.join('')
  return `${chars.slice(0, maxChars).join('')}...`
}
