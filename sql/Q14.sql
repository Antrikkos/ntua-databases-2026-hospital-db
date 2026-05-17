-- ============================================================
-- Q14.sql  (ΔΕΝ ΑΛΛΑΞΕ — ήταν σωστό)
-- ICD-10 κατηγορίες με ίδιο αριθμό εισαγωγών σε δύο συνεχόμενα έτη (≥5)
-- ============================================================
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
JOIN YearlyAdmissions y2 
    ON y1.icd_code = y2.icd_code 
   AND y2.hosp_year = y1.hosp_year + 1
JOIN ICD10_Catalog c ON y1.icd_code = c.code
WHERE y1.total_cases = y2.total_cases;
