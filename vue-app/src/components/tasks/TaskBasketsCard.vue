<script setup>
import { computed, ref } from 'vue'
import { BASKET_TYPES, MIN_BUCKET_COUNT, TYPE_META } from '../../domain/buckets'

const props = defineProps({
  tasks: {
    type: Array,
    required: true,
  },
  bucketKeysByType: {
    type: Object,
    required: true,
  },
  basketNameResolver: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits([
  'add-task',
  'edit-task',
  'toggle-task',
  'delete-task',
  'move-top',
  'rename-bucket',
  'add-bucket',
  'remove-bucket',
])

const draftTitleByBucket = ref({})
const expandedPendingKeys = ref(new Set())

const groupedTasks = computed(() => {
  const groups = {}
  BASKET_TYPES.forEach((type) => {
    groups[type] = {}
    ;(props.bucketKeysByType[type] || []).forEach((bucket) => {
      groups[type][bucket] = {
        pending: props.tasks.filter((task) => task.type === type && task.bucket === bucket && !task.completed),
        completed: props.tasks.filter((task) => task.type === type && task.bucket === bucket && task.completed),
      }
    })
  })
  return groups
})

function bucketDraftKey(type, bucket) {
  return `${type}-${bucket}`
}

function addTask(type, bucket) {
  const key = bucketDraftKey(type, bucket)
  const title = String(draftTitleByBucket.value[key] || '').trim()
  if (!title) return
  emit('add-task', { type, bucket, title })
  draftTitleByBucket.value[key] = ''
}

function togglePending(type, bucket) {
  const key = `${type}|${bucket}`
  const next = new Set(expandedPendingKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedPendingKeys.value = next
}

function isPendingExpanded(type, bucket) {
  return expandedPendingKeys.value.has(`${type}|${bucket}`)
}

function getDisplayPending(type, bucket) {
  const all = groupedTasks.value?.[type]?.[bucket]?.pending || []
  if (all.length <= 5 || isPendingExpanded(type, bucket)) return all
  return all.slice(0, 5)
}

function createdAtLabel(task) {
  if (!task?.createdAt) return ''
  const d = new Date(task.createdAt)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getPlaceholder(type) {
  if (type === 'fruit') return '添加果时事务...'
  if (type === 'veggie') return '添加蔬时事务...'
  return '添加肉时事务...'
}
</script>

<template>
  <div class="baskets">
    <section v-for="type in BASKET_TYPES" :key="type" class="basket-type-column">
      <article
        v-for="(bucket, idx) in bucketKeysByType[type] || []"
        :key="`${type}-${bucket}`"
        class="basket"
        :class="`basket-${type}`"
      >
        <header class="basket-header">
          <h3>
            {{ TYPE_META[type].icon }} {{ TYPE_META[type].label }}篮子
            <button type="button" class="basket-name-btn" @click="emit('rename-bucket', { type, bucket })">
              {{ basketNameResolver(type, bucket) }}
            </button>
          </h3>
          <button
            v-if="idx >= MIN_BUCKET_COUNT"
            type="button"
            class="basket-delete-btn"
            @click="emit('remove-bucket', { type, bucket })"
          >
            删除
          </button>
        </header>

        <div class="inline-add-row">
          <input
            v-model="draftTitleByBucket[bucketDraftKey(type, bucket)]"
            class="inline-add-input"
            type="text"
            :placeholder="getPlaceholder(type)"
            @keydown.enter.prevent="addTask(type, bucket)"
          />
          <button type="button" class="inline-add-btn" @click="addTask(type, bucket)">添加</button>
        </div>

        <div class="pending-list">
          <div v-for="task in getDisplayPending(type, bucket)" :key="task.id" class="task-item">
            <div class="task-main" @click="emit('edit-task', task.id)">
              <input class="task-checkbox" type="checkbox" :checked="task.completed" @click.stop @change.stop="emit('toggle-task', task.id)" />
              <div class="task-text">
                <span class="task-name">{{ task.title || '（未命名事务）' }}</span>
                <span v-if="createdAtLabel(task)" class="task-meta">{{ createdAtLabel(task) }}</span>
              </div>
              <div class="task-actions">
                <button
                  type="button"
                  class="task-action-btn task-pin-btn"
                  title="置顶事务"
                  aria-label="置顶事务"
                  @click.stop="emit('move-top', task.id)"
                >
                  <span class="task-action-icon">↥</span>
                </button>
                <button
                  type="button"
                  class="task-action-btn task-delete-btn"
                  title="删除事务"
                  aria-label="删除事务"
                  @click.stop="emit('delete-task', task.id)"
                >
                  <span class="task-action-icon">✕</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          v-if="(groupedTasks[type][bucket]?.pending || []).length > 5"
          type="button"
          class="pending-toggle-btn"
          @click="togglePending(type, bucket)"
        >
          {{ isPendingExpanded(type, bucket) ? '▴' : '▾' }}
        </button>

        <details class="completed-wrap">
          <summary>已完成（{{ groupedTasks[type][bucket]?.completed?.length || 0 }}）</summary>
          <div>
            <div v-for="task in groupedTasks[type][bucket]?.completed || []" :key="task.id" class="task-item">
              <div class="task-main" @click="emit('edit-task', task.id)">
                <input class="task-checkbox" type="checkbox" checked @click.stop @change.stop="emit('toggle-task', task.id)" />
                <div class="task-text">
                  <span class="task-name">{{ task.title || '（未命名事务）' }}</span>
                  <span v-if="createdAtLabel(task)" class="task-meta">{{ createdAtLabel(task) }}</span>
                </div>
                <button
                  type="button"
                  class="task-delete-btn"
                  title="删除事务"
                  aria-label="删除事务"
                  @click.stop="emit('delete-task', task.id)"
                >
                  <span class="task-action-icon">✕</span>
                </button>
              </div>
            </div>
          </div>
        </details>
      </article>

      <div class="basket-add-row" :class="`basket-add-row-${type}`">
        <button type="button" class="basket-add-btn" @click="emit('add-bucket', type)">新增篮子</button>
      </div>
    </section>
  </div>
</template>
