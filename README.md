# OVIlink Pro

Πλήρης πλατφόρμα διαχείρισης κτηνοτροφικών μονάδων με backend API, license system και multi-tenant αρχιτεκτονική.

## 🏗️ Δομή project

```
ovilink-pro/
├── backend/          ← Node.js + Express API (Railway)
└── frontend/         ← React + Vite (Netlify)
```

## 🚀 Setup

### 1. Supabase
- Δημιούργησε νέο project
- Τρέξε `backend/src/db/schema.sql` στο SQL Editor

### 2. Backend (Railway)
```bash
cd backend
cp .env.example .env
# Συμπλήρωσε τα variables
npm install
node create-admin.js YourPassword123!
npm start
```

### 3. Frontend (Netlify)
```bash
cd frontend
cp .env.example .env.local
# VITE_API_URL=https://your-railway-app.railway.app/api
npm install
npm run build
```

## 👤 Roles
- `super_admin` — Πλήρης έλεγχος πλατφόρμας
- `admin` — Διαχείριση φάρμας + licenses
- `manager` — Πλήρης πρόσβαση στη φάρμα
- `viewer` — Read-only

## 🔑 License System
1. Super Admin: `/admin/licenses` → Δημιουργία license key για φάρμα + module
2. Admin φάρμας: `/modules` → Εισαγωγή license key → Ενεργοποίηση module

## 📦 Available Modules
- `animals` — Ζώα & Καρτέλες
- `milk` — Γαλακτομετρήσεις
- `vaccines` — Εμβολιασμοί
- `costs` — Κοστολόγιο
- `warehouse` — Αποθήκη
- `groups` — Groups & Σιτηρέσια
- `todos` — Εργασίες
- `carbon_footprint` — Αποτύπωμα Άνθρακα (Premium)
- `business_intelligence` — BI Reports (Premium)
- `advanced_reports` — Αναφορές Pro (Premium)
- `opekepe_integration` — ΟΠΕΚΕΠΕ (Premium)

---
Developed & designed by **George Stavrou**
