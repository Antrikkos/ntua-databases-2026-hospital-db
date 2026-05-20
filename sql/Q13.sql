-- ============================================================
-- Q13.sql  
-- ============================================================

WITH RECURSIVE SupervisionHierarchy AS (
    SELECT 
        staff_amka AS doctor_amka, 
        supervisor_amka, 
        1 AS supervision_level
    FROM Doctors
    WHERE supervisor_amka IS NOT NULL
    
    UNION ALL
    
    SELECT 
        sh.doctor_amka, 
        d.supervisor_amka, 
        sh.supervision_level + 1
    FROM SupervisionHierarchy sh
    JOIN Doctors d ON sh.supervisor_amka = d.staff_amka
    WHERE d.supervisor_amka IS NOT NULL
)
SELECT 
    s1.last_name AS Doctor_LastName,
    s2.last_name AS Supervisor_LastName,
    sh.supervision_level AS Hierarchy_Level
FROM SupervisionHierarchy sh
JOIN Staff s1 ON sh.doctor_amka = s1.amka
JOIN Staff s2 ON sh.supervisor_amka = s2.amka
ORDER BY s1.last_name, sh.supervision_level;
