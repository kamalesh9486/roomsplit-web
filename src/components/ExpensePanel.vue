<template>
  <div class="panel-overlay" @click.self="$emit('close')">
    <div class="panel">
      <div class="panel-header">
        <h2>{{ isEdit ? 'Edit Expense' : 'Add Expense' }}</h2>
        <button class="btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="panel-body">
        <div class="form-group">
          <label>Title</label>
          <input v-model="form.title" class="input" placeholder="e.g. Groceries, Rent…" />
        </div>

        <div class="form-group">
          <label>Total Amount (₹)</label>
          <input v-model.number="form.amount" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
        </div>

        <div class="form-group">
          <label>Paid by</label>
          <select v-model="form.payerId" class="input">
            <option v-for="r in store.roommates" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>Date</label>
          <input v-model="form.dateStr" class="input" type="date" />
        </div>

        <!-- Split preview -->
        <div v-if="form.amount > 0 && store.roommates.length" class="split-preview">
          <p class="split-label">Even split across {{ store.roommates.length }} members</p>
          <div v-for="r in store.roommates" :key="r.id" class="split-row">
            <span>{{ r.name }}</span>
            <span>₹{{ splitAmt }}</span>
          </div>
        </div>

        <p v-if="err" class="error-banner">{{ err }}</p>
      </div>

      <div class="panel-footer">
        <button class="btn btn-ghost" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="busy" @click="submit">
          <span v-if="busy" class="spinner"></span>
          {{ busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Expense' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useExpenseStore } from '@/stores/expense'

const props = defineProps({ expense: { type: Object, default: null } })
const emit = defineEmits(['close'])

const store = useExpenseStore()
const isEdit = computed(() => !!props.expense)

const today = new Date().toISOString().split('T')[0]

const form = ref({
  title: '',
  amount: '',
  payerId: store.currentUser?.id || store.roommates[0]?.id,
  dateStr: today
})

const busy = ref(false)
const err = ref('')

const splitAmt = computed(() => {
  const n = store.roommates.length
  if (!n) return '0.00'
  return (Number(form.value.amount) / n).toFixed(2)
})

onMounted(() => {
  if (props.expense) {
    form.value.title = props.expense.title
    form.value.amount = props.expense.amount
    form.value.payerId = props.expense.payer_id
    form.value.dateStr = new Date(props.expense.date).toISOString().split('T')[0]
  }
})

async function submit() {
  err.value = ''
  if (!form.value.title.trim()) { err.value = 'Title is required.'; return }
  if (!form.value.amount || Number(form.value.amount) <= 0) { err.value = 'Enter a valid amount.'; return }
  if (!form.value.payerId) { err.value = 'Select who paid.'; return }

  busy.value = true
  try {
    await store.saveExpense({
      id: props.expense?.id || null,
      title: form.value.title.trim(),
      amount: Number(form.value.amount),
      payerId: form.value.payerId,
      date: new Date(form.value.dateStr).getTime()
    })
    emit('close')
  } catch (e) {
    err.value = e.message || 'Failed to save.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.split-preview { background: var(--primary-light); border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.split-label { font-size: 12px; font-weight: 500; color: var(--primary); margin-bottom: 4px; }
.split-row { display: flex; justify-content: space-between; font-size: 13px; }
</style>
