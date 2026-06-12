<template>
  <div class="login-wrap">
    <div class="login-card card">

      <!-- Logo -->
      <div class="login-logo">
        <div class="logo-icon">₹</div>
        <h1>RoomSplit</h1>
        <p>Bachelors Suite #402</p>
      </div>

      <!-- Loading -->
      <div v-if="store.loading" class="loading-state">
        <div class="spinner"></div>
        <span>Loading members…</span>
      </div>

      <!-- Onboarding: no roommates yet -->
      <template v-else-if="store.roommates.length === 0">
        <div class="onboard-note">
          No members registered yet. Enter your name to set up the suite.
        </div>
        <div class="form-group">
          <label>Your Name</label>
          <input
            v-model="name"
            class="input"
            placeholder="e.g. Kamal"
            autocomplete="off"
            @keyup.enter="register"
          />
        </div>
        <p v-if="err" class="login-err">{{ err }}</p>
        <button class="btn btn-primary" style="width:100%" :disabled="busy || !name.trim()" @click="register">
          <span v-if="busy" class="spinner" style="width:16px;height:16px;border-width:2px"></span>
          {{ busy ? 'Setting up…' : 'Create Suite & Enter' }}
        </button>
      </template>

      <!-- Normal login: type your name -->
      <template v-else>
        <div class="form-group">
          <label>Enter Your Name</label>
          <input
            ref="nameInput"
            v-model="name"
            class="input"
            :class="{ 'input-error': err, 'input-admin': isAdminName }"
            placeholder="Your registered name"
            autocomplete="off"
            spellcheck="false"
            @keyup.enter="login"
            @input="err = ''"
          />
          <!-- Admin indicator -->
          <div v-if="isAdminName" class="admin-hint">
            <span class="admin-dot"></span>
            Admin access will be granted
          </div>
        </div>

        <p v-if="err" class="login-err">
          <span class="err-icon">⚠</span>
          {{ err }}
        </p>

        <button
          class="btn btn-primary"
          style="width:100%"
          :disabled="busy || !name.trim()"
          @click="login"
        >
          <span v-if="busy" class="spinner" style="width:16px;height:16px;border-width:2px"></span>
          {{ busy ? 'Verifying…' : 'Enter Suite' }}
        </button>

        <p class="contact-hint">Not a member? Ask an admin to add you.</p>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useExpenseStore } from '@/stores/expense'

const store = useExpenseStore()
const name  = ref('')
const err   = ref('')
const busy  = ref(false)

const isAdminName = computed(() =>
  name.value.trim().toLowerCase() === 'kamal'
)

function login() {
  err.value = ''
  if (!name.value.trim()) return
  const ok = store.login(name.value.trim())
  if (!ok) {
    err.value = `"${name.value.trim()}" is not registered. Check your spelling or ask admin to add you.`
  }
}

async function register() {
  err.value = ''
  if (!name.value.trim()) { err.value = 'Please enter your name.'; return }
  busy.value = true
  try {
    await store.registerAndLogin(name.value.trim())
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
  background-image:
    radial-gradient(ellipse at 20% 50%, rgba(0,200,150,0.07) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(124,58,237,0.05) 0%, transparent 60%);
}
.login-card {
  width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: 18px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 36px 28px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,200,150,0.05);
}

/* Logo */
.login-logo { text-align: center; }
.logo-icon {
  width: 62px; height: 62px; border-radius: var(--radius);
  background: var(--primary-dim); border: 1px solid rgba(0,200,150,0.4);
  color: var(--primary); font-size: 1.9rem; font-family: var(--font-display); font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px;
  box-shadow: 0 0 28px rgba(0,200,150,0.18);
}
.login-logo h1 { font-size: 1.6rem; font-family: var(--font-display); color: var(--text); }
.login-logo p  { color: var(--text-muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 5px; }

/* Loading */
.loading-state { display: flex; align-items: center; gap: 10px; justify-content: center; color: var(--text-muted); font-size: 13px; padding: 8px 0; }

/* Onboarding */
.onboard-note { font-size: 13px; color: var(--text-muted); background: var(--surface-low); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; line-height: 1.5; }

/* Input states */
.input-error { border-color: var(--danger) !important; box-shadow: 0 0 0 3px var(--danger-dim) !important; }
.input-admin { border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-dim) !important; }

/* Admin hint */
.admin-hint {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-family: var(--font-display); font-weight: 600;
  color: var(--primary); margin-top: 6px;
}
.admin-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 6px var(--primary);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.6; transform: scale(0.85); }
}

/* Error */
.login-err {
  display: flex; align-items: flex-start; gap: 6px;
  color: var(--danger); font-size: 13px; line-height: 1.5;
}
.err-icon { flex-shrink: 0; font-size: 14px; }

/* Contact hint */
.contact-hint { font-size: 12px; color: var(--text-muted); text-align: center; }

@media (max-width: 640px) {
  .login-wrap { align-items: flex-start; padding: 16px; padding-top: 48px; }
  .login-card { padding: 28px 20px; border-radius: var(--radius-lg); }
  .login-card .input { font-size: 16px; }
  .logo-icon { width: 54px; height: 54px; }
}
</style>
