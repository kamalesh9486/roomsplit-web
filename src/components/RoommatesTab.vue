<template>
  <div class="content">
    <div class="section-header"><h2>Roommates</h2></div>

    <div v-if="!store.roommates.length" class="empty-state">
      <div class="icon">🏠</div><p>No roommates yet.</p>
    </div>

    <div v-for="r in store.roommates" :key="r.id" class="card rm-card">
      <div class="row">
        <div class="rm-avatar">{{ r.name[0].toUpperCase() }}</div>
        <div class="rm-info">
          <span class="rm-name">{{ r.name }}</span>
          <div class="rm-badges">
            <span v-if="r.id === store.currentUser?.id" class="badge badge-green">you</span>
            <span v-if="store.isAdmin && r.id !== store.currentUser?.id" class="badge badge-gray">member</span>
            <span v-if="store.isAdmin && r.id === store.currentUser?.id" class="badge" style="background:#0f4024;color:#fff">admin</span>
          </div>
        </div>
        <span class="spacer"></span>

        <!-- Delete button — conditionally shown -->
        <button
          v-if="canShowDelete(r)"
          class="btn-icon"
          :title="deleteTitle(r)"
          @click="requestDelete(r)"
        >🗑️</button>
        <span v-else-if="r.id !== store.currentUser?.id" class="lock-icon" title="Has transaction history — only admin can delete">🔒</span>
      </div>

      <!-- Inline delete confirm / cascade warning -->
      <template v-if="pendingDelete?.id === r.id">
        <!-- Admin with history: cascade warning -->
        <div v-if="store.isAdmin && store.roommateHasHistory(r.id)" class="warning-box">
          <div class="warning-title">⚠ Cascade Delete Warning</div>
          <div class="warning-body">
            {{ r.name }} has active transaction history. Deleting will permanently remove all their associated expenses and splits from both local and cloud databases. This is irreversible.
          </div>
          <div class="warning-actions">
            <button class="btn btn-danger btn-sm" :disabled="busy" @click="doDelete(r.id)">
              {{ busy ? 'Deleting…' : 'Delete Anyway' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="pendingDelete = null">Cancel</button>
          </div>
        </div>

        <!-- Normal confirm (admin deleting clean member, or basic user) -->
        <div v-else class="delete-confirm">
          <span>Remove {{ r.name }}?</span>
          <button class="btn btn-danger btn-sm" :disabled="busy" @click="doDelete(r.id)">
            {{ busy ? '…' : 'Remove' }}
          </button>
          <button class="btn btn-ghost btn-sm" @click="pendingDelete = null">Cancel</button>
        </div>
      </template>
    </div>

    <!-- Add roommate -->
    <hr class="divider" />
    <div class="card">
      <h3 style="margin-bottom:12px">Add Roommate</h3>
      <div class="row">
        <input v-model="newName" class="input" placeholder="Name" @keyup.enter="add" />
        <button class="btn btn-primary" :disabled="busy" @click="add">
          {{ busy ? '…' : 'Add' }}
        </button>
      </div>
      <p v-if="err" class="err-text">{{ err }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useExpenseStore } from '@/stores/expense'

const store = useExpenseStore()
const newName = ref('')
const err = ref('')
const busy = ref(false)
const pendingDelete = ref(null)

// Deletion rules (from guide.md):
// 1. Can never delete yourself
// 2. Basic users: can only delete if roommate has NO history
// 3. Admins: can delete anyone except self (with cascade warning if history exists)
function canShowDelete(r) {
  if (r.id === store.currentUser?.id) return false   // Rule 1: never self
  if (store.isAdmin) return true                      // Rule 3: admins can always try
  return !store.roommateHasHistory(r.id)              // Rule 2: basic users only if clean
}

function deleteTitle(r) {
  if (store.isAdmin && store.roommateHasHistory(r.id)) return 'Delete (will cascade all history)'
  return 'Remove roommate'
}

function requestDelete(r) {
  err.value = ''
  pendingDelete.value = r
}

async function doDelete(id) {
  busy.value = true
  try {
    await store.deleteRoommate(id)
    pendingDelete.value = null
  } catch (e) {
    err.value = e.message || 'Failed to delete.'
  } finally {
    busy.value = false
  }
}

async function add() {
  err.value = ''
  if (!newName.value.trim()) { err.value = 'Enter a name.'; return }
  busy.value = true
  try {
    await store.addRoommate(newName.value)
    newName.value = ''
  } catch (e) {
    err.value = e.message || 'Failed to add.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.rm-card { display: flex; flex-direction: column; gap: 10px; }
.rm-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rm-info { display: flex; flex-direction: column; gap: 3px; }
.rm-name { font-weight: 500; font-size: 15px; }
.rm-badges { display: flex; gap: 4px; flex-wrap: wrap; }
.lock-icon { font-size: 16px; opacity: 0.4; cursor: default; }
.delete-confirm { background: var(--danger-light); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
.delete-confirm span { flex: 1; }
.warning-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.warning-title { font-weight: 700; color: #c2410c; font-size: 13px; }
.warning-body { font-size: 13px; color: #9a3412; line-height: 1.5; }
.warning-actions { display: flex; gap: 8px; }
.err-text { color: var(--danger); font-size: 13px; margin-top: 8px; }
</style>
