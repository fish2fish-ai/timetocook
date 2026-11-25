import { getEffectiveTaskType, normalizeBucketKey } from './buckets'

function toValidBucket(type, value, bucketKeysByType) {
  const safeType = getEffectiveTaskType(type)
  const normalized = normalizeBucketKey(value)
  const keys = bucketKeysByType[safeType] || ['A', 'B']
  return keys.includes(normalized) ? normalized : 'A'
}

export function autoAssignTasks({ blocks, tasks, bucketKeysByType }) {
  const nextBlocks = Array.isArray(blocks)
    ? blocks.map((block) => ({
        ...block,
        taskIds: [],
        taskBucket: toValidBucket(block.type, block.taskBucket, bucketKeysByType),
      }))
    : []

  const nextTasks = Array.isArray(tasks)
    ? tasks.map((task) => ({
        ...task,
        blockIds: [],
        bucket: toValidBucket(task.type, task.bucket, bucketKeysByType),
      }))
    : []

  const pendingTasks = nextTasks.filter((task) => !task.completed)
  const groupKeys = Array.from(
    new Set([
      ...pendingTasks.map((task) => `${task.type}|${task.bucket}`),
      ...nextBlocks.map((block) => `${block.type}|${block.taskBucket || 'A'}`),
    ]),
  )

  groupKeys.forEach((groupKey) => {
    const [type, bucket] = groupKey.split('|')
    const topTaskIds = pendingTasks
      .filter((task) => task.type === type && task.bucket === bucket)
      .slice(0, 3)
      .map((task) => task.id)

    if (topTaskIds.length === 0) return

    const sameGroupBlocks = nextBlocks.filter(
      (block) => block.type === type && (block.taskBucket || 'A') === bucket,
    )

    sameGroupBlocks.forEach((block) => {
      block.taskIds = topTaskIds.slice()
    })

    const sameGroupBlockIds = sameGroupBlocks.map((block) => block.id)
    pendingTasks
      .filter((task) => topTaskIds.includes(task.id) && task.type === type && task.bucket === bucket)
      .forEach((task) => {
        task.blockIds = sameGroupBlockIds.slice()
      })
  })

  return {
    blocks: nextBlocks,
    tasks: nextTasks,
  }
}
