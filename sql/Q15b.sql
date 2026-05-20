-- ============================================================
-- Q15b.sql
-- ============================================================

-- ── ΜΕΡΟΣ Β: Αναλυτικά ανά urgency + τμήμα παραπομπής ──────────────────────
WITH TriageMatched AS (
    SELECT
        t.id, t.urgency_level, t.arrival_time,
        MIN(h.admission_date) AS admission_date,
        MIN(h.department_id)  AS dept_id
    FROM Triage_Records t
    LEFT JOIN Hospitalization h
        ON  t.patient_amka   = h.patient_amka
        AND h.admission_date >= t.arrival_time
        AND h.admission_date  < DATE_ADD(t.arrival_time, INTERVAL 24 HOUR)
    GROUP BY t.id, t.urgency_level, t.arrival_time
)
SELECT
    tm.urgency_level                                        AS Urgency_Level,
    COALESCE(d.name, '— Αποχώρησε —')                     AS Referred_Department,
    COUNT(*)                                                AS Cases,
    ROUND(AVG(
        CASE WHEN tm.dept_id IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, tm.arrival_time, tm.admission_date)
        END
    ), 0)                                                   AS Avg_Wait_Min
FROM TriageMatched tm
LEFT JOIN Departments d ON tm.dept_id = d.id
GROUP BY tm.urgency_level, d.name
ORDER BY tm.urgency_level, Cases DESC;
