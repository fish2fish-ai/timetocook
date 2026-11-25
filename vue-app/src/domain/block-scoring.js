export function getBlockTypeByScore(durationHours, flexibility) {
  const score = durationHours * flexibility
  if (score === 0) return 'fish'
  if (score >= 2.0) return 'meat'
  if (score >= 1.4) return 'fruit'
  return 'veggie'
}

export function getFlexibilityByAnswers(canTakeNotes, canIsolate) {
  if (canTakeNotes && canIsolate) return 1.0
  if (canTakeNotes && !canIsolate) return 0.7
  if (!canTakeNotes && canIsolate) return 0.4
  return 0
}

export function formatDurationHours(durationHours) {
  if (Number.isInteger(durationHours)) return `${durationHours}h`
  return `${durationHours.toFixed(1)}h`
}
