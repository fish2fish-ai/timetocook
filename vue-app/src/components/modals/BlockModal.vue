<script setup>
import { computed, reactive, watch } from 'vue'
import { timeToMinutes } from '../../domain/date'
import { getFlexibilityByAnswers, getBlockTypeByScore } from '../../domain/block-scoring'

const props = defineProps({
  block: {
    type: Object,
    default: null,
  },
  dateStr: {
    type: String,
    required: true,
  },
  bucketKeys: {
    type: Array,
    required: true,
  },
  basketNameResolver: {
    type: Function,
    required: true,
  },
  tasks: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['close', 'save', 'delete', 'open-task'])

const form = reactive({
  start: '09:00',
  end: '10:00',
  canTakeNotesChoice: 'yes',
  canIsolateChoice: 'no',
  taskBucket: 'A',
  repeatMode: 'none',
  editScope: 'thisday',
  deleteMode: 'thisday',
})

watch(
  () => props.block,
  (block) => {
    form.start = block?.start || '09:00'
    form.end = block?.end || '10:00'
    const flexibility = Number(block?.flexibility ?? 0.7)
    if (flexibility >= 0.95) {
      form.canTakeNotesChoice = 'yes'
      form.canIsolateChoice = 'yes'
    } else if (flexibility >= 0.65) {
      form.canTakeNotesChoice = 'yes'
      form.canIsolateChoice = 'no'
    } else if (flexibility >= 0.35) {
      form.canTakeNotesChoice = 'no'
      form.canIsolateChoice = 'yes'
    } else {
      form.canTakeNotesChoice = 'no'
      form.canIsolateChoice = 'no'
    }
    form.taskBucket = block?.taskBucket || props.bucketKeys[0] || 'A'
    form.repeatMode = 'none'
    form.editScope = 'thisday'
    form.deleteMode = 'thisday'
  },
  { immediate: true },
)

const scoreInfo = computed(() => {
  const duration = (timeToMinutes(form.end) - timeToMinutes(form.start)) / 60
  if (duration <= 0) return { score: '--', type: '--', flexibility: 0.7 }
  const flexibility = getFlexibilityByAnswers(form.canTakeNotesChoice === 'yes', form.canIsolateChoice === 'yes')
  const type = getBlockTypeByScore(duration, flexibility)
  return {
    score: (duration * flexibility).toFixed(2),
    type,
    flexibility,
  }
})

const scoreTypeEmoji = computed(() => {
  const map = {
    meat: '🥩',
    fruit: '🍎',
    veggie: '🥦',
    fish: '🐟',
  }
  return map[scoreInfo.value.type] || '--'
})

const scopeOptions = computed(() => {
  const base = [
    { value: 'thisday', label: '这一天' },
    { value: 'daily', label: '每一天（相同开始时间）' },
    { value: 'weekly', label: '每个星期的这一天（相同开始时间）' },
  ]

  const d = new Date(`${props.dateStr}T00:00:00`)
  const day = d.getDay()
  const isWeekday = day >= 1 && day <= 5
  if (isWeekday) {
    base.splice(2, 0, { value: 'workdays', label: '每个工作日（相同开始时间）' })
  }
  return base
})

const assignedTasks = computed(() => {
  if (scoreInfo.value.type === '--' || scoreInfo.value.type === 'fish') return []
  return (props.tasks || [])
    .filter((task) => !task.completed && task.type === scoreInfo.value.type && task.bucket === form.taskBucket)
    .slice(0, 3)
})

function save() {
  if (!form.canTakeNotesChoice || !form.canIsolateChoice) {
    alert('每个问题都需要且只能选择“是”或“否”！')
    return
  }
  if (timeToMinutes(form.end) <= timeToMinutes(form.start)) {
    alert('结束时间必须晚于开始时间！')
    return
  }
  emit('save', {
    ...props.block,
    date: props.dateStr,
    start: form.start,
    end: form.end,
    flexibility: scoreInfo.value.flexibility,
    type: scoreInfo.value.type,
    taskBucket: form.taskBucket,
    repeatMode: form.repeatMode,
    editScope: form.editScope,
  })
}

function setChoiceGroup(groupName, value) {
  if (groupName === 'canTakeNotes') {
    form.canTakeNotesChoice = value
    return
  }
  if (groupName === 'canIsolate') {
    form.canIsolateChoice = value
  }
}

function remove() {
  emit('delete', {
    id: props.block?.id,
    deleteMode: form.deleteMode,
    date: props.block?.date || props.dateStr,
    start: props.block?.start || form.start,
  })
}
</script>

<template>
  <div class="modal-overlay active" @click.self="emit('close')">
    <div class="modal">
      <div class="block-modal-title-row">
        <h3>{{ block ? '✏️ 编辑时间块' : '➕ 设定时间块' }}</h3>
        <span>{{ dateStr }}</span>
      </div>

      <div class="block-modal-time-row">
        <input v-model="form.start" type="time" />
        <span class="block-modal-time-divider">-</span>
        <input v-model="form.end" type="time" />
      </div>
      <div class="question-row">
        <label>这段时间方便做笔记吗？</label>
        <div class="yn-group">
          <label><input :checked="form.canTakeNotesChoice === 'yes'" type="checkbox" @change="setChoiceGroup('canTakeNotes', 'yes')" /> 是</label>
          <label><input :checked="form.canTakeNotesChoice === 'no'" type="checkbox" @change="setChoiceGroup('canTakeNotes', 'no')" /> 否</label>
        </div>
      </div>
      <div class="question-row">
        <label>这段时间能忽视干扰吗？</label>
        <div class="yn-group">
          <label><input :checked="form.canIsolateChoice === 'yes'" type="checkbox" @change="setChoiceGroup('canIsolate', 'yes')" /> 是</label>
          <label><input :checked="form.canIsolateChoice === 'no'" type="checkbox" @change="setChoiceGroup('canIsolate', 'no')" /> 否</label>
        </div>
      </div>

      <div v-if="block">
        <div class="block-modal-scope-row">
          <label>编辑范围</label>
          <select v-model="form.editScope">
            <option v-for="option in scopeOptions" :key="`edit-${option.value}`" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
      </div>

      <div v-if="!block" class="block-modal-scope-row">
        <label>同步添加</label>
        <select v-model="form.repeatMode">
          <option value="none">仅这一天</option>
          <option value="daily">每一天</option>
          <option value="workdays">每个工作日</option>
          <option value="weekly">每个星期的这一天</option>
        </select>
      </div>

      <p class="type-note">系统会根据时长与灵活度评估时间块得分。<br />当前时间块得分：{{ scoreInfo.score }} 类型：{{ scoreTypeEmoji }}</p>

      <div class="block-modal-bucket-row">
        <label>事务篮子</label>
        <select v-model="form.taskBucket">
          <option v-for="bucket in bucketKeys" :key="bucket" :value="bucket">
            {{ basketNameResolver(scoreInfo.type === '--' ? 'meat' : scoreInfo.type, bucket) }}
          </option>
        </select>
      </div>

      <div class="assigned-tasks-hint" style="display: block;">
        <div class="assigned-tasks-title">已分配事务</div>
        <template v-for="idx in [0, 1, 2]" :key="`slot-${idx}`">
          <button
            v-if="assignedTasks[idx]"
            type="button"
            class="assigned-task-link"
            @click="emit('open-task', assignedTasks[idx].id)"
          >
            {{ assignedTasks[idx].title || '（未命名事务）' }}
          </button>
          <div v-else class="assigned-task-slot">占位</div>
        </template>
      </div>

      <button type="button" style="background: #4CAF50;" @click="save">保存块</button>
      <template v-if="block">
        <button type="button" style="background: #f44336;" @click="remove">删除块</button>
        <div class="block-modal-scope-row">
          <label>删除范围</label>
          <select v-model="form.deleteMode">
            <option v-for="option in scopeOptions" :key="`delete-${option.value}`" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
      </template>
    </div>
  </div>
</template>
