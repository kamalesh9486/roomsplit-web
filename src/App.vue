<template>
  <!-- Not configured -->
  <div v-if="!configured" class="setup-screen">
    <div class="card setup-card">
      <div class="logo-icon">₹</div>
      <h1>RoomSplit</h1>
      <p>Supabase is not configured. Add your credentials to get started.</p>
      <pre class="setup-code">VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-key</pre>
      <p class="setup-hint">Set these in Vercel → Project → Settings → Environment Variables, then redeploy.</p>
    </div>
  </div>

  <!-- Not logged in -->
  <LoginScreen v-else-if="!store.currentUser" />

  <!-- Dashboard -->
  <template v-else>
    <header class="topbar">
      <div class="topbar-brand">
        <div class="brand-icon">₹</div>
        <div>
          <h1>RoomSplit</h1>
          <span>Bachelors Suite #402</span>
        </div>
      </div>
      <div class="topbar-user">
        <div class="avatar">{{ store.currentUser.name[0].toUpperCase() }}</div>
        <span class="uname">{{ store.currentUser.name }}</span>
        <button @click="store.logout()">Logout</button>
      </div>
    </header>

    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab-btn"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >{{ t.label }}</button>
      <span class="spacer"></span>
      <button class="tab-refresh" :disabled="store.loading" @click="store.loadData()" title="Refresh">
        <span v-if="store.loading" class="spinner" style="width:14px;height:14px;border-width:2px"></span>
        <span v-else>↻</span>
      </button>
    </nav>

    <div v-if="store.error" class="error-banner" style="max-width:720px;margin:12px auto;border-radius:8px">
      {{ store.error }}
    </div>

    <BalancesTab v-if="activeTab === 'balances'" />
    <ExpensesTab v-else-if="activeTab === 'expenses'" />
    <RoommatesTab v-else-if="activeTab === 'roommates'" />
  </template>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useExpenseStore } from '@/stores/expense'
import { isConfigured } from '@/lib/supabase'
import LoginScreen from '@/components/LoginScreen.vue'
import BalancesTab from '@/components/BalancesTab.vue'
import ExpensesTab from '@/components/ExpensesTab.vue'
import RoommatesTab from '@/components/RoommatesTab.vue'

const store = useExpenseStore()
const configured = isConfigured
const activeTab = ref('balances')

const tabs = [
  { id: 'balances', label: '⚖️ Balances' },
  { id: 'expenses', label: '🧾 Expenses' },
  { id: 'roommates', label: '🏠 Roommates' }
]

onMounted(() => store.loadData())
</script>

<style scoped>
.brand-icon {
  width: 34px; height: 34px; border-radius: 10px;
  background: var(--primary-dim);
  border: 1px solid var(--primary);
  color: var(--primary); font-size: 1.05rem; font-family: var(--font-display); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.uname { font-size: 13px; font-family: var(--font-display); font-weight: 600; color: var(--text); }
.tab-refresh {
  background: transparent; border: none; cursor: pointer;
  padding: 14px 12px; color: var(--text-muted);
  font-size: 18px; display: flex; align-items: center;
  transition: color 0.15s;
}
.tab-refresh:hover { color: var(--primary); }

/* Setup screen */
.setup-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); }
.setup-card { max-width: 420px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.logo-icon {
  width: 60px; height: 60px; border-radius: var(--radius);
  background: var(--primary-dim); border: 1px solid var(--primary);
  color: var(--primary); font-size: 1.8rem; font-family: var(--font-display);
  display: flex; align-items: center; justify-content: center;
}
.setup-code {
  background: var(--surface-low); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 14px; font-size: 12px;
  text-align: left; white-space: pre; width: 100%; font-family: monospace;
  color: var(--primary-bright);
}
.setup-hint { font-size: 12px; color: var(--text-muted); }

@media (max-width: 640px) {
  .brand-icon { width: 30px; height: 30px; font-size: 0.95rem; border-radius: 8px; }
  .uname { display: none; }
  .setup-card { padding: 0 4px; }
  .setup-code { font-size: 11px; }
}
</style>
