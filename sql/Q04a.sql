-- ============================================================
-- Q4.sql  
-- ============================================================

-- Εκδοχή Α: Κανονική εκτέλεση
EXPLAIN ANALYZE
SELECT 
    d.staff_amka,
    s.last_name,
    AVG(ed.medical_care) AS Avg_Medical_Care,
    AVG(eh.overall_experience) AS Avg_Overall_Experience
FROM Doctors d
JOIN Staff s ON d.staff_amka = s.amka
JOIN Evaluation_Doctor ed ON d.staff_amka = ed.doctor_amka
JOIN Evaluation_Hospitalization eh ON ed.hospitalization_id = eh.hospitalization_id
WHERE d.staff_amka = 'ΑΜΚΑ_ΙΑΤΡΟΥ'
GROUP BY d.staff_amka, s.last_name;


