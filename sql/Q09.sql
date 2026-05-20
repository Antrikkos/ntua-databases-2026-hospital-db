-- ============================================================
-- Q9.sql  
-- ============================================================

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
SELECT 
    r.patient_amka,
    p.first_name,
    p.last_name,
    r.Hosp_Year,
    r.Total_Days
FROM RankedStays r
JOIN Patients p ON r.patient_amka = p.amka
WHERE r.Patients_With_Same_Days > 1
ORDER BY r.Hosp_Year DESC, r.Total_Days DESC;
