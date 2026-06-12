<template>
  <div class="content">
    <div class="section-header">
      <h2>Expenses</h2>
      <button class="btn btn-primary btn-sm" @click="openPanel(null)">+ Add</button>
    </div>

    <div v-if="store.loading" class="empty-state">
      <div class="spinner" style="margin: 0 auto"></div>
    </div>

    <div v-else-if="!store.expenses.length" class="empty-state">
      <div class="icon">🧾</div>
      <p>No expenses yet. Add the first one!</p>
    </div>

    <div v-for="exp in store.expenses" :key="exp.id" class="card expense-card">
      <div class="exp-top">
        <div>
          <div class="exp-title">{{ exp.title }}</div>
          <div class="exp-meta">{{ fmtDate(exp.date) }} · Paid by {{ payerName(exp.payer_id) }}</div>
        </div>
        <div class="exp-right">
          <span class="exp-amount">₹{{ fmt(exp.amount) }}</span>
          <div class="exp-actions">
            <button class="btn-icon" title="Edit" @click="openPanel(exp)">✏️</button>
            <button v-if="store.isAdmin" class="btn-icon" title="Delete" @click="confirmDelete(exp)">🗑️</button>
          </div>
        </div>
      </div>

      <!-- Split breakdown -->
      <div v-if="exp.splits?.length" class="splits">
        <div v-for="s in exp.splits" :key="s.id" class="split-item">
          <span>{{ rmName(s.roommate_id) }}</span>
          <span>₹{{ fmt(s.amount) }}</span>
        </div>
      </div>

      <!-- Delete confirm -->
      <div v-if="deleting?.id === exp.id" class="delete-confirm">
        <span>Delete "{{ exp.title }}"?</span>
        <button class="btn btn-danger btn-sm" :disabled="delBusy" @click="doDelete(exp.id)">
          {{ delBusy ? 'Deleting…' : 'Delete' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="deleting = null">Cancel</button>
      </div>
    </div>

    <ExpensePanel v-if="panelOpen" :expense="editTarget" @close="closePanel" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useExpenseStore } from '@/stores/expense'
import ExpensePanel from './ExpensePanel.vue'

const store = useExpenseStore()
const panelOpen = ref(false)
const editTarget = ref(null)
const deleting = ref(null)
const delBusy = ref(false)

function openPanel(exp) { editTarget.value = exp; panelOpen.value = true }
function closePanel() { panelOpen.value = false; editTarget.value = null }

function fmt(n) { return Number(n).toFixed(2) }
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function payerName(id) { return store.roommates.find(r => r.id === id)?.name || 'Unknown' }
function rmName(id) { return store.roommates.find(r => r.id === id)?.name || '?' }

function confirmDelete(exp) { deleting.value = exp }

async function doDelete(id) {
  delBusy.value = true
  try {
    await store.deleteExpense(id)
    deleting.value = null
  } finally {
    delBusy.value = false
  }
}
</script>

<style scoped>
.expense-card { display: flex; flex-direction: column; gap: 10px; }
.exp-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.exp-title { font-weight: 600; font-size: 15px; }
.exp-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.exp-right { display: flex; align-items: flex-start; gap: 8px; flex-shrink: 0; }
.exp-amount { font-size: 1.05rem; font-weight: 700; color: var(--primary); }
.exp-actions { display: flex; gap: 2px; }
.splits { border-top: 1px solid var(--border); padding-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.split-item { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); }
.delete-confirm { background: var(--danger-light); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
.delete-confirm span { flex: 1; min-width: 100px; }
</style>
