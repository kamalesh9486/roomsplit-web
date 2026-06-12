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
          <div v-for="r in store.roommates.slice(0, 4)" :key="r.id" class="stack-avatar">{{ r.name.slice(0,2).toUpperCase() }}</div>
          <div v-if="store.roommates.length > 4" class="stack-avatar stack-more">+{{ store.roommates.length - 4 }}</div>
        </div>
        <div class="hero-sub">{{ store.roommates.length }} members · {{ store.expenses.length }} expenses</div>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="filter-wrap">
      <span class="filter-label">Viewing context:</span>
      <div class="chips">
        <button class="chip" :class="{ active: selectedId === null }" @click="selectedId = null">Everyone</button>
        <button v-for="r in store.roommates" :key="r.id" class="chip" :class="{ active: selectedId === r.id }" @click="selectedId = r.id">{{ r.name }}</button>
      </div>
    </div>

    <!-- Personalized card (when someone selected) -->
    <div v-if="selectedId && personalBreakdown" class="card personal-card">
      <div class="personal-header">
        <div class="row" style="gap:8px">
          <div class="rm-avatar sm">{{ selectedName.slice(0,2).toUpperCase() }}</div>
          <strong>{{ selectedName }}'s Balance</strong>
        </div>
        <div class="personal-totals">
          <span class="badge badge-green">+₹{{ fmt(totalOthersOweMe) }} owed to me</span>
          <span class="badge badge-red">-₹{{ fmt(totalIOweOthers) }} I owe</span>
        </div>
      </div>
      <template v-if="personalBreakdown.receives.length">
        <hr class="divider" style="margin:8px 0" />
        <div class="pd-section-label green-label">↑ Others owe me:</div>
        <div v-for="p in personalBreakdown.receives" :key="p.id" class="pd-row">
          <span class="pd-name">{{ p.name }}</span>
          <span class="pd-total green-text">₹{{ fmt(p.total) }}</span>
          <span class="pd-items">{{ p.items.map(i => `${i.title} ₹${fmt(i.amount)}`).join(' · ') }}</span>
        </div>
      </template>
      <template v-if="personalBreakdown.pays.length">
        <hr class="divider" style="margin:8px 0" />
        <div class="pd-section-label red-label">↓ I owe others:</div>
        <div v-for="p in personalBreakdown.pays" :key="p.id" class="pd-row">
          <span class="pd-name">{{ p.name }}</span>
          <span class="pd-total red-text">₹{{ fmt(p.total) }}</span>
          <span class="pd-items">{{ p.items.map(i => `${i.title} ₹${fmt(i.amount)}`).join(' · ') }}</span>
        </div>
      </template>
    </div>

    <!-- Balance cards -->
    <div class="section-header"><h2>Roommate Balances</h2></div>
    <div v-if="!store.balances.length" class="empty-state"><div class="icon">⚖️</div><p>No expenses yet.</p></div>

    <div v-for="b in store.balances" :key="b.roommate.id" class="card balance-card" :class="{ 'balance-selected': b.roommate.id === selectedId }">
      <!-- Top row -->
      <div class="balance-top">
        <div class="row" style="gap:12px">
          <div class="rm-avatar">{{ b.roommate.name.slice(0,2).toUpperCase() }}</div>
          <div>
            <div class="balance-name">{{ b.roommate.name }}</div>
            <div class="balance-sub">Paid ₹{{ fmt(b.totalPaid) }} · Own share ₹{{ fmt(b.totalOwed) }}</div>
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

      <!-- Summary: owed by / owed to counts only -->
      <div class="dues-summary">
        <div class="dues-pill green-pill" v-if="getOwedBy(b).length">
          <span class="dues-pill-label">Owed By</span>
          <span class="dues-pill-amount">₹{{ fmt(getOwedBy(b).reduce((s,x)=>s+x.total,0)) }}</span>
          <span class="dues-pill-count">{{ getOwedBy(b).length }} {{ getOwedBy(b).length === 1 ? 'person' : 'people' }}</span>
        </div>
        <div class="dues-pill red-pill" v-if="getOwesTo(b).length">
          <span class="dues-pill-label">Owes To</span>
          <span class="dues-pill-amount">₹{{ fmt(getOwesTo(b).reduce((s,x)=>s+x.total,0)) }}</span>
          <span class="dues-pill-count">{{ getOwesTo(b).length }} {{ getOwesTo(b).length === 1 ? 'person' : 'people' }}</span>
        </div>
        <div class="dues-pill settled-pill" v-if="!getOwedBy(b).length && !getOwesTo(b).length">
          <span class="dues-pill-label">All settled up</span>
        </div>
      </div>

      <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px" @click="detailsRoommate = b.roommate">
        View Details
      </button>
    </div>

    <!-- All outstanding debts — raw, one group per from→to pair -->
    <template v-if="debtGroups.length">
      <hr class="divider" />
      <div class="section-header">
        <h2>All Outstanding Debts</h2>
        <span class="badge badge-red">{{ debtGroups.length }} debt{{ debtGroups.length !== 1 ? 's' : '' }}</span>
      </div>
      <div v-for="g in debtGroups" :key="`${g.fromId}-${g.toId}`" class="card debt-group-card">
        <div class="dg-header">
          <div class="dg-pair">
            <strong class="red-text">{{ g.fromName }}</strong>
            <span class="dg-arrow">owes</span>
            <strong class="green-text">{{ g.toName }}</strong>
          </div>
          <strong class="dg-total">₹{{ fmt(g.total) }}</strong>
        </div>
        <div v-for="(item, i) in g.items" :key="i" class="dg-item">
          <span>{{ item.title }}</span>
          <span>₹{{ fmt(item.amount) }}</span>
        </div>
        <button class="btn btn-primary btn-sm" style="width:100%;margin-top:10px" @click="settleTarget = g">
          ✓ Record Settlement (₹{{ fmt(g.total) }})
        </button>
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
          <p style="color:var(--text);font-size:15px;line-height:1.6">
            Record a payment of <strong>₹{{ fmt(settleTarget.total) }}</strong>
            from <strong>{{ settleTarget.fromName }}</strong> to <strong>{{ settleTarget.toName }}</strong>
            covering {{ settleTarget.items.length }} expense{{ settleTarget.items.length !== 1 ? 's' : '' }}.
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

const grandTotal   = computed(() => store.balances.reduce((s, b) => s + b.totalPaid, 0))
const selectedName = computed(() => store.roommates.find(r => r.id === selectedId.value)?.name || '')

// Raw debts grouped by from→to pair (no netting — A→B and B→A are separate groups)
const debtGroups = computed(() => {
  const map = {}
  for (const s of store.settlements) {
    const key = `${s.fromId}→${s.toId}`
    if (!map[key]) map[key] = { fromId: s.fromId, fromName: s.fromName, toId: s.toId, toName: s.toName, total: 0, items: [] }
    map[key].total = parseFloat((map[key].total + s.amount).toFixed(2))
    map[key].items.push({ title: s.title, amount: s.amount })
  }
  return Object.values(map).filter(g => g.total > 0.01)
})

// Personalized breakdown for selected person — raw, no netting
const personalBreakdown = computed(() => {
  if (!selectedId.value) return null
  const payMap = {}, receiveMap = {}
  for (const s of store.settlements) {
    if (s.fromId === selectedId.value) {
      if (!payMap[s.toId]) payMap[s.toId] = { id: s.toId, name: s.toName, total: 0, items: [] }
      payMap[s.toId].total = parseFloat((payMap[s.toId].total + s.amount).toFixed(2))
      payMap[s.toId].items.push({ title: s.title, amount: s.amount })
    }
    if (s.toId === selectedId.value) {
      if (!receiveMap[s.fromId]) receiveMap[s.fromId] = { id: s.fromId, name: s.fromName, total: 0, items: [] }
      receiveMap[s.fromId].total = parseFloat((receiveMap[s.fromId].total + s.amount).toFixed(2))
      receiveMap[s.fromId].items.push({ title: s.title, amount: s.amount })
    }
  }
  return {
    pays:     Object.values(payMap).filter(x => x.total > 0.01),
    receives: Object.values(receiveMap).filter(x => x.total > 0.01)
  }
})

const totalOthersOweMe = computed(() =>
  store.settlements.filter(s => s.toId === selectedId.value).reduce((s, x) => s + x.amount, 0)
)
const totalIOweOthers = computed(() =>
  store.settlements.filter(s => s.fromId === selectedId.value).reduce((s, x) => s + x.amount, 0)
)

// Per balance-card helpers — raw, not netted against each other
function getOwedBy(b) {
  // Others owe this person: settlements where toId = this person
  const map = {}
  for (const s of store.settlements.filter(x => x.toId === b.roommate.id)) {
    if (!map[s.fromId]) map[s.fromId] = { id: s.fromId, name: s.fromName, total: 0, items: [] }
    map[s.fromId].total = parseFloat((map[s.fromId].total + s.amount).toFixed(2))
    map[s.fromId].items.push({ title: s.title, amount: s.amount })
  }
  return Object.values(map).filter(x => x.total > 0.01)
}

function getOwesTo(b) {
  // This person owes others: settlements where fromId = this person
  const map = {}
  for (const s of store.settlements.filter(x => x.fromId === b.roommate.id)) {
    if (!map[s.toId]) map[s.toId] = { id: s.toId, name: s.toName, total: 0, items: [] }
    map[s.toId].total = parseFloat((map[s.toId].total + s.amount).toFixed(2))
    map[s.toId].items.push({ title: s.title, amount: s.amount })
  }
  return Object.values(map).filter(x => x.total > 0.01)
}

function netClass(n) { return n >= 0.01 ? 'net-pos' : n <= -0.01 ? 'net-neg' : 'net-zero' }
function fmt(n)  { return Number(n) % 1 === 0 ? Number(n).toFixed(0) : Number(n).toFixed(2) }
function fmtN(n) { return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function doSettle() {
  settleErr.value = ''
  settleBusy.value = true
  try {
    await store.settleUp({ ...settleTarget.value, amount: settleTarget.value.total })
    settleTarget.value = null
  } catch (e) {
    settleErr.value = e.message || 'Failed to record.'
  } finally {
    settleBusy.value = false
  }
}
</script>

<style scoped>
/* Hero */
.hero-card {
  background: linear-gradient(135deg, #1a2e26 0%, #0f2018 100%);
  border: 1px solid rgba(0,200,150,0.2);
  display: flex; justify-content: space-between; align-items: flex-start;
  box-shadow: 0 0 40px rgba(0,200,150,0.06);
}
.hero-label  { font-size: 11px; font-weight: 600; font-family: var(--font-display); color: var(--primary); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
.hero-amount { font-size: 2.2rem; font-weight: 800; font-family: var(--font-display); color: var(--primary-bright); }
.hero-right  { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.avatar-stack { display: flex; flex-direction: row-reverse; }
.stack-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--surface-high); border: 2px solid var(--surface); color: var(--primary); font-size: 9px; font-weight: 700; font-family: var(--font-display); display: flex; align-items: center; justify-content: center; margin-left: -8px; }
.stack-more { background: var(--secondary-dim); color: var(--text-muted); }
.hero-sub { font-size: 10px; color: var(--text-muted); letter-spacing: 0.04em; }
/* Chips */
.filter-wrap  { margin: 14px 0 6px; }
.filter-label { font-size: 11px; font-weight: 600; font-family: var(--font-display); color: var(--text-muted); display: block; margin-bottom: 8px; letter-spacing: 0.06em; text-transform: uppercase; }
.chips        { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  padding: 5px 14px; border-radius: 99px;
  border: 1px solid var(--border); background: var(--surface-low);
  font-size: 12px; font-family: var(--font-display); font-weight: 600;
  color: var(--text-muted); cursor: pointer; transition: all 0.15s;
}
.chip.active  { background: var(--primary-dim); color: var(--primary); border-color: var(--primary); }
.chip:hover:not(.active) { border-color: var(--text-muted); color: var(--text); }
/* Personal card */
.personal-card   { margin-bottom: 4px; border-left: 3px solid var(--primary); background: var(--surface-low); }
.personal-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.personal-totals { display: flex; gap: 6px; flex-wrap: wrap; }
.pd-section-label { font-size: 11px; font-weight: 600; font-family: var(--font-display); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
.pd-row   { display: grid; grid-template-columns: auto auto 1fr; align-items: baseline; gap: 6px; padding: 3px 0; }
.pd-name  { font-weight: 600; font-size: 13px; font-family: var(--font-display); }
.pd-total { font-weight: 700; font-size: 13px; font-family: var(--font-display); }
.pd-items { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Balance card */
.balance-card     { transition: border-color 0.2s, box-shadow 0.2s; }
.balance-selected { border-color: var(--primary) !important; box-shadow: 0 0 0 1px var(--primary), 0 0 20px rgba(0,200,150,0.1); }
.balance-top      { display: flex; justify-content: space-between; align-items: flex-start; }
.rm-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--surface-high); border: 1px solid var(--border); color: var(--primary); font-weight: 800; font-size: 14px; font-family: var(--font-display); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rm-avatar.sm { width: 26px; height: 26px; font-size: 10px; }
.balance-name  { font-weight: 700; font-size: 15px; font-family: var(--font-display); color: var(--text); }
.balance-sub   { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
.balance-net-wrap  { text-align: right; }
.balance-net       { font-size: 1.15rem; font-weight: 800; font-family: var(--font-display); }
.balance-net-label { font-size: 10px; font-weight: 600; font-family: var(--font-display); letter-spacing: 0.04em; text-transform: uppercase; margin-top: 2px; }
.net-pos  { color: var(--primary-bright); }
.net-neg  { color: var(--danger); }
.net-zero { color: var(--text-muted); }
/* Dues summary pills */
.dues-summary { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.dues-pill {
  flex: 1; min-width: 120px;
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  border: 1px solid transparent;
}
.green-pill { background: var(--primary-glow); border-color: rgba(0,200,150,0.2); }
.red-pill   { background: var(--danger-dim);   border-color: rgba(255,180,171,0.2); }
.settled-pill { background: var(--surface-low); border-color: var(--border); }
.dues-pill-label  { font-size: 10px; font-weight: 700; font-family: var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; }
.green-pill .dues-pill-label { color: var(--primary); }
.red-pill   .dues-pill-label { color: var(--danger); }
.settled-pill .dues-pill-label { color: var(--text-muted); }
.dues-pill-amount { font-size: 1rem; font-weight: 800; font-family: var(--font-display); }
.green-pill .dues-pill-amount { color: var(--primary-bright); }
.red-pill   .dues-pill-amount { color: var(--danger); }
.dues-pill-count  { font-size: 11px; color: var(--text-muted); }
/* Debt groups */
.debt-group-card { background: var(--surface-low); }
.dg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.dg-pair   { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dg-arrow  { font-size: 11px; color: var(--text-muted); font-family: var(--font-display); font-weight: 600; }
.dg-total  { font-size: 1.1rem; font-family: var(--font-display); font-weight: 800; }
.dg-item   { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); padding: 5px 0; border-bottom: 1px solid var(--border); }
.dg-item:last-child { border-bottom: none; }
/* Colours */
.green-label { color: var(--primary-bright); }
.red-label   { color: var(--danger); }
.green-text  { color: var(--primary-bright); }
.red-text    { color: var(--danger); }
</style>
