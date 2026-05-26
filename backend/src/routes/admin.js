const express = require('express')
const bcrypt = require('bcryptjs')
const { supabase } = require('../db/supabase')
const { authenticate, superAdmin } = require('../middleware/auth')
const licenseService = require('../services/licenseService')
const emailService = require('../services/emailService')

const router = express.Router()
router.use(authenticate, superAdmin)

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [farmsRes, usersRes, animalsRes, licensesRes] = await Promise.all([
      supabase.from('farms').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('animals').select('id', { count: 'exact', head: true }),
      supabase.from('module_licenses').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ])
    res.json({
      farms: farmsRes.count || 0,
      users: usersRes.count || 0,
      animals: animalsRes.count || 0,
      activeLicenses: licensesRes.count || 0,
    })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/farms
router.get('/farms', async (req, res) => {
  try {
    const { data } = await supabase.from('farms').select('*, users(id,email,role)').order('created_at', { ascending: false })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/admin/farms
router.post('/farms', async (req, res) => {
  try {
    const { name, address, phone, email, notes } = req.body
    if (!name) return res.status(400).json({ error: 'Το όνομα είναι υποχρεωτικό' })
    const { data, error } = await supabase.from('farms').insert({ name, address, phone, email, notes }).select().single()
    if (error) return res.status(400).json({ error: error.message })
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/admin/farms/:id
router.put('/farms/:id', async (req, res) => {
  try {
    const { name, address, phone, email, notes } = req.body
    const { data, error } = await supabase.from('farms').update({ name, address, phone, email, notes }).eq('id', req.params.id).select().single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/admin/farms/:id
router.delete('/farms/:id', async (req, res) => {
  try {
    await supabase.from('farms').delete().eq('id', req.params.id)
    res.json({ message: 'Η φάρμα διαγράφηκε' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { data } = await supabase.from('users').select('id,email,name,role,farm_id,is_active,last_login,created_at,farms(name)').order('created_at', { ascending: false })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/admin/users — Create new user
router.post('/users', async (req, res) => {
  try {
    const { email, name, password, role, farm_id } = req.body
    if (!email || !password || !role) return res.status(400).json({ error: 'Email, κωδικός και role απαιτούνται' })

    const exists = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single()
    if (exists.data) return res.status(400).json({ error: 'Το email χρησιμοποιείται ήδη' })

    const password_hash = await bcrypt.hash(password, 12)
    const { data, error } = await supabase.from('users').insert({
      email: email.toLowerCase(), name, password_hash, role,
      farm_id: farm_id || null, is_active: true
    }).select('id,email,name,role,farm_id').single()

    if (error) return res.status(400).json({ error: error.message })

    // Send welcome email
    await emailService.sendWelcome(email, name, password).catch(() => {})

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { name, role, farm_id, is_active } = req.body
    const { data, error } = await supabase.from('users').update({ name, role, farm_id: farm_id||null, is_active }).eq('id', req.params.id).select('id,email,name,role,farm_id,is_active').single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await supabase.from('users').delete().eq('id', req.params.id)
    res.json({ message: 'Ο χρήστης διαγράφηκε' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/admin/licenses/generate
router.post('/licenses/generate', async (req, res) => {
  try {
    const { farm_id, module_name, expires_at, max_users } = req.body
    if (!farm_id || !module_name) return res.status(400).json({ error: 'farm_id και module_name απαιτούνται' })

    const license = await licenseService.generateLicense({ farm_id, module_name, expires_at, max_users })
    res.status(201).json(license)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/licenses
router.get('/licenses', async (req, res) => {
  try {
    const { data } = await supabase.from('module_licenses').select('*, farms(name)').order('created_at', { ascending: false })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// DELETE /api/admin/licenses/:id
router.delete('/licenses/:id', async (req, res) => {
  try {
    await supabase.from('module_licenses').update({ is_active: false }).eq('id', req.params.id)
    res.json({ message: 'Η άδεια απενεργοποιήθηκε' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req, res) => {
  try {
    const { farm_id, limit = 100 } = req.query
    let query = supabase.from('audit_logs').select('*, users(email,name), farms(name)').order('created_at', { ascending: false }).limit(parseInt(limit))
    if (farm_id) query = query.eq('farm_id', farm_id)
    const { data } = await query
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
