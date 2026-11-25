import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useScheduleStore } from '../stores/schedule'
import { useTasksStore } from '../stores/tasks'
import { useBucketsStore } from '../stores/buckets'
import { useUiStore } from '../stores/ui'
import { fetchState, persistState } from '../services/state-api'
import { normalizeBucketKeysByType, ensureBucketNames, normalizeBucketKey } from '../domain/buckets'
import { autoAssignTasks } from '../domain/task-assignment'

const STORAGE_KEY = 'time_manager_demo_state_v1'

function normalizeTasks(rawTasks = []) {
  return rawTasks.map((task) => ({
    ...task,
    title: String(task.title || task.name || '').split(/\r?\n/)[0].trim(),
    detail:
      task.detail ||
      (typeof task.name === 'string' ? task.name.split(/\r?\n/).slice(1).join('\n').trim() : ''),
    bucket: task.bucket || 'A',
    completed: Boolean(task.completed),
    createdAt: task.createdAt || null,
    blockIds: Array.isArray(task.blockIds) ? task.blockIds : task.blockId ? [task.blockId] : [],
  }))
}

function normalizeBlocks(rawBlocks = []) {
  return rawBlocks.map((block) => ({
    ...block,
    taskIds: Array.isArray(block.taskIds) ? block.taskIds : block.taskId ? [block.taskId] : [],
  }))
}

export function usePlannerSync() {
  const scheduleStore = useScheduleStore()
  const tasksStore = useTasksStore()
  const bucketsStore = useBucketsStore()
  const uiStore = useUiStore()

  const { blocks } = storeToRefs(scheduleStore)
  const { tasks } = storeToRefs(tasksStore)
  const { bucketKeysByType, bucketNames } = storeToRefs(bucketsStore)

  const payload = computed(() => ({
    blocks: blocks.value,
    tasks: tasks.value,
    bucketKeysByType: bucketKeysByType.value,
    bucketNames: bucketNames.value,
    uiPrefs: {
      isThreeDayMode: Boolean(uiStore.isThreeDayMode),
    },
  }))

  function applyState(parsed = {}) {
    const keysByType = normalizeBucketKeysByType(parsed.bucketKeysByType || parsed.bucketKeys)
    const names = ensureBucketNames(keysByType, parsed.bucketNames)
    const nextTasks = normalizeTasks(parsed.tasks)
    const nextBlocks = normalizeBlocks(parsed.blocks)

    const assigned = autoAssignTasks({
      blocks: nextBlocks,
      tasks: nextTasks,
      bucketKeysByType: keysByType,
    })

    scheduleStore.setBlocks(assigned.blocks)
    tasksStore.setTasks(assigned.tasks)
    bucketsStore.setBucketState({
      keysByType,
      names,
    })
    uiStore.isThreeDayMode = Boolean(parsed.uiPrefs?.isThreeDayMode)
  }

  async function loadState() {
    try {
      const serverState = await fetchState()
      applyState(serverState)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.value))
      return
    } catch (err) {
      console.warn('load from api failed, falling back to localStorage', err)
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const localState = JSON.parse(raw)
      applyState(localState)
    } catch (err) {
      console.warn('load from localStorage failed', err)
    }
  }

  async function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.value))
    try {
      await persistState(payload.value)
    } catch (err) {
      console.warn('save to api failed, localStorage kept latest state', err)
    }
  }

  function reassignAndSave() {
    const normalizedTasks = tasks.value.map((task) => ({
      ...task,
      bucket: normalizeBucketKey(task.bucket),
    }))
    const assigned = autoAssignTasks({
      blocks: blocks.value,
      tasks: normalizedTasks,
      bucketKeysByType: bucketKeysByType.value,
    })
    scheduleStore.setBlocks(assigned.blocks)
    tasksStore.setTasks(assigned.tasks)
    return saveState()
  }

  return {
    loadState,
    saveState,
    reassignAndSave,
  }
}
