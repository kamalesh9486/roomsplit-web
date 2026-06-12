import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isConfigured } from '@/lib/supabase'

function generateId() {
  const arr = new Uint32Array(2)
  crypto.getRandomValues(arr)
  // Keep within JS safe integer range
  return ((arr[0] & 0x1FFFFF) * 2 ** 32 + arr[1]) || 1
}

export const useExpenseStore = defineStore('expense', () => {
  const roommates = ref([])
  const expenses = ref([]) // each has a `splits` array attached
  const currentUser = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // ── Derived ─────────────────────────────────────────────────────────────

  const isAdmin = computed(() =>
    currentUser.value?.name?.trim().toLowerCase() === 'kamal'
  )

  const balances = computed(() =>
    roommates.value.map(roommate => {
      const totalPaid = expenses.value
        .filter(e => e.payer_id === roommate.id)
        .reduce((s, e) => s + e.amount, 0)

      const totalOwed = expenses.value
        .flatMap(e => e.splits || [])
        .filter(s => s.roommate_id === roommate.id)
        .reduce((s, sp) => s + sp.amount, 0)

      return { roommate, totalPaid, totalOwed, netBalance: totalPaid - totalOwed }
    })
  )

  const settlements = computed(() => {
    const transfers = []
    for (const expense of expenses.value) {
      const payer = roommates.value.find(r => r.id === expense.payer_id)
      if (!payer) continue
      for (const split of (expense.splits || [])) {
        if (split.roommate_id !== expense.payer_id && split.amount > 0.01) {
          const debtor = roommates.value.find(r => r.id === split.roommate_id)
          if (!debtor) continue
          transfers.push({
            fromName: debtor.name,
            toName: payer.name,
            amount: split.amount,
            title: expense.title,
            date: expense.date
          })
        }
      }
    }
    return transfers.sort((a, b) => (b.date || 0) - (a.date || 0))
  })

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadData() {
    if (!isConfigured) return
    loading.value = true
    error.value = null
    try {
      const [{ data: rm, error: rmErr }, { data: exp, error: expErr }, { data: sp, error: spErr }] =
        await Promise.all([
          supabase.from('roommates').select('*').order('name'),
          supabase.from('expenses').select('*').order('date', { ascending: false }),
          supabase.from('expense_splits').select('*')
        ])

      if (rmErr) throw rmErr
      if (expErr) throw expErr
      if (spErr) throw spErr

      roommates.value = rm || []

      const byExpense = {}
      for (const s of (sp || [])) {
        if (!byExpense[s.expense_id]) byExpense[s.expense_id] = []
        byExpense[s.expense_id].push(s)
      }

      expenses.value = (exp || []).map(e => ({ ...e, splits: byExpense[e.id] || [] }))
    } catch (e) {
      error.value = e.message || 'Failed to load data'
    } finally {
      loading.value = false
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  function login(name) {
    const match = roommates.value.find(
      r => r.name.trim().toLowerCase() === name.trim().toLowerCase()
    )
    if (match) { currentUser.value = match; return true }
    return false
  }

  async function registerAndLogin(name) {
    const id = generateId()
    const { error: e } = await supabase.from('roommates').insert({ id, name: name.trim() })
    if (e) throw e
    await loadData()
    const match = roommates.value.find(r => r.id === id)
    if (match) currentUser.value = match
  }

  function logout() { currentUser.value = null }

  // ── Roommates ─────────────────────────────────────────────────────────────

  async function addRoommate(name) {
    const id = generateId()
    const { error: e } = await supabase.from('roommates').insert({ id, name: name.trim() })
    if (e) throw e
    await loadData()
  }

  async function deleteRoommate(id) {
    const { error: e } = await supabase.from('roommates').delete().eq('id', id)
    if (e) throw e
    await loadData()
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  async function saveExpense({ id, title, amount, payerId, date }) {
    const isNew = !id
    const expId = isNew ? generateId() : id
    const splitAmount = parseFloat((amount / roommates.value.length).toFixed(2))

    // Upsert expense
    const { error: expErr } = await supabase.from('expenses').upsert({
      id: expId, title, amount, payer_id: payerId, date
    })
    if (expErr) throw expErr

    // Replace splits
    if (!isNew) {
      await supabase.from('expense_splits').delete().eq('expense_id', expId)
    }

    const splits = roommates.value.map(r => ({
      id: generateId(),
      expense_id: expId,
      roommate_id: r.id,
      amount: splitAmount
    }))

    const { error: spErr } = await supabase.from('expense_splits').insert(splits)
    if (spErr) throw spErr

    await loadData()
  }

  async function deleteExpense(id) {
    if (!isAdmin.value) return
    await supabase.from('expense_splits').delete().eq('expense_id', id)
    await supabase.from('expenses').delete().eq('id', id)
    await loadData()
  }

  return {
    roommates, expenses, currentUser, loading, error,
    isAdmin, balances, settlements,
    loadData, login, registerAndLogin, logout,
    addRoommate, deleteRoommate, saveExpense, deleteExpense
  }
})
