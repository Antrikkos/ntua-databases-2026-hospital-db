# Project Review — Γενικό Νοσοκομείο «Υγειόπολης» (db2026)

**Reviewer:** automated code review
**Date:** 2026-05-16 (updated after directory reorganisation)
**Subject:** Implementation review of the hospital information-system database project (`hygeiopolis_db`)

---

## 1. Executive Summary

The project is a **mostly complete, well-structured** implementation of the assignment. The schema, triggers, data-generation pipeline, and the 15 required queries are all present, and most of the difficult business rules from the specification (allergies, supervision, shifts, bed availability, surgery overlaps, evaluations after discharge) are enforced at the database level via triggers.

| Area | Status | Score (/10) |
|------|--------|-------------|
| Schema design (entities & relationships) | Good, minor gaps | 8 |
| Integrity / business-rule constraints (triggers) | Very strong | 9 |
| Indexing strategy | Adequate, mostly auto-FK indexes | 6 |
| Data generation script | Excellent, thoughtful for queries | 9 |
| Reference data ingestion (EMA / ICD-10 / KEN / Procedures) | Good, ETL via Python | 8 |
| Queries Q1–Q15 (correctness + style) | Mostly correct, a few issues | 7.5 |
| Project layout (sql/, diagrams/, docs/, code/, data/, ui/) | ✅ Matches spec | 8 |
| Deliverables completeness (README, diagrams export, Qx_out.txt, report) | Still partly incomplete | 5 |
| Spec compliance | Mostly compliant | 7.5 |
| **Bonus UI** (mentioned in db2026.md, +1 grade point) | ✅ Implemented (Express + vanilla JS) | 9 |
| **Overall** | | **~8.0 / 10** (with bonus point likely → ~9 / 10) |

---

## 2. Current Directory Layout

After the reorganisation:

```
C:/xampp/htdocs/databases/
├── README.md              # ⚠️ currently TODO placeholder
├── REVIEW.md              # this file
├── db2026.md              # the assignment text
├── run_all.bat            # orchestrator (updated to new paths)
│
├── code/                  # Python ETL + generator
│   ├── preprocess_reference_data.py
│   ├── preprocess_ema.py
│   └── generate_data.py
│
├── data/                  # raw source files + intermediate mapping
│   ├── ICD10_Catalog.xls
│   ├── KEN_Catalog.doc
│   ├── Medical_Procedure_Catalog.xls
│   ├── Medicine_EMA.xlsx
│   ├── Active_Substances.xlsx
│   └── ema_code_mapping.txt   (generated)
│
├── sql/                   # schema + generated + queries
│   ├── install.sql
│   ├── icd10.sql              (generated)
│   ├── ken.sql                (generated)
│   ├── medical_procedures.sql (generated)
│   ├── ema_substances.sql     (generated)
│   ├── ema_medicines.sql      (generated)
│   ├── ema_links.sql          (generated)
│   ├── load.sql               (generated)
│   └── Q1.sql … Q15.sql
│
├── diagrams/              # MWB source + (TODO) exported PDFs
│   ├── first.mwb
│   ├── first.mwb.bak
│   └── test.pdf
│
├── docs/                  # ⚠️ empty — report.pdf must be added
│
└── ui/                    # ✨ NEW: bonus showcase web app (Express + vanilla JS)
    ├── package.json
    ├── .env.example
    ├── db.js
    ├── queryLibrary.js
    ├── server.js
    ├── README.md
    └── public/
        ├── index.html
        ├── styles.css
        └── app.js


```

---

## 3. How the Implementation Works

### 3.1 Pipeline overview (driven by `run_all.bat`)

`run_all.bat` now uses the new layout. All Python scripts are invoked from the project root with explicit `--outdir sql` and explicit `data/...` input paths, so the SQL artifacts always land in `sql/`:

```
[1]  pip install faker pandas xlrd openpyxl python-docx
[2]  python code\preprocess_reference_data.py
         --icd10 data\ICD10_Catalog.xls
         --ken   data\KEN_Catalog.doc
         --procs data\Medical_Procedure_Catalog.xls
         --outdir sql
            → sql\icd10.sql, sql\ken.sql, sql\medical_procedures.sql
[3]  python code\preprocess_ema.py
         --input  data\Medicine_EMA.xlsx
         --limit  3000
         --outdir sql
         --mapping-dir data
            → sql\ema_substances.sql, sql\ema_medicines.sql, sql\ema_links.sql
            + data\ema_code_mapping.txt
[4]  python code\generate_data.py --outdir sql
            → sql\load.sql
[5]  mysql < sql\install.sql           (schema + triggers)
[6–9] mysql < sql\icd10/ken/proc/ema*.sql   (reference data first)
[10]  mysql < sql\load.sql            (random data last)
```

This ordering is correct (reference catalogues before random data, so FK targets exist when `load.sql` runs).

### 3.2 Schema (`sql/install.sql`)

22 tables, summarised:

* **Staff hierarchy:** `Staff` (super-type) → `Doctors`, `Nurses`, `Admin_Staff` (sub-types keyed by `staff_amka`). The `staff_type` discriminator on `Staff` lets triggers cheaply tell who's who without joining.
* **Departments / Beds:** `Departments`, `Beds`, `Doctor_has_Department` (M:N).
* **Patients / Hospitalizations:** `Patients`, `Hospitalization`, plus `Triage_Records` and reference catalogues `ICD10_Catalog`, `KEN_Catalog`, `Medical_Procedure_Catalog`.
* **Procedures:** `Procedure_Records` (1 main surgeon) + `Procedure_Assistants` (M:N).
* **Pharmacy:** `Medicine_EMA`, `Active_Substances`, `Medicine_has_Substances`, `Patient_Allergies`, `Prescriptions`.
* **Labs:** `Lab_Tests`.
* **Evaluations:** `Evaluation_Hospitalization` (1 per stay), `Evaluation_Doctor` (1 per stay×doctor).
* **Shifts:** `Shifts` + `Shift_Assignments`.
* **Images:** `Entity_Images` (generic — `entity_type` + `entity_id`).

The ISA design for `Staff` is correct and matches the spec.

### 3.3 Triggers (the strong point)

`sql/install.sql` ships **13 triggers** that enforce most of the business rules in the spec without enums or check-constraint workarounds:

| Trigger | Rule |
|---|---|
| `check_allergy_before_prescription` | Block prescription if any active substance is in patient's allergies |
| `check_monthly_shift_limits` | 15 / 20 / 25 shifts per month for doctors / nurses / admins |
| `check_shift_rest_and_night_limit` | 8h rest between shifts; max 3 consecutive nights |
| `check_doctor_supervision` (+ update twin) | Residents must have supervisor; Directors must not; depth-1 cycle block |
| `calculate_hospitalization_cost` | Auto-compute cost from `KEN_Catalog` + extra-day surcharge |
| `check_resident_supervision_in_shift` | Resident in a shift requires a Senior A / Director present |
| `check_procedure_overlap` | No two procedures sharing a room or surgeon overlap in time |
| `check_evaluation_hosp_completed` / `_doctor_completed` | Evaluations only after discharge |
| `check_bed_department_match` | Bed must belong to the hospitalization's department |
| `check_bed_availability` | Bed is not already in active hospitalization |
| `check_discharge_after_admission` | `discharge_date > admission_date` |
| `check_prescription_during_hospitalization` | Prescriptions only inside an active stay |

This is **above what most submissions provide** and is the project's clearest strength.

### 3.4 Data generation (`code/generate_data.py`)

The script is genuinely well-designed:

* **Seeded** (`random.seed(42)`) → reproducible.
* **Volume meets spec:** 150 doctors (15 directors + 40 Senior A + 45 Senior B + 50 residents + 15 young surgeons), 300 nurses, 100 admins, 200 patients, 500 hospitalizations, 150 procedures, 200 lab tests, 300 prescriptions, 15 departments.
* **Targeted seeding for each query:**
  * Q3 — explicitly produces 20 patients with 4 stays in the same department.
  * Q5 — separate pool of 15 young (`age < 35`) surgeons, with the first 40 procedures assigned to them.
  * Q11 — 40 % of procedures in 2026 → MAX surgery count and gap candidates exist.
  * Q14 — ICD-10 codes are drawn from a small fallback pool so the same code can hit ≥5 cases/year in consecutive years.
  * Q15 — 40 % of triage records in 2026.
* **Constraint-aware scheduling:** `can_assign()` mirrors the rest / monthly / 3-night-streak rules before emitting `Shift_Assignments`, so the triggers don't reject inserts at load time.
* **Bed conflict checks** before emitting hospitalizations, including a `beds_with_open_hosp` set to respect `check_bed_availability`.

### 3.5 Reference-data ETL

* `code/preprocess_ema.py` reads the EMA Article 57 Excel and explodes the `|`-separated active-substance field into normalised rows — matches the spec exactly.
* `code/preprocess_reference_data.py` handles ICD-10 (XLS) / KEN (DOC → DOCX via LibreOffice) / procedures (XLS).
* All generated SQL uses `INSERT IGNORE` and batched multi-row inserts (`BATCH = 500/1000`) — much faster than per-row inserts.

---

## 4. Correctness of the 15 Queries

| Q | Concept | Verdict | Notes |
|---|---------|---------|-------|
| Q1 | Revenue by dept × year × KEN × insurer | ✅ correct | Good use of `GREATEST(0, total_cost - basic_cost)` to avoid negatives |
| Q2 | Doctors per specialty + shift flag + #surgeries | ✅ correct | `LEFT JOIN` preserves doctors with 0 surgeries |
| Q3 | Patients with >3 stays in same department | ✅ correct | Clean `GROUP BY ... HAVING` |
| Q4 | Avg doctor rating + overall experience (EXPLAIN ANALYZE + FORCE INDEX) | ⚠️ correct but placeholder | AMKA still hard-coded as a sample; ensure a real value is plugged in before grading |
| Q5 | Young (<35) surgeons by surgery count | ✅ correct | Joins `category = 'Χειρουργική'` cleanly |
| Q6 | Patient hospitalisation history (EXPLAIN ANALYZE + FORCE INDEX) | ⚠️ correct but placeholder | Still contains `'ΑΜΚΑ_ΤΟΥ_ΑΣΘΕΝΗ'` — must be replaced. Hospital rating is computed as `(nc+cl+f+oe)/4.0` but does **not** include the doctor evaluation — this matches the spec's note ("Συνολική εμπειρία νοσηλείας", not doctor rating) |
| Q7 | Active-substance allergy & medicine counts | ✅ correct | Triple `LEFT JOIN` is appropriate so substances with 0 allergic patients still appear |
| Q8 | Staff without shift on a given date+dept | ✅ correct | Properly limits to staff that **belongs to** the dept (DDH/Nurses/Admin via dept_id) — earlier bug fixed. Note the date `2026-05-10` and dept name `'Καρδιολογία'` are hard-coded |
| Q9 | Patients with identical yearly stay duration > 15 days | ✅ correct | Uses `COUNT(*) OVER(PARTITION BY ...)` to find ties |
| Q10 | Top-3 co-prescribed substance pairs per stay | ✅ correct | `sub1 < sub2` avoids `(A,B)` and `(B,A)` duplication |
| Q11 | Doctors ≥5 fewer surgeries than max (recursive CTE hint) | ⚠️ correct logic, *not* recursive | The spec hints "Recursive CTE may be needed". Here a simple CTE + cross join suffices, which is fine — but you could add a comment justifying why recursion is not needed |
| Q12 | Staff per dept × shift × subclass for a week | ✅ correct | Uses `CASE` to pull `specialty / rank / role` per staff type — proper handling of strict `ONLY_FULL_GROUP_BY` |
| Q13 | Doctor supervision hierarchy (recursive CTE) | ✅ correct | Standard recursive pattern; well-formed |
| Q14 | ICD-10 categories with same admission count in two consecutive years (≥5) | ✅ correct | Self-join on `year + 1` is the standard approach |
| Q15 | Triage distribution + wait time + hospitalisation rate + dept referrals | ✅ correct | `MIN(h.admission_date)` ensures one hospitalisation per triage |

### Issues / cautions in queries

1. **Placeholders (Q4, Q6, Q8):** `'ΑΜΚΑ_ΤΟΥ_ΑΣΘΕΝΗ'`, `'00868759358'`, `'2026-05-10'`, `'Καρδιολογία'`. Be sure to replace with **real values you pre-verify exist in the loaded data**, otherwise the spec rule "queries that return no data are not graded" kicks in.
2. **Q1 grouping by `KEN_Code`:** correct, but `SUM(k.basic_cost)` will multiply by the number of hospitalisations in the group — that is *exactly* what the spec asks for ("συνολικά έσοδα ... ανά ΚΕΝ κωδικό"). Document this clearly in the report so the reviewer doesn't misread it as a bug.
3. **Q6 rating formula:** the comment in the assignment says "Συνολική εντύπωση νοσηλείας*" — your code returns the *average of all four criteria*, not the `overall_experience` field alone. Re-read the spec; if `overall_experience` alone was wanted, return that column directly.
4. **Q11:** the recursive-CTE hint is satisfied in Q13. Consider adding a comment in Q11 saying "recursive CTE not strictly required because MAX() suffices".
5. **Q15 wait time:** the spec says "μέσος χρόνος αναμονής ανά επίπεδο". Your implementation measures wait = time from triage arrival to hospitalisation — which is reasonable, but if "wait time" is meant to be triage-to-service rather than triage-to-admission, you'll need a service-start column. Acceptable as a documented assumption.

---

## 5. Schema / Constraint Suggestions

> ✅ **Applied in this revision (2026-05-16):** the bulk of §5.1, §5.2 and §5.3 are now enforced in `sql/install.sql`. The summary table below tracks every suggestion's status. Items still listed as ❌ are intentionally deferred (see §5.4) — they require coordinated changes outside this file (e.g. FK-wide column-type migration) or are blocked on documentation choices.

### 5.1 Data types — soft improvements

| # | Suggestion | Status | Notes |
|---|---|---|---|
| 1 | `Staff.amka` / `Patients.amka` → `CHAR(11)` | ✅ Done | All 20 AMKA columns across the schema migrated to `CHAR(11)` in lockstep (PKs `Staff.amka`, `Patients.amka` + every FK that references them: `Doctors.staff_amka`/`supervisor_amka`, `Nurses.staff_amka`, `Admin_Staff.staff_amka`, `Departments.director_amka`, `Triage_Records.patient_amka`/`nurse_amka`, `Hospitalization.patient_amka`, `Doctor_has_Department.doctor_amka`, `Procedure_Records.main_surgeon_amk`, `Procedure_Assistants.staff_amka`, `Patient_Allergies.patient_amka`, `Prescriptions.doctor_amka`/`patient_amka`, `Lab_Tests.ordering_doctor_amka`, `Evaluation_Doctor.doctor_amka`, `Doctor_Images.doctor_amka`, `Shift_Assignments.staff_amka`). Generator already emits exactly 11 digits (`gen_amka()` uses `random.choices(string.digits, k=11)`), so the previously-emitted `sql/load.sql` is compatible without regeneration. Wider rationale: enforces fixed-length AMKA at the schema level, eliminates accidental whitespace/over-length inserts, and saves storage relative to `VARCHAR(45)`. |
| 2 | `Patients.address` → `VARCHAR(255)` | ✅ Done | Widened in `Patients` `CREATE TABLE`. |
| 3 | `Doctors.rank` `CHECK` | ✅ Done | `chk_doctor_rank CHECK (rank IN ('Ειδικευόμενος','Επιμελητής Β\'','Επιμελητής Α\'','Διευθυντής'))`. |
| 4 | `Nurses.rank` `CHECK` | ✅ Done | `chk_nurse_rank CHECK (rank IN ('Βοηθός Νοσηλευτή','Νοσηλευτής','Προϊστάμενος'))`. |
| 5 | `Admin_Staff.role` `CHECK` | ✅ Done | `chk_admin_role` covers the 4 generator role strings. |
| 6 | `Patients.gender` `CHECK` | ✅ Done | `chk_patient_gender CHECK (gender IN ('Αρσενικό','Θηλυκό'))`. |
| 7 | `Triage_Records.urgency_level` `CHECK` | ✅ Done | `chk_triage_urgency CHECK (urgency_level IS NULL OR urgency_level BETWEEN 1 AND 5)`. |
| 8 | Likert `CHECK` on `Evaluation_*` columns | ✅ Done | 4 checks on `Evaluation_Hospitalization` + 1 on `Evaluation_Doctor` (all `BETWEEN 1 AND 5`). |
| 9 | `Hospitalization.admission_date NOT NULL` | ✅ Done | Discharge left nullable on purpose (active stays). |
| 10 | `Staff.first_name / last_name / email NOT NULL` | ✅ Done | Plus widened `email` to `VARCHAR(100)`. |
| 11 | Bonus: `chk_staff_type` (`Doctor/Nurse/Admin`) | ✅ Done | Catches typos in the discriminator. |
| 12 | Bonus: `chk_patient_age` (0–130) | ✅ Done | Cheap sanity guard; tolerates NULL. |

### 5.2 Missing or weak constraints

| # | Suggestion | Status | Notes |
|---|---|---|---|
| 1 | `UNIQUE` on `Doctors.license_number` | ✅ Done | `uq_doctor_license_number`. Generator already emits unique LIC* per group. |
| 2 | `UNIQUE` on `Beds (department_id, bed_number)` | ✅ Done | `uq_bed_dept_number`. Spec wording "μοναδικό αριθμό" now enforced. |
| 3 | `UNIQUE` on `Shifts (shift_date, shift_type)` | ✅ Done | `uq_shift_date_type`. Generator already emits one row per (date, type). |
| 4 | `UNIQUE` on `Staff.email` | ✅ Done | `uq_staff_email`. |
| 5 | `UNIQUE` on `Patients.email` | ✅ Done | `uq_patient_email`. |
| 6 | FK cascade behaviour → `ON UPDATE CASCADE` | ✅ Done (broad pass) | All FKs in `Doctors`, `Nurses`, `Admin_Staff`, `Beds`, `Triage_Records`, `Hospitalization`, `Evaluation_*`, `Shift_Assignments` switched to `ON UPDATE CASCADE`. `ON DELETE` kept as `NO ACTION` to preserve audit-trail semantics, except where already `RESTRICT` (`fk_hospitalization_ken`) or `CASCADE` (`Department_Images` / `Doctor_Images`). |
| 7 | `Departments.director_amka NOT NULL` | ✅ Done | Verified that `generate_data.py:550-666` already inserts all 15 director Doctor rows **before** the `Departments` block, and every department's INSERT pulls `director_amka` from `director_dept_map[i]` (always non-null). No generator reorder needed — just flipped the column to `NOT NULL`. Side-effect: also tightened `Departments.name` to `NOT NULL` for consistency. |
| 8 | `Hospitalization` bed-overlap on `UPDATE` | ✅ Done | New `check_bed_availability_update` + `check_bed_department_match_update` triggers mirror the `INSERT` versions and re-validate when `bed_id` / `department_id` change. |
| 9 | `check_resident_supervision_in_shift` ordering | ⚠️ Documented | The trigger is `BEFORE INSERT` so the generator must emit seniors first; this is now noted in the generator's docstring. Converting to an `AFTER` shift-wide re-check is left as a future refactor (it would require an additional summary table to avoid the chicken-and-egg with `BEFORE INSERT`). |
| 10 | `check_doctor_supervision` recursive cycle detection | ✅ Done | New stored procedure `assert_no_supervisor_cycles()` walks the chain via recursive CTE (depth ≤ 50) and `SIGNAL`s if any node revisits itself. Trigger still catches depth-1 cycles inline; the SP is meant to be called after bulk loads. |
| 11 | `check_procedure_overlap` `UPDATE` + self-exclusion | ✅ Done | New `check_procedure_overlap_update` trigger with `WHERE id <> NEW.id` for both space and surgeon overlap checks. |

### 5.3 Indexing

✅ **All six recommended indexes are now declared** in `sql/install.sql`, plus one bonus (`idx_lab_test_date`). The recommendation for `Shifts (shift_date, shift_type)` is satisfied by the new `uq_shift_date_type` UNIQUE key (a UNIQUE constraint is also a usable index).

| Index | Accelerates | Status |
|---|---|---|
| `idx_hosp_admission_year` ON `Hospitalization (admission_date)` | Q1, Q9, Q14 | ✅ |
| `idx_hosp_dept_year` ON `Hospitalization (department_id, admission_date)` | Q1, Q3 | ✅ |
| `idx_proc_start_time` ON `Procedure_Records (start_time)` | Q11 | ✅ |
| `uq_shift_date_type` ON `Shifts (shift_date, shift_type)` | Q2, Q8, Q12 | ✅ (as UNIQUE) |
| `idx_triage_arrival` ON `Triage_Records (arrival_time, urgency_level)` | Q15 | ✅ |
| `idx_pres_patient_start` ON `Prescriptions (patient_amka, start_date)` | Q10 | ✅ |
| `idx_lab_test_date` ON `Lab_Tests (test_date)` | reporting | ✅ (bonus) |

Already-present prerequisite index `fk_hospitalization_ken_idx` (added in §12.1) is left in place. The justification table required by spec §A.2.2 maps each entry directly onto the query column, ready to be copy-pasted into `README.md`.

---

## 6. Deliverables Checklist (per the spec)

| Required artifact | Present? | Notes |
|---|---|---|
| **README.md** with assumptions table | ⚠️ Placeholder only ("TODO: Complete the readme file") | Mandatory. Document every assumption (placeholder values, simplified active substances, extra-day surcharge = 100€, etc.) |
| `diagrams/er.pdf` | ❌ Missing | `diagrams/first.mwb` exists — export ER as PDF from MySQL Workbench (File → Export → Export as PDF) |
| `diagrams/relational.pdf` | ❌ Missing | Same — export the relational view from Workbench |
| `sql/install.sql` | ✅ Present (`sql/install.sql`) | — |
| `sql/load.sql` | ✅ Present (`sql/load.sql`) — generated by `code/generate_data.py --outdir sql` | — |
| `sql/Q01.sql … Q15.sql` | ⚠️ Files are named `Q1.sql … Q15.sql` (no zero padding) | Spec example is `Q01.sql` — zero-pad for safety: `Q01.sql, Q02.sql, ...` |
| `sql/Qx_out.txt` for each query | ❌ **All missing** | Capture each query's result set. From the project root: `for %f in (sql\Q*.sql) do mysql -u root hygeiopolis_db < %f > sql\%~nf_out.txt 2>&1` |
| `docs/report.pdf` (with EXPLAIN screenshots for Q4 & Q6) | ❌ `docs/` is empty | Mandatory — include `EXPLAIN ANALYZE` for both versions of Q4 & Q6, comparison, and 3–5 sentence discussion |
| Optional `code/` folder | ✅ Present with all 3 Python scripts | — |
| Optional `data/` folder | ✅ Present with raw input + generated mapping | Not strictly required by the spec, but a sensible separation |
| Optional **`ui/` showcase web app** | ✅ Present (Express + vanilla JS) — **bonus +1 grade point** per professor | See §9 |

The grading rubric is heavily structural — losing points on missing deliverables is the easiest way to drop a grade level.

---

## 7. Spec Compliance — Specific Concerns

1. **Triage waiting / FIFO logic:** the spec says "patients are served by urgency level and FIFO within the same level". There is no `service_time` column to verify FIFO was respected. Either add `service_started_at DATETIME` on `Triage_Records` or document the assumption that FIFO is implied by `arrival_time` ordering only.
2. **Extra-day surcharge constant:** trigger uses `extra_daily_charge = 100.0` (hard-coded). The spec says "αναλογική πρόσθετη ημερήσια χρέωση" without specifying a value — your assumption must be in README.md.
3. **EMA Article 57 simplification:** spec allows simplification of active substances. You only persist the *name* — no ATC code, no strength. That's acceptable but call it out.
4. **`enum/array/json/xml` ban:** ✅ no enums, no JSON, no XML used. Confirmed compliant.
5. **No ORM:** ✅ no ORM in sight (pure Python string templating to SQL).

---

## 8. Concrete Action Items (priority-ordered)

1. **Fill in `README.md`** with: (a) prerequisites, (b) how to run (`run_all.bat`), (c) full **assumptions table**, (d) ER/relational diagram description, (e) index justification table, (f) the new folder layout.
2. **Export `diagrams/er.pdf` and `diagrams/relational.pdf`** from `diagrams/first.mwb` via Workbench's "Model → Export → Export as PDF".
3. **Generate every `sql/Qx_out.txt`**:
   ```bat
   for %f in (sql\Q*.sql) do mysql -u root hygeiopolis_db < %f > sql\%~nf_out.txt 2>&1
   ```
4. **Write `docs/report.pdf`** including: methodology, ER + relational diagram screenshots, full text of each Q, Q4/Q6 EXPLAIN ANALYZE output with FORCE INDEX comparison + 3–5 sentence analysis.
5. **Replace placeholder AMKAs** in Q4 and Q6, placeholder date/department in Q8 with values that **return data**. Verify with the actual loaded dataset.
6. **Add `CHECK` constraints** for Likert ratings, urgency level, gender, rank/role enumerations.
7. **Add `UNIQUE` constraints** on `Doctors.license_number`, `(department_id, bed_number)`, `(shift_date, shift_type)`.
8. **Add the secondary indexes** listed in §5.3 and document them.
9. **Strengthen Q6** to clarify whether you return the average of the 4 criteria or just `overall_experience` per the spec wording.

---

## 9. Bonus UI (`ui/`) — added this revision

The assignment briefly mentions a possible web frontend ("σκέπτεται να δημιουργήσει αντίστοιχη ιστοσελίδα") and the professor confirmed it is worth **+1 grade point**. A lightweight showcase web app now lives in `ui/`.

### 9.1 Stack
- **Backend:** Node.js + Express + `mysql2/promise` (named placeholders).
- **Frontend:** vanilla HTML/CSS/JS (no framework, no ORM — respects the assignment's "no ORM" rule).
- **Connection config:** via `.env` (`ui/.env.example` provided), defaults to `root` / empty pwd / `hygeiopolis_db`.

### 9.2 Tabs
| Tab | Purpose |
|---|---|
| **Dashboard** | Counts per major entity (Doctors, Nurses, Admins, Patients, Hospitalizations, Departments, Prescriptions, Triage) + revenue table per dept × year + triage bar chart |
| **Patients** | Search by ΑΜΚΑ/surname → detail panel with `Patient_Allergies` and hospitalisation history; "New Patient" form covering all `Patients` columns |
| **Doctors** | Search by ΑΜΚΑ/surname, filter by specialty (populated from `Doctors.specialty` distinct values) |
| **Hospitalizations** | Browse stays (filter to currently-active); "New Admission" form that pulls **available beds** live from the selected department (joins `Beds` × `Hospitalization` to exclude occupied ones) |
| **Prescriptions** | Recent list + "New Prescription" form. Intentionally **exercises the `check_allergy_before_prescription` trigger** — if blocked, the SIGNAL message is surfaced to the user in red, which is a great live demo of trigger enforcement |
| **Queries Q1-Q15** | The headline feature: a side-by-side panel showing **(a) the raw `.sql` file content** (read live from `sql/Qx.sql` at request time via `/api/queries/:id/sql`) and **(b) the live result grid** after running the query. Parameters (specialty for Q2, doctor AMKA for Q4, patient AMKA for Q6, date+dept for Q8, reference date for Q12) get auto-rendered form inputs. |

### 9.3 Why the side-by-side SQL view matters for the demo
The professor will see:
- exactly what's in `sql/Q1.sql … sql/Q15.sql` (no copy-paste — the server `fs.readFileSync`s the actual files), so there is no risk of UI/repo drift;
- the executable parametrised variant runs against the live DB and shows the result grid;
- triggers fire visibly (try inserting a prescription with an allergic substance → the SIGNAL message bubbles up to the UI).

### 9.4 How to run it
```cmd
cd C:\xampp\htdocs\databases\ui
copy .env.example .env
npm install
npm start
```
…then open <http://localhost:3000>.

### 9.5 Caveats / nice-to-have
- The UI assumes the DB is populated via `run_all.bat`. With no data, the Queries tab returns empty grids — same constraint as the academic spec.
- No authentication. The UI is a **demo**, not a production app — do not expose it on a public network.
- The "no `enum/array/json/xml`" rule applies to the *database schema*, not the JS layer. Frontend dropdowns use plain `<option>` lists which is fine.

---

## 10. Recent Changes Summary (this revision)

* ✅ Project reorganised into `sql/`, `code/`, `data/`, `diagrams/`, `docs/`.
* ✅ `code/preprocess_reference_data.py` — added `--outdir` (default `sql`), inputs default to `data/...`.
* ✅ `code/preprocess_ema.py` — added `--outdir` (default `sql`) and `--mapping-dir` (default `data`); input defaults to `data/Medicine_EMA.xlsx`.
* ✅ `code/generate_data.py` — added `argparse` with `--outdir` (default `sql`); writes `sql/load.sql`.
* ✅ `run_all.bat` — fully rewritten to use the new paths; every step now sources files from `sql/` and the Python scripts get explicit `--outdir sql`.
* ✅ **`ui/`** — new bonus showcase app (Express + vanilla JS, same styling as `Old ui/`). 6 tabs, queries panel reads raw SQL **live** from `sql/Qx.sql`.
* ✅ **`code/generate_data.py` (V3)** — major realism rewrite (see §11). Patched in this revision to (a) honour the new `data/` + `sql/` layout via `--outdir/--datadir/--sqldir`, and (b) fix a cost-of-zero regression caused by the `calculate_hospitalization_cost` trigger only firing on `UPDATE`.
* ✅ **FK on `Hospitalization.ken_code` → `KEN_Catalog.code`** added inline (with a matching index `fk_hospitalization_ken_idx`), and the `calculate_hospitalization_cost` trigger now raises `SIGNAL '45000'` if the ΚΕΝ lookup yields `NULL`. Closes the high-priority gap in §12.1.
* ✅ **`Entity_Images` replaced by `Department_Images` + `Doctor_Images`**, each with a real FK and `ON DELETE CASCADE`. The generator and the existing `sql/load.sql` were rewritten in lockstep — `run_all.bat` continues to work without re-running `generate_data.py`. Closes §12.2 with option (a).
* ✅ **All AMKA columns narrowed from `VARCHAR(45)` to `CHAR(11)`** in `sql/install.sql` (20 columns total — every PK and FK that holds an AMKA value: `Staff`, `Patients`, `Doctors.staff_amka`/`supervisor_amka`, `Nurses.staff_amka`, `Admin_Staff.staff_amka`, `Departments.director_amka`, `Triage_Records.patient_amka`/`nurse_amka`, `Hospitalization.patient_amka`, `Doctor_has_Department.doctor_amka`, `Procedure_Records.main_surgeon_amk`, `Procedure_Assistants.staff_amka`, `Patient_Allergies.patient_amka`, `Prescriptions.doctor_amka`/`patient_amka`, `Lab_Tests.ordering_doctor_amka`, `Evaluation_Doctor.doctor_amka`, `Doctor_Images.doctor_amka`, `Shift_Assignments.staff_amka`). The generator already emits exactly 11 digits per AMKA (`gen_amka()`), so the previously-emitted `sql/load.sql` (verified: `INSERT INTO Staff (amka,…) VALUES ('92902107953',…)` etc.) is compatible without re-running `code/generate_data.py`. Closes §5.1 row #1 / §5.4 item #1.

To run end-to-end after these changes:

```cmd
cd C:\xampp\htdocs\databases
run_all.bat
```

---

## 11. Evaluation of `generate_data.py` (V3 rewrite)

The user authored a substantial rewrite of `code/generate_data.py`

### 11.1 Why V3 is a meaningful upgrade

1. **Realistic Greek identities** — gender-aware first names + properly inflected surnames (`Παπαδόπουλος`/`Παπαδοπούλου`, `Παππάς`/`Παππά`). The original used `Faker('el_GR')` which produced mixed-gender pairs.
2. **CDC-style anthropometrics** — `realistic_weight_height(age, gender)` returns plausible weight/height per age bracket. The old version drew uniformly in `(45–120 kg, 1.50–1.95 m)` for every patient including infants.
3. **Hire-date consistency** — `hire_date` cannot precede the staff member's 22nd birthday (`max(date(2026 - (age - 22), 1, 1), …)`). The original allowed a 26-year-old hired in 2000.
4. **Director ↔ specialty alignment** — each director's specialty matches their department (e.g. `ΜΕΘ` → `Αναισθησιολογία`). Plus `Doctor_has_Department` now contains the director.
5. **Patient ↔ department compatibility** — `pick_compatible(dept_id)` keeps children out of adult departments, women-only filter for `Μαιευτική`, etc. Spec doesn't strictly require this but it makes the data defensible.
6. **Bed-count consistency fix** — `Departments.bed_count` is pre-computed (`dept_bed_counts[i]`) and the `Beds` loop produces *exactly* that many rows per department. The original drew the count and the loop bound independently, so the totals didn't match.
7. **Bed types respect department** — `ΜΕΘ` → only `ΜΕΘ` beds, `Παιδιατρική` → `Παιδιατρική` beds.
8. **ΜΕΘ staffing** — only senior nurses (no `Βοηθός Νοσηλευτή`), plausible for an ICU.
9. **Doctor-on-shift gating for activities** — lab tests and prescriptions can only be ordered by a doctor that actually had a shift that day (`doctor_shift_dates`). The original picked any doctor at random.
10. **Triage precedes every admission** — V3 emits one triage row per hospitalisation (spec: every patient passes through triage), plus extra triage rows for "discharged with instructions" patients (good for Q15 admit-rate).
11. **Procedure timing within working hours** (`06:00–22:00` start window, end before midnight).
12. **Staffing capacity bump** — nurses 300→500, admins 100→150, which is needed to comfortably satisfy the per-shift minimum (3 doctors + 6 nurses + 2 admins) over the longer shift window.
13. **Strict minimum-staffing enforcement** — `if len(assigned_docs) < 3 or len(assigned_nurses) < 6 or len(assigned_admins) < 2: continue`. Better to skip a department-shift than emit a violating one.
14. **Real reference data, with graceful fallback** — `_load_icd10/_ken/_procedures/_ema` read the actual files from `data/`/`sql/` when present, and fall back to the small hard-coded sample otherwise. This means the `Hospitalization.admission_diagnosis_icd10` values can now point at the full ICD-10 catalogue instead of just 10 codes.
15. **Likert ratings biased positive** (`weights=[5,10,25,35,25]`) — realistic patient-satisfaction distribution.
16. **Shift period spans 2023–2026** — Q1 / Q9 / Q14 (multi-year analyses) get proper multi-year coverage.

### 11.2 Issues that needed fixing during this revision (now patched)

1. **Cost regression — fixed.** V3 inserted `total_cost = 0` with a comment claiming "the trigger will compute it". But the `calculate_hospitalization_cost` trigger is `BEFORE UPDATE ... IF NEW.discharge_date IS NOT NULL AND OLD.discharge_date IS NULL` — it never fires on `INSERT`. So every completed hospitalisation would have remained at zero cost and Q1's `Total_Revenue` column would have collapsed. Patched: the cost is now computed in Python (matching the trigger's formula: `basic_cost + max(0, actual_days - mdn) * 100.0`).
2. **Hard-coded paths — fixed.** V3 still expected `ICD10_Catalog.xls`, `Medicine_EMA.xlsx`, `ken.sql` and the output `load.sql` in the current working directory. Patched with `argparse`:
   - `--outdir`  (default `sql`) for `load.sql`
   - `--datadir` (default `data`) for the xls/xlsx inputs
   - `--sqldir`  (default `sql`) for `ken.sql` (already produced by `preprocess_reference_data.py`)


### 11.3 Issues still worth tracking (not blocking)

1. **Performance.** Shift periods now cover 2023–2026 ≈ 615 day-slots × 3 shift types × 15 departments × (3 + 6 + 2) staff = ~277 k `Shift_Assignments` rows in the worst case. With per-row trigger validation (rest/monthly/3-night-streak + resident-needs-senior) the `load.sql` import will take noticeably longer than the original. Acceptable, but consider documenting in README.
2. **Duplicated entries in static lists** (`'Καλαμάτα'`, `'Σόλωνος'`) — harmless, but cosmetic.
3. **`compatible_depts()` falls back to dept 4 (Επείγοντα)** for any unrecognised specialty. Reasonable, but means a `Δερματολογία` director with mistyped specialty would land in Emergency. Worth a short comment.
4. **`_load_ema` parse logic** — when active substance contains `|`, the inner comma-split is guarded by `',' in part and '|' not in raw` (False when raw has a `|`). This means combined products like `"A | B, C"` only register A and "B, C" (not B and C separately). Same behaviour as `preprocess_ema.py`, so they at least stay consistent — but document it as a simplification.
5. **`shift_periods` granularity** — emitting 15 days per month over 4 years means some queries that look at *whole* months will see gaps (days 16-end have no shifts). Q12 expects a full week; if the chosen reference week straddles day 15, results will look thin.
6. **`hire_date` lower bound** — uses `2026 - (age - 22)`, which assumes the simulation "now" is 2026. If you re-run after 2026 the bound drifts. Replace with `date.today().year` once the project stops being a 2026 snapshot.


### 11.4 Net effect on the project grade
The V3 rewrite turns the seed data from "valid-but-synthetic" into "valid-and-defensible". Concretely:
- Q1's revenue table will no longer have any zero rows.
- Q4/Q6 demos with a real AMKA will look medically sensible.
- Q15's triage chart now reflects "every admission passed through triage" — which the spec explicitly demands.
- Q12's per-department staffing will pass the 3/6/2 minimum on every emitted shift.

This nudges the **data generation** sub-score from 9 → 9.5 / 10, with overall project quality benefiting indirectly across queries that depend on data realism (Q1, Q4, Q6, Q12, Q15).

---

## 12. Tables Without Outgoing Foreign Keys — Analysis

Two tables in the schema declare **no outgoing foreign keys**: `Entity_Images` and `KEN_Catalog`. These are very different cases and only one of them is a real problem.

> ✅ **Applied in this revision (2026-05-16):** both gaps have been closed in `sql/install.sql`. See §12.1, §12.2, and §12.3 for the actions taken. The generator and the previously-emitted `sql/load.sql` were updated in lockstep so `run_all.bat` keeps working end-to-end.

### 12.1 `KEN_Catalog` — a missing FK on the *referrer*, not on the catalog itself

`KEN_Catalog` is a **reference catalog** (PK = `code`, plus `basic_cost`, `avg_duration_days`, `description`). It is correct that it has no outgoing FKs — a lookup table's role is to be *referenced by* other tables, not to reference anything. The same is true of `ICD10_Catalog`, `Medical_Procedure_Catalog`, `Medicine_EMA`, `Active_Substances`, and `Spaces`. So strictly speaking the "no outgoing FK" observation about `KEN_Catalog` is by design.

**But the user's instinct is right — there is a missing FK in this neighbourhood.** It just goes the other direction:

```sql
-- install.sql line 208 — Hospitalization.ken_code:
`ken_code` VARCHAR(45) NULL,
-- …no CONSTRAINT fk_hosp_ken FOREIGN KEY (ken_code) REFERENCES KEN_Catalog(code).
```

Compare with the *other* reference codes on the same table, which all have proper FKs:

| Column | FK declared? |
|---|---|
| `Hospitalization.admission_diagnosis_icd10` → `ICD10_Catalog.code` | ✅ Yes (line 231) |
| `Hospitalization.discharge_diagnosis_icd10` → `ICD10_Catalog.code` | ✅ Yes (line 236) |
| `Procedure_Records.procedure_code` → `Medical_Procedure_Catalog.code` | ✅ Yes |
| `Hospitalization.ken_code` → `KEN_Catalog.code` | ❌ **Missing** |

This is a clear oversight — the spec uses ΚΕΝ identically to ICD-10 as a closed code system.

#### Why this matters (concrete impact)

1. **Silent NULL cost in the cost trigger.** `calculate_hospitalization_cost` (install.sql:791-816) does:
    ```sql
    SELECT basic_cost, avg_duration_days INTO base_cost, mdn_days
    FROM KEN_Catalog WHERE code = NEW.ken_code;
    ```
    If `ken_code` is a typo or stale value, the SELECT returns no row, `base_cost` stays NULL, the arithmetic propagates NULLs, and `NEW.total_cost` is silently set to NULL. **No error, no warning.** Q1's `SUM(k.basic_cost)` and `Total_Revenue` columns then drop those stays entirely. With the FK, the bad insert is rejected up-front.

2. **Q1 INNER JOIN drops rows.** `Q1.sql:16` does `JOIN KEN_Catalog k ON h.ken_code = k.code`. Without the FK, any hospitalization with an unknown `ken_code` is silently excluded from the revenue report — easy to miss in grading because the query *runs* and returns *something*.

3. **No cascade safety on catalog refresh.** If `KEN_Catalog` is reloaded with a slightly different code spelling (Greek letter normalisation, e.g. `Ε01Α` vs `E01A` Latin), every existing `ken_code` becomes orphaned with no warning.

#### Recommended fix

```sql
ALTER TABLE Hospitalization
  ADD CONSTRAINT fk_hospitalization_ken
  FOREIGN KEY (ken_code) REFERENCES KEN_Catalog (code)
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

This also gives you a free index on `Hospitalization.ken_code`, which Q1 will use for the join. Loading order is already correct (`ken.sql` runs before `load.sql` in `run_all.bat`), so the FK can be added without re-sequencing.

#### ✅ Action taken in this revision

The FK has been declared **inline** in the `Hospitalization` `CREATE TABLE` block (the script already does `SET FOREIGN_KEY_CHECKS=0` at the top, so the forward reference to `KEN_Catalog` is fine), accompanied by a matching covering index `fk_hospitalization_ken_idx`:

```sql
INDEX `fk_hospitalization_ken_idx` (`ken_code` ASC),
CONSTRAINT `fk_hospitalization_ken`
  FOREIGN KEY (`ken_code`)
  REFERENCES `KEN_Catalog` (`code`)
  ON DELETE RESTRICT
  ON UPDATE CASCADE
```

In addition, `calculate_hospitalization_cost` was hardened: it now raises `SIGNAL SQLSTATE '45000'` if the lookup against `KEN_Catalog` yields `NULL`, instead of silently storing `total_cost = NULL`. This defence stays useful even after the FK is in place, because the trigger also runs during bulk loads with `FOREIGN_KEY_CHECKS=0`.

### 12.2 `Entity_Images` — polymorphic by design, integrity unenforceable

`Entity_Images` (install.sql:527-534) is a **polymorphic association table**:

```sql
CREATE TABLE Entity_Images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(45),        -- 'Department' | 'Doctor' | …
  entity_id   VARCHAR(45),        -- PK of the target row, as text
  image_url   VARCHAR(500),
  description TEXT
);
```

This pattern is **deliberately FK-less**: a single column (`entity_id`) cannot have a foreign key that varies by `entity_type`. SQL doesn't support conditional FKs. So the absence here is *not* an oversight — it's a known limitation of the design choice.

#### Problems this causes (real, even if intentional)

1. **No referential integrity.** Nothing prevents `('Doctor', '99999999999')` where AMKA `99999999999` doesn't exist. The generator only emits 15 departments + 20 doctors so the chance of this in seed data is low, but the *DB* doesn't know.
2. **No cascade on delete.** Delete a department → its image row is orphaned. Delete is rare in this schema (NO ACTION everywhere), but still a soft leak.
3. **`entity_type` is free text.** A typo (`'Doctors'` vs `'Doctor'`) silently breaks every query that filters on it. The spec forbids `ENUM`, but a `CHECK (entity_type IN (…))` constraint is allowed and should be added.
4. **`entity_id VARCHAR(45)`** is a lossy union of `INT` (departments) and `VARCHAR` (AMKA). Queries joining to integer PKs need a cast.

#### Three ways to fix it (pick one, explain in README)

| Option | Pros | Cons |
|---|---|---|
| **(a) One image table per entity type** (`Department_Images`, `Doctor_Images`, …) with proper FK + `ON DELETE CASCADE` | Full integrity, indexable, simple queries | More tables; mild duplication of `image_url`/`description` columns |
| **(b) Multiple nullable FK columns** (`department_id`, `doctor_amka`, `patient_amka`, …) with `CHECK` that exactly one is non-NULL | Single table, real FKs | Wide table, awkward CHECK, every new entity type = ALTER TABLE |
| **(c) Keep polymorphic but constrain `entity_type`** with `CHECK (entity_type IN ('Department','Doctor','Patient','Nurse','Admin','Bed','Hospitalization'))` and document the limitation | Minimal churn, no schema rewrite | Still no validation that `entity_id` exists; no cascade |

**Recommendation:** (a) for an academic submission that wants to demonstrate proper relational design — it earns explicit points under §A.2 "integrity constraints". (c) is the minimum acceptable fix if the schema is otherwise frozen.

#### ✅ Action taken in this revision

Chose **option (a)**. The generic `Entity_Images` table was removed and replaced with two purpose-built tables, each with a real FK and a sensible cascade:

```sql
CREATE TABLE IF NOT EXISTS `Department_Images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `department_id` INT NOT NULL,
  `image_url` VARCHAR(500) NULL,
  `description` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_dept_image_dept_idx` (`department_id` ASC),
  CONSTRAINT `fk_dept_image_dept`
    FOREIGN KEY (`department_id`) REFERENCES `Departments` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `Doctor_Images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `doctor_amka` VARCHAR(45) NOT NULL,
  `image_url` VARCHAR(500) NULL,
  `description` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_doctor_image_doctor_idx` (`doctor_amka` ASC),
  CONSTRAINT `fk_doctor_image_doctor`
    FOREIGN KEY (`doctor_amka`) REFERENCES `Doctors` (`staff_amka`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB;
```

Why option (a) rather than (c):
- The previously-emitted `sql/load.sql` only ever populated two entity types (`Department` ×15 and `Doctor` ×20), so the split incurs zero data loss.
- Now matches the integrity discipline of **every other relationship in the schema** — which was the user's explicit goal ("make it match the rest of the database").
- The UI (`ui/`) doesn't query `Entity_Images`, so there is no downstream breakage.
- `ON DELETE CASCADE` makes image cleanup automatic when a department or doctor is deleted (impossible under the previous polymorphic design).

Follow-up edits that were applied to keep the pipeline consistent:
- `code/generate_data.py` (lines ~1310-1315) — the two image-emitting loops now write `INSERT INTO Department_Images (department_id, …)` and `INSERT INTO Doctor_Images (doctor_amka, …)`.
- `sql/load.sql` — all 35 previously-emitted `INSERT INTO Entity_Images …` lines were rewritten in place to target the new tables (no rerun of `generate_data.py` required to use the schema today).

### 12.3 Action items to add to §8

- ~~**[High]** Add `FOREIGN KEY (ken_code) REFERENCES KEN_Catalog(code)` on `Hospitalization`.~~ ✅ **Done** — see §12.1.
- ~~**[High]** Either split `Entity_Images` into per-entity tables **or** add `CHECK (entity_type IN (…))` …~~ ✅ **Done** — split per option (a); see §12.2.
- ~~**[Medium]** While adding the ΚΕΝ FK, also revisit the `calculate_hospitalization_cost` trigger and have it raise `SIGNAL SQLSTATE '45000'` if `base_cost IS NULL` …~~ ✅ **Done** — trigger now signals on a missing ΚΕΝ code; see §12.1.

---

## 13. Final Rating

**Database & queries quality:** 7.5 / 10
**Project layout / structure:** 8 / 10 (improved after reorganisation)
**Deliverables completeness:** 5 / 10 (folders exist; README, diagrams, report, Qx_out files still empty/missing)
**Bonus UI (`ui/` showcase app):** 9 / 10 — likely earns the +1 bonus point the professor mentioned
**Overall (weighted as in the brief):** **~8.0 / 10**

If items 1–4 in §8 are completed, the realistic grade jumps to **~9 / 10** before the bonus, and to **~10 / 10** once the +1 point from the UI is added — the underlying schema, triggers, data generation, query logic, and now the live demo UI are genuinely strong work. The project is "code-complete and well-organised, with the bonus already in place — only the documentation deliverables (README, exported diagrams, `docs/report.pdf`, `Qx_out.txt` files) remain to finalise the submission package."