<script setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import CalendarCard from '../components/calendar/CalendarCard.vue'
import TaskBasketsCard from '../components/tasks/TaskBasketsCard.vue'
import TaskModal from '../components/modals/TaskModal.vue'
import BlockModal from '../components/modals/BlockModal.vue'
import BucketNameModal from '../components/modals/BucketNameModal.vue'
import DeleteBasketModal from '../components/modals/DeleteBasketModal.vue'
import { useUiStore } from '../stores/ui'
import { useScheduleStore } from '../stores/schedule'
import { useTasksStore } from '../stores/tasks'
import { useBucketsStore } from '../stores/buckets'
import { nextNumericId } from '../domain/ids'
import { formatDurationHours } from '../domain/block-scoring'
import {
  formatDateStr,
  getBusinessDateInfo,
  getRepeatDates,
  normalizeTimeToAxisMinute,
  timeToMinutes,
  truncateTextByChars,
} from '../domain/date'
import { usePlannerSync } from '../composables/usePlannerSync'
import {
  getBasketName,
  getBucketKeysForType,
  isValidBucketForType,
  normalizeBucketKey,
} from '../domain/buckets'

const DAY_AXIS_START_MINUTES = 6 * 60
const DAY_AXIS_END_MINUTES = DAY_AXIS_START_MINUTES + 24 * 60
const BLANK_MINUTE_PX = 0.3
const ACTIVE_MINUTE_PX = 0.16

const uiStore = useUiStore()
const scheduleStore = useScheduleStore()
const tasksStore = useTasksStore()
const bucketsStore = useBucketsStore()
const plannerSync = usePlannerSync()

const { activeModal, editingTaskId, editingBlockId, selectedDate, pendingDeleteBucket } = storeToRefs(uiStore)
const { blocks } = storeToRefs(scheduleStore)
const { tasks } = storeToRefs(tasksStore)
const { bucketKeysByType, bucketNames } = storeToRefs(bucketsStore)

const bucketRenameTarget = ref(null)

const todayDateStr = computed(() => formatDateStr(new Date()))
const dayCount = computed(() => (uiStore.isThreeDayMode ? 3 : 7))

const visibleRange = computed(() => {
  const start = new Date(uiStore.currentWeekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + (dayCount.value - 1))
  return {
    startStr: formatDateStr(start),
    endStr: formatDateStr(end),
  }
})

const tasksById = computed(() => {
  const map = new Map()
  tasks.value.forEach((task) => map.set(Number(task.id), task))
  return map
})

const nowInfo = computed(() => getBusinessDateInfo(new Date(), DAY_AXIS_START_MINUTES))

function getNormalizedRange(block) {
  const start = normalizeTimeToAxisMinute(block.start, DAY_AXIS_START_MINUTES)
  let end = normalizeTimeToAxisMinute(block.end, DAY_AXIS_START_MINUTES)
  if (end <= start) end += 24 * 60

  const clampedStart = Math.max(DAY_AXIS_START_MINUTES, Math.min(start, DAY_AXIS_END_MINUTES))
  const clampedEnd = Math.max(DAY_AXIS_START_MINUTES, Math.min(end, DAY_AXIS_END_MINUTES))
  if (clampedEnd <= clampedStart) return null
  return { start: clampedStart, end: clampedEnd }
}

function getVisibleTasksForBlock(block, limit = 3) {
  return (Array.isArray(block.taskIds) ? block.taskIds : [])
    .map((id) => tasksById.value.get(Number(id)))
    .filter((task) => task && !task.completed)
    .slice(0, limit)
}

function getRequiredBlockContentHeight(block, visibleLimit = 3) {
  const visibleCount = getVisibleTasksForBlock(block, visibleLimit).length
  return 66 + visibleCount * 26
}

function buildTimelineLayout() {
  const weekBlocks = blocks.value
    .filter((block) => block.date >= visibleRange.value.startStr && block.date <= visibleRange.value.endStr)
    .map((block) => {
      const range = getNormalizedRange(block)
      if (!range) return null
      return {
        id: block.id,
        start: range.start,
        end: range.end,
        requiredHeight: getRequiredBlockContentHeight(block, 1),
      }
    })
    .filter(Boolean)

  const pointSet = new Set([DAY_AXIS_START_MINUTES, DAY_AXIS_END_MINUTES])
  weekBlocks.forEach((item) => {
    pointSet.add(item.start)
    pointSet.add(item.end)
  })

  const points = Array.from(pointSet).sort((a, b) => a - b)
  const indexMap = new Map(points.map((p, idx) => [p, idx]))
  const nodeCount = points.length
  const edges = Array.from({ length: nodeCount }, () => [])
  const heights = Array(nodeCount).fill(Number.NEGATIVE_INFINITY)
  heights[0] = 0

  for (let i = 0; i < nodeCount - 1; i += 1) {
    const segStart = points[i]
    const segEnd = points[i + 1]
    const segMinutes = segEnd - segStart
    const hasAnyBlock = weekBlocks.some((item) => item.start < segEnd && item.end > segStart)
    const minSegHeight = segMinutes * (hasAnyBlock ? ACTIVE_MINUTE_PX : BLANK_MINUTE_PX)
    edges[i].push({ to: i + 1, weight: minSegHeight })
  }

  weekBlocks.forEach((item) => {
    const from = indexMap.get(item.start)
    const to = indexMap.get(item.end)
    edges[from].push({ to, weight: item.requiredHeight })
  })

  for (let i = 0; i < nodeCount; i += 1) {
    if (!Number.isFinite(heights[i])) continue
    edges[i].forEach((edge) => {
      heights[edge.to] = Math.max(heights[edge.to], heights[i] + edge.weight)
    })
  }

  const totalHeight = Math.max(220, Math.ceil(heights[nodeCount - 1]))

  function minuteToTop(minute) {
    const m = Math.max(DAY_AXIS_START_MINUTES, Math.min(minute, DAY_AXIS_END_MINUTES))
    if (m <= points[0]) return 0
    if (m >= points[nodeCount - 1]) return heights[nodeCount - 1]

    let idx = 0
    while (idx < nodeCount - 1 && points[idx + 1] < m) idx += 1
    const leftMinute = points[idx]
    const rightMinute = points[idx + 1]
    const leftTop = heights[idx]
    const rightTop = heights[idx + 1]
    const ratio = (m - leftMinute) / (rightMinute - leftMinute)
    return leftTop + (rightTop - leftTop) * ratio
  }

  return {
    totalHeight,
    minuteToTop,
  }
}

const timelineLayout = computed(() => buildTimelineLayout())

const hourGuideTops = computed(() => {
  const list = []
  for (let minute = DAY_AXIS_START_MINUTES; minute <= DAY_AXIS_END_MINUTES; minute += 60) {
    list.push(Math.round(timelineLayout.value.minuteToTop(minute)))
  }
  return list
})

const blocksByDate = computed(() => {
  const grouped = {}
  blocks.value.forEach((block) => {
    const range = getNormalizedRange(block)
    if (!range) return

    const visibleTasks = getVisibleTasksForBlock(block, 3)
    const collapsedHeight = Math.max(getRequiredBlockContentHeight(block, 1), timelineLayout.value.minuteToTop(range.end) - timelineLayout.value.minuteToTop(range.start))
    const expandedHeight = Math.max(getRequiredBlockContentHeight(block, 3), timelineLayout.value.minuteToTop(range.end) - timelineLayout.value.minuteToTop(range.start))
    const durationLabel = formatDurationHours((range.end - range.start) / 60)
    const typeIcon = { meat: '🥩', fruit: '🍎', veggie: '🥦', fish: '🐟' }[block.type] || '🐟'

    const decorated = {
      ...block,
      visibleTasks,
      topPx: timelineLayout.value.minuteToTop(range.start),
      collapsedHeight,
      expandedHeight,
      durationLabel,
      typeIcon,
    }

    if (!grouped[block.date]) grouped[block.date] = []
    grouped[block.date].push(decorated)
  })

  Object.keys(grouped).forEach((date) => {
    grouped[date].sort((a, b) => String(a.start).localeCompare(String(b.start)))
  })

  return grouped
})

const nowLineByDate = computed(() => {
  const targetDate = nowInfo.value.dateStr
  return {
    [targetDate]: timelineLayout.value.minuteToTop(nowInfo.value.axisMinute),
  }
})

const banner = computed(() => {
  const time = new Date()
  const timeLabel = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
  const dayBlocks = (blocksByDate.value[nowInfo.value.dateStr] || []).slice().sort((a, b) => a.topPx - b.topPx)
  const current = dayBlocks.find((block) => {
    const start = normalizeTimeToAxisMinute(block.start, DAY_AXIS_START_MINUTES)
    let end = normalizeTimeToAxisMinute(block.end, DAY_AXIS_START_MINUTES)
    if (end <= start) end += 24 * 60
    return nowInfo.value.axisMinute >= start && nowInfo.value.axisMinute < end
  })

  if (!current) {
    return {
      text: `${timeLabel} 当前无事务：Take a break...`,
      className: '',
    }
  }

  const taskText = truncateTextByChars(
    (current.visibleTasks || []).map((task) => task.title || '（未命名事务）').join(' | ') || '...',
    20,
  )
  return {
    text: `${timeLabel} ${current.typeIcon || '🗂️'} 当前事务：${taskText}`,
    className: `type-${current.type || 'fish'}`,
  }
})

const editingTask = computed(() => {
  const id = Number(editingTaskId.value)
  return tasks.value.find((task) => Number(task.id) === id) || null
})

const editingBlock = computed(() => {
  const id = Number(editingBlockId.value)
  return blocks.value.find((block) => Number(block.id) === id) || null
})

const currentBlockDate = computed(() => selectedDate.value || editingBlock.value?.date || null)

const currentBlockBucketKeys = computed(() => {
  const type = editingBlock.value?.type || 'meat'
  return getBucketKeysForType(type, bucketKeysByType.value)
})

const deleteBasketName = computed(() => {
  if (!pendingDeleteBucket.value) return ''
  const { type, bucket } = pendingDeleteBucket.value
  return basketNameResolver(type, bucket)
})

function basketNameResolver(type, bucket) {
  return getBasketName(type, bucket, bucketNames.value, bucketKeysByType.value)
}

function shiftCalendar(direction) {
  const step = uiStore.isThreeDayMode ? 3 : 7
  uiStore.shiftWeek(direction * step)
}

async function toggleCalendarMode() {
  uiStore.toggleThreeDayMode()
  await plannerSync.saveState()
}

function toggleCalendarCollapse() {
  uiStore.toggleCalendarCollapse()
}

function toggleTaskBasketsCollapse() {
  uiStore.toggleTaskBasketsCollapse()
}

async function goToday() {
  uiStore.goToTodayWeek()
  await plannerSync.saveState()
}

function openNewBlock(dateStr) {
  uiStore.openBlockModal({ date: dateStr })
}

function openEditBlock(blockId) {
  const block = blocks.value.find((item) => Number(item.id) === Number(blockId))
  if (!block) return
  uiStore.openBlockModal({ blockId: block.id, date: block.date })
}

async function saveBlock(payload) {
  const selectedBucket = normalizeBucketKey(payload.taskBucket)
  const typeKeys = getBucketKeysForType(payload.type, bucketKeysByType.value)
  const taskBucket = typeKeys.includes(selectedBucket) ? selectedBucket : typeKeys[0] || 'A'

  if (payload.id) {
    const existing = blocks.value.find((block) => Number(block.id) === Number(payload.id))
    if (!existing) return

    if (payload.editScope === 'daily') {
      const dailyDateSet = new Set(getRepeatDates(existing.date, 'daily'))
      scheduleStore.setBlocks(
        blocks.value.map((block) => {
          if (block.start !== existing.start) return block
          if (!dailyDateSet.has(block.date)) return block
          return { ...block, start: payload.start, end: payload.end, flexibility: payload.flexibility, type: payload.type, taskBucket }
        }),
      )
    } else if (payload.editScope === 'workdays') {
      const workdayDateSet = new Set(getRepeatDates(existing.date, 'workdays'))
      scheduleStore.setBlocks(
        blocks.value.map((block) => {
          if (block.start !== existing.start) return block
          if (!workdayDateSet.has(block.date)) return block
          return { ...block, start: payload.start, end: payload.end, flexibility: payload.flexibility, type: payload.type, taskBucket }
        }),
      )
    } else if (payload.editScope === 'weekly') {
      const weeklyDateSet = new Set(getRepeatDates(existing.date, 'weekly'))
      scheduleStore.setBlocks(
        blocks.value.map((block) => {
          if (block.start !== existing.start) return block
          if (!weeklyDateSet.has(block.date)) return block
          return { ...block, start: payload.start, end: payload.end, flexibility: payload.flexibility, type: payload.type, taskBucket }
        }),
      )
    } else {
      scheduleStore.upsertBlock({
        ...existing,
        ...payload,
        date: payload.date,
        taskBucket,
        taskIds: Array.isArray(existing.taskIds) ? existing.taskIds : [],
      })
    }
  } else {
    const targetDates = getRepeatDates(payload.date, payload.repeatMode || 'none')
    const nextBlocks = blocks.value.slice()
    targetDates.forEach((targetDate) => {
      const duplicated = nextBlocks.some((block) => block.date === targetDate && block.start === payload.start && block.end === payload.end)
      if (duplicated) return
      nextBlocks.push({
        id: nextNumericId(nextBlocks),
        date: targetDate,
        start: payload.start,
        end: payload.end,
        flexibility: payload.flexibility,
        type: payload.type,
        taskBucket,
        taskIds: [],
      })
    })
    scheduleStore.setBlocks(nextBlocks)
  }

  await plannerSync.reassignAndSave()
  uiStore.setActiveModal(null)
}

async function deleteBlock(payload) {
  if (!payload?.id) return
  const block = blocks.value.find((item) => Number(item.id) === Number(payload.id))
  if (!block) return

  const mode = payload.deleteMode || 'thisday'
  const targetDateSet = new Set(getRepeatDates(block.date, mode === 'thisday' ? 'none' : mode))

  const toDelete = blocks.value.filter((item) => {
    if (item.start !== block.start) return false
    if (mode === 'thisday') return item.date === block.date
    return targetDateSet.has(item.date)
  })
  const deleteIds = new Set(toDelete.map((item) => Number(item.id)))
  scheduleStore.setBlocks(blocks.value.filter((item) => !deleteIds.has(Number(item.id))))

  await plannerSync.reassignAndSave()
  uiStore.setActiveModal(null)
}

async function addTask({ type, bucket, title }) {
  const safeBucket = isValidBucketForType(type, bucket, bucketKeysByType.value)
    ? normalizeBucketKey(bucket)
    : getBucketKeysForType(type, bucketKeysByType.value)[0] || 'A'
  const task = {
    id: nextNumericId(tasks.value),
    title,
    detail: '',
    type,
    bucket: safeBucket,
    completed: false,
    createdAt: new Date().toISOString(),
    blockIds: [],
  }
  tasksStore.upsertTask(task)
  await plannerSync.reassignAndSave()
}

function openTaskModal(taskId) {
  uiStore.openTaskModal(taskId)
}

function openTaskModalFromBlock(taskId) {
  uiStore.setActiveModal(null)
  uiStore.openTaskModal(taskId)
}

async function closeTaskModal(payload) {
  const taskId = Number(payload?.id)
  const task = tasks.value.find((item) => Number(item.id) === taskId)
  if (task && typeof payload?.completed === 'boolean' && task.completed !== payload.completed) {
    tasksStore.upsertTask({ ...task, completed: payload.completed })
    await plannerSync.reassignAndSave()
  }
  uiStore.setActiveModal(null)
}

async function saveTask(payload) {
  if (!payload || !String(payload.title || '').trim()) return
  tasksStore.upsertTask({ ...payload, title: String(payload.title).trim() })
  await plannerSync.reassignAndSave()
  uiStore.setActiveModal(null)
}

async function deleteTask(taskId) {
  tasksStore.removeTask(taskId)
  await plannerSync.reassignAndSave()
  uiStore.setActiveModal(null)
}

async function toggleTask(taskId) {
  const task = tasks.value.find((item) => Number(item.id) === Number(taskId))
  if (!task) return
  tasksStore.upsertTask({ ...task, completed: !task.completed })
  await plannerSync.reassignAndSave()
}

async function moveTaskToTop(taskId) {
  const list = tasks.value.slice()
  const idx = list.findIndex((task) => Number(task.id) === Number(taskId))
  if (idx < 0) return
  const [target] = list.splice(idx, 1)
  const insertIdx = list.findIndex((task) => task.type === target.type && task.bucket === target.bucket && !task.completed)
  if (insertIdx < 0) list.push(target)
  else list.splice(insertIdx, 0, target)
  tasksStore.setTasks(list)
  await plannerSync.reassignAndSave()
}

function openRenameBucket({ type, bucket }) {
  bucketRenameTarget.value = { type, bucket }
  uiStore.setActiveModal('rename-bucket')
}

async function saveRenameBucket(rawName) {
  if (!bucketRenameTarget.value) return
  bucketsStore.renameBucket(bucketRenameTarget.value.type, bucketRenameTarget.value.bucket, rawName)
  await plannerSync.saveState()
  uiStore.setActiveModal(null)
}

async function requestRemoveBucket({ type, bucket }) {
  const relatedCount = tasks.value.filter((task) => task.type === type && task.bucket === bucket).length
  if (relatedCount > 0) {
    uiStore.openBucketDeleteModal({ type, bucket })
    return
  }
  await removeBucketNow(type, bucket)
}

async function removeBucketNow(type, bucket) {
  const ok = bucketsStore.removeBucket(type, bucket)
  if (!ok) return
  const nextKeys = getBucketKeysForType(type, bucketKeysByType.value)
  const fallbackBucket = nextKeys[0] || 'A'
  tasksStore.setTasks(tasks.value.filter((task) => !(task.type === type && task.bucket === bucket)))
  scheduleStore.setBlocks(
    blocks.value.map((block) => {
      if (block.type === type && block.taskBucket === bucket) {
        return { ...block, taskBucket: fallbackBucket, taskIds: [] }
      }
      return block
    }),
  )
  await plannerSync.reassignAndSave()
  uiStore.setActiveModal(null)
}

async function confirmDeleteBasket() {
  if (!pendingDeleteBucket.value) return
  await removeBucketNow(pendingDeleteBucket.value.type, pendingDeleteBucket.value.bucket)
}

async function addBucket(type) {
  const nextBucket = bucketsStore.addBucket(type)
  if (!nextBucket) return
  await plannerSync.saveState()
}

onMounted(async () => {
  await plannerSync.loadState()
  uiStore.goToTodayWeek()
})
</script>

<template>
  <main class="app-container">
    <CalendarCard
      :week-start="uiStore.currentWeekStart"
      :is-three-day-mode="uiStore.isThreeDayMode"
      :is-collapsed="uiStore.isCalendarCollapsed"
      :blocks-by-date="blocksByDate"
      :hour-guide-tops="hourGuideTops"
      :track-height="timelineLayout.totalHeight"
      :now-line-by-date="nowLineByDate"
      :banner="banner"
      :today-date-str="todayDateStr"
      :basket-name-resolver="basketNameResolver"
      @shift="shiftCalendar"
      @today="goToday"
      @toggle-mode="toggleCalendarMode"
      @toggle-collapse="toggleCalendarCollapse"
      @new-block="openNewBlock"
      @edit-block="openEditBlock"
    />

    <section class="card task-baskets-card" :class="{ collapsed: uiStore.isTaskBasketsCollapsed }" id="taskBasketsCard">
      <div class="task-baskets-header-row">
        <h2>📝 事务篮子</h2>
        <button class="task-baskets-toggle-btn" type="button" @click="toggleTaskBasketsCollapse">
          {{ uiStore.isTaskBasketsCollapsed ? '展开事务篮子' : '收起事务篮子' }}
        </button>
      </div>
      <TaskBasketsCard
        :tasks="tasks"
        :bucket-keys-by-type="bucketKeysByType"
        :basket-name-resolver="basketNameResolver"
        @add-task="addTask"
        @edit-task="openTaskModal"
        @toggle-task="toggleTask"
        @delete-task="deleteTask"
        @move-top="moveTaskToTop"
        @rename-bucket="openRenameBucket"
        @add-bucket="addBucket"
        @remove-bucket="requestRemoveBucket"
      />
    </section>

    <TaskModal
      v-if="activeModal === 'task' && editingTask"
      :task="editingTask"
      @close="closeTaskModal"
      @save="saveTask"
      @delete="deleteTask"
    />

    <BlockModal
      v-if="activeModal === 'block' && currentBlockDate"
      :block="editingBlock"
      :date-str="currentBlockDate"
      :bucket-keys="currentBlockBucketKeys"
      :basket-name-resolver="basketNameResolver"
      :tasks="tasks"
      @close="uiStore.setActiveModal(null)"
      @save="saveBlock"
      @delete="deleteBlock"
      @open-task="openTaskModalFromBlock"
    />

    <BucketNameModal
      v-if="activeModal === 'rename-bucket' && bucketRenameTarget"
      :type="bucketRenameTarget.type"
      :bucket="bucketRenameTarget.bucket"
      :current-name="basketNameResolver(bucketRenameTarget.type, bucketRenameTarget.bucket)"
      @close="uiStore.setActiveModal(null)"
      @save="saveRenameBucket"
    />

    <DeleteBasketModal
      v-if="activeModal === 'delete-bucket' && pendingDeleteBucket"
      :basket-name="deleteBasketName"
      @close="uiStore.setActiveModal(null)"
      @confirm="confirmDeleteBasket"
    />
  </main>
</template>
