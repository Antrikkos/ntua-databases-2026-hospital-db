/**
 * queryLibrary.js
 * ──────────────────────────────────────────────────────────
 * Each entry corresponds to one of the 15 mandated queries.
 *  - `sqlFile`        : path (relative to project root) to the canonical
 *                       Qx.sql file. Used by the "View raw SQL" feature
 *                       in the UI so the professor sees EXACTLY what
 *                       lives in the submitted sql/ folder.
 *  - `params`         : parameter descriptors for the form (label, type,
 *                       default). The `name` field also names the
 *                       :placeholder used inside `executableSql`.
 *  - `executableSql`  : a parameterised version using :namedPlaceholder
 *                       syntax (mysql2 namedPlaceholders=true). Identical
 *                       semantics to the canonical SQL, with hard-coded
 *                       values lifted out so they can be supplied by the
 *                       form.
 *  - `notes`          : optional short description shown in the UI.
 */

const path = require("path");
const fs = require("fs");

const SQL_DIR = path.resolve(__dirname, "..", "sql");

const queryLibrary = {
  Q01: {
    title: "Έσοδα ανά τμήμα / έτος / ΚΕΝ / ασφαλιστικό φορέα",
    sqlFile: path.join(SQL_DIR, "Q01.sql"),
    params: [],
    executableSql: `
      SELECT
        d.name AS Department,
        YEAR(h.admission_date) AS Admission_Year,
        h.ken_code AS KEN_Code,
        SUM(k.basic_cost) AS Total_Base_Revenue,
        SUM(GREATEST(0, h.total_cost - k.basic_cost)) AS Total_Extra_Revenue,
        p.insurance_provider AS Insurance_Provider,
        COUNT(h.id) AS Total_Hospitalizations
      FROM Hospitalization h
      JOIN Departments d ON h.department_id = d.id
      JOIN KEN_Catalog k ON h.ken_code = k.code
      JOIN Patients p ON h.patient_amka = p.amka
      GROUP BY d.name, YEAR(h.admission_date), h.ken_code, p.insurance_provider
      ORDER BY Department, Admission_Year, KEN_Code
    `
  },

  Q02: {
    title: "Ιατροί ειδικότητας + ένδειξη εφημερίας + #επεμβάσεων",
    sqlFile: path.join(SQL_DIR, "Q02.sql"),
    params: [
      { name: "specialty", label: "Ειδικότητα", type: "text", defaultValue: "Καρδιολογία" }
    ],
    executableSql: `
      SELECT
        s.first_name,
        s.last_name,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM Shift_Assignments sa
            JOIN Shifts sh ON sa.shift_id = sh.id
            WHERE sa.staff_amka = d.staff_amka
              AND YEAR(sh.shift_date) = YEAR(CURDATE())
          ) THEN 'Ναι'
          ELSE 'Όχι'
        END AS Had_Shift_Current_Year,
        COUNT(pr.id) AS Lead_Surgeries_Performed
      FROM Doctors d
      JOIN Staff s ON d.staff_amka = s.amka
      LEFT JOIN Procedure_Records pr ON d.staff_amka = pr.main_surgeon_amk
      WHERE d.specialty = :specialty
      GROUP BY d.staff_amka, s.first_name, s.last_name
      ORDER BY Lead_Surgeries_Performed DESC, s.last_name
    `
  },

  Q03: {
    title: "Ασθενείς με >3 νοσηλείες στο ίδιο τμήμα",
    sqlFile: path.join(SQL_DIR, "Q03.sql"),
    params: [],
    executableSql: `
      SELECT
        p.first_name,
        p.last_name,
        d.name AS Department,
        COUNT(h.id) AS Hospitalization_Count,
        SUM(h.total_cost) AS Total_Accumulated_Cost
      FROM Hospitalization h
      JOIN Patients p ON h.patient_amka = p.amka
      JOIN Departments d ON h.department_id = d.id
      GROUP BY h.patient_amka, h.department_id, p.first_name, p.last_name, d.name
      HAVING COUNT(h.id) > 3
      ORDER BY Hospitalization_Count DESC, Total_Accumulated_Cost DESC
    `
  },

  Q04a: {
    title: "Μ.Ο. αξιολογήσεων συγκεκριμένου ιατρού (medical care + overall)",
    sqlFile: path.join(SQL_DIR, "Q04a.sql"),
    notes: "Επίλεξε πραγματικό ΑΜΚΑ ιατρού από τη βάση. Στο sql/Q4.sql υπάρχει η EXPLAIN ANALYZE έκδοση + FORCE INDEX.",
    params: [
      { name: "doctorAmka", label: "ΑΜΚΑ Ιατρού", type: "text", defaultValue: "" }
    ],
    executableSql: `
      SELECT
        d.staff_amka,
        s.last_name,
        AVG(ed.medical_care) AS Avg_Medical_Care,
        AVG(eh.overall_experience) AS Avg_Overall_Experience
      FROM Doctors d
      JOIN Staff s ON d.staff_amka = s.amka
      JOIN Evaluation_Doctor ed ON d.staff_amka = ed.doctor_amka
      JOIN Evaluation_Hospitalization eh ON ed.hospitalization_id = eh.hospitalization_id
      WHERE d.staff_amka = :doctorAmka
      GROUP BY d.staff_amka, s.last_name
    `
  },

  Q04b: {
    title: "Μ.Ο. αξιολογήσεων συγκεκριμένου ιατρού (medical care + overall)",
    sqlFile: path.join(SQL_DIR, "Q04b.sql"),
    notes: "Επίλεξε πραγματικό ΑΜΚΑ ιατρού από τη βάση. Στο sql/Q4.sql υπάρχει η EXPLAIN ANALYZE έκδοση + FORCE INDEX.",
    params: [
      { name: "doctorAmka", label: "ΑΜΚΑ Ιατρού", type: "text", defaultValue: "" }
    ],
    executableSql: `
      SELECT
        d.staff_amka,
        s.last_name,
        AVG(ed.medical_care) AS Avg_Medical_Care,
        AVG(eh.overall_experience) AS Avg_Overall_Experience
      FROM Doctors d
      JOIN Staff s ON d.staff_amka = s.amka
      JOIN Evaluation_Doctor ed ON d.staff_amka = ed.doctor_amka
      JOIN Evaluation_Hospitalization eh ON ed.hospitalization_id = eh.hospitalization_id
      WHERE d.staff_amka = :doctorAmka
      GROUP BY d.staff_amka, s.last_name
    `
  },

  Q05: {
    title: "Νέοι ιατροί (<35) με τις περισσότερες χειρουργικές επεμβάσεις",
    sqlFile: path.join(SQL_DIR, "Q05.sql"),
    params: [],
    executableSql: `
      SELECT
        s.first_name,
        s.last_name,
        s.age,
        COUNT(pr.id) AS Surgeries_Count
      FROM Doctors d
      JOIN Staff s ON d.staff_amka = s.amka
      JOIN Procedure_Records pr ON d.staff_amka = pr.main_surgeon_amk
      JOIN Medical_Procedure_Catalog mpc ON pr.procedure_code = mpc.code
      WHERE s.age < 35 AND mpc.category = 'Χειρουργική'
      GROUP BY d.staff_amka, s.first_name, s.last_name, s.age
      ORDER BY Surgeries_Count DESC
    `
  },

  Q06a: {
    title: "Ιστορικό νοσηλειών συγκεκριμένου ασθενή (+ μέσος όρος αξιολόγησης)",
    sqlFile: path.join(SQL_DIR, "Q06a.sql"),
    notes: "Επίλεξε πραγματικό ΑΜΚΑ ασθενή. Στο sql/Q6.sql υπάρχει η EXPLAIN ANALYZE έκδοση + FORCE INDEX.",
    params: [
      { name: "patientAmka", label: "ΑΜΚΑ Ασθενή", type: "text", defaultValue: "" }
    ],
    executableSql: `
      SELECT
        h.id AS Hospitalization_ID,
        h.admission_date,
        h.discharge_date,
        icd_adm.description AS Admission_Diagnosis,
        icd_dis.description AS Discharge_Diagnosis,
        h.total_cost,
        (eh.nursing_care + eh.cleanliness + eh.food + eh.overall_experience) / 4.0 AS Avg_Hospitalization_Rating
      FROM Hospitalization h
      LEFT JOIN ICD10_Catalog icd_adm ON h.admission_diagnosis_icd10 = icd_adm.code
      LEFT JOIN ICD10_Catalog icd_dis ON h.discharge_diagnosis_icd10 = icd_dis.code
      LEFT JOIN Evaluation_Hospitalization eh ON h.id = eh.hospitalization_id
      WHERE h.patient_amka = :patientAmka
      ORDER BY h.admission_date DESC
    `
  },

  Q06b: {
    title: "Ιστορικό νοσηλειών συγκεκριμένου ασθενή (+ μέσος όρος αξιολόγησης)",
    sqlFile: path.join(SQL_DIR, "Q06b.sql"),
    notes: "Επίλεξε πραγματικό ΑΜΚΑ ασθενή. Στο sql/Q6.sql υπάρχει η EXPLAIN ANALYZE έκδοση + FORCE INDEX.",
    params: [
      { name: "patientAmka", label: "ΑΜΚΑ Ασθενή", type: "text", defaultValue: "" }
    ],
    executableSql: `
      SELECT
        h.id AS Hospitalization_ID,
        h.admission_date,
        h.discharge_date,
        icd_adm.description AS Admission_Diagnosis,
        icd_dis.description AS Discharge_Diagnosis,
        h.total_cost,
        (eh.nursing_care + eh.cleanliness + eh.food + eh.overall_experience) / 4.0 AS Avg_Hospitalization_Rating
      FROM Hospitalization h
      LEFT JOIN ICD10_Catalog icd_adm ON h.admission_diagnosis_icd10 = icd_adm.code
      LEFT JOIN ICD10_Catalog icd_dis ON h.discharge_diagnosis_icd10 = icd_dis.code
      LEFT JOIN Evaluation_Hospitalization eh ON h.id = eh.hospitalization_id
      WHERE h.patient_amka = :patientAmka
      ORDER BY h.admission_date DESC
    `
  },

  Q07: {
    title: "Αλλεργίες ανά δραστική ουσία (#ασθενείς, #φάρμακα)",
    sqlFile: path.join(SQL_DIR, "Q07.sql"),
    params: [],
    executableSql: `
      SELECT
        a.name AS Active_Substance,
        COUNT(DISTINCT pa.patient_amka) AS Allergic_Patients_Count,
        COUNT(DISTINCT mhs.medicine_code) AS Medicines_Containing_Count
      FROM Active_Substances a
      LEFT JOIN Patient_Allergies pa ON a.id = pa.substance_id
      LEFT JOIN Medicine_has_Substances mhs ON a.id = mhs.substance_id
      GROUP BY a.id, a.name
      ORDER BY Allergic_Patients_Count DESC
      LIMIT 50
    `
  },

  Q08: {
    title: "Προσωπικό χωρίς εφημερία σε συγκεκριμένη ημερομηνία / τμήμα",
    sqlFile: path.join(SQL_DIR, "Q08.sql"),
    params: [
      { name: "shiftDate",      label: "Ημερομηνία",      type: "date", defaultValue: null },
      { name: "departmentName", label: "Όνομα Τμήματος", type: "text", defaultValue: "Καρδιολογία" }
    ],
    executableSql: `
      SELECT
        s.amka,
        s.first_name,
        s.last_name,
        s.staff_type
      FROM Staff s
      WHERE (
        EXISTS (
          SELECT 1 FROM Doctor_has_Department dhd
          WHERE dhd.doctor_amka = s.amka
            AND dhd.department_id = (SELECT id FROM Departments WHERE name = :departmentName LIMIT 1)
        )
        OR EXISTS (
          SELECT 1 FROM Nurses n
          WHERE n.staff_amka = s.amka
            AND n.department_id = (SELECT id FROM Departments WHERE name = :departmentName LIMIT 1)
        )
        OR EXISTS (
          SELECT 1 FROM Admin_Staff adm
          WHERE adm.staff_amka = s.amka
            AND adm.department_id = (SELECT id FROM Departments WHERE name = :departmentName LIMIT 1)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM Shift_Assignments sa
        JOIN Shifts sh ON sa.shift_id = sh.id
        WHERE sa.staff_amka = s.amka
          AND sh.shift_date = :shiftDate
          AND sa.department_id = (SELECT id FROM Departments WHERE name = :departmentName LIMIT 1)
      )
      ORDER BY s.staff_type, s.last_name
    `
  },

  Q09: {
    title: "Ασθενείς με ίδιο αριθμό ημερών νοσηλείας/έτος (>15 ημέρες)",
    sqlFile: path.join(SQL_DIR, "Q09.sql"),
    params: [],
    executableSql: `
      WITH PatientYearlyStays AS (
        SELECT
          patient_amka,
          YEAR(admission_date) AS Hosp_Year,
          SUM(DATEDIFF(discharge_date, admission_date)) AS Total_Days
        FROM Hospitalization
        WHERE discharge_date IS NOT NULL
        GROUP BY patient_amka, YEAR(admission_date)
        HAVING Total_Days > 15
      ),
      RankedStays AS (
        SELECT
          patient_amka,
          Hosp_Year,
          Total_Days,
          COUNT(*) OVER(PARTITION BY Hosp_Year, Total_Days) AS Patients_With_Same_Days
        FROM PatientYearlyStays
      )
      SELECT r.patient_amka, p.first_name, p.last_name, r.Hosp_Year, r.Total_Days
      FROM RankedStays r
      JOIN Patients p ON r.patient_amka = p.amka
      WHERE r.Patients_With_Same_Days > 1
      ORDER BY r.Hosp_Year DESC, r.Total_Days DESC
    `
  },

  Q10: {
    title: "Top-3 ζεύγη δραστικών ουσιών στην ίδια νοσηλεία",
    sqlFile: path.join(SQL_DIR, "Q10.sql"),
    params: [],
    executableSql: `
      WITH HospPrescriptions AS (
        SELECT DISTINCT h.id AS hosp_id, mhs.substance_id
        FROM Hospitalization h
        JOIN Prescriptions p ON h.patient_amka = p.patient_amka
          AND p.start_date >= DATE(h.admission_date)
          AND (h.discharge_date IS NULL OR p.start_date <= DATE(h.discharge_date))
        JOIN Medicine_has_Substances mhs ON p.medicine_code = mhs.medicine_code
      ),
      SubstancePairs AS (
        SELECT hp1.substance_id AS sub1, hp2.substance_id AS sub2
        FROM HospPrescriptions hp1
        JOIN HospPrescriptions hp2 ON hp1.hosp_id = hp2.hosp_id AND hp1.substance_id < hp2.substance_id
      )
      SELECT
        as1.name AS Substance_1,
        as2.name AS Substance_2,
        COUNT(*) AS Frequency
      FROM SubstancePairs sp
      JOIN Active_Substances as1 ON sp.sub1 = as1.id
      JOIN Active_Substances as2 ON sp.sub2 = as2.id
      GROUP BY sp.sub1, sp.sub2, as1.name, as2.name
      ORDER BY Frequency DESC
      LIMIT 3
    `
  },

  Q11: {
    title: "Ιατροί με ≥5 λιγότερες επεμβάσεις από τον top του έτους",
    sqlFile: path.join(SQL_DIR, "Q11.sql"),
    params: [],
    executableSql: `
      WITH DoctorSurgeries AS (
        SELECT main_surgeon_amk AS doctor_amka, COUNT(id) AS total_surgeries
        FROM Procedure_Records
        WHERE YEAR(start_time) = YEAR(CURDATE())
        GROUP BY main_surgeon_amk
      ),
      MaxSurgeries AS (
        SELECT MAX(total_surgeries) AS max_surg FROM DoctorSurgeries
      )
      SELECT
        s.first_name,
        s.last_name,
        COALESCE(ds.total_surgeries, 0) AS Surgeries_Performed
      FROM Doctors d
      JOIN Staff s ON d.staff_amka = s.amka
      LEFT JOIN DoctorSurgeries ds ON d.staff_amka = ds.doctor_amka
      CROSS JOIN MaxSurgeries ms
      WHERE COALESCE(ds.total_surgeries, 0) <= (ms.max_surg - 5)
      ORDER BY Surgeries_Performed DESC
    `
  },

  Q12: {
    title: "Απαιτούμενο προσωπικό ανά τμήμα/βάρδια εβδομάδας",
    sqlFile: path.join(SQL_DIR, "Q12.sql"),
    params: [
      { name: "referenceDate", label: "Ημερομηνία αναφοράς (εβδομάδα)", type: "date", defaultValue: null }
    ],
    executableSql: `
      SELECT
        d.name AS Department,
        sh.shift_date,
        sh.shift_type,
        st.staff_type AS Main_Profession,
        CASE st.staff_type
          WHEN 'Doctor' THEN doc.specialty
          WHEN 'Nurse'  THEN n.\`rank\`
          WHEN 'Admin'  THEN adm.role
          ELSE 'Άγνωστο'
        END AS Subclass_Role,
        COUNT(sa.staff_amka) AS Staff_Count
      FROM Shifts sh
      JOIN Shift_Assignments sa ON sh.id = sa.shift_id
      JOIN Departments d ON sa.department_id = d.id
      JOIN Staff st ON sa.staff_amka = st.amka
      LEFT JOIN Doctors doc ON st.amka = doc.staff_amka
      LEFT JOIN Nurses n ON st.amka = n.staff_amka
      LEFT JOIN Admin_Staff adm ON st.amka = adm.staff_amka
      WHERE WEEK(sh.shift_date) = WEEK(:referenceDate)
        AND YEAR(sh.shift_date) = YEAR(:referenceDate)
      GROUP BY
        d.name, sh.shift_date, sh.shift_type, st.staff_type,
        CASE st.staff_type
          WHEN 'Doctor' THEN doc.specialty
          WHEN 'Nurse'  THEN n.\`rank\`
          WHEN 'Admin'  THEN adm.role
          ELSE 'Άγνωστο'
        END
      ORDER BY sh.shift_date, sh.shift_type, d.name, Main_Profession
    `
  },

  Q13: {
    title: "Ιεραρχία εποπτείας κάθε ιατρού (Recursive CTE)",
    sqlFile: path.join(SQL_DIR, "Q13.sql"),
    params: [],
    executableSql: `
      WITH RECURSIVE SupervisionHierarchy AS (
        SELECT staff_amka AS doctor_amka, supervisor_amka, 1 AS supervision_level
        FROM Doctors
        WHERE supervisor_amka IS NOT NULL
        UNION ALL
        SELECT sh.doctor_amka, d.supervisor_amka, sh.supervision_level + 1
        FROM SupervisionHierarchy sh
        JOIN Doctors d ON sh.supervisor_amka = d.staff_amka
        WHERE d.supervisor_amka IS NOT NULL
      )
      SELECT
        s1.last_name AS Doctor_LastName,
        s2.last_name AS Supervisor_LastName,
        sh.supervision_level AS Hierarchy_Level
      FROM SupervisionHierarchy sh
      JOIN Staff s1 ON sh.doctor_amka = s1.amka
      JOIN Staff s2 ON sh.supervisor_amka = s2.amka
      ORDER BY s1.last_name, sh.supervision_level
    `
  },

  Q14: {
    title: "ICD-10 με ίδιο πλήθος εισαγωγών σε διαδοχικά έτη (≥5)",
    sqlFile: path.join(SQL_DIR, "Q14.sql"),
    params: [],
    executableSql: `
      WITH YearlyAdmissions AS (
        SELECT
          admission_diagnosis_icd10 AS icd_code,
          YEAR(admission_date) AS hosp_year,
          COUNT(*) AS total_cases
        FROM Hospitalization
        WHERE admission_diagnosis_icd10 IS NOT NULL
        GROUP BY admission_diagnosis_icd10, YEAR(admission_date)
        HAVING total_cases >= 5
      )
      SELECT
        y1.icd_code AS ICD10_Code,
        c.description AS Disease_Description,
        y1.hosp_year AS Year_1,
        y2.hosp_year AS Year_2,
        y1.total_cases AS Cases_Per_Year
      FROM YearlyAdmissions y1
      JOIN YearlyAdmissions y2 ON y1.icd_code = y2.icd_code AND y2.hosp_year = y1.hosp_year + 1
      JOIN ICD10_Catalog c ON y1.icd_code = c.code
      WHERE y1.total_cases = y2.total_cases
    `
  },

  Q15: {
    title: "Triage: κατανομή, μέσος χρόνος αναμονής, ποσοστό νοσηλείας",
    sqlFile: path.join(SQL_DIR, "Q15.sql"),
    params: [],
    executableSql: `
      WITH TriageMatched AS (
        SELECT
          t.id              AS triage_id,
          t.urgency_level,
          t.arrival_time,
          MIN(h.id)             AS hosp_id,
          MIN(h.admission_date) AS admission_date,
          MIN(h.department_id)  AS dept_id
        FROM Triage_Records t
        LEFT JOIN Hospitalization h
          ON  t.patient_amka   = h.patient_amka
          AND h.admission_date >= t.arrival_time
          AND h.admission_date  < DATE_ADD(t.arrival_time, INTERVAL 24 HOUR)
        GROUP BY t.id, t.urgency_level, t.arrival_time
      ),
      DeptNames AS (
        SELECT
          tm.urgency_level,
          tm.triage_id,
          tm.hosp_id,
          tm.arrival_time,
          tm.admission_date,
          d.name AS dept_name
        FROM TriageMatched tm
        LEFT JOIN Departments d ON tm.dept_id = d.id
      )
      SELECT
        urgency_level                                            AS Urgency_Level,
        COUNT(triage_id)                                         AS Total_Triage,
        SUM(hosp_id IS NOT NULL)                                 AS Admitted_Count,
        ROUND(SUM(hosp_id IS NOT NULL) / COUNT(triage_id) * 100, 1)
                                                                 AS Hospitalization_Rate_Pct,
        ROUND(AVG(
          CASE WHEN hosp_id IS NOT NULL
               THEN TIMESTAMPDIFF(MINUTE, arrival_time, admission_date)
          END
        ), 0)                                                    AS Avg_Wait_Min,
        GROUP_CONCAT(DISTINCT dept_name ORDER BY dept_name SEPARATOR ' | ')
                                                                 AS Referred_Departments
      FROM DeptNames
      GROUP BY urgency_level
      ORDER BY urgency_level
    `
  }
};

function listQueryDefinitions() {
  return Object.entries(queryLibrary).map(([id, q]) => ({
    id,
    title: q.title,
    params: q.params || [],
    notes: q.notes || null
  }));
}

function readRawSql(id) {
  const def = queryLibrary[id];
  if (!def) return null;
  try {
    return fs.readFileSync(def.sqlFile, "utf8");
  } catch (err) {
    return `-- Could not read ${def.sqlFile}\n-- ${err.message}`;
  }
}

module.exports = { queryLibrary, listQueryDefinitions, readRawSql };