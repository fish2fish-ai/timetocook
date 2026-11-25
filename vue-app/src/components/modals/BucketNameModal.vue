<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  type: {
    type: String,
    required: true,
  },
  bucket: {
    type: String,
    required: true,
  },
  currentName: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['close', 'save'])

const name = ref('')

watch(
  () => props.currentName,
  (next) => {
    name.value = next
  },
  { immediate: true },
)
</script>

<template>
  <div class="modal-overlay active" @click.self="emit('close')">
    <div class="modal bucket-name-modal">
      <h3>✏️ 重命名篮子</h3>
      <input v-model="name" type="text" maxlength="12" placeholder="输入篮子名称..." @keydown.enter.prevent="emit('save', name)" />
      <button type="button" style="background: #4CAF50;" @click="emit('save', name)">保存名称</button>
    </div>
  </div>
</template>
