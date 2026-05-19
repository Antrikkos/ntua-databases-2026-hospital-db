require("dotenv").config();

const path = require("path");
const express = require("express");
const { query, pool, withTransaction } = require("./db");
const { queryLibrary, listQueryDefinitions, readRawSql } = require("./queryLibrary");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}

function mondayOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  now.setDate(now.getDate() + diff);
  return now.toISOString().slice(0, 10);
}

function normalizeQueryParams(id, incoming = {}) {
  const params = { ...incoming };
  if (id === "Q08" && !params.shiftDate) params.shiftDate = today();
  if (id === "Q12" && !params.referenceDate) params.referenceDate = mondayOfCurrentWeek();
  return params;
}

// ─────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await query("SELECT 1 AS ok");
    res.json({ ok: true, db: "connected" });
  } catch (error) {
    res.status(500).json({ ok: false, db: "disconnected", error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
app.get("/api/summary", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        (SELECT COUNT(*) FROM Doctors)         AS doctors_count,
        (SELECT COUNT(*) FROM Nurses)          AS nurses_count,
        (SELECT COUNT(*) FROM Admin_Staff)     AS admins_count,
        (SELECT COUNT(*) FROM Patients)        AS patients_count,
        (SELECT COUNT(*) FROM Hospitalization) AS hospitalizations_count,
        (SELECT COUNT(*) FROM Departments)     AS departments_count,
        (SELECT COUNT(*) FROM Prescriptions)   AS prescriptions_count,
        (SELECT COUNT(*) FROM Triage_Records)  AS triage_cases_count
    `);
    res.json(rows[0] || {});
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard/revenue", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        d.name AS department,
        YEAR(h.admission_date) AS year,
        ROUND(SUM(h.total_cost), 2) AS total_revenue,
        COUNT(*) AS hospitalizations
      FROM Hospitalization h
      JOIN Departments d ON h.department_id = d.id
      WHERE h.discharge_date IS NOT NULL
      GROUP BY d.name, YEAR(h.admission_date)
      ORDER BY year DESC, total_revenue DESC
      LIMIT 30
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard/triage", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        urgency_level,
        COUNT(*) AS total_cases
      FROM Triage_Records
      GROUP BY urgency_level
      ORDER BY urgency_level
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// Patients
// ─────────────────────────────────────────────────────────────
app.get("/api/patients", async (req, res, next) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const rows = await query(
      `
      SELECT amka, first_name, last_name, age, gender, insurance_provider, phone, email
      FROM Patients
      WHERE :search = ''
         OR first_name LIKE CONCAT('%', :search, '%')
         OR last_name  LIKE CONCAT('%', :search, '%')
         OR amka       LIKE CONCAT('%', :search, '%')
      ORDER BY last_name, first_name
      LIMIT 100
      `,
      { search }
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/patients/:amka", async (req, res, next) => {
  try {
    const amka = req.params.amka;
    const [patient] = await query(`SELECT * FROM Patients WHERE amka = :amka`, { amka });
    if (!patient) return res.status(404).json({ error: "Patient not found." });

    const hospitalizations = await query(
      `
      SELECT h.id, h.admission_date, h.discharge_date,
             d.name AS department, h.ken_code, h.total_cost,
             h.admission_diagnosis_icd10, h.discharge_diagnosis_icd10
      FROM Hospitalization h
      JOIN Departments d ON h.department_id = d.id
      WHERE h.patient_amka = :amka
      ORDER BY h.admission_date DESC
      `,
      { amka }
    );

    const allergies = await query(
      `
      SELECT a.id AS substance_id, a.name AS substance_name
      FROM Patient_Allergies pa
      JOIN Active_Substances a ON pa.substance_id = a.id
      WHERE pa.patient_amka = :amka
      ORDER BY a.name
      `,
      { amka }
    );

    res.json({ patient, hospitalizations, allergies });
  } catch (error) {
    next(error);
  }
});

app.post("/api/patients", async (req, res, next) => {
  try {
    const b = req.body || {};
    const required = ["amka", "first_name", "last_name", "age", "gender", "insurance_provider"];
    const missing = required.filter((k) => !b[k] && b[k] !== 0);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
    }
    await query(
      `
      INSERT INTO Patients
        (amka, first_name, last_name, fathers_name, age, weight, height, gender,
         address, phone, email, profession, citizenship, emergency_contact, insurance_provider)
      VALUES
        (:amka, :first_name, :last_name, :fathers_name, :age, :weight, :height, :gender,
         :address, :phone, :email, :profession, :citizenship, :emergency_contact, :insurance_provider)
      `,
      {
        amka: b.amka,
        first_name: b.first_name,
        last_name: b.last_name,
        fathers_name: b.fathers_name || null,
        age: Number(b.age),
        weight: b.weight ? Number(b.weight) : null,
        height: b.height ? Number(b.height) : null,
        gender: b.gender,
        address: b.address || null,
        phone: b.phone || null,
        email: b.email || null,
        profession: b.profession || null,
        citizenship: b.citizenship || null,
        emergency_contact: b.emergency_contact || null,
        insurance_provider: b.insurance_provider
      }
    );
    res.status(201).json({ ok: true, amka: b.amka });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// Doctors
// ─────────────────────────────────────────────────────────────
app.get("/api/doctors", async (req, res, next) => {
  try {
    const search = (req.query.search || "").toString().trim();
    const specialty = (req.query.specialty || "").toString().trim();
    const rows = await query(
      `
      SELECT d.staff_amka, s.first_name, s.last_name, s.age,
             d.specialty, d.\`rank\` AS rank_, d.license_number, d.supervisor_amka
      FROM Doctors d
      JOIN Staff s ON d.staff_amka = s.amka
      WHERE (:search = '' OR s.last_name LIKE CONCAT('%', :search, '%')
             OR s.first_name LIKE CONCAT('%', :search, '%')
             OR d.staff_amka LIKE CONCAT('%', :search, '%'))
        AND (:specialty = '' OR d.specialty = :specialty)
      ORDER BY s.last_name, s.first_name
      LIMIT 100
      `,
      { search, specialty }
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/specialties", async (_req, res, next) => {
  try {
    const rows = await query(`SELECT DISTINCT specialty FROM Doctors WHERE specialty IS NOT NULL ORDER BY specialty`);
    res.json(rows.map((r) => r.specialty));
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// Hospitalizations
// ─────────────────────────────────────────────────────────────
app.get("/api/hospitalizations", async (req, res, next) => {
  try {
    // status=active|completed|all (default all). Legacy ?open=true also supported.
    const legacyOpen = req.query.open === "true";
    let status = (req.query.status || "").toString().toLowerCase();
    if (!status) status = legacyOpen ? "active" : "all";

    const flagActive = status === "active" ? 1 : 0;
    const flagCompleted = status === "completed" ? 1 : 0;

    const rows = await query(
      `
      SELECT h.id, h.patient_amka, p.first_name, p.last_name,
             d.name AS department, b.bed_number, h.bed_id,
             h.admission_date, h.discharge_date,
             h.admission_diagnosis_icd10, h.discharge_diagnosis_icd10,
             h.ken_code, h.total_cost,
             DATEDIFF(COALESCE(h.discharge_date, NOW()), h.admission_date) AS stay_days
      FROM Hospitalization h
      JOIN Patients p ON h.patient_amka = p.amka
      JOIN Departments d ON h.department_id = d.id
      LEFT JOIN Beds b ON b.id = h.bed_id
      WHERE
        (:flagActive = 0 AND :flagCompleted = 0)
        OR (:flagActive = 1 AND h.discharge_date IS NULL)
        OR (:flagCompleted = 1 AND h.discharge_date IS NOT NULL)
      ORDER BY (h.discharge_date IS NULL) DESC, h.admission_date DESC
      LIMIT 150
      `,
      { flagActive, flagCompleted }
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/hospitalizations/:id/discharge", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid hospitalization id" });

    const b = req.body || {};
    if (!b.discharge_date) return res.status(400).json({ error: "discharge_date required" });
    if (!b.discharge_diagnosis_icd10) return res.status(400).json({ error: "discharge_diagnosis_icd10 required" });

    const [current] = await query(
      `SELECT id, admission_date, discharge_date FROM Hospitalization WHERE id = :id`,
      { id }
    );
    if (!current) return res.status(404).json({ error: "Hospitalization not found" });
    if (current.discharge_date) return res.status(400).json({ error: "Η νοσηλεία έχει ήδη ολοκληρωθεί." });
    if (new Date(b.discharge_date) < new Date(current.admission_date)) {
      return res.status(400).json({ error: "Η ημερομηνία εξόδου προηγείται της εισαγωγής." });
    }

    // The calculate_hospitalization_cost trigger fills total_cost automatically.
    await pool.execute(
      `
      UPDATE Hospitalization
         SET discharge_date = :discharge_date,
             discharge_diagnosis_icd10 = :discharge_diagnosis_icd10
       WHERE id = :id
      `,
      {
        id,
        discharge_date: b.discharge_date,
        discharge_diagnosis_icd10: b.discharge_diagnosis_icd10
      }
    );

    const [updated] = await query(
      `SELECT id, total_cost, discharge_date, discharge_diagnosis_icd10 FROM Hospitalization WHERE id = :id`,
      { id }
    );
    res.json({ ok: true, hospitalization: updated });
  } catch (error) {
    const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
    res.status(400).json({ error: msg });
  }
});

app.get("/api/departments", async (_req, res, next) => {
  try {
    const rows = await query(`SELECT id, name FROM Departments ORDER BY name`);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/beds/available", async (req, res, next) => {
  try {
    const departmentId = Number(req.query.departmentId);
    if (!departmentId) return res.status(400).json({ error: "departmentId required" });
    const rows = await query(
      `
      SELECT b.id, b.bed_number, b.type, b.status
      FROM Beds b
      WHERE b.department_id = :departmentId
        AND b.status = 'Διαθέσιμη'
        AND NOT EXISTS (
          SELECT 1 FROM Hospitalization h
          WHERE h.bed_id = b.id AND h.discharge_date IS NULL
        )
      ORDER BY b.bed_number
      LIMIT 50
      `,
      { departmentId }
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/hospitalizations", async (req, res, next) => {
  try {
    const b = req.body || {};
    const required = ["patient_amka", "bed_id", "department_id", "admission_date", "admission_diagnosis_icd10", "ken_code"];
    const missing = required.filter((k) => !b[k]);
    if (missing.length > 0) return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });

    const triageId = b.triage_id ? Number(b.triage_id) : null;

    const insertId = await withTransaction(async (conn) => {
      const [result] = await conn.execute(
        `
        INSERT INTO Hospitalization
          (patient_amka, bed_id, department_id, admission_date, admission_diagnosis_icd10, ken_code, total_cost)
        VALUES
          (:patient_amka, :bed_id, :department_id, :admission_date, :admission_diagnosis_icd10, :ken_code, 0)
        `,
        {
          patient_amka: b.patient_amka,
          bed_id: Number(b.bed_id),
          department_id: Number(b.department_id),
          admission_date: b.admission_date,
          admission_diagnosis_icd10: b.admission_diagnosis_icd10,
          ken_code: b.ken_code
        }
      );
      if (triageId) {
        await conn.execute(
          `UPDATE Triage_Records
              SET outcome = 'Admitted', resolved_at = NOW(), hospitalization_id = :hid
            WHERE id = :tid AND outcome IS NULL`,
          { hid: result.insertId, tid: triageId }
        );
      }
      return result.insertId;
    });

    res.status(201).json({ ok: true, hospitalization_id: insertId, triage_id: triageId });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// Prescriptions  (the allergy trigger is enforced server-side)
// ─────────────────────────────────────────────────────────────
app.get("/api/prescriptions", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT pr.doctor_amka, ds.last_name AS doctor_last,
             pr.patient_amka, ps.last_name AS patient_last,
             pr.medicine_code, m.brand_name,
             pr.start_date, pr.end_date, pr.dosage, pr.frequency
      FROM Prescriptions pr
      JOIN Staff ds ON ds.amka = pr.doctor_amka
      JOIN Patients ps ON ps.amka = pr.patient_amka
      JOIN Medicine_EMA m ON m.code = pr.medicine_code
      ORDER BY pr.start_date DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/medicines/search", async (req, res, next) => {
  try {
    const term = (req.query.q || "").toString().trim();
    const rows = await query(
      `
      SELECT code, brand_name
      FROM Medicine_EMA
      WHERE :term = '' OR brand_name LIKE CONCAT('%', :term, '%') OR code LIKE CONCAT('%', :term, '%')
      ORDER BY brand_name
      LIMIT 30
      `,
      { term }
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/prescriptions", async (req, res, next) => {
  try {
    const b = req.body || {};
    const required = ["doctor_amka", "patient_amka", "medicine_code", "start_date"];
    const missing = required.filter((k) => !b[k]);
    if (missing.length > 0) return res.status(400).json({ error: `Missing: ${missing.join(", ")}` });

    await query(
      `
      INSERT INTO Prescriptions
        (doctor_amka, patient_amka, medicine_code, start_date, end_date, dosage, frequency)
      VALUES
        (:doctor_amka, :patient_amka, :medicine_code, :start_date, :end_date, :dosage, :frequency)
      `,
      {
        doctor_amka: b.doctor_amka,
        patient_amka: b.patient_amka,
        medicine_code: b.medicine_code,
        start_date: b.start_date,
        end_date: b.end_date || null,
        dosage: b.dosage || null,
        frequency: b.frequency || null
      }
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    // Surface trigger SIGNAL messages cleanly (e.g. allergy)
    const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
    res.status(400).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────
// Triage / ΤΕΠ — patient queue, FIFO within urgency level
// ─────────────────────────────────────────────────────────────
const EMERGENCY_DEPARTMENT_NAME = "Επείγοντα";

async function ensureTriageColumns() {
  // Idempotent — adds workflow columns if not already present.
  const migrations = [
    "ALTER TABLE Triage_Records ADD COLUMN IF NOT EXISTS `outcome` VARCHAR(20) NULL",
    "ALTER TABLE Triage_Records ADD COLUMN IF NOT EXISTS `resolved_at` DATETIME NULL",
    "ALTER TABLE Triage_Records ADD COLUMN IF NOT EXISTS `hospitalization_id` INT NULL",
    "CREATE INDEX IF NOT EXISTS `idx_triage_queue` ON Triage_Records (outcome, urgency_level, arrival_time)"
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Duplicate column / index errors on older MariaDB → ignore.
      if (!/Duplicate|exists/i.test(err.message)) {
        console.warn("Triage migration warning:", err.message);
      }
    }
  }
}

app.get("/api/triage/queue", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        t.id, t.patient_amka, t.symptoms, t.urgency_level,
        t.arrival_time, t.nurse_amka,
        p.first_name, p.last_name, p.age, p.gender, p.insurance_provider, p.phone,
        ns.first_name AS nurse_first, ns.last_name AS nurse_last,
        TIMESTAMPDIFF(MINUTE, t.arrival_time, NOW()) AS waiting_minutes
      FROM Triage_Records t
      JOIN Patients p ON p.amka = t.patient_amka
      LEFT JOIN Staff ns ON ns.amka = t.nurse_amka
      WHERE t.outcome IS NULL
      ORDER BY t.urgency_level ASC, t.arrival_time ASC
      LIMIT 200
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/triage/history", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT
        t.id, t.patient_amka, t.symptoms, t.urgency_level,
        t.arrival_time, t.resolved_at, t.outcome, t.hospitalization_id,
        p.first_name, p.last_name,
        TIMESTAMPDIFF(MINUTE, t.arrival_time, t.resolved_at) AS handled_in_minutes
      FROM Triage_Records t
      JOIN Patients p ON p.amka = t.patient_amka
      WHERE t.outcome IS NOT NULL
      ORDER BY t.resolved_at DESC
      LIMIT 30
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/triage/nurses", async (_req, res, next) => {
  try {
    const rows = await query(
      `
      SELECT n.staff_amka, s.first_name, s.last_name, n.rank AS rank_, d.name AS department
      FROM Nurses n
      JOIN Staff s ON s.amka = n.staff_amka
      LEFT JOIN Departments d ON d.id = n.department_id
      WHERE d.name = :ed OR d.name IS NULL
      ORDER BY s.last_name, s.first_name
      `,
      { ed: EMERGENCY_DEPARTMENT_NAME }
    );
    // Fallback: if Emergency dept has no nurses, return all nurses
    if (rows.length === 0) {
      const fallback = await query(`
        SELECT n.staff_amka, s.first_name, s.last_name, n.rank AS rank_, d.name AS department
        FROM Nurses n
        JOIN Staff s ON s.amka = n.staff_amka
        LEFT JOIN Departments d ON d.id = n.department_id
        ORDER BY s.last_name, s.first_name
        LIMIT 50
      `);
      return res.json(fallback);
    }
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/triage", async (req, res, next) => {
  try {
    const b = req.body || {};
    const required = ["patient_amka", "nurse_amka", "symptoms", "urgency_level"];
    const missing = required.filter((k) => b[k] === undefined || b[k] === null || b[k] === "");
    if (missing.length > 0) return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });

    const urgency = Number(b.urgency_level);
    if (!Number.isInteger(urgency) || urgency < 1 || urgency > 5) {
      return res.status(400).json({ error: "urgency_level must be 1-5" });
    }

    const [exists] = await query(`SELECT 1 AS ok FROM Patients WHERE amka = :amka`, { amka: b.patient_amka });
    if (!exists) return res.status(400).json({ error: "Άγνωστος ασθενής (ΑΜΚΑ δεν υπάρχει)." });

    const [openCase] = await query(
      `SELECT id FROM Triage_Records WHERE patient_amka = :amka AND outcome IS NULL LIMIT 1`,
      { amka: b.patient_amka }
    );
    if (openCase) {
      return res.status(400).json({ error: `Ο ασθενής βρίσκεται ήδη στη λίστα triage (#${openCase.id}).` });
    }

    const [result] = await pool.execute(
      `
      INSERT INTO Triage_Records (patient_amka, nurse_amka, symptoms, urgency_level, arrival_time)
      VALUES (:patient_amka, :nurse_amka, :symptoms, :urgency_level, COALESCE(:arrival_time, NOW()))
      `,
      {
        patient_amka: b.patient_amka,
        nurse_amka: b.nurse_amka,
        symptoms: b.symptoms,
        urgency_level: urgency,
        arrival_time: b.arrival_time || null
      }
    );
    res.status(201).json({ ok: true, triage_id: result.insertId });
  } catch (error) {
    next(error);
  }
});

app.post("/api/triage/:id/discharge", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid triage id" });

    const [result] = await pool.execute(
      `UPDATE Triage_Records SET outcome = 'Discharged', resolved_at = NOW() WHERE id = :id AND outcome IS NULL`,
      { id }
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Δεν βρέθηκε ενεργό περιστατικό με αυτό το id." });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/icd10/search", async (req, res, next) => {
  try {
    const term = (req.query.q || "").toString().trim();
    const rows = await query(
      `
      SELECT code, description
      FROM ICD10_Catalog
      WHERE :term = '' OR code LIKE CONCAT(:term, '%') OR description LIKE CONCAT('%', :term, '%')
      ORDER BY code
      LIMIT 30
      `,
      { term }
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/ken/search", async (req, res, next) => {
  try {
    const term = (req.query.q || "").toString().trim();
    const rows = await query(
      `
      SELECT code, description, basic_cost AS base_cost, avg_duration_days AS average_stay_days
      FROM KEN_Catalog
      WHERE :term = '' OR code LIKE CONCAT('%', :term, '%') OR description LIKE CONCAT('%', :term, '%')
      ORDER BY code
      LIMIT 30
      `,
      { term }
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────────────────────
// Reviews (Evaluations) — hospitalization & doctor evaluations
//
// Σύμφωνα με την εκφώνηση (db2026.md):
//   - Αξιολόγηση επιτρέπεται μόνο σε ασθενείς με ολοκληρωμένη νοσηλεία
//     (triggers check_evaluation_hosp_completed / _doctor_completed).
//   - Likert 1–5 (CHECK constraints στους πίνακες Evaluation_*).
//   - Ο ασθενής μπορεί να αξιολογήσει κάθε ιατρό που του συνταγογράφησε
//     κατά τη νοσηλεία του → derive μέσω Prescriptions/date range.
// ─────────────────────────────────────────────────────────────

// All completed hospitalizations + whether they already carry an evaluation
app.get("/api/reviews/hospitalizations", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT h.id,
             h.patient_amka,
             p.first_name, p.last_name,
             d.name AS department,
             h.admission_date, h.discharge_date,
             eh.nursing_care, eh.cleanliness, eh.food, eh.overall_experience,
             (eh.hospitalization_id IS NOT NULL) AS has_evaluation,
             (SELECT COUNT(*) FROM Evaluation_Doctor ed WHERE ed.hospitalization_id = h.id) AS doctor_reviews
      FROM Hospitalization h
      JOIN Patients p ON p.amka = h.patient_amka
      JOIN Departments d ON d.id = h.department_id
      LEFT JOIN Evaluation_Hospitalization eh ON eh.hospitalization_id = h.id
      WHERE h.discharge_date IS NOT NULL
      ORDER BY h.discharge_date DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Doctors leaderboard: avg medical_care + review count
app.get("/api/reviews/doctors-summary", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT d.staff_amka,
             s.first_name, s.last_name,
             d.specialty, d.\`rank\` AS rank_,
             COUNT(ed.medical_care) AS review_count,
             ROUND(AVG(ed.medical_care), 2) AS avg_medical_care
      FROM Doctors d
      JOIN Staff s ON s.amka = d.staff_amka
      LEFT JOIN Evaluation_Doctor ed ON ed.doctor_amka = d.staff_amka
      GROUP BY d.staff_amka, s.first_name, s.last_name, d.specialty, d.\`rank\`
      HAVING review_count > 0
      ORDER BY avg_medical_care DESC, review_count DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Reviews for a specific doctor (with hospitalization context)
app.get("/api/reviews/doctor/:amka", async (req, res, next) => {
  try {
    const amka = req.params.amka;
    const [doctor] = await query(
      `
      SELECT d.staff_amka, s.first_name, s.last_name, d.specialty, d.\`rank\` AS rank_,
             COUNT(ed.medical_care) AS review_count,
             ROUND(AVG(ed.medical_care), 2) AS avg_medical_care
      FROM Doctors d
      JOIN Staff s ON s.amka = d.staff_amka
      LEFT JOIN Evaluation_Doctor ed ON ed.doctor_amka = d.staff_amka
      WHERE d.staff_amka = :amka
      GROUP BY d.staff_amka, s.first_name, s.last_name, d.specialty, d.\`rank\`
      `,
      { amka }
    );
    if (!doctor) return res.status(404).json({ error: "Doctor not found." });

    const reviews = await query(
      `
      SELECT ed.hospitalization_id, ed.medical_care,
             h.admission_date, h.discharge_date,
             dep.name AS department,
             h.patient_amka, p.first_name AS patient_first, p.last_name AS patient_last
      FROM Evaluation_Doctor ed
      JOIN Hospitalization h ON h.id = ed.hospitalization_id
      JOIN Departments dep ON dep.id = h.department_id
      JOIN Patients p ON p.amka = h.patient_amka
      WHERE ed.doctor_amka = :amka
      ORDER BY h.discharge_date DESC
      LIMIT 100
      `,
      { amka }
    );
    res.json({ doctor, reviews });
  } catch (error) {
    next(error);
  }
});

// Completed hospitalizations that don't have a hospitalization evaluation yet
app.get("/api/reviews/eligible", async (_req, res, next) => {
  try {
    const rows = await query(`
      SELECT h.id, h.patient_amka,
             p.first_name, p.last_name,
             d.name AS department,
             h.admission_date, h.discharge_date
      FROM Hospitalization h
      JOIN Patients p ON p.amka = h.patient_amka
      JOIN Departments d ON d.id = h.department_id
      LEFT JOIN Evaluation_Hospitalization eh ON eh.hospitalization_id = h.id
      WHERE h.discharge_date IS NOT NULL
        AND eh.hospitalization_id IS NULL
      ORDER BY h.discharge_date DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// Prescribing doctors for a given hospitalization (those the patient may evaluate)
app.get("/api/reviews/hospitalization/:id/doctors", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid hospitalization id" });

    const [hosp] = await query(
      `SELECT id, patient_amka, admission_date, discharge_date FROM Hospitalization WHERE id = :id`,
      { id }
    );
    if (!hosp) return res.status(404).json({ error: "Hospitalization not found." });
    if (!hosp.discharge_date) {
      return res.status(400).json({ error: "Η νοσηλεία δεν έχει ολοκληρωθεί ακόμη." });
    }

    const doctors = await query(
      `
      SELECT DISTINCT pr.doctor_amka,
             s.first_name, s.last_name,
             d.specialty, d.\`rank\` AS rank_,
             ed.medical_care AS existing_rating
      FROM Prescriptions pr
      JOIN Doctors d ON d.staff_amka = pr.doctor_amka
      JOIN Staff s ON s.amka = pr.doctor_amka
      LEFT JOIN Evaluation_Doctor ed
             ON ed.doctor_amka = pr.doctor_amka
            AND ed.hospitalization_id = :id
      WHERE pr.patient_amka = :patient_amka
        AND pr.start_date >= DATE(:admission_date)
        AND pr.start_date <= DATE(:discharge_date)
      ORDER BY s.last_name, s.first_name
      `,
      {
        id,
        patient_amka: hosp.patient_amka,
        admission_date: hosp.admission_date,
        discharge_date: hosp.discharge_date
      }
    );
    res.json({ hospitalization: hosp, doctors });
  } catch (error) {
    next(error);
  }
});

// Submit a hospitalization evaluation + per-doctor evaluations (atomic).
// The completed-hospitalization rule is enforced by the BEFORE INSERT triggers.
app.post("/api/reviews/hospitalization/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid hospitalization id" });

    const b = req.body || {};
    const likert = (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 5 ? n : "BAD";
    };
    const scores = {
      nursing_care: likert(b.nursing_care),
      cleanliness: likert(b.cleanliness),
      food: likert(b.food),
      overall_experience: likert(b.overall_experience)
    };
    if (Object.values(scores).includes("BAD")) {
      return res.status(400).json({ error: "Οι βαθμολογίες πρέπει να είναι ακέραιοι 1–5." });
    }

    const doctorRatings = Array.isArray(b.doctor_ratings) ? b.doctor_ratings : [];
    for (const dr of doctorRatings) {
      if (!dr.doctor_amka) return res.status(400).json({ error: "Λείπει doctor_amka σε αξιολόγηση ιατρού." });
      const score = likert(dr.medical_care);
      if (score === "BAD") return res.status(400).json({ error: "Η βαθμολογία ιατρού πρέπει να είναι 1–5." });
      dr.medical_care = score;
    }

    await withTransaction(async (conn) => {
      await conn.execute(
        `
        INSERT INTO Evaluation_Hospitalization
          (hospitalization_id, nursing_care, cleanliness, food, overall_experience)
        VALUES
          (:hospitalization_id, :nursing_care, :cleanliness, :food, :overall_experience)
        `,
        { hospitalization_id: id, ...scores }
      );
      for (const dr of doctorRatings) {
        if (dr.medical_care === null) continue;
        await conn.execute(
          `
          INSERT INTO Evaluation_Doctor (hospitalization_id, doctor_amka, medical_care)
          VALUES (:hospitalization_id, :doctor_amka, :medical_care)
          `,
          { hospitalization_id: id, doctor_amka: dr.doctor_amka, medical_care: dr.medical_care }
        );
      }
    });

    res.status(201).json({ ok: true, hospitalization_id: id });
  } catch (error) {
    const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
    res.status(400).json({ error: msg });
  }
});

require("./routes_admin")(app);

// ─────────────────────────────────────────────────────────────
// Queries (Q1-Q15) — list, raw SQL, execute
// ─────────────────────────────────────────────────────────────
app.get("/api/queries", (_req, res) => {
  res.json(listQueryDefinitions());
});

app.get("/api/queries/:id/sql", (req, res) => {
  const id = req.params.id;
  const raw = readRawSql(id);
  if (raw === null) return res.status(404).json({ error: "Unknown query id." });
  res.type("text/plain").send(raw);
});

app.post("/api/queries/:id/run", async (req, res) => {
  try {
    const id = req.params.id;
    const def = queryLibrary[id];
    if (!def) return res.status(404).json({ error: "Unknown query id." });

    const params = normalizeQueryParams(id, req.body || {});
    const rows = await query(def.executableSql, params);
    res.json({ queryId: id, rowCount: rows.length, rows });
  } catch (error) {
    const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
    res.status(400).json({ error: msg });
  }
});

// ─────────────────────────────────────────────────────────────
// Generic error handler
// ─────────────────────────────────────────────────────────────
app.use((error, _req, res, _next) => {
  const status = Number(error.statusCode || error.status || 500);
  const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
  res.status(status).json({ error: msg || "Server error" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    await ensureTriageColumns();
    console.log(`Hygeiopolis UI ready: http://localhost:${PORT}`);
  } catch (error) {
    console.log(`Server up at http://localhost:${PORT}  (DB unreachable: ${error.message})`);
  }
});