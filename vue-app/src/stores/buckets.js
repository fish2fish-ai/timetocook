import { defineStore } from 'pinia'
import {
  BUCKET_LABELS,
  MIN_BUCKET_COUNT,
  normalizeBucketKeysByType,
  ensureBucketNames,
  getBasketNameKey,
  sanitizeBucketName,
  getBucketKeysForType,
} from '../domain/buckets'

export const useBucketsStore = defineStore('buckets', {
  state: () => ({
    bucketKeysByType: {
      meat: ['A', 'B'],
      fruit: ['A', 'B'],
      veggie: ['A', 'B'],
    },
    bucketNames: {
      'meat-A': 'A',
      'fruit-A': 'A',
      'veggie-A': 'A',
      'meat-B': 'B',
      'fruit-B': 'B',
      'veggie-B': 'B',
    },
  }),
  actions: {
    setBucketState({ keysByType, names } = {}) {
      const normalizedKeysByType = normalizeBucketKeysByType(keysByType || this.bucketKeysByType)
      this.bucketKeysByType = normalizedKeysByType
      this.bucketNames = ensureBucketNames(normalizedKeysByType, names || this.bucketNames)
    },
    renameBucket(type, bucket, rawName) {
      const key = getBasketNameKey(type, bucket)
      this.bucketNames = {
        ...this.bucketNames,
        [key]: sanitizeBucketName(rawName, this.bucketNames[key] || bucket),
      }
    },
    addBucket(type) {
      const typeKeys = getBucketKeysForType(type, this.bucketKeysByType)
      if (typeKeys.length >= BUCKET_LABELS.length) return null
      const nextBucket = BUCKET_LABELS.find((label) => !typeKeys.includes(label))
      if (!nextBucket) return null
      const normalized = {
        ...this.bucketKeysByType,
        [type]: [...typeKeys, nextBucket],
      }
      this.bucketKeysByType = normalizeBucketKeysByType(normalized)
      this.bucketNames = ensureBucketNames(this.bucketKeysByType, this.bucketNames)
      return nextBucket
    },
    removeBucket(type, bucket) {
      const typeKeys = getBucketKeysForType(type, this.bucketKeysByType)
      const index = typeKeys.indexOf(bucket)
      if (index < MIN_BUCKET_COUNT) return false
      const normalized = {
        ...this.bucketKeysByType,
        [type]: typeKeys.filter((key) => key !== bucket),
      }
      this.bucketKeysByType = normalizeBucketKeysByType(normalized)
      this.bucketNames = ensureBucketNames(this.bucketKeysByType, this.bucketNames)
      return true
    },
    resetToDefaults() {
      const defaults = {
        meat: ['A', 'B'],
        fruit: ['A', 'B'],
        veggie: ['A', 'B'],
      }
      this.bucketKeysByType = defaults
      this.bucketNames = ensureBucketNames(defaults, {})
    },
  },
})
