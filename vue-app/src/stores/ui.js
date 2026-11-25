import { defineStore } from 'pinia'

function getMonday(dateObj) {
  const date = new Date(dateObj)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    isCalendarCollapsed: false,
    isTaskBasketsCollapsed: false,
    isThreeDayMode: false,
    currentWeekStart: getMonday(new Date()),
    activeModal: null,
    editingTaskId: null,
    editingBlockId: null,
    selectedDate: null,
    pendingDeleteBucket: null,
  }),
  actions: {
    toggleThreeDayMode() {
      this.isThreeDayMode = !this.isThreeDayMode
      if (this.isThreeDayMode) {
        const now = new Date()
        this.currentWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else {
        this.currentWeekStart = getMonday(this.currentWeekStart || new Date())
      }
    },
    toggleCalendarCollapse() {
      this.isCalendarCollapsed = !this.isCalendarCollapsed
    },
    toggleTaskBasketsCollapse() {
      this.isTaskBasketsCollapsed = !this.isTaskBasketsCollapsed
    },
    goToTodayWeek() {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      this.currentWeekStart = this.isThreeDayMode ? today : getMonday(today)
    },
    shiftWeek(days) {
      const next = new Date(this.currentWeekStart)
      next.setDate(next.getDate() + Number(days || 0))
      this.currentWeekStart = next
    },
    openTaskModal(taskId = null) {
      this.editingTaskId = taskId
      this.activeModal = 'task'
    },
    openBlockModal({ blockId = null, date = null } = {}) {
      this.editingBlockId = blockId
      this.selectedDate = date
      this.activeModal = 'block'
    },
    openBucketDeleteModal(payload) {
      this.pendingDeleteBucket = payload || null
      this.activeModal = 'delete-bucket'
    },
    setActiveModal(modalName) {
      this.activeModal = modalName || null
      if (!modalName) {
        this.editingTaskId = null
        this.editingBlockId = null
        this.pendingDeleteBucket = null
      }
    },
  },
})
