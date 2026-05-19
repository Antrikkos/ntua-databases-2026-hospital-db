-- ============================================================
-- Q6.sql  (ΔΙΟΡΘΩΜΕΝΟ)
-- ΔΙΟΡΘΩΣΗ: FORCE INDEX όνομα fk_hospitalization_patient_idx
--           (αυτό υπάρχει στο install.sql — το idx_hosp_patient_amka δεν υπάρχει)
-- ΣΗΜΕΙΩΣΗ: Αντικατέστησε το ΑΜΚΑ με πραγματικό από τη ΒΔ σου
-- ============================================================

-- Εκδοχή Α: Κανονική εκτέλεση
EXPLAIN ANALYZE
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
WHERE h.patient_amka = '80589489579';


