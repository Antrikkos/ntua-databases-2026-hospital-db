# Hygeiopolis Hospital Database (db2026)

University database project for the fictional "Γενικό Νοσοκομείο Υγειόπολης".
The repository contains the relational schema, business-rule triggers, the 15
mandated SQL queries, Python preprocessors that build the reference catalogs
(ICD-10, KEN, Medical Procedures, EMA medicines) from the original sources in
`data/`, a fixture generator, and an optional Node/Express UI that exercises
the schema live.

The target RDBMS is **MySQL / MariaDB** (developed against XAMPP on Windows).
The entire pipeline runs under `utf8mb4` because schema, CHECK constraints and
trigger messages contain Greek literals.

## Folder layout

```
code/       Python preprocessors and the random-data generator
data/       Upstream source files (ICD-10 xls, KEN doc, EMA xlsx, ...)
sql/        install.sql, generated catalog/load SQL, Q01.sql ... Q15.sql
diagrams/   MySQL Workbench model and exported ER / relational diagrams
docs/       Report and supporting documentation
ui/         Optional Node.js + Express showcase UI
run_all.bat One-shot pipeline that drops, regenerates and reloads the DB
```

## Prerequisites

- MySQL or MariaDB 8.x (XAMPP works out of the box), with `mysql` on `PATH`
- Python 3.10+ and `pip`
- Node.js 18+ and `npm` (only if you want to run the UI)
- Windows shell (the runner script is a `.bat` file; on macOS/Linux run the
  individual steps manually as shown below)

The Python dependencies (`faker`, `pandas`, `xlrd`, `openpyxl`, `python-docx`)
are installed automatically by `run_all.bat`. To install them manually:

```cmd
pip install faker pandas xlrd openpyxl python-docx
```

## Database setup

### Option A: one-shot rebuild

From the project root:

```cmd
run_all.bat
```

The script prompts for MySQL username, database name (default
`hygeiopolis_db`) and password, then runs the full 10-step pipeline:

1. Drops the database if it exists
2. Installs Python dependencies
3. Generates `sql/icd10.sql`, `sql/ken.sql`, `sql/medical_procedures.sql`
4. Generates `sql/ema_substances.sql`, `sql/ema_medicines.sql`, `sql/ema_links.sql`
5. Generates the random fixtures into `sql/load.sql`
6. Applies the schema from `sql/install.sql`
7-9. Loads the reference catalogs
10. Loads the fixture data

The bulk load step is intentionally slow (shift assignments alone produce
~277k rows, each validated through several triggers) - expect the final step
to take a few minutes.

### Option B: run the steps individually

Useful while iterating on a single component:

```cmd
:: Regenerate reference catalog SQL
python code\preprocess_reference_data.py --icd10 data\ICD10_Catalog.xls ^
       --ken data\KEN_Catalog.doc --procs data\Medical_Procedure_Catalog.xls ^
       --outdir sql

:: Regenerate EMA medicines + substances + links
python code\preprocess_ema.py --input data\Medicine_EMA.xlsx --limit 3000 ^
       --outdir sql --mapping-dir data

:: Regenerate random fixture data
python code\generate_data.py --outdir sql

:: Schema first, then catalogs, then fixtures
mysql -u root --default-character-set=utf8mb4 < sql\install.sql
mysql -u root --default-character-set=utf8mb4 hygeiopolis_db < sql\icd10.sql
mysql -u root --default-character-set=utf8mb4 hygeiopolis_db < sql\ken.sql
mysql -u root --default-character-set=utf8mb4 hygeiopolis_db < sql\medical_procedures.sql
mysql -u root --default-character-set=utf8mb4 hygeiopolis_db < sql\ema_substances.sql
mysql -u root --default-character-set=utf8mb4 hygeiopolis_db < sql\ema_medicines.sql
mysql -u root --default-character-set=utf8mb4 hygeiopolis_db < sql\ema_links.sql
mysql -u root --default-character-set=utf8mb4 hygeiopolis_db < sql\load.sql
```

Load order matters: schema, then reference catalogs (ICD-10, KEN, procedures,
EMA), then `load.sql` which references all of them.

## Running the mandated queries

Each of the 15 queries lives in its own file under `sql/`:

```cmd
mysql -u root -t --default-character-set=utf8mb4 hygeiopolis_db < sql\Q07.sql
```

`Q04.sql` and `Q06.sql` contain two `EXPLAIN ANALYZE` blocks each (baseline,
a `FORCE INDEX` and an `IGNORE INDEX` variant) so the index-comparison output can be captured
for the report.

## Running the UI (optional)

The UI is a thin Express + plain-HTML frontend that talks to the database via
`mysql2`. It reads each `Qx.sql` live from disk, so the queries page always
reflects what is actually submitted.

```cmd
cd ui
npm install
npm start
```

The server listens on `http://localhost:3000`. Connection credentials are
read from `ui/.env` (defaults: user `root`, empty password, database
`hygeiopolis_db`). Create the file only if you need to override the defaults:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hygeiopolis_db
```

`npm run dev` is an alias for `npm start`; there is no build step.

### UI features
 
- **Dashboard** — live stats (patients, active/completed hospitalizations, beds, staff)
- **ΤΕΠ / Triage** — priority queue (urgency + FIFO); admit to ward directly
  from the queue with department / bed / attending doctor selection
- **Patients / Doctors / Hospitalizations / Prescriptions** — full CRUD views
- **Reviews** — post-discharge patient evaluations (Likert scale, per hospitalization and per doctor)
- **Shift Calendar** — monthly calendar with per-day shift details; manual
  and auto-fill shift creation enforcing the 3/6/2 minimum staffing rule
- **Queries Q1–Q15b** — run all 15 queries live with parameter inputs; Q04
  and Q06 variants include an ⚡ **EXPLAIN ANALYZE** button that renders the
  execution plan inline
- **Admin** — cascade-safe entity deletion, shift management
 
## Design assumptions
 
| # | Assumption |
|---|---|
| 1 | A triage record with `outcome = NULL` is visible in the queue. `outcome = 'Admitted'` links to a hospitalization; `outcome = 'Discharged'` means the patient left with instructions. |
| 2 | The 3/6/2 minimum staffing rule (≥3 doctors, ≥6 nurses, ≥2 admin per shift) is enforced at three layers: frontend validation, server-side pre-check before the transaction, and a BEFORE DELETE trigger that prevents reducing a shift below minimum. It cannot be enforced by BEFORE INSERT because the full roster is not known at insert time. |
| 3 | Images are stored as external URLs (Unsplash CDN), not as BLOBs, to keep the database size manageable. |
| 4 | Doctor deletion is blocked if the doctor has any clinical history (procedures, prescriptions, lab tests, shifts) in order to preserve audit trail integrity. |
| 5 | For Q14, the fixture generator uses a pool of 25 common ICD-10 codes (`HOSP_ICD_POOL`) so that codes repeat enough across years to satisfy the ≥5 per year constraint. The full 11,007-code catalog remains in the database as reference data. |
| 6 | The `@load_mode` session variable disables expensive trigger subqueries during bulk load. `generate_data.py` guarantees data integrity, so the bypass is safe. All triggers fire normally during regular application use (`@load_mode` defaults to NULL / 0). |

 
## Use of AI tools
 
This project was developed with the assistance of **Claude** (Anthropic,
Claude Sonnet 4.6) as well as **Gemini** (Google, Gemini Pro 3.1). Specifically, the tools contributed to the following:
 
- **Bug detection and fixing** — SQL trigger escaping issues, Node.js named
  placeholder errors, query logic bugs (e.g. Q15 implicit grouping)
- **Performance optimization** — bulk INSERT generation, `@load_mode` trigger
  bypass, `run_all.bat` pipeline optimizations
- **Feature implementation** — admit-from-triage modal, EXPLAIN ANALYZE
  endpoint and UI button, shift auto-fill, calendar tab merge
- **Report writing** — query explanations, EXPLAIN ANALYZE comparison tables,
  trigger and index documentation sections

All generated code and content was reviewed, understood and validated by the
team before submission. Architectural decisions (schema design, trigger
strategy, 3-layer enforcement, index selection) were discussed interactively,
with the team making all final choices.
