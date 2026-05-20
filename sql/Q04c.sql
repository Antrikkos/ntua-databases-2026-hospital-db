-- ============================================================
-- Q4c.sql 
-- ============================================================

-- Εκδοχή Γ: Με IGNORE INDEX
EXPLAIN ANALYZE
SELECT 
    d.staff_amka,
    s.last_name,
    AVG(ed.medical_care) AS Avg_Medical_Care,
    AVG(eh.overall_experience) AS Avg_Overall_Experience
FROM Doctors d
JOIN Staff s ON d.staff_amka = s.amka
JOIN Evaluation_Doctor ed IGNORE INDEX (fk_ed_doctor_idx) ON d.staff_amka = ed.doctor_amka
JOIN Evaluation_Hospitalization eh ON ed.hospitalization_id = eh.hospitalization_id
WHERE d.staff_amka = '16257864602'
GROUP BY d.staff_amka, s.last_name;


