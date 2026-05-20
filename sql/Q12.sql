-- ============================================================
-- Q12.sql  
-- ============================================================

SELECT
    d.name AS Department,
    sh.shift_date,
    sh.shift_type,
    st.staff_type AS Main_Profession,
    CASE st.staff_type
        WHEN 'Doctor' THEN doc.specialty
        WHEN 'Nurse'  THEN n.`rank`
        WHEN 'Admin'  THEN adm.role
        ELSE 'Άγνωστο'
    END AS Subclass_Role,
    COUNT(sa.staff_amka) AS Staff_Count
FROM Shifts sh
JOIN Shift_Assignments sa ON sh.id = sa.shift_id
JOIN Departments d ON sa.department_id = d.id
JOIN Staff st ON sa.staff_amka = st.amka
LEFT JOIN Doctors doc ON st.amka = doc.staff_amka
LEFT JOIN Nurses n ON st.amka = n.staff_amka
LEFT JOIN Admin_Staff adm ON st.amka = adm.staff_amka
WHERE WEEK(sh.shift_date) = WEEK('2026-05-10')
  AND YEAR(sh.shift_date) = 2026
GROUP BY
    d.name,
    sh.shift_date,
    sh.shift_type,
    st.staff_type,
    CASE st.staff_type
        WHEN 'Doctor' THEN doc.specialty
        WHEN 'Nurse'  THEN n.`rank`
        WHEN 'Admin'  THEN adm.role
        ELSE 'Άγνωστο'
    END
ORDER BY
    sh.shift_date,
    sh.shift_type,
    d.name,
    Main_Profession;
