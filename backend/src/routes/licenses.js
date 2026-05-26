const express = require('express')
const { authenticate, adminOnly, farmIsolation } = require('../middleware/auth')
const licenseService = require('../services/licenseService')
const emailService = require('../services/emailService')
const { supabase } = require('../db/supabase')

const router = express.Router()
router.use(authenticate)

// GET /api/licenses/my - Get farm's active licenses
router.get('/my', farmIsolation, async (req, res) => {
  try {
    const licenses = await licenseService.getFarmLicenses(req.farmId)
    res.json(licenses)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/licenses/modules - Get all available modules with license status
router.get('/modules', farmIsolation, async (req, res) => {
  try {
    const licenses = await licenseService.getFarmLicenses(req.farmId)
    const activeModules = licenses.map(l => l.module_name)

    const modules = licenseService.MODULES.map(name => ({
      name,
      is_active: activeModules.includes(name),
      license: licenses.find(l => l.module_name === name) || null,
    }))

    res.json(modules)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// POST /api/licenses/activate - Activate a license key
router.post('/activate', adminOnly, farmIsolation, async (req, res) => {
  try {
    const { license_key } = req.body
    if (!license_key) return res.status(400).json({ error: 'License key απαιτείται' })

    const result = await licenseService.activateLicense(license_key, req.farmId)

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    // Send confirmation email
    const { data: farm } = await supabase.from('farms').select('name,email').eq('id', req.farmId).single()
    if (farm?.email) {
      await emailService.sendLicenseActivated({
        email: farm.email,
        farmName: farm.name,
        moduleName: result.module,
        expiresAt: result.expires_at,
      }).catch(() => {})
    }

    res.json({ message: `Module "${result.module}" ενεργοποιήθηκε επιτυχώς!`, module: result.module, expires_at: result.expires_at })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// GET /api/licenses/check/:module - Check if module is active
router.get('/check/:module', farmIsolation, async (req, res) => {
  try {
    const isActive = await licenseService.checkLicense(req.farmId, req.params.module)
    res.json({ module: req.params.module, is_active: isActive })
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

module.exports = router
