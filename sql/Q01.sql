-- ============================================================
-- Q1.sql  (ΔΙΟΡΘΩΜΕΝΟ)
-- Συνολικά έσοδα ανά τμήμα, έτος, ΚΕΝ κωδικό και ασφαλιστικό φορέα
-- ΔΙΟΡΘΩΣΗ: GREATEST(0,...) αποτρέπει αρνητική extra_revenue
-- ============================================================
SELECT 
    d.name AS Department,
    YEAR(h.admission_date) AS Admission_Year,
    h.ken_code AS KEN_Code,
    SUM(k.basic_cost) AS Total_Base_Revenue,
    SUM(GREATEST(0, h.total_cost - k.basic_cost)) AS Total_Extra_Revenue,
    p.insurance_provider AS Insurance_Provider,
    COUNT(h.id) AS Total_Hospitalizations
FROM Hospitalization h
JOIN Departments d ON h.department_id = d.id
JOIN KEN_Catalog k ON h.ken_code = k.code
JOIN Patients p ON h.patient_amka = p.amka
GROUP BY 
    d.name,
    YEAR(h.admission_date),
    h.ken_code,
    p.insurance_provider
ORDER BY Admission_YEAR ASC, Department ASC, KEN_code ASC;
