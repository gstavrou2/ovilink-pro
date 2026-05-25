const express = require('express')
const supabase = require('../db/supabase')
const { authenticate, managerOnly, farmIsolation } = require('../middleware/auth')
const { auditLog } = require('../middleware/audit')

const router = express.Router()
router.use(authenticate, farmIsolation)

// GET /api/animals
router.get('/', async (req, res) => {
  try {
    const { type, status, search } = req.query
    let query = supabase.from('animals').select('*').eq('farm_id', req.farmId).order('code')
    if (type) query = query.eq('type', type)
    if (status) query = query.eq('status', status)
    if (search) query = query.or(`code.ilike.%${search}%,breed.ilike.%${search}%`)
    const { data, error } = await query
    if (error) return res.status(400).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/animals/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('animals').select('*').eq('id', req.params.id).eq('farm_id', req.farmId).single()
    if (error || !data) return res.status(404).json({ error: 'Ζώο δεν βρέθηκε' })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/animals
router.post('/', managerOnly, auditLog('create', 'animal'), async (req, res) => {
  try {
    const { code, type, breed, dob, ear_tag, status, mother_code, father_code, notes } = req.body
    if (!code || !type) return res.status(400).json({ error: 'Κωδικός και είδος είναι υποχρεωτικά' })

    const exists = await supabase.from('animals').select('id').eq('farm_id', req.farmId).eq('code', code).single()
    if (exists.data) return res.status(400).json({ error: 'Ο κωδικός υπάρχει ήδη' })

    const { data, error } = await supabase.from('animals').insert({ farm_id: req.farmId, code, type, breed, dob, ear_tag, status: status||'active', mother_code, father_code, notes }).select().single()
    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/animals/:id
router.put('/:id', managerOnly, auditLog('update', 'animal'), async (req, res) => {
  try {
    const { code, type, breed, dob, ear_tag, status, mother_code, father_code, notes } = req.body
    const { data, error } = await supabase.from('animals').update({ code, type, breed, dob, ear_tag, status, mother_code, father_code, notes }).eq('id', req.params.id).eq('farm_id', req.farmId).select().single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/animals/:id
router.delete('/:id', managerOnly, auditLog('delete', 'animal'), async (req, res) => {
  try {
    await supabase.from('animals').delete().eq('id', req.params.id).eq('farm_id', req.farmId)
    res.json({ message: 'Το ζώο διαγράφηκε' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
