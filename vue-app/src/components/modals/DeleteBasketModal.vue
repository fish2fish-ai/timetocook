<script setup>
const props = defineProps({
  basketName: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <div class="modal-overlay active" @click.self="emit('close')">
    <div class="modal bucket-delete-modal">
      <h3>🗑️ 删除篮子</h3>
      <p class="bucket-delete-message"><strong>{{ basketName }}</strong> 中已添加的事务将被永久删除。</p>
      <div class="bucket-delete-actions">
        <button type="button" style="background: #f44336;" @click="emit('confirm')">确认删除</button>
        <button type="button" @click="emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>
