-- ============================================================
-- Q5.sql  (ΔΕΝ ΑΛΛΑΞΕ — ήταν σωστό)
-- Νέοι ιατροί (ηλικία < 35) ταξινομημένοι κατά χειρουργικές επεμβάσεις
-- ============================================================
SELECT 
    s.first_name, 
    s.last_name, 
    s.age, 
    COUNT(pr.id) AS Surgeries_Count
FROM Doctors d
JOIN Staff s ON d.staff_amka = s.amka
JOIN Procedure_Records pr ON d.staff_amka = pr.main_surgeon_amk
JOIN Medical_Procedure_Catalog mpc ON pr.procedure_code = mpc.code
WHERE s.age < 35 
  AND mpc.category = 'Χειρουργική'
GROUP BY 
    d.staff_amka, 
    s.first_name, 
    s.last_name, 
    s.age
ORDER BY Surgeries_Count DESC;
