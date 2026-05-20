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

`Q04.sql` and `Q06.sql` contain two `EXPLAIN ANALYZE` blocks each (baseline
plus a `FORCE INDEX` variant) so the index-comparison output can be captured
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
