-- ============================================================
-- Q8.sql  
-- ============================================================

SELECT 
    s.amka, 
    s.first_name, 
    s.last_name, 
    s.staff_type
FROM Staff s
-- Κρατάμε μόνο staff που ανήκει στο συγκεκριμένο τμήμα
WHERE (
    -- Γιατροί: μέσω Doctor_has_Department
    EXISTS (
        SELECT 1 FROM Doctor_has_Department dhd
        WHERE dhd.doctor_amka = s.amka
          AND dhd.department_id = (SELECT id FROM Departments WHERE name = 'Καρδιολογία' LIMIT 1)
    )
    OR
    -- Νοσηλευτές: απευθείας department_id
    EXISTS (
        SELECT 1 FROM Nurses n
        WHERE n.staff_amka = s.amka
          AND n.department_id = (SELECT id FROM Departments WHERE name = 'Καρδιολογία' LIMIT 1)
    )
    OR
    -- Διοικητικοί: απευθείας department_id
    EXISTS (
        SELECT 1 FROM Admin_Staff adm
        WHERE adm.staff_amka = s.amka
          AND adm.department_id = (SELECT id FROM Departments WHERE name = 'Καρδιολογία' LIMIT 1)
    )
)
-- ΔΕΝ έχει εφημερία εκείνη την ημέρα στο συγκεκριμένο τμήμα
AND NOT EXISTS (
    SELECT 1
    FROM Shift_Assignments sa
    JOIN Shifts sh ON sa.shift_id = sh.id
    WHERE sa.staff_amka = s.amka
      AND sh.shift_date = '2026-05-10'
      AND sa.department_id = (SELECT id FROM Departments WHERE name = 'Καρδιολογία' LIMIT 1)
);
