<template>
  <div class="panel-overlay" @click.self="$emit('close')">
    <div class="panel">
      <div class="panel-header">
        <div class="row" style="gap:8px">
          <button class="btn-icon" @click="$emit('close')">←</button>
          <h2>Detailed Breakdown</h2>
        </div>
        <button class="btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="panel-body">
        <!-- Identity header -->
        <div class="identity-card">
          <div class="id-avatar">{{ roommate.name.slice(0, 2).toUpperCase() }}</div>
          <div>
            <div class="id-name">{{ roommate.name }}</div>
            <div class="id-net">{{ netText }}</div>
          </div>
        </div>

        <!-- Owed By section (others owe this person) -->
        <div class="section-title owed-by-title">
          Owed By (₹{{ fmtN(totalOwedByAll) }})
        </div>

        <div v-if="!roommatesWhoOwe.length" class="empty-note">
          No active debts — no expenses paid by {{ roommate.name }} yet.
        </div>
        <div v-for="{ other, list } in roommatesWhoOwe" :key="other.id" class="detail-card">
          <div class="detail-top">
            <span class="detail-name">{{ other.name }}</span>
            <span class="detail-amount owed-by-amt">₹{{ fmtN(sum(list)) }}</span>
          </div>
          <div class="detail-formula">{{ formula(list) }}</div>
          <div class="detail-contrib">
            Contributing: {{ list.map(x => `${x.title} (₹${fmtN(x.amount)})`).join(', ') }}
          </div>
        </div>

        <!-- Owed To section (this person owes others) -->
        <div class="section-title owed-to-title" style="margin-top:20px">
          Owed To (₹{{ fmtN(totalOwedToAll) }})
        </div>

        <div v-if="!roommatesWhoAreOwed.length" class="empty-note">
          {{ roommate.name }} does not owe anyone at the moment.
        </div>
        <div v-for="{ other, list } in roommatesWhoAreOwed" :key="other.id" class="detail-card">
          <div class="detail-top">
            <span class="detail-name">{{ other.name }}</span>
            <span class="detail-amount owed-to-amt">₹{{ fmtN(sum(list)) }}</span>
          </div>
          <div class="detail-formula">{{ formula(list) }}</div>
          <div class="detail-contrib">
            Contributing: {{ list.map(x => `${x.title} (₹${fmtN(x.amount)})`).join(', ') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useExpenseStore } from '@/stores/expense'

const props = defineProps({ roommate: { type: Object, required: true } })
defineEmits(['close'])
const store = useExpenseStore()

const rid = computed(() => props.roommate.id)
const otherRoommates = computed(() => store.roommates.filter(r => r.id !== rid.value))

// Owed By: expenses where this person paid — others owe them
const owedByMap = computed(() => {
  const map = {}
  for (const r of otherRoommates.value) map[r.id] = []
  for (const exp of store.expenses) {
    if (exp.payerId !== rid.value) continue
    for (const split of (exp.splits || [])) {
      if (split.roommateId !== rid.value && split.amount > 0.01 && map[split.roommateId]) {
        map[split.roommateId].push({ amount: split.amount, title: exp.title })
      }
    }
  }
  return map
})

// Owed To: expenses where others paid — this person owes them
const owedToMap = computed(() => {
  const map = {}
  for (const r of otherRoommates.value) map[r.id] = []
  for (const exp of store.expenses) {
    if (exp.payerId === rid.value) continue
    for (const split of (exp.splits || [])) {
      if (split.roommateId === rid.value && split.amount > 0.01 && map[exp.payerId]) {
        map[exp.payerId].push({ amount: split.amount, title: exp.title })
      }
    }
  }
  return map
})

const roommatesWhoOwe = computed(() =>
  otherRoommates.value
    .map(r => ({ other: r, list: owedByMap.value[r.id] || [] }))
    .filter(x => x.list.length > 0)
)

const roommatesWhoAreOwed = computed(() =>
  otherRoommates.value
    .map(r => ({ other: r, list: owedToMap.value[r.id] || [] }))
    .filter(x => x.list.length > 0)
)

const totalOwedByAll = computed(() => roommatesWhoOwe.value.reduce((s, x) => s + sum(x.list), 0))
const totalOwedToAll = computed(() => roommatesWhoAreOwed.value.reduce((s, x) => s + sum(x.list), 0))

const netText = computed(() => {
  const d = totalOwedByAll.value - totalOwedToAll.value
  if (d > 0.01) return `Net Owed To Him: ₹${fmtN(d)}`
  if (d < -0.01) return `Net Owes To Others: ₹${fmtN(-d)}`
  return 'Fully settled up!'
})

function sum(list) { return list.reduce((s, x) => s + x.amount, 0) }
function fmtN(n) { return Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(2) }
function formula(list) {
  const parts = list.map(x => `₹${fmtN(x.amount)}`)
  if (list.length <= 1) return parts[0] || ''
  return parts.join(' + ') + ' = ₹' + fmtN(sum(list))
}
</script>

<style scoped>
.identity-card { background: var(--primary-light); border-radius: var(--radius); padding: 16px; display: flex; gap: 14px; align-items: center; }
.id-avatar { width: 56px; height: 56px; border-radius: 50%; background: var(--primary); color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.id-name { font-size: 1.2rem; font-weight: 700; }
.id-net { font-size: 13px; color: var(--text-muted); margin-top: 3px; }
.section-title { font-size: 1rem; font-weight: 700; margin-bottom: 8px; }
.owed-by-title { color: var(--success); }
.owed-to-title { color: var(--danger); }
.empty-note { font-size: 13px; color: var(--text-muted); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; }
.detail-card { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 8px; }
.detail-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.detail-name { font-weight: 700; font-size: 15px; }
.detail-amount { font-weight: 700; font-size: 15px; }
.owed-by-amt { color: var(--success); }
.owed-to-amt { color: var(--danger); }
.detail-formula { font-size: 13px; font-weight: 500; color: var(--text-muted); }
.detail-contrib { font-size: 12px; color: var(--text-muted); margin-top: 3px; opacity: 0.8; }
</style>
