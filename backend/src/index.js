require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const authRoutes = require('./routes/auth')
const farmRoutes = require('./routes/farms')
const userRoutes = require('./routes/users')
const animalRoutes = require('./routes/animals')
const milkRoutes = require('./routes/milk')
const vaccineRoutes = require('./routes/vaccines')
const costRoutes = require('./routes/costs')
const warehouseRoutes = require('./routes/warehouse')
const groupRoutes = require('./routes/groups')
const todoRoutes = require('./routes/todos')
const licenseRoutes = require('./routes/licenses')
const notificationRoutes = require('./routes/notifications')
const adminRoutes = require('./routes/admin')

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Πολλές αιτήσεις. Δοκιμάστε αργότερα.' }
})
app.use('/api/', limiter)

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Πολλές προσπάθειες σύνδεσης. Δοκιμάστε αργότερα.' }
})
app.use('/api/auth/', authLimiter)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/farms', farmRoutes)
app.use('/api/users', userRoutes)
app.use('/api/animals', animalRoutes)
app.use('/api/milk', milkRoutes)
app.use('/api/vaccines', vaccineRoutes)
app.use('/api/costs', costRoutes)
app.use('/api/warehouse', warehouseRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/todos', todoRoutes)
app.use('/api/licenses', licenseRoutes)
app.use('/api/notifications', notificationRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`🐑 OVIlink Pro API running on port ${PORT}`)
})

module.exports = app
