<template>
  <div class="content">

    <!-- Grand total hero -->
    <div class="card hero-card">
      <div>
        <div class="hero-label">Total Suite Expense</div>
        <div class="hero-amount">₹{{ fmtN(grandTotal) }}</div>
      </div>
      <div class="hero-right">
        <div class="avatar-stack">
          <div v-for="r in store.roommates.slice(0, 4)" :key="r.id" class="stack-avatar">
            {{ r.name.slice(0, 2).toUpperCase() }}
          </div>
          <div v-if="store.roommates.length > 4" class="stack-avatar stack-more">
            +{{ store.roommates.length - 4 }}
          </div>
        </div>
        <div class="hero-sub">Split equally among suite members</div>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="filter-wrap">
      <span class="filter-label">Viewing context:</span>
      <div class="chips">
        <button class="chip" :class="{ active: selectedId === null }" @click="selectedId = null">Everyone</button>
        <button v-for="r in store.roommates" :key="r.id" class="chip" :class="{ active: selectedId === r.id }" @click="selectedId = r.id">
          {{ r.name }}
        </button>
      </div>
    </div>

    <!-- Personalized balance card when someone is selected -->
    <div v-if="selectedBalance" class="card personal-card" :class="netCardClass(selectedBalance.netBalance)">
      <div class="row" style="gap:8px;margin-bottom:8px">
        <span class="personal-icon">{{ selectedBalance.netBalance >= 0 ? '✓' : '!' }}</span>
        <strong>Your Balance: {{ selectedBalance.roommate.name }}</strong>
      </div>
      <div class="personal-status">{{ personalStatus(selectedBalance.netBalance) }}</div>
      <template v-if="personalConsolidated.length">
        <hr class="divider" style="margin:10px 0" />
        <div class="personal-section-label">Active Settlements (Consolidated):</div>
        <div v-for="s in personalConsolidated" :key="`${s.fromId}-${s.toId}`" class="personal-row">
          <span v-if="s.fromId === selectedId">• Pay ₹{{ fmt(s.amount) }} to {{ s.toName }}</span>
          <span v-else>• Receive ₹{{ fmt(s.amount) }} from {{ s.fromName }}</span>
        </div>
      </template>
    </div>

    <!-- Balance cards -->
    <div class="section-header"><h2>Roommate Balances</h2></div>

    <div v-if="!store.balances.length" class="empty-state">
      <div class="icon">⚖️</div><p>No expenses yet.</p>
    </div>

    <div v-for="b in store.balances" :key="b.roommate.id" class="card balance-card" :class="{ 'balance-selected': b.roommate.id === selectedId }">
      <div class="balance-top">
        <div class="row" style="gap:12px">
          <div class="rm-avatar">{{ b.roommate.name.slice(0, 2).toUpperCase() }}</div>
          <div>
            <div class="balance-name">{{ b.roommate.name }}</div>
            <div class="balance-sub">Paid ₹{{ fmt(b.totalPaid) }} · Owed ₹{{ fmt(b.totalOwed) }}</div>
          </div>
        </div>
        <div class="balance-net-wrap">
          <div class="balance-net" :class="netClass(b.netBalance)">
            {{ b.netBalance >= 0.01 ? '+' : '' }}₹{{ fmt(Math.abs(b.netBalance)) }}
          </div>
          <div class="balance-net-label" :class="netClass(b.netBalance)">
            {{ b.netBalance > 0.01 ? 'is owed' : b.netBalance < -0.01 ? 'owes' : 'settled' }}
          </div>
        </div>
      </div>

      <!-- Owes to / Owed by rows -->
      <template v-if="getOwesTo(b).length || getOwedBy(b).length">
        <hr class="divider" style="margin:10px 0" />
        <div v-for="x in getOwesTo(b)" :key="`ot-${x.name}`" class="dues-row dues-owes">
          <span>→ Owes ₹{{ fmt(x.amount) }} to {{ x.name }}</span>
        </div>
        <div v-for="x in getOwedBy(b)" :key="`ob-${x.name}`" class="dues-row dues-owed">
          <span>← Owed ₹{{ fmt(x.amount) }} by {{ x.name }}</span>
        </div>
      </template>

      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px" @click="detailsRoommate = b.roommate">
        🔍 View Details
      </button>
    </div>

    <!-- Consolidated settlements -->
    <template v-if="consolidatedSettlements.length">
      <hr class="divider" />
      <div class="section-header"><h2>Suggested Settlements (Consolidated)</h2></div>
      <div v-for="s in consolidatedSettlements" :key="`${s.fromId}-${s.toId}`" class="card settlement-row-card">
        <div class="row">
          <div style="flex:1">
            <div class="row" style="gap:6px;flex-wrap:wrap">
              <strong class="settle-from">{{ s.fromName }}</strong>
              <span class="settle-arrow">→</span>
              <strong class="settle-to">{{ s.toName }}</strong>
            </div>
            <div class="settle-amount">Pay ₹{{ fmt(s.amount) }}</div>
          </div>
          <button class="btn btn-primary btn-sm" @click="settleTarget = s">✓ Settle</button>
        </div>
      </div>
    </template>

    <!-- Settle confirmation panel -->
    <div v-if="settleTarget" class="panel-overlay" @click.self="settleTarget = null">
      <div class="panel" style="max-width:400px">
        <div class="panel-header">
          <h2>Record Settlement?</h2>
          <button class="btn-icon" @click="settleTarget = null">✕</button>
        </div>
        <div class="panel-body">
          <p style="color:var(--text);font-size:15px">
            This will record a payment of <strong>₹{{ fmt(settleTarget.amount) }}</strong>
            paid by <strong>{{ settleTarget.fromName }}</strong> to <strong>{{ settleTarget.toName }}</strong>
            to offset the balance.
          </p>
          <p v-if="settleErr" class="error-banner">{{ settleErr }}</p>
        </div>
        <div class="panel-footer">
          <button class="btn btn-ghost" @click="settleTarget = null">Cancel</button>
          <button class="btn btn-primary" :disabled="settleBusy" @click="doSettle">
            <span v-if="settleBusy" class="spinner"></span>
            {{ settleBusy ? 'Recording…' : 'Record' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Roommate details slide-in -->
    <RoommateDetails v-if="detailsRoommate" :roommate="detailsRoommate" @close="detailsRoommate = null" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useExpenseStore } from '@/stores/expense'
import RoommateDetails from './RoommateDetails.vue'

const store = useExpenseStore()
const selectedId = ref(null)
const detailsRoommate = ref(null)
const settleTarget = ref(null)
const settleBusy = ref(false)
const settleErr = ref('')

const grandTotal = computed(() => store.balances.reduce((s, b) => s + b.totalPaid, 0))
const selectedBalance = computed(() => store.balances.find(b => b.roommate.id === selectedId.value) ?? null)

const consolidatedSettlements = computed(() => {
  const map = {}
  for (const s of store.settlements) {
    const key = `${s.fromId}→${s.toId}`
    if (!map[key]) map[key] = { fromId: s.fromId, fromName: s.fromName, toId: s.toId, toName: s.toName, amount: 0 }
    map[key].amount += s.amount
  }
  return Object.values(map).filter(s => s.amount > 0.01)
})

const personalConsolidated = computed(() => {
  if (!selectedId.value) return []
  const relevant = store.settlements.filter(s => s.fromId === selectedId.value || s.toId === selectedId.value)
  const map = {}
  for (const s of relevant) {
    const key = `${s.fromId}→${s.toId}`
    if (!map[key]) map[key] = { fromId: s.fromId, fromName: s.fromName, toId: s.toId, toName: s.toName, amount: 0 }
    map[key].amount += s.amount
  }
  return Object.values(map).filter(s => s.amount > 0.01)
})

function getOwesTo(b) {
  const map = {}
  for (const s of store.settlements.filter(x => x.fromId === b.roommate.id)) {
    if (!map[s.toId]) map[s.toId] = { name: s.toName, amount: 0 }
    map[s.toId].amount += s.amount
  }
  return Object.values(map).filter(x => x.amount > 0.01)
}

function getOwedBy(b) {
  const map = {}
  for (const s of store.settlements.filter(x => x.toId === b.roommate.id)) {
    if (!map[s.fromId]) map[s.fromId] = { name: s.fromName, amount: 0 }
    map[s.fromId].amount += s.amount
  }
  return Object.values(map).filter(x => x.amount > 0.01)
}

function personalStatus(net) {
  if (net > 0.01) return `You are owed ₹${fmt(net)} overall.`
  if (net < -0.01) return `You owe ₹${fmt(-net)} overall.`
  return 'You are fully settled up!'
}

function netClass(n) { return n >= 0.01 ? 'net-pos' : n <= -0.01 ? 'net-neg' : 'net-zero' }
function netCardClass(n) { return n >= 0.01 ? 'personal-green' : n <= -0.01 ? 'personal-red' : 'personal-gray' }
function fmt(n) { return Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(2) }
function fmtN(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function doSettle() {
  settleErr.value = ''
  settleBusy.value = true
  try {
    await store.settleUp(settleTarget.value)
    settleTarget.value = null
  } catch (e) {
    settleErr.value = e.message || 'Failed to record settlement.'
  } finally {
    settleBusy.value = false
  }
}
</script>

<style scoped>
/* Hero card */
.hero-card { background: var(--primary); color: #fff; border: none; display: flex; justify-content: space-between; align-items: flex-start; }
.hero-label { font-size: 13px; font-weight: 500; opacity: 0.8; margin-bottom: 4px; }
.hero-amount { font-size: 2rem; font-weight: 800; }
.hero-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.avatar-stack { display: flex; flex-direction: row-reverse; }
.stack-avatar { width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,0.25); border: 2px solid var(--primary); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-left: -8px; }
.stack-more { background: rgba(255,255,255,0.15); }
.hero-sub { font-size: 11px; opacity: 0.7; }
/* Filter chips */
.filter-wrap { margin: 12px 0 4px; }
.filter-label { font-size: 12px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 5px 12px; border-radius: 99px; border: 1px solid var(--border); background: var(--surface); font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }
/* Personal card */
.personal-card { margin-bottom: 4px; }
.personal-green { background: var(--success-light); border-color: #86efac; }
.personal-red   { background: var(--danger-light);  border-color: #fca5a5; }
.personal-gray  { background: var(--border);         border-color: var(--border); }
.personal-icon { width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
.personal-status { font-size: 15px; font-weight: 600; }
.personal-section-label { font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px; }
.personal-row { font-size: 13px; font-weight: 500; padding: 2px 0; }
/* Balance card */
.balance-card { transition: border-color 0.15s; }
.balance-selected { border-color: var(--primary); border-width: 2px; }
.balance-top { display: flex; justify-content: space-between; align-items: flex-start; }
.rm-avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.balance-name { font-weight: 700; font-size: 15px; }
.balance-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.balance-net-wrap { text-align: right; }
.balance-net { font-size: 1.1rem; font-weight: 800; }
.balance-net-label { font-size: 11px; font-weight: 500; }
.net-pos  { color: var(--success); }
.net-neg  { color: var(--danger); }
.net-zero { color: var(--text-muted); }
.dues-row { font-size: 13px; font-weight: 500; padding: 2px 0; }
.dues-owes { color: var(--danger); }
.dues-owed { color: var(--success); }
/* Consolidated settlement */
.settlement-row-card {}
.settle-from { color: var(--danger); }
.settle-arrow { color: var(--text-muted); }
.settle-to   { color: var(--success); }
.settle-amount { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
</style>
