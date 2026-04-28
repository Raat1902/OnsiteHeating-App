# Onsite Heating Pro ” v1 (Alpha)

![CI](https://github.com/Raat1902/OnsiteHeating-App/actions/workflows/ci.yml/badge.svg)


I'm building a local-first HVAC field service app for dispatch â†’ jobs â†’ invoices â†’ payments. This repo is a **portfolio demo** and itâ€™s still in progress.

**Stack:** React + TypeScript + Vite + Tailwind  
**Storage:** IndexedDB (Dexie)  
**Mode:** Offline-first (works without a backend)

## Status
- **v1 (Alpha):** core flows work end-to-end, UI/UX and edge cases are still being refined.
- Not intended for production use yet (no authentication hardening, no server-side persistence).

## What works in v1
- Multi-role demo flow: Admin / Technician / Customer
- Jobs / work orders: create, update status, add notes, attach files
- Dispatch-style views and technician workflow screens
- Invoices: create line items and view totals (demo payment flow)
- Local persistence in the browser (IndexedDB)

## What I'm improving next
- Stronger validation and error handling
- Better UI polish + mobile layout pass
- Export/backup improvements
- Optional backend sync (future)

## Demo accounts (seeded on first run)
- Admin: `rania@onsiteheating.com` / `admin123`
- Technician: `tech@onsiteheating.com` / `tech123`
- Customer: `customer@example.com` / `cust123`

## Run (developer)
```bash
npm install
npm run dev
```

## Build & preview
```bash
npm run build
npm run preview
```

## Reset demo data
In the app: **Settings a†’ Reset everything**

## License
MIT (see `LICENSE`)

