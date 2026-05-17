# Hygeiopolis UI (bonus)

Showcase frontend + lightweight Express API for the `hygeiopolis_db` project.

## Run

```cmd
cd C:\xampp\htdocs\databases\ui
copy .env.example .env       :: edit if your MySQL creds are not root/empty
npm install
npm start
```

Then open <http://localhost:3000>.

## Tabs

| Tab | What it does |
|---|---|
| **Dashboard** | Summary counts, revenue by department × year, triage chart |
| **Patients** | Search + open detail (allergies, hospitalisation history) + create new patient |
| **Doctors** | Search by AMKA / surname, filter by specialty |
| **Hospitalizations** | Browse stays (filter active), admit new patient (uses `Beds` availability live) |
| **Prescriptions** | List recent + create new — the `check_allergy_before_prescription` trigger blocks invalid ones; the UI surfaces the SQL error |
| **Queries Q1-Q15** | Side-by-side: raw SQL from `sql/Qx.sql` + live result grid. Parameters are wired up where applicable. |

## Notes

- DB connection settings live in `.env` (or default to `root` / empty pwd / `hygeiopolis_db`).
- The Queries tab pulls each Q's SQL **live from `../sql/Qx.sql`** so the file shown is always what was submitted.
- Forms hit `INSERT`s that exercise the triggers in `sql/install.sql` — this is intentional for the demo.