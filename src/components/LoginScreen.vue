<template>
  <div class="login-wrap">
    <div class="login-card card">
      <div class="login-logo">
        <div class="logo-icon">₹</div>
        <h1>RoomSplit</h1>
        <p>Bachelors Suite #402</p>
      </div>

      <!-- Onboarding: no roommates yet -->
      <template v-if="store.roommates.length === 0 && !store.loading">
        <div class="form-group">
          <label>Your name (you'll be the first member)</label>
          <input v-model="name" class="input" placeholder="Enter your name" @keyup.enter="register" />
        </div>
        <p v-if="err" class="login-err">{{ err }}</p>
        <button class="btn btn-primary" style="width:100%" :disabled="busy" @click="register">
          <span v-if="busy" class="spinner"></span>
          {{ busy ? 'Setting up…' : 'Get Started' }}
        </button>
      </template>

      <!-- Normal login: pick your name -->
      <template v-else-if="!store.loading">
        <p class="login-prompt">Who are you?</p>
        <div class="roommate-list">
          <button
            v-for="r in store.roommates"
            :key="r.id"
            class="roommate-btn"
            @click="selectUser(r.name)"
          >
            <span class="rm-avatar">{{ r.name[0].toUpperCase() }}</span>
            {{ r.name }}
          </button>
        </div>

        <hr class="divider" />
        <p class="or-text">Not listed? Join the suite</p>
        <div class="row">
          <input v-model="name" class="input" placeholder="Your name" @keyup.enter="register" />
          <button class="btn btn-ghost" :disabled="busy" @click="register">Join</button>
        </div>
        <p v-if="err" class="login-err">{{ err }}</p>
      </template>

      <div v-else class="empty-state">
        <div class="spinner" style="margin: 0 auto"></div>
        <p style="margin-top:12px">Loading…</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useExpenseStore } from '@/stores/expense'

const store = useExpenseStore()
const name = ref('')
const err = ref('')
const busy = ref(false)

function selectUser(n) {
  const ok = store.login(n)
  if (!ok) err.value = 'Login failed. Please try again.'
}

async function register() {
  err.value = ''
  if (!name.value.trim()) { err.value = 'Please enter your name.'; return }
  busy.value = true
  try {
    await store.registerAndLogin(name.value)
  } catch (e) {
    err.value = e.message || 'Failed to register.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); }
.login-card { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 16px; }
.login-logo { text-align: center; padding-bottom: 8px; }
.logo-icon { width: 56px; height: 56px; border-radius: 14px; background: var(--primary); color: #fff; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
.login-logo h1 { font-size: 1.4rem; }
.login-logo p { color: var(--text-muted); font-size: 13px; }
.login-prompt { font-size: 13px; font-weight: 500; color: var(--text-muted); text-align: center; }
.roommate-list { display: flex; flex-direction: column; gap: 8px; }
.roommate-btn { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; font-size: 15px; font-family: inherit; text-align: left; transition: background 0.15s, border-color 0.15s; }
.roommate-btn:hover { background: var(--primary-light); border-color: var(--primary); }
.rm-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.or-text { font-size: 12px; color: var(--text-muted); text-align: center; }
.login-err { color: var(--danger); font-size: 13px; }
</style>
