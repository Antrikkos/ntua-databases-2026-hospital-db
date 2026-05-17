-- ============================================================
-- Q3.sql  (ΔΕΝ ΑΛΛΑΞΕ — ήταν σωστό)
-- Ασθενείς με >3 νοσηλείες στο ίδιο τμήμα και συνολικό κόστος
-- ============================================================
SELECT 
    p.first_name, 
    p.last_name, 
    d.name AS Department, 
    COUNT(h.id) AS Hospitalization_Count, 
    SUM(h.total_cost) AS Total_Accumulated_Cost
FROM Hospitalization h
JOIN Patients p ON h.patient_amka = p.amka
JOIN Departments d ON h.department_id = d.id
GROUP BY 
    h.patient_amka, 
    h.department_id,
    p.first_name,
    p.last_name,
    d.name
HAVING COUNT(h.id) > 3;
