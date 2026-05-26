const express = require('express')
const { supabase } = require('../db/supabase')
const { authenticate, managerOnly, farmIsolation } = require('../middleware/auth')
const router = express.Router()
router.use(authenticate, farmIsolation)

// Placeholder — full implementation mirrors animals.js pattern
router.get('/', async (req, res) => {
  try {
    const tableName = require('path').basename(__filename, '.js')
    const tableMap = {
      farms: 'farms', users: 'users', milk: 'milk_daily_totals',
      vaccines: 'vaccines', costs: 'costs', warehouse: 'warehouse_products',
      groups: 'animal_groups', todos: 'todos', notifications: 'notifications'
    }
    const table = tableMap[tableName] || tableName
    const { data, error } = await supabase.from(table).select('*').eq('farm_id', req.farmId).order('created_at', { ascending: false })
    if (error) return res.status(400).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
