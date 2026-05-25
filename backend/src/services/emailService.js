const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@ovilink.gr'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Base email template with OVIlink branding
function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html lang="el">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OVIlink</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f7f4; color: #1a1a18; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: #1D9E75; padding: 32px 40px; text-align: center; }
    .header h1 { color: white; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 4px; }
    .body { padding: 40px; }
    .body h2 { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #1a1a18; }
    .body p { font-size: 14px; line-height: 1.6; color: #4a4a45; margin-bottom: 16px; }
    .btn { display: inline-block; background: #1D9E75; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 8px 0; }
    .btn:hover { background: #0F6E56; }
    .info-box { background: #f0faf6; border-left: 4px solid #1D9E75; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .info-box p { color: #0F6E56; margin: 0; }
    .divider { border: none; border-top: 1px solid #e5e5e2; margin: 24px 0; }
    .footer { background: #f8f7f4; padding: 24px 40px; text-align: center; }
    .footer p { font-size: 12px; color: #8a8a85; line-height: 1.6; }
    .footer a { color: #1D9E75; text-decoration: none; }
    .logo-text { font-size: 24px; font-weight: 800; color: white; }
    .logo-text span { font-weight: 300; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-text">OVI<span>link</span></div>
      <p>Διαχείριση Κτηνοτροφικής Μονάδας | Γαλακτοπαραγωγή</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} OVIlink — Developed &amp; designed by George Stavrou</p>
      <p style="margin-top:8px"><a href="${FRONTEND_URL}">ovilink.gr</a></p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`)
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error('Email error:', err)
  }
}

// Welcome email for new users
async function sendWelcome(email, name, tempPassword) {
  await sendEmail({
    to: email,
    subject: 'Καλώς ήρθατε στο OVIlink!',
    html: baseTemplate(`
      <h2>Καλώς ήρθατε, ${name || 'χρήστη'}!</h2>
      <p>Ο λογαριασμός σας στο <strong>OVIlink</strong> δημιουργήθηκε επιτυχώς.</p>
      <div class="info-box">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Προσωρινός κωδικός:</strong> ${tempPassword}</p>
      </div>
      <p>Παρακαλούμε αλλάξτε τον κωδικό σας μετά την πρώτη σύνδεση.</p>
      <a href="${FRONTEND_URL}/login" class="btn">Σύνδεση στο OVIlink</a>
      <hr class="divider">
      <p style="font-size:12px;color:#8a8a85">Αν δεν δημιουργήσατε εσείς αυτόν τον λογαριασμό, παρακαλούμε επικοινωνήστε μαζί μας.</p>
    `)
  })
}

// Password reset email
async function sendPasswordReset(email, name, token) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`
  await sendEmail({
    to: email,
    subject: 'Επαναφορά κωδικού πρόσβασης — OVIlink',
    html: baseTemplate(`
      <h2>Επαναφορά κωδικού</h2>
      <p>Γεια σας ${name || ''},</p>
      <p>Λάβαμε αίτημα επαναφοράς του κωδικού πρόσβασής σας στο OVIlink.</p>
      <a href="${resetUrl}" class="btn">Επαναφορά κωδικού</a>
      <p>Ο σύνδεσμος ισχύει για <strong>1 ώρα</strong>.</p>
      <hr class="divider">
      <p style="font-size:12px;color:#8a8a85">Αν δεν ζητήσατε επαναφορά κωδικού, αγνοήστε αυτό το email.</p>
    `)
  })
}

// Milk threshold alert
async function sendMilkAlert({ email, farmName, groupName, total, threshold, date }) {
  await sendEmail({
    to: email,
    subject: `⚠️ Χαμηλή παραγωγή γάλακτος — ${groupName}`,
    html: baseTemplate(`
      <h2>⚠️ Ειδοποίηση χαμηλής παραγωγής</h2>
      <p>Φάρμα: <strong>${farmName}</strong></p>
      <div class="info-box">
        <p><strong>Group:</strong> ${groupName}</p>
        <p><strong>Ημερομηνία:</strong> ${date}</p>
        <p><strong>Παραγωγή:</strong> ${total} kg</p>
        <p><strong>Όριο:</strong> ${threshold} kg</p>
      </div>
      <p>Η παραγωγή γάλακτος έπεσε κάτω από το ορισμένο όριο. Σας συνιστούμε να εξετάσετε τροποποίηση του σιτηρεσίου.</p>
      <a href="${FRONTEND_URL}/groups" class="btn">Διαχείριση σιτηρεσίου</a>
    `)
  })
}

// License activation email
async function sendLicenseActivated({ email, farmName, moduleName, expiresAt }) {
  await sendEmail({
    to: email,
    subject: `✅ Module ενεργοποιήθηκε — ${moduleName}`,
    html: baseTemplate(`
      <h2>✅ Module ενεργοποιήθηκε</h2>
      <div class="info-box">
        <p><strong>Φάρμα:</strong> ${farmName}</p>
        <p><strong>Module:</strong> ${moduleName}</p>
        <p><strong>Λήξη:</strong> ${expiresAt ? new Date(expiresAt).toLocaleDateString('el-GR') : 'Χωρίς λήξη'}</p>
      </div>
      <p>Το module έχει ενεργοποιηθεί επιτυχώς στη φάρμα σας.</p>
      <a href="${FRONTEND_URL}" class="btn">Μετάβαση στην εφαρμογή</a>
    `)
  })
}

// Vaccine reminder
async function sendVaccineReminder({ email, farmName, vaccines }) {
  const vaccineList = vaccines.map(v => `<li><strong>${v.animal_code}</strong> — ${v.vaccine_name} (${v.next_date})</li>`).join('')
  await sendEmail({
    to: email,
    subject: `🔔 Υπενθύμιση εμβολιασμών — ${farmName}`,
    html: baseTemplate(`
      <h2>🔔 Επερχόμενοι εμβολιασμοί</h2>
      <p>Φάρμα: <strong>${farmName}</strong></p>
      <p>Οι παρακάτω εμβολιασμοί πλησιάζουν:</p>
      <ul style="margin:16px 0;padding-left:20px;line-height:2">
        ${vaccineList}
      </ul>
      <a href="${FRONTEND_URL}/vaccines" class="btn">Διαχείριση εμβολιασμών</a>
    `)
  })
}

module.exports = { sendWelcome, sendPasswordReset, sendMilkAlert, sendLicenseActivated, sendVaccineReminder }
