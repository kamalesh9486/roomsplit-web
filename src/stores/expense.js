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

  // Greedy bilateral settlement — produces the minimum number of transfers
  const settlements = computed(() => {
    const creditors = balances.value
      .filter(b => b.netBalance > 0.01)
      .map(b => ({ id: b.roommate.id, name: b.roommate.name, amount: b.netBalance }))
      .sort((a, b) => b.amount - a.amount)

    const debtors = balances.value
      .filter(b => b.netBalance < -0.01)
      .map(b => ({ id: b.roommate.id, name: b.roommate.name, amount: Math.abs(b.netBalance) }))
      .sort((a, b) => b.amount - a.amount)

    const transfers = []
    let ci = 0, di = 0

    while (ci < creditors.length && di < debtors.length) {
      const settle = parseFloat(Math.min(creditors[ci].amount, debtors[di].amount).toFixed(2))
      transfers.push({
        fromId:   debtors[di].id,   fromName: debtors[di].name,
        toId:     creditors[ci].id, toName:   creditors[ci].name,
        amount: settle
      })
      creditors[ci] = { ...creditors[ci], amount: parseFloat((creditors[ci].amount - settle).toFixed(2)) }
      debtors[di]   = { ...debtors[di],   amount: parseFloat((debtors[di].amount   - settle).toFixed(2)) }
      if (creditors[ci].amount < 0.01) ci++
      if (debtors[di].amount   < 0.01) di++
    }
    return transfers
  })

  // True if a roommate has any expense or split history
  function roommateHasHistory(id) {
    return expenses.value.some(e =>
      e.payer_id === id || (e.splits || []).some(s => s.roommate_id === id)
    )
  }

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

    const { error: expErr } = await supabase.from('expenses').upsert({
      id: expId, title, amount, payer_id: payerId, date
    })
    if (expErr) throw expErr

    if (!isNew) {
      await supabase.from('expense_splits').delete().eq('expense_id', expId)
    }

    let splits
    if (customSplits) {
      splits = customSplits.map(s => ({
        id: generateId(), expense_id: expId, roommate_id: s.roommateId, amount: s.amount
      }))
    } else {
      const splitAmount = parseFloat((amount / roommates.value.length).toFixed(2))
      splits = roommates.value.map(r => ({
        id: generateId(), expense_id: expId, roommate_id: r.id, amount: splitAmount
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
    if (!isAdmin.value || !supabase) return
    await supabase.from('expense_splits').delete().eq('expense_id', id)
    await supabase.from('expenses').delete().eq('id', id)
    await loadData()
  }

  async function deleteExpenses(ids) {
    if (!isAdmin.value || !supabase) return
    for (const id of ids) {
      await supabase.from('expense_splits').delete().eq('expense_id', id)
      await supabase.from('expenses').delete().eq('id', id)
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
