const { supabase } = require('../db/supabase')

const auditLog = (action, resource) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = async (data) => {
      // Log after successful operations
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        await supabase.from('audit_logs').insert({
          user_id: req.user.id,
          farm_id: req.user.farm_id,
          action,
          resource,
          resource_id: req.params.id || data?.id || null,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          details: { method: req.method, path: req.path }
        }).catch(() => {}) // Don't fail if audit log fails
      }
      return originalJson(data)
    }
    next()
  }
}

module.exports = { auditLog }
