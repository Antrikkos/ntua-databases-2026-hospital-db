-- ============================================================
-- Q3.sql  
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
HAVING Hospitalization_Count > 3
order by Hospitalization_Count desc;
