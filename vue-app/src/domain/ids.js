export function nextNumericId(items) {
  const maxId = (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const id = Number(item?.id || 0)
    return Number.isFinite(id) ? Math.max(acc, id) : acc
  }, 0)
  return maxId + 1
}
