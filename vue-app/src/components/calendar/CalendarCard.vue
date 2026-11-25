<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { formatDateStr, getIsoWeekNumber } from '../../domain/date'

const props = defineProps({
  weekStart: {
    type: Date,
    required: true,
  },
  isThreeDayMode: {
    type: Boolean,
    default: false,
  },
  isCollapsed: {
    type: Boolean,
    default: false,
  },
  blocksByDate: {
    type: Object,
    required: true,
  },
  hourGuideTops: {
    type: Array,
    required: true,
  },
  trackHeight: {
    type: Number,
    required: true,
  },
  nowLineByDate: {
    type: Object,
    required: true,
  },
  banner: {
    type: Object,
    required: true,
  },
  todayDateStr: {
    type: String,
    required: true,
  },
  basketNameResolver: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits(['shift', 'today', 'toggle-mode', 'toggle-collapse', 'new-block', 'edit-block'])

const weekLabel = computed(() => `今年第 ${getIsoWeekNumber(new Date())} 周`)
const monthLabel = computed(() => {
  const date = props.weekStart
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
})

const dayNameMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const hoveredBlockId = ref(null)
const dayBodyRefs = ref({})
const syncedScrollTop = ref(0)
let syncingScroll = false

const visibleDates = computed(() => {
  const days = props.isThreeDayMode ? 3 : 7
  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(props.weekStart)
    date.setDate(date.getDate() + idx)
    return {
      date,
      dateStr: formatDateStr(date),
      dayName: dayNameMap[date.getDay()],
      dayNumber: date.getDate(),
      isToday: formatDateStr(date) === props.todayDateStr,
    }
  })
})

function getBlockClass(block) {
  return ['time-block', `type-${block.type || 'fish'}`, hoveredBlockId.value === block.id ? 'expanded' : '']
}

function getBlockStyle(block, columnBlocks) {
  const hovered = (columnBlocks || []).find((item) => item.id === hoveredBlockId.value)
  if (!hovered) {
    return {
      top: `${block.topPx}px`,
      height: `${block.collapsedHeight}px`,
    }
  }

  const expandDelta = Math.max(0, hovered.expandedHeight - hovered.collapsedHeight)
  const shiftThreshold = hovered.topPx + hovered.collapsedHeight

  let top = block.topPx
  if (block.id !== hovered.id && block.topPx >= shiftThreshold) {
    top += expandDelta
  }

  const currentHeight = block.id === hovered.id ? hovered.expandedHeight : block.collapsedHeight
  return {
    top: `${top}px`,
    height: `${currentHeight}px`,
  }
}

function getTrackStyle(columnBlocks) {
  const hovered = (columnBlocks || []).find((item) => item.id === hoveredBlockId.value)
  const expandDelta = hovered ? Math.max(0, hovered.expandedHeight - hovered.collapsedHeight) : 0
  return {
    height: `${props.trackHeight + expandDelta}px`,
  }
}

function setDayBodyRef(dateStr, el) {
  if (el) {
    dayBodyRefs.value[dateStr] = el
    el.scrollTop = syncedScrollTop.value
  } else {
    delete dayBodyRefs.value[dateStr]
  }
}

function syncDayBodyScroll(sourceEl) {
  if (!sourceEl || syncingScroll) return
  syncingScroll = true
  syncedScrollTop.value = sourceEl.scrollTop
  Object.values(dayBodyRefs.value).forEach((el) => {
    if (el !== sourceEl) el.scrollTop = syncedScrollTop.value
  })
  syncingScroll = false
}

watch(
  visibleDates,
  async () => {
    await nextTick()
    Object.values(dayBodyRefs.value).forEach((el) => {
      el.scrollTop = syncedScrollTop.value
    })
  },
  { deep: true },
)
</script>

<template>
  <section class="card calendar-card" :class="{ collapsed: isCollapsed }">
    <div class="calendar-header">
      <div class="calendar-nav">
        <button type="button" class="nav-btn" @click="emit('shift', -1)">◀</button>
        <span id="currentMonthLabel">{{ monthLabel }}</span>
        <button type="button" class="nav-btn" @click="emit('shift', 1)">▶</button>
        <span class="current-task-banner" :class="banner.className" :style="{ display: 'inline-block' }">{{ banner.text }}</span>
      </div>
      <div class="calendar-meta">
        <button type="button" class="today-btn" @click="emit('today')">今天</button>
        <span class="week-badge">{{ weekLabel }}</span>
      </div>
    </div>

    <div class="calendar-grid" :style="{ gridTemplateColumns: `repeat(${isThreeDayMode ? 3 : 7}, minmax(0, 1fr))` }">
      <article v-for="column in visibleDates" :key="column.dateStr" class="day-column" @click="emit('new-block', column.dateStr)">
        <div class="day-title">
          <div class="date-circle" :class="{ today: column.isToday }">{{ column.dayNumber }}</div>
          <div class="day-name">{{ column.dayName }}</div>
        </div>

        <div
          :ref="(el) => setDayBodyRef(column.dateStr, el)"
          class="day-body"
          :class="column.isToday ? 'scrollbar-primary' : 'scrollbar-hidden'"
          @scroll="syncDayBodyScroll($event.target)"
        >
          <div class="day-track" :style="getTrackStyle(blocksByDate[column.dateStr] || [])">
            <div
              v-for="top in hourGuideTops"
              :key="`guide-${column.dateStr}-${top}`"
              class="hour-guide-line"
              :style="{ top: `${top}px` }"
            />
            <div
              v-if="nowLineByDate[column.dateStr] !== undefined"
              class="current-time-line"
              :style="{ top: `${nowLineByDate[column.dateStr]}px` }"
            />

            <div
              v-for="block in blocksByDate[column.dateStr] || []"
              :key="block.id"
              :class="getBlockClass(block)"
              :style="getBlockStyle(block, blocksByDate[column.dateStr] || [])"
              @click.stop="emit('edit-block', block.id)"
              @mouseenter="hoveredBlockId = block.id"
              @mouseleave="hoveredBlockId = null"
            >
              <div class="block-time">{{ block.typeIcon }} {{ block.durationLabel }}</div>
              <div class="block-time">{{ block.start }} - {{ block.end }}</div>
              <div v-for="(task, idx) in block.visibleTasks || []" :key="task.id" class="block-task" :class="{ 'extra-task': idx > 0 }">
                {{ task.title }}
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="calendar-toggle-row">
      <button type="button" class="calendar-toggle-btn" @click="emit('toggle-collapse')">
        {{ isCollapsed ? '展开日历' : '收起日历' }}
      </button>
      <button type="button" class="calendar-toggle-btn" @click="emit('toggle-mode')">
        {{ isThreeDayMode ? '显示一周' : '显示三天' }}
      </button>
    </div>
  </section>
</template>
