const API_STATE_URL = '/api/state'

export async function fetchState() {
  const res = await fetch(API_STATE_URL, { method: 'GET' })
  if (!res.ok) {
    throw new Error(`load state failed: ${res.status}`)
  }
  return res.json()
}

export async function persistState(payload) {
  const res = await fetch(API_STATE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`save state failed: ${res.status}`)
  }
}
