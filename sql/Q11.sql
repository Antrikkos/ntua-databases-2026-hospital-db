-- ============================================================
-- Q11.sql  (ΔΕΝ ΑΛΛΑΞΕ — ήταν σωστό)
-- Ιατροί με τουλάχιστον 5 λιγότερες επεμβάσεις από τον top του τρέχοντος έτους
-- ============================================================
WITH DoctorSurgeries AS (
    SELECT
        main_surgeon_amk AS doctor_amka,
        COUNT(id) AS total_surgeries
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
ORDER BY Surgeries_Performed DESC;
