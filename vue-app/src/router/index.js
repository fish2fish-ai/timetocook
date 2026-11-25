import { createRouter, createWebHistory } from 'vue-router'
import SchedulerView from '../views/SchedulerView.vue'

const routes = [
  {
    path: '/',
    name: 'scheduler',
    component: SchedulerView,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
