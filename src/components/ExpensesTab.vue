<template>
  <div class="content">

    <!-- Admin toolbar -->
    <div v-if="store.isAdmin && store.expenses.length" class="card admin-toolbar">
      <div class="row">
        <span class="admin-label">⚙ Admin Actions</span>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" @click="toggleMultiSelect">
          {{ multiSelect ? 'Cancel Select' : 'Select Multiple' }}
        </button>
        <button
          v-if="multiSelect && selectedIds.size > 0"
          class="btn btn-danger btn-sm"
          :disabled="delBusy"
          @click="bulkDelete"
        >
          Delete ({{ selectedIds.size }})
        </button>
      </div>
    </div>

    <!-- Add button -->
    <div class="section-header">
      <h2>Expenses</h2>
      <button class="btn btn-primary btn-sm" @click="openPanel(null)">+ Add</button>
    </div>

    <div v-if="store.loading" class="empty-state">
      <div class="spinner" style="margin:0 auto"></div>
    </div>

    <div v-else-if="!store.expenses.length" class="empty-state">
      <div class="icon">🧾</div>
      <p>No expenses yet. Add the first one!</p>
    </div>

    <div
      v-for="exp in store.expenses"
      :key="exp.id"
      class="card expense-card"
      :class="{ 'exp-selected': multiSelect && selectedIds.has(exp.id) }"
      @click="handleCardClick(exp.id)"
    >
      <div class="exp-top">
        <!-- Checkbox in multi-select mode -->
        <input
          v-if="multiSelect"
          type="checkbox"
          class="exp-checkbox"
          :checked="selectedIds.has(exp.id)"
          @click.stop
          @change="toggleSelect(exp.id)"
        />

        <div class="exp-info">
          <div class="exp-title">{{ exp.title }}</div>
          <div class="exp-meta">Paid by {{ payerName(exp.payerId) }} · {{ fmtDate(exp.date) }}</div>
        </div>

        <div class="exp-amount">₹{{ fmt(exp.amount) }}</div>
        <div class="exp-chevron">{{ expandedId === exp.id ? '▲' : '▼' }}</div>
      </div>

      <!-- Expanded: participants table + actions -->
      <template v-if="expandedId === exp.id && !multiSelect">
        <hr class="divider" style="margin:12px 0 8px" />

        <!-- Participant header -->
        <div class="participants-header">
          <span class="splits-label">👥 Participants ({{ exp.splits.length }})</span>
          <span class="part-summary">{{ exp.splits.length }} people · ₹{{ fmt(exp.amount / exp.splits.length) }} each avg</span>
        </div>

        <!-- Each participant row: payer highlighted, others show who they owe -->
        <div v-for="s in exp.splits" :key="s.id" class="participant-row" :class="{ 'is-payer': s.roommateId === exp.payerId }">
          <div class="part-left">
            <div class="part-avatar" :class="{ 'part-avatar-payer': s.roommateId === exp.payerId }">
              {{ rmName(s.roommateId).slice(0,2).toUpperCase() }}
            </div>
            <div>
              <div class="part-name">{{ rmName(s.roommateId) }}</div>
              <div class="part-sub">
                <span v-if="s.roommateId === exp.payerId" class="badge-paid">Paid the bill</span>
                <span v-else class="part-owes">owes ₹{{ fmt(s.amount) }} → {{ payerName(exp.payerId) }}</span>
              </div>
            </div>
          </div>
          <span class="part-amount" :class="s.roommateId === exp.payerId ? 'amount-paid' : 'amount-owes'">
            ₹{{ fmt(s.amount) }}
          </span>
        </div>

        <div class="exp-actions">
          <button class="btn btn-ghost btn-sm" @click.stop="openPanel(exp)">✏️ Edit</button>
          <button v-if="store.isAdmin" class="btn btn-danger btn-sm" @click.stop="confirmDel = exp">🗑️ Delete</button>
        </div>

        <!-- Inline delete confirm -->
        <div v-if="confirmDel?.id === exp.id" class="delete-confirm">
          <span>Delete "{{ exp.title }}"?</span>
          <button class="btn btn-danger btn-sm" :disabled="delBusy" @click.stop="doDelete(exp.id)">
            {{ delBusy ? '…' : 'Delete' }}
          </button>
          <button class="btn btn-ghost btn-sm" @click.stop="confirmDel = null">Cancel</button>
        </div>
      </template>
    </div>

    <ExpensePanel v-if="panelOpen" :expense="editTarget" @close="closePanel" />
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useExpenseStore } from '@/stores/expense'
import ExpensePanel from './ExpensePanel.vue'

const store = useExpenseStore()

const expandedId = ref(null)
const panelOpen = ref(false)
const editTarget = ref(null)
const confirmDel = ref(null)
const delBusy = ref(false)
const multiSelect = ref(false)
const selectedIds = reactive(new Set())

function handleCardClick(id) {
  if (multiSelect.value) { toggleSelect(id); return }
  expandedId.value = expandedId.value === id ? null : id
  confirmDel.value = null
}

function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
}

function toggleMultiSelect() {
  multiSelect.value = !multiSelect.value
  selectedIds.clear()
  expandedId.value = null
}

function openPanel(exp) { editTarget.value = exp; panelOpen.value = true }
function closePanel() { panelOpen.value = false; editTarget.value = null }

function fmt(n) { return Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(2) }
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function payerName(id) { return store.roommates.find(r => r.id === id)?.name || 'Unknown' }
function rmName(id) { return store.roommates.find(r => r.id === id)?.name || '?' }

async function doDelete(id) {
  delBusy.value = true
  try {
    await store.deleteExpense(id)
    confirmDel.value = null
    expandedId.value = null
  } finally { delBusy.value = false }
}

async function bulkDelete() {
  delBusy.value = true
  try {
    await store.deleteExpenses([...selectedIds])
    selectedIds.clear()
    multiSelect.value = false
  } finally { delBusy.value = false }
}
</script>

<style scoped>
.admin-toolbar { margin-bottom: 4px; }
.admin-label { font-weight: 600; font-size: 14px; }
.expense-card { cursor: pointer; transition: border-color 0.15s; user-select: none; }
.expense-card:hover { border-color: var(--primary); }
.exp-selected { border-color: var(--primary); border-width: 2px; background: var(--primary-light); }
.exp-top { display: flex; align-items: center; gap: 10px; }
.exp-checkbox { width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; accent-color: var(--primary); }
.exp-info { flex: 1; min-width: 0; }
.exp-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exp-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.exp-amount { font-size: 1.1rem; font-weight: 800; color: var(--primary); flex-shrink: 0; }
.exp-chevron { color: var(--text-muted); font-size: 11px; flex-shrink: 0; }
.splits-label { font-size: 12px; font-weight: 700; color: var(--primary); }
.participants-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.part-summary { font-size: 11px; color: var(--text-muted); }
.participant-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 8px; border-radius: var(--radius-sm); margin-bottom: 4px; background: var(--bg); }
.is-payer { background: var(--primary-light); }
.part-left { display: flex; align-items: center; gap: 8px; }
.part-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--border); color: var(--text-muted); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.part-avatar-payer { background: var(--primary); color: #fff; }
.part-name { font-size: 13px; font-weight: 600; }
.part-sub { font-size: 11px; margin-top: 1px; }
.badge-paid { color: var(--primary); font-weight: 600; }
.part-owes { color: var(--danger); }
.part-amount { font-size: 13px; font-weight: 700; flex-shrink: 0; }
.amount-paid  { color: var(--primary); }
.amount-owes  { color: var(--text-muted); }
.exp-actions { display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end; }
.delete-confirm { background: var(--danger-light); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; margin-top: 10px; }
.delete-confirm span { flex: 1; min-width: 100px; }
</style>
