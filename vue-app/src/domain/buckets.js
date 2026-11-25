export const BASKET_TYPES = ['meat', 'fruit', 'veggie']
export const BUCKET_LABELS = 'ABCDEFGHIJ'.split('')
export const MIN_BUCKET_COUNT = 2
export const MAX_BUCKET_COUNT = 10

export const TYPE_META = {
  meat: { icon: '🥩', label: '肉' },
  fruit: { icon: '🍎', label: '果' },
  veggie: { icon: '🥦', label: '蔬' },
}

export function getEffectiveTaskType(type) {
  if (type === 'fruit' || type === 'veggie') return type
  return 'meat'
}

export function normalizeBucketKey(raw) {
  const normalized = String(raw || '').trim().toUpperCase()
  if (!BUCKET_LABELS.includes(normalized)) return 'A'
  return normalized
}

export function normalizeBucketKeys(rawKeys) {
  const source = Array.isArray(rawKeys) ? rawKeys : []
  const unique = []
  source.forEach((key) => {
    const normalized = normalizeBucketKey(key)
    if (!unique.includes(normalized)) unique.push(normalized)
  })

  if (!unique.includes('A')) unique.unshift('A')
  if (!unique.includes('B')) {
    if (unique.length < MAX_BUCKET_COUNT) unique.push('B')
    else unique[unique.length - 1] = 'B'
  }

  return unique
    .sort((a, b) => BUCKET_LABELS.indexOf(a) - BUCKET_LABELS.indexOf(b))
    .slice(0, MAX_BUCKET_COUNT)
}

export function normalizeBucketKeysByType(rawByType) {
  const source = rawByType && typeof rawByType === 'object' ? rawByType : {}
  return {
    meat: normalizeBucketKeys(source.meat),
    fruit: normalizeBucketKeys(source.fruit),
    veggie: normalizeBucketKeys(source.veggie),
  }
}

export function sanitizeBucketName(raw, fallback = 'A') {
  const normalized = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return fallback
  return normalized.slice(0, 12)
}

export function getBucketKeysForType(type, bucketKeysByType) {
  const safeType = getEffectiveTaskType(type)
  const keys = bucketKeysByType?.[safeType]
  return Array.isArray(keys) ? keys : ['A', 'B']
}

export function isValidBucketForType(type, bucket, bucketKeysByType) {
  return getBucketKeysForType(type, bucketKeysByType).includes(normalizeBucketKey(bucket))
}

export function getBasketNameKey(type, bucket) {
  return `${getEffectiveTaskType(type)}-${normalizeBucketKey(bucket)}`
}

export function getDefaultBasketName(bucket) {
  return normalizeBucketKey(bucket)
}

export function ensureBucketNames(bucketKeysByType, rawNames) {
  const source = rawNames && typeof rawNames === 'object' ? rawNames : {}
  const names = {}

  BASKET_TYPES.forEach((type) => {
    getBucketKeysForType(type, bucketKeysByType).forEach((bucket) => {
      const key = getBasketNameKey(type, bucket)
      names[key] = sanitizeBucketName(source[key], getDefaultBasketName(bucket))
    })
  })

  if (typeof source.A === 'string') {
    BASKET_TYPES.forEach((type) => {
      const key = getBasketNameKey(type, 'A')
      if (names[key]) names[key] = sanitizeBucketName(source.A, names[key])
    })
  }
  if (typeof source.B === 'string') {
    BASKET_TYPES.forEach((type) => {
      const key = getBasketNameKey(type, 'B')
      if (names[key]) names[key] = sanitizeBucketName(source.B, names[key])
    })
  }

  return names
}

export function getBasketName(type, bucket, bucketNames, bucketKeysByType) {
  const key = getBasketNameKey(type, bucket)
  return sanitizeBucketName(bucketNames?.[key], getDefaultBasketName(bucket))
}
