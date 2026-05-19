-- ============================================================
-- Q2.sql  (ΔΕΝ ΑΛΛΑΞΕ — ήταν σωστό)
-- Ιατροί συγκεκριμένης ειδικότητας με ένδειξη εφημερίας τρέχοντος έτους
-- και αριθμό επεμβάσεων ως κύριοι χειρουργοί
-- ============================================================
SELECT 
    s.first_name, 
    s.last_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM Shift_Assignments sa 
            JOIN Shifts sh ON sa.shift_id = sh.id 
            WHERE sa.staff_amka = d.staff_amka
              AND YEAR(sh.shift_date) = YEAR(CURDATE())
        ) THEN 'Ναι' 
        ELSE 'Όχι' 
    END AS Had_Shift_Current_Year,
    COUNT(pr.id) AS Lead_Surgeries_Performed
FROM Doctors d
JOIN Staff s ON d.staff_amka = s.amka
LEFT JOIN Procedure_Records pr ON d.staff_amka = pr.main_surgeon_amk
WHERE d.specialty = 'Καρδιολογία'
GROUP BY 
    d.staff_amka,
    s.first_name,
    s.last_name
Order by Lead_Surgeries_Performed DESC;