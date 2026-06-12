<template>
  <div class="content">
    <div class="section-header">
      <h2>Roommates</h2>
    </div>

    <div v-if="!store.roommates.length" class="empty-state">
      <div class="icon">🏠</div>
      <p>No roommates yet.</p>
    </div>

    <div v-for="r in store.roommates" :key="r.id" class="card rm-card">
      <div class="row">
        <div class="rm-avatar">{{ r.name[0].toUpperCase() }}</div>
        <span class="rm-name">{{ r.name }}</span>
        <span v-if="r.id === store.currentUser?.id" class="badge badge-green">you</span>
        <span class="spacer"></span>
        <button
          v-if="store.isAdmin && r.id !== store.currentUser?.id"
          class="btn-icon"
          title="Remove"
          @click="confirmRemove(r)"
        >🗑️</button>
      </div>

      <div v-if="removing?.id === r.id" class="delete-confirm">
        <span>Remove {{ r.name }}?</span>
        <button class="btn btn-danger btn-sm" :disabled="busy" @click="doRemove(r.id)">
          {{ busy ? 'Removing…' : 'Remove' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="removing = null">Cancel</button>
      </div>
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
const removing = ref(null)

function confirmRemove(r) { removing.value = r }

async function doRemove(id) {
  busy.value = true
  try { await store.deleteRoommate(id); removing.value = null }
  catch (e) { err.value = e.message }
  finally { busy.value = false }
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
.rm-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary-light); color: var(--primary); font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rm-name { font-weight: 500; font-size: 15px; }
.delete-confirm { background: var(--danger-light); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13px; }
.delete-confirm span { flex: 1; }
.err-text { color: var(--danger); font-size: 13px; margin-top: 8px; }
</style>
