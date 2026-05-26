const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { supabase } = require('../db/supabase')

const MODULES = [
  'animals',
  'milk',
  'vaccines',
  'costs',
  'warehouse',
  'groups',
  'todos',
  'carbon_footprint',
  'business_intelligence',
  'opekepe_integration',
  'advanced_reports',
]

// Generate a signed license key
function generateLicenseKey(farm_id, module_name, expires_at) {
  const payload = `${farm_id}:${module_name}:${expires_at || 'never'}`
  const signature = crypto
    .createHmac('sha256', process.env.LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase()

  // Format: OVL-{MODULE}-{RANDOM}-{SIGNATURE}
  const random = uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase()
  const moduleCode = module_name.slice(0, 4).toUpperCase()
  return `OVL-${moduleCode}-${random}-${signature}`
}

// Verify a license key
function verifyLicenseKey(key, farm_id, module_name, expires_at) {
  const payload = `${farm_id}:${module_name}:${expires_at || 'never'}`
  const expectedSig = crypto
    .createHmac('sha256', process.env.LICENSE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase()

  const parts = key.split('-')
  if (parts.length !== 4) return false
  return parts[3] === expectedSig
}

// Generate and save a new license
async function generateLicense({ farm_id, module_name, expires_at, max_users = null }) {
  if (!MODULES.includes(module_name)) {
    throw new Error(`Άγνωστο module: ${module_name}`)
  }

  const license_key = generateLicenseKey(farm_id, module_name, expires_at)

  const { data, error } = await supabase
    .from('module_licenses')
    .insert({
      farm_id,
      module_name,
      license_key,
      expires_at: expires_at || null,
      max_users,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Activate a license by key (called by tenant)
async function activateLicense(license_key, farm_id) {
  const { data: license, error } = await supabase
    .from('module_licenses')
    .select('*')
    .eq('license_key', license_key)
    .eq('farm_id', farm_id)
    .single()

  if (error || !license) {
    return { success: false, error: 'Μη έγκυρο license key' }
  }

  if (!license.is_active) {
    return { success: false, error: 'Το license έχει απενεργοποιηθεί' }
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { success: false, error: 'Το license έχει λήξει' }
  }

  // Verify signature
  const valid = verifyLicenseKey(license_key, farm_id, license.module_name, license.expires_at)
  if (!valid) {
    return { success: false, error: 'Μη έγκυρη υπογραφή license' }
  }

  // Mark as activated
  await supabase.from('module_licenses').update({ activated_at: new Date() }).eq('id', license.id)

  return { success: true, module: license.module_name, expires_at: license.expires_at }
}

// Check if farm has active license for module
async function checkLicense(farm_id, module_name) {
  const { data } = await supabase
    .from('module_licenses')
    .select('*')
    .eq('farm_id', farm_id)
    .eq('module_name', module_name)
    .eq('is_active', true)
    .single()

  if (!data) return false
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false
  return true
}

// Get all active licenses for a farm
async function getFarmLicenses(farm_id) {
  const { data } = await supabase
    .from('module_licenses')
    .select('*')
    .eq('farm_id', farm_id)
    .eq('is_active', true)

  return (data || []).filter(l => !l.expires_at || new Date(l.expires_at) > new Date())
}

module.exports = { generateLicense, activateLicense, checkLicense, getFarmLicenses, MODULES }
