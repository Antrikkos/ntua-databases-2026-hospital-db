-- ============================================================
-- Q10.sql  
-- ============================================================

WITH HospPrescriptions AS (
    SELECT DISTINCT
        h.id AS hosp_id,
        mhs.substance_id
    FROM Hospitalization h
    JOIN Prescriptions p ON h.patient_amka = p.patient_amka
        AND p.start_date >= DATE(h.admission_date)
        AND (h.discharge_date IS NULL OR p.start_date <= DATE(h.discharge_date))
    JOIN Medicine_has_Substances mhs ON p.medicine_code = mhs.medicine_code
),
SubstancePairs AS (
    SELECT
        hp1.substance_id AS sub1,
        hp2.substance_id AS sub2
    FROM HospPrescriptions hp1
    JOIN HospPrescriptions hp2 ON hp1.hosp_id = hp2.hosp_id
        AND hp1.substance_id < hp2.substance_id
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
LIMIT 3;
