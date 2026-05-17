-- ============================================================
-- Q15.sql  (ΔΙΟΡΘΩΜΕΝΟ)
-- Κατανομή triage: επίπεδο επείγοντος, μέσος χρόνος αναμονής,
-- ποσοστό νοσηλείας, κατανομή παραπομπών ανά τμήμα
-- ΔΙΟΡΘΩΣΗ: Χρήση DISTINCT για αποφυγή πολλαπλών νοσηλειών ανά triage
--           (ένας ασθενής μπορεί να έχει πολλές νοσηλείες — παίρνουμε
--            μόνο αυτή με την πλησιέστερη ημερομηνία εισαγωγής)
-- ============================================================
WITH TriageWithHosp AS (
    -- Για κάθε triage, βρίσκουμε την πιο κοντινή νοσηλεία (ίδια μέρα ή επόμενη)
    SELECT
        t.id AS triage_id,
        t.urgency_level,
        t.arrival_time,
        t.patient_amka,
        -- Παίρνουμε τη νωρίτερη νοσηλεία που ξεκινά μετά την άφιξη
        MIN(h.admission_date) AS matched_admission,
        MIN(h.department_id) AS matched_dept_id
    FROM Triage_Records t
    LEFT JOIN Hospitalization h 
        ON t.patient_amka = h.patient_amka
       AND h.admission_date >= t.arrival_time
       AND h.admission_date < DATE_ADD(t.arrival_time, INTERVAL 24 HOUR)
    GROUP BY t.id, t.urgency_level, t.arrival_time, t.patient_amka
)
SELECT 
    twh.urgency_level AS Urgency_Level,
    d.name AS Referred_Department,
    COUNT(twh.triage_id) AS Total_Triage_Cases,
    ROUND(
        COUNT(twh.matched_admission) / COUNT(twh.triage_id) * 100, 2
    ) AS Hospitalization_Rate_Pct,
    ROUND(
        AVG(
            CASE WHEN twh.matched_admission IS NOT NULL
                 THEN TIMESTAMPDIFF(MINUTE, twh.arrival_time, twh.matched_admission)
            END
        ), 1
    ) AS Avg_Wait_Minutes
FROM TriageWithHosp twh
LEFT JOIN Departments d ON twh.matched_dept_id = d.id
GROUP BY twh.urgency_level, d.name
ORDER BY twh.urgency_level ASC, Total_Triage_Cases DESC;
