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
.login-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  padding: 20px; background: var(--bg);
  background-image: radial-gradient(ellipse at 20% 50%, rgba(0,200,150,0.06) 0%, transparent 60%),
                    radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.05) 0%, transparent 60%);
}
.login-card {
  width: 100%; max-width: 390px;
  display: flex; flex-direction: column; gap: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 32px 28px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,200,150,0.04);
}
.login-logo { text-align: center; padding-bottom: 8px; }
.logo-icon {
  width: 60px; height: 60px; border-radius: var(--radius);
  background: var(--primary-dim); border: 1px solid rgba(0,200,150,0.4);
  color: var(--primary); font-size: 1.8rem; font-family: var(--font-display); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
  box-shadow: 0 0 24px rgba(0,200,150,0.15);
}
.login-logo h1 { font-size: 1.6rem; font-family: var(--font-display); color: var(--text); }
.login-logo p { color: var(--text-muted); font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; margin-top: 4px; }
.login-prompt { font-size: 12px; font-weight: 600; font-family: var(--font-display); color: var(--text-muted); text-align: center; letter-spacing: 0.06em; text-transform: uppercase; }
.roommate-list { display: flex; flex-direction: column; gap: 6px; }
.roommate-btn {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface-low); cursor: pointer;
  font-size: 14px; font-family: var(--font-body); color: var(--text);
  text-align: left; transition: all 0.15s;
}
.roommate-btn:hover {
  background: var(--primary-glow);
  border-color: var(--primary);
  transform: translateX(2px);
}
.rm-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--surface-high); color: var(--primary);
  font-weight: 700; font-size: 13px; font-family: var(--font-display);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.or-text { font-size: 11px; font-weight: 600; font-family: var(--font-display); color: var(--text-muted); text-align: center; letter-spacing: 0.06em; text-transform: uppercase; }
.login-err { color: var(--danger); font-size: 13px; }
</style>
