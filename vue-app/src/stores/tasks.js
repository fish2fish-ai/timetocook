import { defineStore } from 'pinia'

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
  }),
  getters: {
    pendingTasks: (state) => state.tasks.filter((task) => !task.completed),
  },
  actions: {
    setTasks(nextTasks) {
      this.tasks = Array.isArray(nextTasks) ? nextTasks : []
    },
    upsertTask(nextTask) {
      if (!nextTask || typeof nextTask !== 'object') return
      const id = Number(nextTask.id)
      const safeTask = {
        ...nextTask,
        id,
        blockIds: Array.isArray(nextTask.blockIds) ? nextTask.blockIds : [],
      }
      const idx = this.tasks.findIndex((task) => Number(task.id) === id)
      if (idx >= 0) this.tasks[idx] = safeTask
      else this.tasks.push(safeTask)
    },
    removeTask(taskId) {
      const target = Number(taskId)
      this.tasks = this.tasks.filter((task) => Number(task.id) !== target)
    },
  },
})
