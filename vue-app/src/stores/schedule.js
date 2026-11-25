import { defineStore } from 'pinia'

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    blocks: [],
  }),
  getters: {
    blocksByDate: (state) => {
      const grouped = {}
      state.blocks.forEach((block) => {
        if (!grouped[block.date]) grouped[block.date] = []
        grouped[block.date].push(block)
      })
      Object.keys(grouped).forEach((date) => {
        grouped[date].sort((a, b) => String(a.start).localeCompare(String(b.start)))
      })
      return grouped
    },
  },
  actions: {
    setBlocks(nextBlocks) {
      this.blocks = Array.isArray(nextBlocks) ? nextBlocks : []
    },
    upsertBlock(nextBlock) {
      if (!nextBlock || typeof nextBlock !== 'object') return
      const id = Number(nextBlock.id)
      const safeBlock = {
        ...nextBlock,
        id,
        taskIds: Array.isArray(nextBlock.taskIds) ? nextBlock.taskIds.slice(0, 3) : [],
      }
      const idx = this.blocks.findIndex((block) => Number(block.id) === id)
      if (idx >= 0) this.blocks[idx] = safeBlock
      else this.blocks.push(safeBlock)
    },
    removeBlock(blockId) {
      const target = Number(blockId)
      this.blocks = this.blocks.filter((block) => Number(block.id) !== target)
    },
  },
})
