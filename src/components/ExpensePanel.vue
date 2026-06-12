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
          <input v-model.number="form.amount" class="input" type="number" min="0" step="0.01" placeholder="0.00" @input="onAmountChange" />
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

        <!-- Split method -->
        <div class="form-group">
          <label>Split Method</label>
          <div class="split-tabs">
            <button v-for="t in splitTypes" :key="t.id" class="split-tab" :class="{ active: splitType === t.id }" @click="changeSplitType(t.id)">
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- Split section -->
        <div v-if="store.roommates.length" class="split-section">

          <!-- Equally -->
          <template v-if="splitType === 'equal'">
            <div class="split-header">Even split — ₹{{ fa(equalAmt) }} per person</div>
            <div v-for="r in store.roommates" :key="r.id" class="split-preview-row">
              <span>{{ r.name }}</span><span>₹{{ fa(equalAmt) }}</span>
            </div>
          </template>

          <!-- Exact Amounts -->
          <template v-else-if="splitType === 'exact'">
            <div v-for="(s, i) in splitInputs" :key="s.roommateId" class="split-input-row">
              <span class="split-name">{{ s.name }}</span>
              <div class="split-field">
                <span class="split-sym">₹</span>
                <input v-model.number="splitInputs[i].amount" class="input split-num" type="number" min="0" step="0.01" />
              </div>
            </div>
            <div class="split-bar" :class="splitValid ? 'bar-ok' : 'bar-err'">
              Sum ₹{{ fa(splitSum) }} of ₹{{ fa(form.amount || 0) }}
              <span v-if="!splitValid"> — ₹{{ fa(Math.abs((form.amount || 0) - splitSum)) }} remaining</span>
              <span v-else> ✓</span>
            </div>
          </template>

          <!-- Percentage -->
          <template v-else>
            <div v-for="(s, i) in splitInputs" :key="s.roommateId" class="split-input-row">
              <span class="split-name">{{ s.name }}</span>
              <div class="split-field">
                <input v-model.number="splitInputs[i].percent" class="input split-num" type="number" min="0" max="100" step="0.1" @input="onPctChange(i)" />
                <span class="split-sym">%</span>
              </div>
              <span class="split-calc">= ₹{{ fa(splitInputs[i].amount) }}</span>
            </div>
            <div class="split-bar" :class="pctValid ? 'bar-ok' : 'bar-err'">
              Sum {{ fa(splitPctSum) }}% of 100%
              <span v-if="!pctValid"> — {{ fa(Math.abs(100 - splitPctSum)) }}% remaining</span>
              <span v-else> ✓</span>
            </div>
          </template>

        </div>

        <p v-if="err" class="error-banner">{{ err }}</p>
      </div>

      <div class="panel-footer">
        <button class="btn btn-ghost" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="busy || !splitValid" @click="submit">
          <span v-if="busy" class="spinner"></span>
          {{ busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Expense' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useExpenseStore } from '@/stores/expense'

const props = defineProps({ expense: { type: Object, default: null } })
const emit = defineEmits(['close'])
const store = useExpenseStore()
const isEdit = computed(() => !!props.expense)

const today = new Date().toISOString().split('T')[0]
const form = ref({ title: '', amount: '', payerId: store.currentUser?.id || store.roommates[0]?.id, dateStr: today })
const splitType = ref('equal')
const splitInputs = ref([])
const busy = ref(false)
const err = ref('')

const splitTypes = [
  { id: 'equal',   label: 'Equally' },
  { id: 'exact',   label: 'Exact Amounts' },
  { id: 'percent', label: 'Percentage' }
]

const n = computed(() => store.roommates.length)
const equalAmt    = computed(() => n.value > 0 ? Number(form.value.amount || 0) / n.value : 0)
const splitSum    = computed(() => splitInputs.value.reduce((s, x) => s + Number(x.amount || 0), 0))
const splitPctSum = computed(() => splitInputs.value.reduce((s, x) => s + Number(x.percent || 0), 0))
const pctValid    = computed(() => Math.abs(splitPctSum.value - 100) < 0.01)
const splitValid  = computed(() => {
  if (splitType.value === 'equal')   return true
  if (splitType.value === 'exact')   return Math.abs(splitSum.value - Number(form.value.amount || 0)) < 0.01
  return pctValid.value
})

function fa(v) { return Number(v).toFixed(2) }

function buildSplits(amt) {
  const ea  = n.value > 0 ? parseFloat((amt / n.value).toFixed(2)) : 0
  const pct = n.value > 0 ? parseFloat((100 / n.value).toFixed(4)) : 0
  return store.roommates.map(r => ({ roommateId: r.id, name: r.name, amount: ea, percent: pct }))
}

function resetSplits() { splitInputs.value = buildSplits(Number(form.value.amount || 0)) }

function changeSplitType(type) { splitType.value = type; resetSplits() }

function onAmountChange() {
  if (splitType.value === 'equal') return
  const amt = Number(form.value.amount || 0)
  splitInputs.value = splitInputs.value.map(s => ({
    ...s,
    amount: parseFloat((Number(s.percent || 0) / 100 * amt).toFixed(2))
  }))
}

function onPctChange(i) {
  const amt = Number(form.value.amount || 0)
  splitInputs.value[i].amount = parseFloat((Number(splitInputs.value[i].percent || 0) / 100 * amt).toFixed(2))
}

onMounted(() => {
  if (props.expense) {
    form.value = {
      title: props.expense.title,
      amount: props.expense.amount,
      payerId: props.expense.payer_id,
      dateStr: new Date(props.expense.date).toISOString().split('T')[0]
    }
    splitType.value = 'exact'
    splitInputs.value = store.roommates.map(r => {
      const ex = props.expense.splits?.find(s => s.roommate_id === r.id)
      return { roommateId: r.id, name: r.name, amount: ex?.amount ?? 0, percent: 0 }
    })
  } else {
    resetSplits()
  }
})

watch(() => form.value.amount, () => { if (splitType.value !== 'equal') onAmountChange() })

async function submit() {
  err.value = ''
  if (!form.value.title.trim())                    { err.value = 'Title is required.'; return }
  if (!form.value.amount || Number(form.value.amount) <= 0) { err.value = 'Enter a valid amount.'; return }
  if (!form.value.payerId)                          { err.value = 'Select who paid.'; return }
  if (!splitValid.value) {
    err.value = splitType.value === 'percent'
      ? 'Percentages must add up to 100%.'
      : 'Split amounts must add up to the total.'
    return
  }
  busy.value = true
  try {
    const customSplits = splitType.value === 'equal' ? null
      : splitInputs.value.map(s => ({ roommateId: s.roommateId, amount: Number(s.amount) }))
    await store.saveExpense({
      id: props.expense?.id || null,
      title: form.value.title.trim(),
      amount: Number(form.value.amount),
      payerId: form.value.payerId,
      date: new Date(form.value.dateStr).getTime(),
      customSplits
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
.split-tabs { display: flex; gap: 4px; }
.split-tab { flex: 1; padding: 7px 4px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); font-size: 13px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.split-tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.split-section { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 7px; }
.split-header { font-size: 12px; font-weight: 600; color: var(--primary); }
.split-preview-row { display: flex; justify-content: space-between; font-size: 13px; }
.split-input-row { display: flex; align-items: center; gap: 8px; }
.split-name { flex: 1; font-size: 13px; }
.split-field { display: flex; align-items: center; gap: 4px; }
.split-sym { font-size: 13px; color: var(--text-muted); }
.split-num { width: 88px; padding: 5px 8px; text-align: right; }
.split-calc { font-size: 12px; color: var(--text-muted); min-width: 72px; text-align: right; }
.split-bar { font-size: 12px; font-weight: 500; border-top: 1px solid var(--border); padding-top: 6px; margin-top: 2px; }
.bar-ok  { color: var(--success); }
.bar-err { color: var(--danger); }
</style>
