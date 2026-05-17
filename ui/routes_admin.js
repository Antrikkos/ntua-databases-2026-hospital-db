// routes/admin.js
// Cascade delete routes + shift management routes.
// Mount in server.js with:
//   const adminRoutes = require("./routes/admin");
//   adminRoutes(app);

const { query, pool, withTransaction } = require("./db");

// ─────────────────────────────────────────────────────────────
// CASCADE IMPACT PREVIEW
// Returns counts of dependent rows that would be deleted.
// Frontend calls this first, shows warning, user confirms,
// then frontend calls the actual DELETE endpoint.
// ─────────────────────────────────────────────────────────────

const IMPACT_QUERIES = {
  patient: (amka) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Hospitalization WHERE patient_amka = :amka)       AS hospitalizations,
        (SELECT COUNT(*) FROM Triage_Records WHERE patient_amka = :amka)        AS triage_records,
        (SELECT COUNT(*) FROM Prescriptions WHERE patient_amka = :amka)         AS prescriptions,
        (SELECT COUNT(*) FROM Patient_Allergies WHERE patient_amka = :amka)     AS allergies,
        (SELECT COUNT(*) FROM Lab_Tests lt
           JOIN Hospitalization h ON lt.hospitalization_id = h.id
          WHERE h.patient_amka = :amka)                                         AS lab_tests,
        (SELECT COUNT(*) FROM Procedure_Records pr
           JOIN Hospitalization h ON pr.hospitalization_id = h.id
          WHERE h.patient_amka = :amka)                                         AS procedures,
        (SELECT COUNT(*) FROM Evaluation_Hospitalization eh
           JOIN Hospitalization h ON eh.hospitalization_id = h.id
          WHERE h.patient_amka = :amka)                                         AS hospitalization_reviews,
        (SELECT COUNT(*) FROM Evaluation_Doctor ed
           JOIN Hospitalization h ON ed.hospitalization_id = h.id
          WHERE h.patient_amka = :amka)                                         AS doctor_reviews
    `,
    params: { amka }
  }),

  doctor: (amka) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Doctor_has_Department WHERE doctor_amka = :amka)              AS department_assignments,
        (SELECT COUNT(*) FROM Prescriptions WHERE doctor_amka = :amka)                      AS prescriptions,
        (SELECT COUNT(*) FROM Procedure_Records WHERE main_surgeon_amk = :amka)             AS surgeries_as_lead,
        (SELECT COUNT(*) FROM Procedure_Assistants WHERE staff_amka = :amka)                AS surgeries_as_assistant,
        (SELECT COUNT(*) FROM Lab_Tests WHERE ordering_doctor_amka = :amka)                 AS lab_tests,
        (SELECT COUNT(*) FROM Evaluation_Doctor WHERE doctor_amka = :amka)                  AS reviews_received,
        (SELECT COUNT(*) FROM Shift_Assignments WHERE staff_amka = :amka)                   AS shift_assignments,
        (SELECT COUNT(*) FROM Doctors WHERE supervisor_amka = :amka)                        AS supervised_residents,
        (SELECT COUNT(*) FROM Departments WHERE director_amka = :amka)                      AS directs_departments,
        (SELECT COUNT(*) FROM Hospitalization h
           JOIN Procedure_Records pr ON pr.hospitalization_id = h.id
          WHERE pr.main_surgeon_amk = :amka AND h.discharge_date IS NULL)                   AS active_surgeries
    `,
    params: { amka }
  }),

  nurse: (amka) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Triage_Records WHERE nurse_amka = :amka)         AS triage_records,
        (SELECT COUNT(*) FROM Procedure_Assistants WHERE staff_amka = :amka)   AS surgery_assists,
        (SELECT COUNT(*) FROM Shift_Assignments WHERE staff_amka = :amka)      AS shift_assignments
    `,
    params: { amka }
  }),

  admin: (amka) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Shift_Assignments WHERE staff_amka = :amka) AS shift_assignments
    `,
    params: { amka }
  }),

  hospitalization: (id) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Prescriptions p
           JOIN Hospitalization h ON p.patient_amka = h.patient_amka
          WHERE h.id = :id
            AND p.start_date >= DATE(h.admission_date)
            AND (h.discharge_date IS NULL OR p.start_date <= DATE(h.discharge_date)))    AS prescriptions_in_window,
        (SELECT COUNT(*) FROM Lab_Tests WHERE hospitalization_id = :id)                   AS lab_tests,
        (SELECT COUNT(*) FROM Procedure_Records WHERE hospitalization_id = :id)           AS procedures,
        (SELECT COUNT(*) FROM Evaluation_Hospitalization WHERE hospitalization_id = :id)  AS hospitalization_review,
        (SELECT COUNT(*) FROM Evaluation_Doctor WHERE hospitalization_id = :id)           AS doctor_reviews,
        (SELECT bed_id FROM Hospitalization WHERE id = :id)                               AS bed_to_release,
        (SELECT discharge_date IS NULL FROM Hospitalization WHERE id = :id)               AS is_active
    `,
    params: { id }
  }),

  eval_hospitalization: (id) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Evaluation_Doctor WHERE hospitalization_id = :id) AS doctor_reviews_in_same_hosp,
        (SELECT nursing_care FROM Evaluation_Hospitalization WHERE hospitalization_id = :id) AS nursing_care,
        (SELECT overall_experience FROM Evaluation_Hospitalization WHERE hospitalization_id = :id) AS overall_experience
    `,
    params: { id }
  }),

  eval_doctor: (doctor_amka) => ({
    sql: `SELECT COUNT(*) AS total_doctor_reviews FROM Evaluation_Doctor WHERE doctor_amka = :doctor_amka`,
    params: { doctor_amka }
  }),

  procedure: (id) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Procedure_Assistants WHERE procedure_record_id = :id) AS assistants
    `,
    params: { id }
  }),

  shift: (id) => ({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM Shift_Assignments WHERE shift_id = :id) AS assignments
    `,
    params: { id }
  })
};

// ─────────────────────────────────────────────────────────────
// CASCADE DELETE EXECUTORS
// All wrapped in transactions. Order: leaf tables first.
// Returns { deleted_<table>: N, ... } summary.
// ─────────────────────────────────────────────────────────────

const DELETE_CASCADES = {
  patient: async (conn, amka) => {
    const result = {};

    // 1. Find all hospitalizations of this patient (need their ids for child cleanup)
    const [hosps] = await conn.execute(
      `SELECT id FROM Hospitalization WHERE patient_amka = :amka`,
      { amka }
    );
    const hospIds = hosps.map((r) => r.id);

    // 2. Delete children of hospitalizations
    if (hospIds.length > 0) {
      const placeholders = hospIds.map((_, i) => `:h${i}`).join(",");
      const params = Object.fromEntries(hospIds.map((id, i) => [`h${i}`, id]));

      const [labs] = await conn.execute(
        `DELETE FROM Lab_Tests WHERE hospitalization_id IN (${placeholders})`, params);
      result.lab_tests = labs.affectedRows;

      // Procedure_Assistants → Procedure_Records
      const [procs] = await conn.execute(
        `SELECT id FROM Procedure_Records WHERE hospitalization_id IN (${placeholders})`, params);
      if (procs.length > 0) {
        const procIds = procs.map((r) => r.id);
        const pPl = procIds.map((_, i) => `:p${i}`).join(",");
        const pParams = Object.fromEntries(procIds.map((id, i) => [`p${i}`, id]));
        const [pas] = await conn.execute(
          `DELETE FROM Procedure_Assistants WHERE procedure_record_id IN (${pPl})`, pParams);
        result.procedure_assistants = pas.affectedRows;
      }
      const [prs] = await conn.execute(
        `DELETE FROM Procedure_Records WHERE hospitalization_id IN (${placeholders})`, params);
      result.procedures = prs.affectedRows;

      const [eh] = await conn.execute(
        `DELETE FROM Evaluation_Hospitalization WHERE hospitalization_id IN (${placeholders})`, params);
      result.hospitalization_reviews = eh.affectedRows;

      const [ed] = await conn.execute(
        `DELETE FROM Evaluation_Doctor WHERE hospitalization_id IN (${placeholders})`, params);
      result.doctor_reviews = ed.affectedRows;

      const [tr] = await conn.execute(
        `UPDATE Triage_Records SET hospitalization_id = NULL
          WHERE hospitalization_id IN (${placeholders})`, params);
      result.triage_records_unlinked = tr.affectedRows;

      // 3. Hospitalizations themselves — AFTER UPDATE trigger frees beds
      // To trigger bed release, set discharge_date first if NULL
      await conn.execute(
        `UPDATE Hospitalization
            SET discharge_date = COALESCE(discharge_date, CURDATE())
          WHERE id IN (${placeholders})`, params);

      const [hd] = await conn.execute(
        `DELETE FROM Hospitalization WHERE id IN (${placeholders})`, params);
      result.hospitalizations = hd.affectedRows;
    }

    // 4. Patient-level children
    const [pr] = await conn.execute(`DELETE FROM Prescriptions WHERE patient_amka = :amka`, { amka });
    result.prescriptions = pr.affectedRows;

    const [pa] = await conn.execute(`DELETE FROM Patient_Allergies WHERE patient_amka = :amka`, { amka });
    result.allergies = pa.affectedRows;

    const [tr2] = await conn.execute(`DELETE FROM Triage_Records WHERE patient_amka = :amka`, { amka });
    result.triage_records = tr2.affectedRows;

    // 5. Patient
    const [p] = await conn.execute(`DELETE FROM Patients WHERE amka = :amka`, { amka });
    result.patient = p.affectedRows;
    return result;
  },

  doctor: async (conn, amka) => {
    const result = {};

    // Block: active surgeries by this doctor
    const [active] = await conn.execute(
      `SELECT pr.id FROM Procedure_Records pr
         JOIN Hospitalization h ON pr.hospitalization_id = h.id
        WHERE pr.main_surgeon_amk = :amka AND h.discharge_date IS NULL`,
      { amka }
    );
    if (active.length > 0) {
      throw new Error(`Δεν επιτρέπεται διαγραφή: ο ιατρός έχει ${active.length} επεμβάσεις σε ενεργή νοσηλεία.`);
    }

    // Block: directs a department
    const [dirs] = await conn.execute(
      `SELECT id, name FROM Departments WHERE director_amka = :amka`, { amka });
    if (dirs.length > 0) {
      throw new Error(`Δεν επιτρέπεται διαγραφή: ο ιατρός διευθύνει τμήμα(τα): ${dirs.map(d => d.name).join(", ")}.`);
    }

    // Cascade
    const [pa] = await conn.execute(
      `DELETE FROM Procedure_Assistants WHERE staff_amka = :amka`, { amka });
    result.procedure_assistants = pa.affectedRows;

    // Unlink supervised residents (set NULL — they need re-assignment manually)
    const [sup] = await conn.execute(
      `UPDATE Doctors SET supervisor_amka = NULL WHERE supervisor_amka = :amka`, { amka });
    result.supervised_residents_unlinked = sup.affectedRows;

    // Procedure_Records: if completed (hosp has discharge), keep history by nulling FK
    // But schema requires main_surgeon_amk NOT NULL → so we DELETE them
    const [prr] = await conn.execute(
      `DELETE FROM Procedure_Records WHERE main_surgeon_amk = :amka`, { amka });
    result.procedures = prr.affectedRows;

    const [lt] = await conn.execute(
      `DELETE FROM Lab_Tests WHERE ordering_doctor_amka = :amka`, { amka });
    result.lab_tests = lt.affectedRows;

    const [pr] = await conn.execute(
      `DELETE FROM Prescriptions WHERE doctor_amka = :amka`, { amka });
    result.prescriptions = pr.affectedRows;

    const [ed] = await conn.execute(
      `DELETE FROM Evaluation_Doctor WHERE doctor_amka = :amka`, { amka });
    result.reviews = ed.affectedRows;

    const [sa] = await conn.execute(
      `DELETE FROM Shift_Assignments WHERE staff_amka = :amka`, { amka });
    result.shift_assignments = sa.affectedRows;

    const [dhd] = await conn.execute(
      `DELETE FROM Doctor_has_Department WHERE doctor_amka = :amka`, { amka });
    result.department_assignments = dhd.affectedRows;

    const [d] = await conn.execute(`DELETE FROM Doctors WHERE staff_amka = :amka`, { amka });
    result.doctor = d.affectedRows;

    const [s] = await conn.execute(`DELETE FROM Staff WHERE amka = :amka`, { amka });
    result.staff = s.affectedRows;
    return result;
  },

  nurse: async (conn, amka) => {
    const result = {};

    // Triage_Records.nurse_amka has NO ON DELETE → set NULL
    const [tr] = await conn.execute(
      `UPDATE Triage_Records SET nurse_amka = NULL WHERE nurse_amka = :amka`, { amka });
    result.triage_records_unlinked = tr.affectedRows;

    const [pa] = await conn.execute(
      `DELETE FROM Procedure_Assistants WHERE staff_amka = :amka`, { amka });
    result.procedure_assistants = pa.affectedRows;

    const [sa] = await conn.execute(
      `DELETE FROM Shift_Assignments WHERE staff_amka = :amka`, { amka });
    result.shift_assignments = sa.affectedRows;

    const [n] = await conn.execute(`DELETE FROM Nurses WHERE staff_amka = :amka`, { amka });
    result.nurse = n.affectedRows;

    const [s] = await conn.execute(`DELETE FROM Staff WHERE amka = :amka`, { amka });
    result.staff = s.affectedRows;
    return result;
  },

  admin: async (conn, amka) => {
    const result = {};
    const [sa] = await conn.execute(
      `DELETE FROM Shift_Assignments WHERE staff_amka = :amka`, { amka });
    result.shift_assignments = sa.affectedRows;

    const [a] = await conn.execute(`DELETE FROM Admin_Staff WHERE staff_amka = :amka`, { amka });
    result.admin = a.affectedRows;

    const [s] = await conn.execute(`DELETE FROM Staff WHERE amka = :amka`, { amka });
    result.staff = s.affectedRows;
    return result;
  },

  hospitalization: async (conn, id) => {
    const result = {};

    // 1. Trigger bed release: set discharge_date if NULL
    //    The auto_set_bed_available AFTER UPDATE trigger handles bed status.
    await conn.execute(
      `UPDATE Hospitalization
          SET discharge_date = COALESCE(discharge_date, CURDATE()),
              discharge_diagnosis_icd10 = COALESCE(discharge_diagnosis_icd10, admission_diagnosis_icd10)
        WHERE id = :id`,
      { id }
    );

    // 2. Cascading deletes
    const [lt] = await conn.execute(
      `DELETE FROM Lab_Tests WHERE hospitalization_id = :id`, { id });
    result.lab_tests = lt.affectedRows;

    const [procs] = await conn.execute(
      `SELECT id FROM Procedure_Records WHERE hospitalization_id = :id`, { id });
    if (procs.length > 0) {
      const pIds = procs.map((r) => r.id);
      const pPl = pIds.map((_, i) => `:p${i}`).join(",");
      const pParams = Object.fromEntries(pIds.map((pid, i) => [`p${i}`, pid]));
      const [pas] = await conn.execute(
        `DELETE FROM Procedure_Assistants WHERE procedure_record_id IN (${pPl})`, pParams);
      result.procedure_assistants = pas.affectedRows;
    }
    const [pr] = await conn.execute(
      `DELETE FROM Procedure_Records WHERE hospitalization_id = :id`, { id });
    result.procedures = pr.affectedRows;

    const [eh] = await conn.execute(
      `DELETE FROM Evaluation_Hospitalization WHERE hospitalization_id = :id`, { id });
    result.hospitalization_review = eh.affectedRows;

    const [ed] = await conn.execute(
      `DELETE FROM Evaluation_Doctor WHERE hospitalization_id = :id`, { id });
    result.doctor_reviews = ed.affectedRows;

    const [tr] = await conn.execute(
      `UPDATE Triage_Records SET hospitalization_id = NULL WHERE hospitalization_id = :id`, { id });
    result.triage_unlinked = tr.affectedRows;

    const [h] = await conn.execute(`DELETE FROM Hospitalization WHERE id = :id`, { id });
    result.hospitalization = h.affectedRows;
    return result;
  },

  eval_hospitalization: async (conn, id) => {
    // Deleting the hospitalization evaluation; keep doctor evaluations (separate choice)
    const [r] = await conn.execute(
      `DELETE FROM Evaluation_Hospitalization WHERE hospitalization_id = :id`, { id }
    );
    return { eval_hospitalization: r.affectedRows };
  },

  eval_doctor: async (conn, { hosp_id, doctor_amka }) => {
    const [r] = await conn.execute(
      `DELETE FROM Evaluation_Doctor WHERE hospitalization_id = :hosp_id AND doctor_amka = :doctor_amka`,
      { hosp_id, doctor_amka }
    );
    return { eval_doctor: r.affectedRows };
  },

  prescription: async (conn, { doctor_amka, patient_amka, medicine_code, start_date }) => {
    const [p] = await conn.execute(
      `DELETE FROM Prescriptions
        WHERE doctor_amka = :doctor_amka
          AND patient_amka = :patient_amka
          AND medicine_code = :medicine_code
          AND start_date = :start_date`,
      { doctor_amka, patient_amka, medicine_code, start_date }
    );
    return { prescription: p.affectedRows };
  },

  procedure: async (conn, id) => {
    const result = {};
    const [pa] = await conn.execute(
      `DELETE FROM Procedure_Assistants WHERE procedure_record_id = :id`, { id });
    result.assistants = pa.affectedRows;
    const [p] = await conn.execute(
      `DELETE FROM Procedure_Records WHERE id = :id`, { id });
    result.procedure = p.affectedRows;
    return result;
  },

  shift: async (conn, id) => {
    const result = {};
    const [sa] = await conn.execute(
      `DELETE FROM Shift_Assignments WHERE shift_id = :id`, { id });
    result.assignments = sa.affectedRows;
    const [s] = await conn.execute(
      `DELETE FROM Shifts WHERE id = :id`, { id });
    result.shift = s.affectedRows;
    return result;
  }
};

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
module.exports = function registerAdminRoutes(app) {
  // ── Cascade impact preview ─────────────────────────────────
  app.get("/api/admin/impact/:entity/:key", async (req, res) => {
    try {
      const { entity, key } = req.params;
      const builder = IMPACT_QUERIES[entity];
      if (!builder) return res.status(400).json({ error: `Unknown entity: ${entity}` });

      // For prescriptions, key is composite — pass via query string instead.
      // Here we just support single-key entities.
      const built = builder(key);
      const [row] = await query(built.sql, built.params);
      res.json({ entity, key, impact: row || {} });
    } catch (error) {
      const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/admin/impact/prescription", async (req, res) => {
    // Composite-key preview for prescriptions
    const { doctor_amka, patient_amka, medicine_code, start_date } = req.body || {};
    if (!doctor_amka || !patient_amka || !medicine_code || !start_date) {
      return res.status(400).json({ error: "doctor_amka, patient_amka, medicine_code, start_date required" });
    }
    res.json({
      entity: "prescription",
      impact: { note: "Πρόκειται για διαγραφή μεμονωμένης συνταγής — δεν επηρεάζει άλλες εγγραφές." }
    });
  });

  // ── Cascade delete executor ────────────────────────────────
  app.delete("/api/admin/delete/:entity/:key", async (req, res) => {
    try {
      const { entity, key } = req.params;
      const executor = DELETE_CASCADES[entity];
      if (!executor) return res.status(400).json({ error: `Unknown entity: ${entity}` });
      if (entity === "prescription") {
        return res.status(400).json({ error: "Use POST /api/admin/delete/prescription for composite key." });
      }

      const summary = await withTransaction(async (conn) => executor(conn, key));
      res.json({ ok: true, entity, key, deleted: summary });
    } catch (error) {
      const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
      res.status(400).json({ error: msg });
    }
  });

  app.post("/api/admin/delete/prescription", async (req, res) => {
    try {
      const { doctor_amka, patient_amka, medicine_code, start_date } = req.body || {};
      if (!doctor_amka || !patient_amka || !medicine_code || !start_date) {
        return res.status(400).json({ error: "doctor_amka, patient_amka, medicine_code, start_date required" });
      }
      const summary = await withTransaction(async (conn) =>
        DELETE_CASCADES.prescription(conn, { doctor_amka, patient_amka, medicine_code, start_date })
      );
      res.json({ ok: true, entity: "prescription", deleted: summary });
    } catch (error) {
      const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
      res.status(400).json({ error: msg });
    }
  });

  // Eval_hospitalization delete
  app.delete("/api/admin/delete/eval_hospitalization/:hospId", async (req, res) => {
    try {
      const id = Number(req.params.hospId);
      const summary = await withTransaction(async (conn) =>
        DELETE_CASCADES.eval_hospitalization(conn, id)
      );
      res.json({ ok: true, deleted: summary });
    } catch (error) {
      res.status(400).json({ error: error.sqlMessage || error.message });
    }
  });

  // Eval_doctor delete — composite key: /hospId/doctorAmka
  app.delete("/api/admin/delete/eval_doctor/:hospId/:doctorAmka", async (req, res) => {
    try {
      const hosp_id = Number(req.params.hospId);
      const doctor_amka = req.params.doctorAmka;
      const summary = await withTransaction(async (conn) =>
        DELETE_CASCADES.eval_doctor(conn, { hosp_id, doctor_amka })
      );
      res.json({ ok: true, deleted: summary });
    } catch (error) {
      res.status(400).json({ error: error.sqlMessage || error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // ADD DOCTOR
  // Creates Staff + Doctors + Doctor_has_Department atomically.
  // Trigger check_no_circular_supervision + resident-must-have-supervisor
  // are enforced by the DB.
  // ─────────────────────────────────────────────────────────────

  // Lookup helpers for the add-doctor form
  app.get("/api/admin/doctors/supervisors", async (_req, res, next) => {
    try {
      // Returns all non-resident doctors (eligible to be supervisors)
      const rows = await query(`
        SELECT d.staff_amka, s.first_name, s.last_name, d.specialty, d.\`rank\` AS rank_
        FROM Doctors d
        JOIN Staff s ON s.amka = d.staff_amka
        WHERE d.\`rank\` != 'Ειδικευόμενος'
        ORDER BY d.\`rank\`, s.last_name, s.first_name
      `);
      res.json(rows);
    } catch (err) { next(err); }
  });

  app.post("/api/admin/doctors", async (req, res) => {
    try {
      const b = req.body || {};

      // ── Validate required fields ───────────────────────────
      const required = [
        "amka", "first_name", "last_name", "age", "hire_date",
        "license_number", "specialty", "rank", "department_ids"
      ];
      const missing = required.filter((k) => !b[k] && b[k] !== 0);
      if (missing.length > 0)
        return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });

      const deptIds = Array.isArray(b.department_ids) ? b.department_ids.map(Number) : [];
      if (deptIds.length === 0)
        return res.status(400).json({ error: "Απαιτείται τουλάχιστον ένα τμήμα." });

      const VALID_RANKS = ["Ειδικευόμενος", "Επιμελητής Β'", "Επιμελητής Α'", "Διευθυντής"];
      if (!VALID_RANKS.includes(b.rank))
        return res.status(400).json({ error: `Άκυρη βαθμίδα. Επιτρεπτές: ${VALID_RANKS.join(", ")}` });

      // Resident must have supervisor; Director must NOT
      if (b.rank === "Ειδικευόμενος" && !b.supervisor_amka)
        return res.status(400).json({ error: "Οι Ειδικευόμενοι υποχρεούνται να έχουν επόπτη." });
      if (b.rank === "Διευθυντής" && b.supervisor_amka)
        return res.status(400).json({ error: "Οι Διευθυντές δεν μπορούν να έχουν επόπτη." });

      const result = await withTransaction(async (conn) => {
        // 1. Staff row
        await conn.execute(
          `INSERT INTO Staff
             (amka, first_name, last_name, fathers_name, age, email, phone,
              hire_date, staff_type)
           VALUES
             (:amka, :first_name, :last_name, :fathers_name, :age, :email, :phone,
              :hire_date, 'Doctor')`,
          {
            amka:         b.amka,
            first_name:   b.first_name,
            last_name:    b.last_name,
            fathers_name: b.fathers_name || null,
            age:          Number(b.age),
            email:        b.email || null,
            phone:        b.phone || null,
            hire_date:    b.hire_date,
          }
        );

        // 2. Doctors row — triggers enforce supervision rules
        await conn.execute(
          `INSERT INTO Doctors
             (staff_amka, license_number, specialty, \`rank\`, supervisor_amka)
           VALUES
             (:amka, :license_number, :specialty, :rank, :supervisor_amka)`,
          {
            amka:            b.amka,
            license_number:  b.license_number,
            specialty:       b.specialty,
            rank:            b.rank,
            supervisor_amka: b.supervisor_amka || null,
          }
        );

        // 3. Department assignments
        for (const deptId of deptIds) {
          await conn.execute(
            `INSERT INTO Doctor_has_Department (doctor_amka, department_id) VALUES (:amka, :dept)`,
            { amka: b.amka, dept: deptId }
          );
        }

        return { amka: b.amka, departments: deptIds.length };
      });

      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      const msg = error.sqlMessage || error.message;
      res.status(400).json({ error: msg });
    }
  });
  // ─────────────────────────────────────────────────────────────

  // List recent shifts (for the UI list)
  app.get("/api/shifts", async (req, res, next) => {
    try {
      const dateFrom = req.query.from || null;
      const dateTo = req.query.to || null;
      const rows = await query(
        `
        SELECT
          s.id, s.shift_date, s.shift_type,
          COUNT(DISTINCT sa.staff_amka) AS total_staff,
          SUM(CASE WHEN st.staff_type = 'Doctor' THEN 1 ELSE 0 END) AS doctors,
          SUM(CASE WHEN st.staff_type = 'Nurse' THEN 1 ELSE 0 END)  AS nurses,
          SUM(CASE WHEN st.staff_type = 'Admin' THEN 1 ELSE 0 END)  AS admins
        FROM Shifts s
        LEFT JOIN Shift_Assignments sa ON sa.shift_id = s.id
        LEFT JOIN Staff st ON st.amka = sa.staff_amka
        WHERE (:dateFrom IS NULL OR s.shift_date >= :dateFrom)
          AND (:dateTo IS NULL OR s.shift_date <= :dateTo)
        GROUP BY s.id, s.shift_date, s.shift_type
        ORDER BY s.shift_date DESC, FIELD(s.shift_type, 'Morning', 'Afternoon', 'Night')
        LIMIT 100
        `,
        { dateFrom, dateTo }
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  // Get shift details (assignments grouped by department)
  app.get("/api/shifts/:id", async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const [shift] = await query(`SELECT id, shift_date, shift_type FROM Shifts WHERE id = :id`, { id });
      if (!shift) return res.status(404).json({ error: "Shift not found" });

      const assignments = await query(
        `
        SELECT sa.staff_amka, sa.department_id, d.name AS department,
               s.first_name, s.last_name, s.staff_type,
               doc.specialty, doc.\`rank\` AS doctor_rank,
               n.\`rank\` AS nurse_rank,
               a.role AS admin_role
        FROM Shift_Assignments sa
        JOIN Staff s ON s.amka = sa.staff_amka
        JOIN Departments d ON d.id = sa.department_id
        LEFT JOIN Doctors doc ON doc.staff_amka = sa.staff_amka
        LEFT JOIN Nurses n ON n.staff_amka = sa.staff_amka
        LEFT JOIN Admin_Staff a ON a.staff_amka = sa.staff_amka
        WHERE sa.shift_id = :id
        ORDER BY d.name, s.staff_type, s.last_name
        `,
        { id }
      );
      res.json({ shift, assignments });
    } catch (error) {
      next(error);
    }
  });

  // Auto-fill suggestion: who CAN work this shift+dept based on triggers
  // (3 doctors / 6 nurses / 2 admins, senior present if resident, monthly limit, 8hr rest)
  app.post("/api/shifts/autofill", async (req, res) => {
    try {
      const { shift_date, shift_type, department_id } = req.body || {};
      if (!shift_date || !shift_type || !department_id) {
        return res.status(400).json({ error: "shift_date, shift_type, department_id required" });
      }
      if (!["Morning", "Afternoon", "Night"].includes(shift_type)) {
        return res.status(400).json({ error: "shift_type must be Morning|Afternoon|Night" });
      }

      const deptId = Number(department_id);

      // Pull all staff with monthly counts + last shift info for filtering
      // We'll use SQL to do the filtering work (faster than JS loops)
      const candidates = await query(
        `
        SELECT
          s.amka,
          s.first_name,
          s.last_name,
          s.staff_type,
          doc.\`rank\` AS doctor_rank,
          doc.specialty,
          n.\`rank\` AS nurse_rank,
          n.department_id AS nurse_dept,
          a.role AS admin_role,
          a.department_id AS admin_dept,
          (SELECT COUNT(*)
             FROM Shift_Assignments sa2
             JOIN Shifts sh2 ON sh2.id = sa2.shift_id
            WHERE sa2.staff_amka = s.amka
              AND YEAR(sh2.shift_date) = YEAR(:shift_date)
              AND MONTH(sh2.shift_date) = MONTH(:shift_date)
          ) AS monthly_shifts,
          (SELECT COUNT(*)
             FROM Shift_Assignments sa3
             JOIN Shifts sh3 ON sh3.id = sa3.shift_id
            WHERE sa3.staff_amka = s.amka
              AND sh3.shift_date = :shift_date
              AND sh3.shift_type = :shift_type
          ) AS already_on_this_shift,
          -- Rest check: is there a shift ending within 8hrs of this one's start?
          (SELECT COUNT(*)
             FROM Shift_Assignments sa4
             JOIN Shifts sh4 ON sh4.id = sa4.shift_id
            WHERE sa4.staff_amka = s.amka
              AND CASE :shift_type
                    WHEN 'Morning'   THEN ABS(TIMESTAMPDIFF(HOUR,
                                              CASE sh4.shift_type
                                                WHEN 'Morning'   THEN CONCAT(sh4.shift_date,' 15:00:00')
                                                WHEN 'Afternoon' THEN CONCAT(sh4.shift_date,' 23:00:00')
                                                WHEN 'Night'     THEN CONCAT(DATE_ADD(sh4.shift_date,INTERVAL 1 DAY),' 07:00:00')
                                              END,
                                              CONCAT(:shift_date,' 07:00:00'))) < 8
                    WHEN 'Afternoon' THEN ABS(TIMESTAMPDIFF(HOUR,
                                              CASE sh4.shift_type
                                                WHEN 'Morning'   THEN CONCAT(sh4.shift_date,' 15:00:00')
                                                WHEN 'Afternoon' THEN CONCAT(sh4.shift_date,' 23:00:00')
                                                WHEN 'Night'     THEN CONCAT(DATE_ADD(sh4.shift_date,INTERVAL 1 DAY),' 07:00:00')
                                              END,
                                              CONCAT(:shift_date,' 15:00:00'))) < 8
                    WHEN 'Night'     THEN ABS(TIMESTAMPDIFF(HOUR,
                                              CASE sh4.shift_type
                                                WHEN 'Morning'   THEN CONCAT(sh4.shift_date,' 15:00:00')
                                                WHEN 'Afternoon' THEN CONCAT(sh4.shift_date,' 23:00:00')
                                                WHEN 'Night'     THEN CONCAT(DATE_ADD(sh4.shift_date,INTERVAL 1 DAY),' 07:00:00')
                                              END,
                                              CONCAT(:shift_date,' 23:00:00'))) < 8
                  END
              AND NOT (sh4.shift_date = :shift_date AND sh4.shift_type = :shift_type)
          ) AS rest_violation,
          -- Consecutive night count
          (SELECT COUNT(*)
             FROM Shift_Assignments sa5
             JOIN Shifts sh5 ON sh5.id = sa5.shift_id
            WHERE sa5.staff_amka = s.amka
              AND sh5.shift_type = 'Night'
              AND sh5.shift_date BETWEEN DATE_SUB(:shift_date, INTERVAL 3 DAY) AND DATE_SUB(:shift_date, INTERVAL 1 DAY)
          ) AS recent_night_count
        FROM Staff s
        LEFT JOIN Doctors doc ON doc.staff_amka = s.amka
        LEFT JOIN Nurses n ON n.staff_amka = s.amka
        LEFT JOIN Admin_Staff a ON a.staff_amka = s.amka
        LEFT JOIN Doctor_has_Department dhd ON dhd.doctor_amka = s.amka AND dhd.department_id = :department_id
        WHERE
          (s.staff_type = 'Doctor' AND dhd.doctor_amka IS NOT NULL)
          OR (s.staff_type = 'Nurse' AND n.department_id = :department_id)
          OR (s.staff_type = 'Admin' AND a.department_id = :department_id)
        `,
        { shift_date, shift_type, department_id: deptId }
      );

      // Apply trigger rules: filter out those who can't work
      const MAX_MONTHLY = { Doctor: 15, Nurse: 20, Admin: 25 };
      const eligible = candidates.filter((c) =>
        c.already_on_this_shift == 0 &&
        c.rest_violation == 0 &&
        c.monthly_shifts < MAX_MONTHLY[c.staff_type] &&
        !(shift_type === "Night" && c.recent_night_count >= 3)
      );

      // Split by role
      const doctors = eligible.filter((c) => c.staff_type === "Doctor");
      const nurses = eligible.filter((c) => c.staff_type === "Nurse");
      const admins = eligible.filter((c) => c.staff_type === "Admin");

      // Pick 3 doctors with senior-present rule
      const SENIOR_RANKS = ["Επιμελητής Α'", "Διευθυντής"];
      const seniors = doctors.filter((d) => SENIOR_RANKS.includes(d.doctor_rank));
      const mid     = doctors.filter((d) => !SENIOR_RANKS.includes(d.doctor_rank) && d.doctor_rank !== "Ειδικευόμενος");
      const residents = doctors.filter((d) => d.doctor_rank === "Ειδικευόμενος");

      const pickDocs = [];
      // Prefer 1 senior + 2 mid; if no mid, fill with senior; only add residents if senior present
      const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
      const sSeniors = shuffle(seniors);
      const sMid     = shuffle(mid);
      const sResidents = shuffle(residents);

      if (sSeniors.length > 0) pickDocs.push(sSeniors[0]);
      for (const d of sMid) { if (pickDocs.length >= 3) break; pickDocs.push(d); }
      for (const d of sSeniors.slice(1)) { if (pickDocs.length >= 3) break; pickDocs.push(d); }
      if (pickDocs.some((d) => SENIOR_RANKS.includes(d.doctor_rank))) {
        for (const d of sResidents) { if (pickDocs.length >= 3) break; pickDocs.push(d); }
      }

      const pickNurses = shuffle(nurses).slice(0, 6);
      const pickAdmins = shuffle(admins).slice(0, 2);

      const warnings = [];
      if (pickDocs.length < 3) warnings.push(`Μόνο ${pickDocs.length}/3 διαθέσιμοι ιατροί.`);
      if (pickNurses.length < 6) warnings.push(`Μόνο ${pickNurses.length}/6 διαθέσιμοι νοσηλευτές.`);
      if (pickAdmins.length < 2) warnings.push(`Μόνο ${pickAdmins.length}/2 διαθέσιμοι διοικητικοί.`);
      const hasSenior = pickDocs.some((d) => SENIOR_RANKS.includes(d.doctor_rank));
      const hasResident = pickDocs.some((d) => d.doctor_rank === "Ειδικευόμενος");
      if (hasResident && !hasSenior) warnings.push("Ειδικευόμενος χωρίς senior — απορρίπτεται από trigger.");

      res.json({
        shift_date,
        shift_type,
        department_id: deptId,
        suggested: {
          doctors: pickDocs,
          nurses: pickNurses,
          admins: pickAdmins
        },
        counts: {
          doctors: pickDocs.length,
          nurses: pickNurses.length,
          admins: pickAdmins.length
        },
        complete: pickDocs.length >= 3 && pickNurses.length >= 6 && pickAdmins.length >= 2 && hasSenior,
        warnings
      });
    } catch (error) {
      const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
      res.status(400).json({ error: msg });
    }
  });

  // Create shift + assignments (manual or after auto-fill confirmation)
  app.post("/api/shifts", async (req, res) => {
    try {
      const { shift_date, shift_type, department_id, staff_amkas } = req.body || {};
      if (!shift_date || !shift_type || !department_id) {
        return res.status(400).json({ error: "shift_date, shift_type, department_id required" });
      }
      if (!Array.isArray(staff_amkas) || staff_amkas.length === 0) {
        return res.status(400).json({ error: "staff_amkas[] required (non-empty)" });
      }
      if (!["Morning", "Afternoon", "Night"].includes(shift_type)) {
        return res.status(400).json({ error: "shift_type must be Morning|Afternoon|Night" });
      }

      const result = await withTransaction(async (conn) => {
        // 1. Find or create the Shift row (unique by date+type)
        const [existing] = await conn.execute(
          `SELECT id FROM Shifts WHERE shift_date = :d AND shift_type = :t`,
          { d: shift_date, t: shift_type }
        );

        let shiftId;
        if (existing.length > 0) {
          shiftId = existing[0].id;
        } else {
          const [ins] = await conn.execute(
            `INSERT INTO Shifts (shift_date, shift_type) VALUES (:d, :t)`,
            { d: shift_date, t: shift_type }
          );
          shiftId = ins.insertId;
        }

        // 2. Insert each assignment — triggers enforce all rules.
        //    We use INSERT (not IGNORE) so violations surface as errors.
        const inserted = [];
        const failed = [];
        for (const amka of staff_amkas) {
          try {
            await conn.execute(
              `INSERT INTO Shift_Assignments (shift_id, staff_amka, department_id)
               VALUES (:shift_id, :amka, :dept)`,
              { shift_id: shiftId, amka, dept: Number(department_id) }
            );
            inserted.push(amka);
          } catch (err) {
            // Trigger SIGNAL surfaces as sqlMessage
            failed.push({ amka, error: err.sqlMessage || err.message });
            throw err; // rollback the entire shift
          }
        }
        return { shiftId, inserted, failed };
      });

      res.status(201).json({ ok: true, shift_id: result.shiftId, assigned: result.inserted.length });
    } catch (error) {
      const msg = error && error.sqlMessage ? error.sqlMessage : error.message;
      res.status(400).json({ error: msg });
    }
  });

  // Staff search by department (for manual shift form)
  app.get("/api/shifts/staff/by-department", async (req, res, next) => {
    try {
      const deptId = Number(req.query.department_id);
      const role = (req.query.role || "").toString();  // Doctor|Nurse|Admin|""
      if (!deptId) return res.status(400).json({ error: "department_id required" });

      const rows = await query(
        `
        SELECT s.amka, s.first_name, s.last_name, s.staff_type,
               doc.specialty, doc.\`rank\` AS doctor_rank,
               n.\`rank\` AS nurse_rank,
               a.role AS admin_role
        FROM Staff s
        LEFT JOIN Doctors doc ON doc.staff_amka = s.amka
        LEFT JOIN Nurses n ON n.staff_amka = s.amka
        LEFT JOIN Admin_Staff a ON a.staff_amka = s.amka
        LEFT JOIN Doctor_has_Department dhd ON dhd.doctor_amka = s.amka AND dhd.department_id = :dept
        WHERE
          ((:role = '' OR :role = 'Doctor') AND s.staff_type = 'Doctor' AND dhd.doctor_amka IS NOT NULL)
          OR
          ((:role = '' OR :role = 'Nurse') AND s.staff_type = 'Nurse' AND n.department_id = :dept)
          OR
          ((:role = '' OR :role = 'Admin') AND s.staff_type = 'Admin' AND a.department_id = :dept)
        ORDER BY s.staff_type, s.last_name, s.first_name
        `,
        { dept: deptId, role }
      );
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });
};
