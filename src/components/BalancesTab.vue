<template>
  <div class="content">
    <!-- Balance cards -->
    <div class="section-header">
      <h2>Balances</h2>
    </div>

    <div v-if="!store.balances.length" class="empty-state">
      <div class="icon">⚖️</div>
      <p>No expenses yet. Add one to see balances.</p>
    </div>

    <div v-for="b in store.balances" :key="b.roommate.id" class="card balance-card">
      <div class="balance-top">
        <div class="row">
          <div class="rm-avatar">{{ b.roommate.name[0].toUpperCase() }}</div>
          <strong>{{ b.roommate.name }}</strong>
          <span v-if="b.roommate.id === store.currentUser?.id" class="badge badge-gray you-badge">you</span>
        </div>
        <span class="balance-net" :class="netClass(b.netBalance)">
          {{ b.netBalance >= 0 ? '+' : '' }}₹{{ fmt(Math.abs(b.netBalance)) }}
        </span>
      </div>
      <div class="balance-row">
        <span class="label">Paid</span>
        <span>₹{{ fmt(b.totalPaid) }}</span>
      </div>
      <div class="balance-row">
        <span class="label">Owed share</span>
        <span>₹{{ fmt(b.totalOwed) }}</span>
      </div>
      <div v-if="b.netBalance >= 0.01" class="balance-verdict badge-green badge" style="margin-top:8px">
        Gets back ₹{{ fmt(b.netBalance) }}
      </div>
      <div v-else-if="b.netBalance <= -0.01" class="balance-verdict badge-red badge" style="margin-top:8px">
        Owes ₹{{ fmt(Math.abs(b.netBalance)) }}
      </div>
      <div v-else class="balance-verdict badge-gray badge" style="margin-top:8px">Settled up</div>
    </div>

    <!-- Settlements -->
    <hr class="divider" />
    <div class="section-header">
      <h2>Who Owes Whom</h2>
    </div>

    <div v-if="!store.settlements.length" class="empty-state">
      <div class="icon">🤝</div>
      <p>All settled up!</p>
    </div>

    <div v-for="(s, i) in store.settlements" :key="i" class="card settlement-card">
      <div class="settlement-row">
        <span class="settlement-from">{{ s.fromName }}</span>
        <span class="arrow">→</span>
        <span class="settlement-to">{{ s.toName }}</span>
        <span class="spacer"></span>
        <strong>₹{{ fmt(s.amount) }}</strong>
      </div>
      <div class="settlement-meta">
        {{ s.title }}
        <span v-if="s.date"> · {{ fmtDate(s.date) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useExpenseStore } from '@/stores/expense'

const store = useExpenseStore()

function fmt(n) { return Number(n).toFixed(2) }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
function netClass(n) { return n >= 0.01 ? 'net-positive' : n <= -0.01 ? 'net-negative' : 'net-zero' }
</script>

<style scoped>
.balance-card { display: flex; flex-direction: column; gap: 6px; }
.balance-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.rm-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.you-badge { font-size: 11px; padding: 1px 6px; }
.balance-net { font-size: 1.1rem; font-weight: 700; }
.net-positive { color: var(--success); }
.net-negative { color: var(--danger); }
.net-zero { color: var(--text-muted); }
.balance-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); }
.balance-verdict { font-size: 12px; width: fit-content; }
.settlement-card { }
.settlement-row { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.settlement-from { font-weight: 600; }
.settlement-to { font-weight: 600; color: var(--primary); }
.arrow { color: var(--text-muted); }
.settlement-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
</style>
