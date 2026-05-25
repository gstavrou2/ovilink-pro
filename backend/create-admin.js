require('dotenv').config()
const bcrypt = require('bcryptjs')
const supabase = require('./src/db/supabase')

async function createSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@ovilink.gr'
  const password = process.argv[2] || 'Admin1234!'
  const name = 'Super Admin'

  console.log(`Creating super admin: ${email}`)

  const password_hash = await bcrypt.hash(password, 12)

  const { data, error } = await supabase
    .from('users')
    .upsert({ email, name, password_hash, role: 'super_admin', is_active: true }, { onConflict: 'email' })
    .select()
    .single()

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log('✅ Super admin created:', data.email)
  console.log('Password:', password)
  process.exit(0)
}

createSuperAdmin()
