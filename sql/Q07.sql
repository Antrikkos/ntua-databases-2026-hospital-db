-- ============================================================
-- Q7.sql  
-- ============================================================

SELECT 
    a.name AS Active_Substance,
    COUNT(DISTINCT pa.patient_amka) AS Allergic_Patients_Count,
    COUNT(DISTINCT mhs.medicine_code) AS Medicines_Containing_Count
FROM Active_Substances a
LEFT JOIN Patient_Allergies pa ON a.id = pa.substance_id
LEFT JOIN Medicine_has_Substances mhs ON a.id = mhs.substance_id
GROUP BY a.id, a.name
ORDER BY Allergic_Patients_Count DESC;
