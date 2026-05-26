const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { supabase } = require('../db/supabase')const { authenticate } = require('../middleware/auth')
const emailService = require('../services/emailService')

const router = express.Router()

// Generate tokens
function generateTokens(userId) {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  )
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  )
  return { accessToken, refreshToken }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email και κωδικός απαιτούνται' })
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*, farms(id,name)')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !user) {
      return res.status(401).json({ error: 'Λάθος email ή κωδικός' })
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Ο λογαριασμός είναι ανενεργός' })
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.status(401).json({ error: 'Λάθος email ή κωδικός' })
    }

    // Update last login
    await supabase.from('users').update({ last_login: new Date() }).eq('id', user.id)

    const { accessToken, refreshToken } = generateTokens(user.id)

    // Save refresh token
    await supabase.from('refresh_tokens').insert({
      user_id: user.id,
      token: refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    })

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        farm_id: user.farm_id,
        farm_name: user.farms?.name,
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token απαιτείται' })
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)

    // Check if refresh token exists in DB
    const { data: tokenRecord } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .eq('user_id', decoded.userId)
      .single()

    if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Μη έγκυρο refresh token' })
    }

    // Generate new tokens
    const tokens = generateTokens(decoded.userId)

    // Replace refresh token
    await supabase.from('refresh_tokens').delete().eq('token', refreshToken)
    await supabase.from('refresh_tokens').insert({
      user_id: decoded.userId,
      token: tokens.refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    })

    res.json(tokens)
  } catch (err) {
    res.status(401).json({ error: 'Μη έγκυρο refresh token' })
  }
})

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      await supabase.from('refresh_tokens').delete().eq('token', refreshToken)
    }
    res.json({ message: 'Αποσύνδεση επιτυχής' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email απαιτείται' })

    const { data: user } = await supabase.from('users').select('id,email,name').eq('email', email.toLowerCase()).single()

    // Always return success (security best practice)
    if (user) {
      const resetToken = uuidv4()
      await supabase.from('password_reset_tokens').insert({
        user_id: user.id,
        token: resetToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      })
      await emailService.sendPasswordReset(user.email, user.name, resetToken)
    }

    res.json({ message: 'Αν το email υπάρχει, θα λάβετε οδηγίες επαναφοράς' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ error: 'Token και κωδικός απαιτούνται' })
    if (password.length < 8) return res.status(400).json({ error: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες' })

    const { data: tokenRecord } = await supabase.from('password_reset_tokens').select('*').eq('token', token).single()

    if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Το token έχει λήξει ή δεν είναι έγκυρο' })
    }

    const password_hash = await bcrypt.hash(password, 12)
    await supabase.from('users').update({ password_hash }).eq('id', tokenRecord.user_id)
    await supabase.from('password_reset_tokens').delete().eq('token', token)

    res.json({ message: 'Ο κωδικός άλλαξε επιτυχώς' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const { password_hash, ...user } = req.user
  res.json(user)
})

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Απαιτούνται και οι δύο κωδικοί' })
    if (newPassword.length < 8) return res.status(400).json({ error: 'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες' })

    const { data: user } = await supabase.from('users').select('password_hash').eq('id', req.user.id).single()
    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Ο τρέχων κωδικός δεν είναι σωστός' })

    const password_hash = await bcrypt.hash(newPassword, 12)
    await supabase.from('users').update({ password_hash }).eq('id', req.user.id)

    res.json({ message: 'Ο κωδικός άλλαξε επιτυχώς' })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
