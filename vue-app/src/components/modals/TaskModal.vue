<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  task: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'save', 'delete'])

const form = reactive({
  title: '',
  detail: '',
  completed: false,
})

const createdAtText = reactive({ value: '未知' })

watch(
  () => props.task,
  (task) => {
    form.title = task?.title || ''
    form.detail = task?.detail || ''
    form.completed = Boolean(task?.completed)
    const d = task?.createdAt ? new Date(task.createdAt) : null
    createdAtText.value = d && !Number.isNaN(d.getTime())
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : '未知'
  },
  { immediate: true },
)

function save() {
  if (!form.title.trim()) {
    alert('事务标题不能为空！')
    return
  }
  emit('save', {
    ...props.task,
    title: form.title.trim(),
    detail: form.detail.trim(),
    completed: form.completed,
  })
}

function closeModal() {
  emit('close', {
    id: props.task?.id,
    completed: form.completed,
  })
}
</script>

<template>
  <div class="modal-overlay active" @click.self="closeModal">
    <div class="modal">
      <h3>✏️ 编辑事务</h3>
      <div class="task-modal-row"><label>事务标题</label><input v-model="form.title" type="text" /></div>
      <div class="task-modal-row"><label>事务详情</label><textarea v-model="form.detail" rows="5" /></div>
      <div>
        <label><input v-model="form.completed" type="checkbox" /> 标记为已完成</label>
      </div>
      <p style="margin: 0; color: #666; font-size: 13px;">添加日期: {{ createdAtText.value }}</p>

      <button type="button" style="background: #4CAF50;" @click="save">保存事务</button>
      <button type="button" style="background: #f44336;" @click="emit('delete', props.task?.id)">删除事务</button>
    </div>
  </div>
</template>
