-- ============================================================
-- Q15a.sql
-- ============================================================

-- ── ΜΕΡΟΣ Α: Σύνολο ανά urgency level (5 γραμμές) ──────────────────────────
WITH TriageMatched AS (
    SELECT
        t.id              AS triage_id,
        t.urgency_level,
        t.arrival_time,
        MIN(h.id)             AS hosp_id,
        MIN(h.admission_date) AS admission_date,
        MIN(h.department_id)  AS dept_id
    FROM Triage_Records t
    LEFT JOIN Hospitalization h
        ON  t.patient_amka   = h.patient_amka
        AND h.admission_date >= t.arrival_time
        AND h.admission_date  < DATE_ADD(t.arrival_time, INTERVAL 24 HOUR)
    GROUP BY t.id, t.urgency_level, t.arrival_time
),
DeptNames AS (
    -- Συγκεντρώνουμε τα τμήματα ΠΡΙ το GROUP BY ώστε το GROUP_CONCAT
    -- να μην επηρεάζει το grouping
    SELECT
        tm.urgency_level,
        tm.triage_id,
        tm.hosp_id,
        tm.arrival_time,
        tm.admission_date,
        d.name AS dept_name
    FROM TriageMatched tm
    LEFT JOIN Departments d ON tm.dept_id = d.id
)
SELECT
    urgency_level                                           AS Urgency_Level,
    COUNT(triage_id)                                        AS Total_Triage,
    SUM(hosp_id IS NOT NULL)                                AS Admitted_Count,
    ROUND(SUM(hosp_id IS NOT NULL) / COUNT(triage_id) * 100, 1)
                                                            AS Hospitalization_Rate_Pct,
    ROUND(AVG(
        CASE WHEN hosp_id IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, arrival_time, admission_date)
        END
    ), 0)                                                   AS Avg_Wait_Min,
    GROUP_CONCAT(DISTINCT dept_name ORDER BY dept_name SEPARATOR ' | ')
                                                            AS Referred_Departments
FROM DeptNames
GROUP BY urgency_level
ORDER BY urgency_level;

