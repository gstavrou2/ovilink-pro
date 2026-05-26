const jwt = require('jsonwebtoken')
const { supabase } = require('../db/supabase')

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Απαιτείται authentication' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from DB
    const { data: user, error } = await supabase
      .from('users')
      .select('*, farms(id,name)')
      .eq('id', decoded.userId)
      .single()

    if (error || !user) {
      return res.status(401).json({ error: 'Μη έγκυρος χρήστης' })
    }

    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
    }
    return res.status(401).json({ error: 'Μη έγκυρο token' })
  }
}

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Απαιτείται authentication' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Δεν έχεις δικαίωμα πρόσβασης' })
    }
    next()
  }
}

// Super admin only
const superAdmin = authorize('super_admin')

// Admin or super admin
const adminOnly = authorize('super_admin', 'admin')

// Manager or above
const managerOnly = authorize('super_admin', 'admin', 'manager')

// Farm isolation - ensure user can only access their farm's data
const farmIsolation = (req, res, next) => {
  if (req.user.role === 'super_admin') return next()
  if (!req.user.farm_id) {
    return res.status(403).json({ error: 'Δεν έχεις ανατεθεί σε φάρμα' })
  }
  req.farmId = req.user.farm_id
  next()
}

module.exports = { authenticate, authorize, superAdmin, adminOnly, managerOnly, farmIsolation }
