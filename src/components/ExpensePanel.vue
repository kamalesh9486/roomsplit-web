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

        <!-- Split method tabs -->
        <div class="form-group">
          <label>Split Method</label>
          <div class="split-tabs">
            <button v-for="t in splitTypes" :key="t.id" class="split-tab" :class="{ active: splitType === t.id }" @click="changeSplitType(t.id)">
              <span class="tab-icon">{{ t.icon }}</span>{{ t.label }}
            </button>
          </div>
        </div>

        <!-- Split body -->
        <div v-if="store.roommates.length" class="split-section">

          <!-- ① Equal All -->
          <template v-if="splitType === 'equal-all'">
            <div class="split-info">All {{ store.roommates.length }} members · ₹{{ fa(equalAllAmt) }} each</div>
            <div v-for="r in store.roommates" :key="r.id" class="split-row-preview">
              <div class="row" style="gap:8px">
                <div class="mini-avatar">{{ r.name[0].toUpperCase() }}</div>
                <span>{{ r.name }}</span>
              </div>
              <span class="fw">₹{{ fa(equalAllAmt) }}</span>
            </div>
          </template>

          <!-- ② Equal Select -->
          <template v-else-if="splitType === 'equal-select'">
            <div class="split-info">
              {{ selectedCount }} of {{ store.roommates.length }} included
              <span v-if="selectedCount > 0"> · ₹{{ fa(equalSelectAmt) }} each</span>
            </div>
            <div
              v-for="r in store.roommates" :key="r.id"
              class="toggle-row" :class="{ included: selected.has(r.id) }"
              @click="togglePerson(r.id)"
            >
              <div class="row" style="gap:8px">
                <div class="toggle-box" :class="{ checked: selected.has(r.id) }">
                  <span v-if="selected.has(r.id)">✓</span>
                </div>
                <div class="mini-avatar" :class="{ muted: !selected.has(r.id) }">{{ r.name[0].toUpperCase() }}</div>
                <span :class="{ 'name-excluded': !selected.has(r.id) }">{{ r.name }}</span>
                <span v-if="!selected.has(r.id)" class="excl-badge">excluded</span>
              </div>
              <span :class="selected.has(r.id) ? 'fw' : 'muted-text'">
                {{ selected.has(r.id) ? `₹${fa(equalSelectAmt)}` : '—' }}
              </span>
            </div>
            <div v-if="selectedCount === 0" class="split-bar bar-err">Select at least one person.</div>
          </template>

          <!-- ③ Custom -->
          <template v-else>
            <div class="split-info">Enter exact ₹ amount per person</div>
            <div v-for="(s, i) in splitInputs" :key="s.roommateId" class="custom-row">
              <div class="row" style="gap:8px;flex:1">
                <div class="mini-avatar">{{ s.name[0].toUpperCase() }}</div>
                <span class="split-name">{{ s.name }}</span>
              </div>
              <div class="split-field">
                <span class="split-sym">₹</span>
                <input v-model.number="splitInputs[i].amount" class="input split-num" type="number" min="0" step="0.01" />
              </div>
            </div>
            <div class="split-bar" :class="customValid ? 'bar-ok' : 'bar-err'">
              Sum ₹{{ fa(splitSum) }} of ₹{{ fa(form.amount || 0) }}
              <span v-if="!customValid">
                — ₹{{ fa(Math.abs((form.amount || 0) - splitSum)) }}
                {{ splitSum < (form.amount || 0) ? 'unallocated' : 'over budget' }}
              </span>
              <span v-else> ✓ balanced</span>
            </div>
          </template>

        </div>

        <p v-if="err" class="error-banner">{{ err }}</p>
      </div>

      <div class="panel-footer">
        <button class="btn btn-ghost" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="busy || !isValid" @click="submit">
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
const emit  = defineEmits(['close'])
const store = useExpenseStore()
const isEdit = computed(() => !!props.expense)

const today = new Date().toISOString().split('T')[0]
const form = ref({ title: '', amount: '', payerId: store.currentUser?.id || store.roommates[0]?.id, dateStr: today })
const splitType   = ref('equal-all')
const selected    = ref(new Set(store.roommates.map(r => r.id)))
const splitInputs = ref([])
const busy = ref(false)
const err  = ref('')

const splitTypes = [
  { id: 'equal-all',    icon: '⚖️', label: 'Equal All' },
  { id: 'equal-select', icon: '✅', label: 'Equal Select' },
  { id: 'custom',       icon: '✏️', label: 'Custom' }
]

const selectedCount  = computed(() => selected.value.size)
const equalAllAmt    = computed(() => store.roommates.length > 0 ? Number(form.value.amount || 0) / store.roommates.length : 0)
const equalSelectAmt = computed(() => selectedCount.value > 0 ? Number(form.value.amount || 0) / selectedCount.value : 0)
const splitSum       = computed(() => splitInputs.value.reduce((s, x) => s + Number(x.amount || 0), 0))
const customValid    = computed(() => Math.abs(splitSum.value - Number(form.value.amount || 0)) < 0.01)

const isValid = computed(() => {
  if (splitType.value === 'equal-all')    return true
  if (splitType.value === 'equal-select') return selectedCount.value > 0
  return customValid.value
})

function fa(v) { return Number(v).toFixed(2) }

function togglePerson(id) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

function buildCustomInputs() {
  const amt = Number(form.value.amount || 0)
  const n   = store.roommates.length
  if (!n) { splitInputs.value = []; return }

  // Even base share rounded to 2dp
  const base    = parseFloat((amt / n).toFixed(2))
  // Remainder so the total always sums to exactly amt
  const remainder = parseFloat((amt - base * n).toFixed(2))

  splitInputs.value = store.roommates.map((r, i) => ({
    roommateId: r.id,
    name:       r.name,
    // Give the rounding remainder to the first person
    amount:     i === 0 ? parseFloat((base + remainder).toFixed(2)) : base
  }))
}

// Auto-rebuild custom inputs whenever the amount changes
watch(() => form.value.amount, () => {
  if (splitType.value === 'custom') buildCustomInputs()
})

function changeSplitType(type) {
  splitType.value = type
  if (type === 'equal-select') selected.value = new Set(store.roommates.map(r => r.id))
  if (type === 'custom')       buildCustomInputs()
}

onMounted(() => {
  if (props.expense) {
    form.value = {
      title: props.expense.title, amount: props.expense.amount,
      payerId: props.expense.payerId,
      dateStr: new Date(props.expense.date).toISOString().split('T')[0]
    }
    const splits  = props.expense.splits || []
    const allIds  = new Set(store.roommates.map(r => r.id))
    const splitIds = new Set(splits.map(s => s.roommateId))
    const first   = splits[0]?.amount ?? 0
    const allEqual = splits.length > 0 && splits.every(s => Math.abs(s.amount - first) < 0.01)

    if (allEqual && splitIds.size === allIds.size) {
      splitType.value = 'equal-all'
    } else if (allEqual && splitIds.size < allIds.size) {
      splitType.value = 'equal-select'
      selected.value  = splitIds
    } else {
      splitType.value   = 'custom'
      splitInputs.value = store.roommates.map(r => {
        const ex = splits.find(s => s.roommateId === r.id)
        return { roommateId: r.id, name: r.name, amount: ex?.amount ?? 0 }
      })
    }
  }
})

async function submit() {
  err.value = ''
  if (!form.value.title.trim())                                               { err.value = 'Title is required.';              return }
  if (!form.value.amount || Number(form.value.amount) <= 0)                   { err.value = 'Enter a valid amount.';            return }
  if (!form.value.payerId)                                                     { err.value = 'Select who paid.';                return }
  if (splitType.value === 'equal-select' && selectedCount.value === 0)        { err.value = 'Select at least one person.';     return }
  if (splitType.value === 'custom' && !customValid.value)                     { err.value = 'Amounts must add up to the total.'; return }

  busy.value = true
  try {
    const amt = Number(form.value.amount)
    let customSplits = null

    if (splitType.value === 'equal-select') {
      const perPerson = parseFloat((amt / selectedCount.value).toFixed(2))
      customSplits = store.roommates
        .filter(r => selected.value.has(r.id))
        .map(r => ({ roommateId: r.id, amount: perPerson }))
    } else if (splitType.value === 'custom') {
      customSplits = splitInputs.value.map(s => ({ roommateId: s.roommateId, amount: Number(s.amount) }))
    }

    await store.saveExpense({
      id: props.expense?.id || null,
      title: form.value.title.trim(), amount: amt,
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
/* Split method tabs */
.split-tabs { display: flex; gap: 4px; }
.split-tab {
  flex: 1; padding: 9px 4px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface-low);
  font-size: 11px; font-weight: 600; font-family: var(--font-display);
  color: var(--text-muted); cursor: pointer; transition: all 0.15s;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  letter-spacing: 0.02em;
}
.split-tab:hover { border-color: var(--text-muted); color: var(--text); }
.split-tab.active {
  background: var(--primary-dim); color: var(--primary);
  border-color: var(--primary);
  box-shadow: 0 0 12px rgba(0,200,150,0.1);
}
.tab-icon { font-size: 16px; line-height: 1; }
/* Split body */
.split-section {
  background: var(--surface-low); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.split-info {
  font-size: 11px; font-weight: 700; font-family: var(--font-display);
  color: var(--primary); padding-bottom: 8px; border-bottom: 1px solid var(--border);
  letter-spacing: 0.04em; text-transform: uppercase;
}
/* Equal All */
.split-row-preview { display: flex; justify-content: space-between; align-items: center; padding: 5px 4px; font-size: 13px; color: var(--text-muted); }
/* Equal Select */
.toggle-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 12px; border-radius: var(--radius-sm); cursor: pointer;
  border: 1px solid var(--border); transition: all 0.15s;
}
.toggle-row.included { background: var(--primary-glow); border-color: rgba(0,200,150,0.3); }
.toggle-row:not(.included) { opacity: 0.55; }
.toggle-row:hover { opacity: 1; border-color: var(--primary); }
.toggle-box {
  width: 20px; height: 20px; border-radius: var(--radius-xs);
  border: 2px solid var(--border); background: var(--surface);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; font-family: var(--font-display);
  flex-shrink: 0; transition: all 0.15s; color: #0e1511;
}
.toggle-box.checked { background: var(--primary); border-color: var(--primary); }
.name-excluded { color: var(--text-muted); text-decoration: line-through; font-size: 13px; }
.excl-badge { font-size: 10px; background: var(--surface-high); color: var(--text-muted); padding: 2px 7px; border-radius: 99px; font-family: var(--font-display); }
/* Custom */
.custom-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.split-name { font-size: 13px; font-family: var(--font-display); font-weight: 500; flex: 1; color: var(--text); }
.split-field { display: flex; align-items: center; gap: 4px; }
.split-sym { font-size: 13px; color: var(--text-muted); font-family: var(--font-display); }
.split-num { width: 90px; padding: 6px 8px; text-align: right; font-family: var(--font-display); }
/* Avatars */
.mini-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--surface-high); color: var(--primary); font-size: 11px; font-weight: 700; font-family: var(--font-display); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mini-avatar.muted { opacity: 0.35; }
/* Misc */
.fw { font-weight: 700; font-size: 13px; font-family: var(--font-display); color: var(--primary-bright); }
.muted-text { color: var(--text-muted); font-size: 13px; }
.split-bar { font-size: 12px; font-weight: 600; font-family: var(--font-display); border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px; }
.bar-ok  { color: var(--primary-bright); }
.bar-err { color: var(--danger); }
</style>
