import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, isConfigured } from '@/lib/supabase'

// Supabase columns are camelCase: payerId, expenseId, roommateId
// All DB reads/writes must use these exact names

function generateId() {
  // Stay within Number.MAX_SAFE_INTEGER so IDs never lose precision
  return String(Math.floor(Math.random() * 9007199254740991) + 1)
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
        .filter(e => e.payerId === roommate.id)
        .reduce((s, e) => s + e.amount, 0)

      const totalOwed = expenses.value
        .flatMap(e => e.splits || [])
        .filter(s => s.roommateId === roommate.id)
        .reduce((s, sp) => s + sp.amount, 0)

      return { roommate, totalPaid, totalOwed, netBalance: totalPaid - totalOwed }
    })
  )

  // Raw per-expense debts — one entry per split, never netted or merged
  const settlements = computed(() => {
    const transfers = []
    for (const expense of expenses.value) {
      const payer = roommates.value.find(r => r.id === expense.payerId)
      if (!payer) continue
      for (const split of (expense.splits || [])) {
        if (split.roommateId !== expense.payerId && split.amount > 0.01) {
          const debtor = roommates.value.find(r => r.id === split.roommateId)
          if (!debtor) continue
          transfers.push({
            fromId:    debtor.id,  fromName: debtor.name,
            toId:      payer.id,   toName:   payer.name,
            amount:    split.amount,
            title:     expense.title,
            date:      expense.date,
            expenseId: expense.id
          })
        }
      }
    }
    return transfers.sort((a, b) => (b.date || 0) - (a.date || 0))
  })

  // True if a roommate has any expense or split history
  function roommateHasHistory(id) {
    return expenses.value.some(e =>
      e.payerId === id || (e.splits || []).some(s => s.roommateId === id)
    )
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  async function loadData() {
    if (!isConfigured) return
    loading.value = true
    error.value = null
    try {
      // Cast all bigint IDs to text so JavaScript never loses precision on large IDs
      const [{ data: rm, error: rmErr }, { data: exp, error: expErr }, { data: sp, error: spErr }] =
        await Promise.all([
          supabase.from('roommates').select('id::text, name').order('name'),
          supabase.from('expenses').select('id::text, title, amount, "payerId"::text, date').order('date', { ascending: false }),
          supabase.from('expense_splits').select('id::text, "expenseId"::text, "roommateId"::text, amount')
        ])

      if (rmErr) throw rmErr
      if (expErr) throw expErr
      if (spErr) throw spErr

      roommates.value = rm || []

      // Group splits by expenseId (camelCase — matches Supabase column)
      const byExpense = {}
      for (const s of (sp || [])) {
        if (!byExpense[s.expenseId]) byExpense[s.expenseId] = []
        byExpense[s.expenseId].push(s)
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
    if (!supabase) throw new Error('Supabase not configured')
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
    if (!supabase) throw new Error('Supabase not configured')
    const id = generateId()
    const { error: e } = await supabase.from('roommates').insert({ id, name: name.trim() })
    if (e) throw e
    await loadData()
  }

  async function deleteRoommate(id) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error: e } = await supabase.from('roommates').delete().eq('id', id)
    if (e) throw e
    await loadData()
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  // customSplits: [{roommateId, amount}] — if null, splits evenly across all roommates
  async function saveExpense({ id, title, amount, payerId, date, customSplits = null }) {
    if (!supabase) throw new Error('Supabase not configured')
    const isNew = !id
    const expId = isNew ? generateId() : id

    // Column name is camelCase: payerId
    const { error: expErr } = await supabase.from('expenses').upsert({
      id: expId, title, amount, payerId, date
    })
    if (expErr) throw expErr

    if (!isNew) {
      await supabase.from('expense_splits').delete().eq('expenseId', String(expId))
    }

    let splits
    if (customSplits) {
      splits = customSplits.map(s => ({
        id: generateId(), expenseId: expId, roommateId: s.roommateId, amount: s.amount
      }))
    } else {
      const splitAmount = parseFloat((amount / roommates.value.length).toFixed(2))
      splits = roommates.value.map(r => ({
        id: generateId(), expenseId: expId, roommateId: r.id, amount: splitAmount
      }))
    }

    const { error: spErr } = await supabase.from('expense_splits').insert(splits)
    if (spErr) throw spErr

    await loadData()
  }

  async function settleUp(settlement) {
    await saveExpense({
      id: null,
      title: `Settlement: ${settlement.fromName} → ${settlement.toName}`,
      amount: settlement.amount,
      payerId: settlement.fromId,
      date: Date.now(),
      customSplits: [{ roommateId: settlement.toId, amount: settlement.amount }]
    })
  }

  async function deleteExpense(id) {
    if (!supabase) throw new Error('Supabase not configured')
    if (!isAdmin.value) throw new Error('Only admin can delete expenses')
    const { error: spErr } = await supabase.from('expense_splits').delete().eq('expenseId', String(id))
    if (spErr) throw spErr
    const { error: expErr } = await supabase.from('expenses').delete().eq('id', String(id))
    if (expErr) throw expErr
    await loadData()
  }

  async function deleteExpenses(ids) {
    if (!supabase) throw new Error('Supabase not configured')
    if (!isAdmin.value) throw new Error('Only admin can delete expenses')
    for (const id of ids) {
      const { error: spErr } = await supabase.from('expense_splits').delete().eq('expenseId', String(id))
      if (spErr) throw spErr
      const { error: expErr } = await supabase.from('expenses').delete().eq('id', String(id))
      if (expErr) throw expErr
    }
    await loadData()
  }

  return {
    roommates, expenses, currentUser, loading, error,
    isAdmin, balances, settlements,
    loadData, login, registerAndLogin, logout,
    addRoommate, deleteRoommate, saveExpense, settleUp, deleteExpense, deleteExpenses,
    roommateHasHistory
  }
})
