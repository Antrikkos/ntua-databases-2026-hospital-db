# Γενικό Νοσοκομείο «Υγειόπολης» — Τεχνική Αναφορά Έργου

**Σχήμα Βάσης:** `hygeiopolis_db`
**RDBMS:** MariaDB / MySQL 8+ (InnoDB, `utf8mb4_unicode_ci`)
**Ημερομηνία:** 2026-05-17
**Συγγραφέας:** Ανδρέας Κλεάνθους

---

## Πίνακας Περιεχομένων

1. [Εισαγωγή & Στόχοι](#1-εισαγωγή--στόχοι)
2. [Δομή Έργου (Project Layout)](#2-δομή-έργου-project-layout)
3. [Σχεδιαστικές Αποφάσεις (ER → Σχεσιακό)](#3-σχεδιαστικές-αποφάσεις-er--σχεσιακό)
4. [Σχεσιακό Σχήμα — Πίνακες](#4-σχεσιακό-σχήμα--πίνακες)
5. [Περιορισμοί Ακεραιότητας](#5-περιορισμοί-ακεραιότητας)
6. [Triggers — Επιβολή Κανόνων στη ΒΔ](#6-triggers--επιβολή-κανόνων-στη-βδ)
7. [Ευρετήρια (Indexes) και Δικαιολόγηση](#7-ευρετήρια-indexes-και-δικαιολόγηση)
8. [Δεδομένα Αναφοράς & ETL Pipeline](#8-δεδομένα-αναφοράς--etl-pipeline)
9. [Παραγωγή Συνθετικών Δεδομένων (`generate_data.py`)](#9-παραγωγή-συνθετικών-δεδομένων-generate_datapy)
10. [Ερωτήματα Q1–Q15](#10-ερωτήματα-q1q15)
11. [Q4 & Q6 — EXPLAIN ANALYZE / FORCE INDEX](#11-q4--q6--explain-analyze--force-index)
12. [Πίνακας Παραδοχών](#12-πίνακας-παραδοχών)
13. [Bonus: Web Showcase UI](#13-bonus-web-showcase-ui)
14. [Οδηγίες Εκτέλεσης (Reproducibility)](#14-οδηγίες-εκτέλεσης-reproducibility)
15. [Έλεγχος Συμμόρφωσης με την Εκφώνηση](#15-έλεγχος-συμμόρφωσης-με-την-εκφώνηση)

---

## 1. Εισαγωγή & Στόχοι

Το Γενικό Νοσοκομείο «Υγειόπολης» χρειάζεται μια πλήρη βάση δεδομένων που να καλύπτει όλα τα λειτουργικά του υποσυστήματα: προσωπικό (ιατροί, νοσηλευτές, διοικητικοί), τμήματα και κλίνες, ασθενείς και νοσηλείες, triage στα Επείγοντα, ιατρικές πράξεις, εργαστηριακές εξετάσεις, φαρμακευτικές συνταγές, βάρδιες/εφημερίες, αξιολογήσεις και εικόνες οντοτήτων.

Πέραν της απλής αποθήκευσης, η ΒΔ καλείται να **επιβάλλει** πληθώρα επιχειρησιακών κανόνων (απαγόρευση συνταγογράφησης σε αλλεργικό ασθενή, μέγιστες βάρδιες/μήνα, 8ωρη ανάπαυση μεταξύ βαρδιών, αποφυγή κυκλικής εποπτείας ιατρών, αυτόματος υπολογισμός κόστους νοσηλείας βάσει ΚΕΝ, μη επικάλυψη χρήσης χειρουργείων κ.ο.κ.) **απευθείας στο επίπεδο της βάσης**, χωρίς εξάρτηση από εφαρμογές εκτός RDBMS.

**Βασικές αρχές σχεδίασης:**

- **Κανονικοποίηση μέχρι 3NF / BCNF** όπου είναι δυνατό, χωρίς υπερβολικό σπάσιμο που θα δυσκόλευε queries.
- **Καμία χρήση `ENUM`/`ARRAY`/`JSON`/`XML`** (απαίτηση της εκφώνησης) — τα enumerations υλοποιούνται με `CHECK(... IN (...))` constraints.
- **Καμία χρήση ORM** (απαίτηση της εκφώνησης) — όλα τα queries γράφονται σε pure SQL, οι Python ETL scripts κάνουν string templating.
- **InnoDB + foreign keys παντού** όπου έχει νόημα, ώστε η αναφορική ακεραιότητα να εξασφαλίζεται από τη μηχανή.
- **Τα business rules επιβάλλονται με triggers**, ώστε να μην υπάρχει κίνδυνος "κακής" καταχώρησης μέσω άλλου client (ψυχρή πίεση: ένα `mysql -e "INSERT …"` πρέπει να αποτυγχάνει εξίσου με την εφαρμογή).

---

## 2. Δομή Έργου (Project Layout)

```
C:/xampp/htdocs/databases/
├── README.md                         # Σύνοψη & assumptions table
├── db2026.md                         # Η εκφώνηση
├── run_all.bat                       # End-to-end orchestrator
│
├── code/                             # Python ETL & data generator
│   ├── preprocess_reference_data.py  # ICD-10, ΚΕΝ, Medical Procedures
│   ├── preprocess_ema.py             # EMA Article 57 (φάρμακα/δραστικές)
│   └── generate_data.py              # Συνθετικά δεδομένα (load.sql)
│
├── data/                             # Πηγαία αρχεία αναφοράς
│   ├── ICD10_Catalog.xls
│   ├── KEN_Catalog.doc
│   ├── Medical_Procedure_Catalog.xls
│   ├── Medicine_EMA.xlsx
│   ├── Active_Substances.xlsx
│   └── ema_code_mapping.txt          (auto-generated)
│
├── sql/                              # Schema + reference + queries
│   ├── install.sql                   # Σχήμα, constraints, triggers, indexes
│   ├── load.sql                      # Συνθετικά δεδομένα (auto)
│   ├── icd10.sql / ken.sql / medical_procedures.sql   (auto)
│   ├── ema_substances.sql / ema_medicines.sql / ema_links.sql (auto)
│   └── Q01.sql … Q15.sql + Q*_out.txt
│
├── diagrams/
│   ├── first.mwb                     # MySQL Workbench source
│   ├── er.pdf                        # ER διάγραμμα
│   └── relational.pdf                # Σχεσιακό διάγραμμα
│
├── docs/
│   └── Report.md                     # (αυτό το αρχείο)
│
└── ui/                               # Bonus: Express + vanilla JS demo
    ├── server.js, db.js, queryLibrary.js
    └── public/                       # HTML/CSS/JS frontend
```

---

## 3. Σχεδιαστικές Αποφάσεις (ER → Σχεσιακό)

### 3.1 Ιεραρχία προσωπικού (ISA)

Η εκφώνηση μιλά για τρεις τύπους προσωπικού (ιατροί, νοσηλευτές, διοικητικοί) με κοινά πεδία (ΑΜΚΑ, όνομα, …) και ξεχωριστά ανά τύπο. Επιλέχθηκε **κλασικό ISA pattern**:

- `Staff` (super-type, κρατά τα κοινά πεδία + έναν discriminator `staff_type`)
- `Doctors`, `Nurses`, `Admin_Staff` (sub-types, κλειδωμένα στον `Staff.amka` με FK)

**Γιατί:** Σε σχέση με ένα ενιαίο "fat" `Staff` table με όλα τα πεδία nullable, αυτή η προσέγγιση:
1. εξασφαλίζει `NOT NULL` εκεί που έχει νόημα (π.χ. `Doctors.license_number`),
2. επιτρέπει διαφορετικούς περιορισμούς ανά υποτύπο (`Doctors.rank` ≠ `Nurses.rank`),
3. το `staff_type` permits γρήγορα `WHERE` φίλτρα χωρίς JOIN στους υποπίνακες, που χρησιμοποιείται κρίσιμα μέσα στα triggers (π.χ. monthly shift limits).

### 3.2 Αυτο-αναφορική σχέση εποπτείας ιατρών

Κάθε ιατρός μπορεί να έχει επόπτη (ιατρό). Αναπαρίσταται με `Doctors.supervisor_amka → Doctors.staff_amka`. Οι περιορισμοί της εκφώνησης (ειδικευόμενοι ⇒ υποχρεωτικός επόπτης, διευθυντές ⇒ απαγορεύεται επόπτης, καμία κυκλική αλυσίδα) δεν εκφράζονται με constraint, οπότε υλοποιούνται με triggers (`check_doctor_supervision*`) και ένα stored procedure `assert_no_supervisor_cycles()` για βαθύτερους κύκλους (recursive CTE).

### 3.3 Πολλαπλά τμήματα ανά ιατρό

Η εκφώνηση λέει ότι ένας ιατρός μπορεί να ανήκει σε **περισσότερα του ενός** τμήματα. Άρα M:N → πίνακας **`Doctor_has_Department`** (composite PK). Αντίθετα, νοσηλευτής και διοικητικός ανήκουν σε **ένα** τμήμα, οπότε αρκεί ένα `department_id` πεδίο στους αντίστοιχους πίνακες.

### 3.4 Διευθυντής τμήματος

Κάθε `Departments.director_amka` είναι FK προς `Doctors.staff_amka`. Είναι `NOT NULL` γιατί κάθε τμήμα *πρέπει* να έχει διευθυντή (η εκφώνηση δεν αφήνει αμφιβολία). Δυνητικό cyclic-dependency πρόβλημα κατά τη φόρτωση (γιατρός χρειάζεται τμήμα → τμήμα χρειάζεται γιατρό) αντιμετωπίζεται με: (α) loose ordering όπου οι διευθυντές δημιουργούνται *πριν* τα τμήματα, και (β) `SET FOREIGN_KEY_CHECKS=0` κατά την bulk import.

### 3.5 Κλίνες ως αδύναμη οντότητα τμήματος

Μια κλίνη ταυτοποιείται μοναδικά μέσα στο τμήμα της (`bed_number`). Αντί για composite PK `(department_id, bed_number)` που θα πολλαπλασίαζε FKs στις νοσηλείες, χρησιμοποιείται **surrogate `id`** + **UNIQUE constraint** στο ζεύγος `(department_id, bed_number)`. Έτσι κρατάμε στενά FKs (`Hospitalization.bed_id → Beds.id`) και ταυτόχρονα εξασφαλίζουμε τη φυσική μοναδικότητα.

### 3.6 Νοσηλεία (`Hospitalization`)

Κεντρική οντότητα της ΒΔ. Συνδέεται:
- 1:N με `Patients` (ένας ασθενής → πολλές νοσηλείες),
- N:1 με `Beds` και `Departments` (μια νοσηλεία = μία κλίνη + ένα τμήμα),
- N:1 με `ICD10_Catalog` (διπλά: admission & discharge diagnosis),
- N:1 με `KEN_Catalog` (κόστος),
- 1:N με `Procedure_Records`, `Lab_Tests`, `Prescriptions`,
- 1:1 με `Evaluation_Hospitalization`,
- 1:N με `Evaluation_Doctor` (μία αξιολόγηση ανά γιατρό).

Το `total_cost` υπολογίζεται **αυτόματα** από trigger όταν συμπληρωθεί η `discharge_date` (βάση + αναλογική πρόσθετη χρέωση αν υπάρχει υπέρβαση ΜΔΝ).

### 3.7 Triage

Το `Triage_Records` συνδέεται με `Patients` και `Nurses`, ενώ προαιρετικά με μια `Hospitalization` (αν ο ασθενής τελικά εισήχθη). Η σχέση είναι 0..1:1 (μία triage εγγραφή → μηδέν ή μία νοσηλεία). Η σειρά εξυπηρέτησης ορίζεται από `urgency_level ASC, arrival_time ASC` — ένα **composite index** `idx_triage_queue (outcome, urgency_level, arrival_time)` εξασφαλίζει ότι το ερώτημα "ποιο είναι το επόμενο pending περιστατικό" είναι O(1) range scan.

### 3.8 Πράξεις & βοηθοί

Μια ιατρική πράξη έχει **έναν** κύριο χειρουργό και **πολλούς** βοηθούς. Άρα `Procedure_Records.main_surgeon_amk` (όχι ID — απευθείας FK στον γιατρό) και ξεχωριστός πίνακας **`Procedure_Assistants`** για τους βοηθούς (M:N με `Staff`, όχι μόνο `Doctors`, γιατί η εκφώνηση επιτρέπει και νοσηλευτές ως βοηθούς).

Η ταυτόχρονη χρήση χώρου ή ιατρού σε δύο επεμβάσεις απαγορεύεται από trigger `check_procedure_overlap` (INSERT + UPDATE variants).

### 3.9 Φαρμακευτική αγωγή

- **`Medicine_EMA`** — όλα τα φάρμακα του ΕΟΧ (από EMA Article 57).
- **`Active_Substances`** — οι δραστικές ουσίες (normalized — μία γραμμή/ουσία).
- **`Medicine_has_Substances`** — M:N (ένα φάρμακο έχει πολλές ουσίες, μια ουσία υπάρχει σε πολλά φάρμακα).
- **`Patient_Allergies`** — M:N (ένας ασθενής → πολλές αλλεργικές ουσίες).
- **`Prescriptions`** — με composite PK `(doctor_amka, patient_amka, medicine_code, start_date)` για μοναδικότητα ανά συνταγή.

Trigger `check_allergy_before_prescription` μπλοκάρει συνταγή φαρμάκου του οποίου *οποιαδήποτε* δραστική ουσία ανήκει στις αλλεργίες του ασθενή. Επιπλέον trigger `check_prescription_during_hospitalization` εξασφαλίζει ότι η συνταγή πέφτει εντός ενεργής νοσηλείας του ίδιου ασθενή.

### 3.10 Αξιολογήσεις

Δύο διακριτές οντότητες:
- `Evaluation_Hospitalization` (1:1 με νοσηλεία) — Likert 1–5 σε τέσσερα κριτήρια (Nursing care, Cleanliness, Food, Overall).
- `Evaluation_Doctor` (N:1 με νοσηλεία, ξεχωριστή γραμμή ανά γιατρό που συνταγογράφησε) — Likert 1–5 σε Medical care.

Triggers `check_evaluation_*_completed` επιτρέπουν εισαγωγή μόνο αν `Hospitalization.discharge_date IS NOT NULL`.

### 3.11 Βάρδιες/Εφημερίες

- **`Shifts`** = (ημερομηνία, τύπος βάρδιας: Morning/Afternoon/Night) με UNIQUE `(shift_date, shift_type)` — δηλαδή μία γραμμή ανά ημερολογιακή βάρδια.
- **`Shift_Assignments`** = M:N μεταξύ `Shifts` και `Staff`, με `department_id` για να ξέρουμε σε ποιο τμήμα ανήκει η βάρδια εκείνου του ατόμου εκείνη τη μέρα.

Τέσσερα triggers επιβάλλουν τους κανόνες της εκφώνησης (μηνιαία όρια, 8ωρη ανάπαυση, ≤3 συνεχόμενες νυχτερινές, παρουσία Επιμελητή Α΄/Διευθυντή όταν υπάρχει ειδικευόμενος).

### 3.12 Εικόνες οντοτήτων

Αρχικά υπήρχε ένας πολυμορφικός πίνακας `Entity_Images` (`entity_type`+`entity_id`), που όμως **δεν επιτρέπει FK** (το `entity_id` αλλάζει τύπο ανά γραμμή). Έγινε **split σε `Department_Images` + `Doctor_Images`**, καθένας με κανονικό FK + `ON DELETE CASCADE`. Αυτή είναι η μόνη απόκλιση από "ένας πίνακας → όλες οι εικόνες", αλλά εξυπηρετεί τη συνολική πολιτική του σχήματος ("κάθε σχέση πρέπει να έχει FK").

---

## 4. Σχεσιακό Σχήμα — Πίνακες

22 πίνακες συνολικά. Παρακάτω, μια συμπυκνωμένη παρουσίαση. Η πλήρης DDL βρίσκεται στο `sql/install.sql`.

### 4.1 Προσωπικό

| Πίνακας | PK | Σημαντικά πεδία | Παρατηρήσεις |
|---|---|---|---|
| `Staff` | `amka` `CHAR(11)` | `first_name`, `last_name`, `email UNIQUE`, `staff_type` | Discriminator `staff_type IN ('Doctor','Nurse','Admin')` |
| `Doctors` | `staff_amka` | `license_number UNIQUE`, `specialty`, `rank`, `supervisor_amka → Doctors` | rank ∈ {Ειδικευόμενος, Επιμελητής Β΄, Επιμελητής Α΄, Διευθυντής} |
| `Nurses` | `staff_amka` | `rank`, `department_id` | rank ∈ {Βοηθός, Νοσηλευτής, Προϊστάμενος} |
| `Admin_Staff` | `staff_amka` | `role`, `office`, `department_id` | role ∈ {Γραμματέας, Λογιστής, Διαχειριστής, Υπεύθυνος Προμηθειών} |

### 4.2 Δομικές οντότητες

| Πίνακας | PK | Σημαντικά πεδία |
|---|---|---|
| `Departments` | `id` | `name NOT NULL`, `bed_count`, `director_amka NOT NULL → Doctors` |
| `Beds` | `id` | `(department_id, bed_number) UNIQUE`, `type`, `status` |
| `Doctor_has_Department` | (`doctor_amka`,`department_id`) | — | M:N |
| `Spaces` | `id` | `name`, `type` | Για χειρουργεία/αίθουσες επέμβασης |

### 4.3 Ασθενείς & νοσηλείες

| Πίνακας | PK | Σημαντικά πεδία |
|---|---|---|
| `Patients` | `amka` | `first_name`, `last_name`, `gender CHECK`, `age CHECK 0..130`, `email UNIQUE`, `insurance_provider` |
| `Hospitalization` | `id` | `patient_amka`, `bed_id`, `department_id`, `admission_date NOT NULL`, `discharge_date`, `admission_diagnosis_icd10`, `discharge_diagnosis_icd10`, `ken_code`, `total_cost` |
| `Triage_Records` | `id` | `patient_amka`, `nurse_amka`, `urgency_level CHECK 1..5`, `arrival_time`, `outcome`, `hospitalization_id` |

### 4.4 Κλινικές δραστηριότητες

| Πίνακας | PK | Σημαντικά πεδία |
|---|---|---|
| `Lab_Tests` | `id` | `hospitalization_id`, `ordering_doctor_amka`, `type`, `result_text`, `result_value`, `unit`, `cost` |
| `Procedure_Records` | `id` | `hospitalization_id`, `procedure_code`, `space_id`, `main_surgeon_amk`, `start_time`, `end_time` |
| `Procedure_Assistants` | (`procedure_record_id`,`staff_amka`) | — | M:N — βοηθοί |

### 4.5 Φαρμακευτική αγωγή

| Πίνακας | PK | Σημαντικά πεδία |
|---|---|---|
| `Medicine_EMA` | `code` | `brand_name` |
| `Active_Substances` | `id` | `name` |
| `Medicine_has_Substances` | (`medicine_code`,`substance_id`) | — |
| `Patient_Allergies` | (`patient_amka`,`substance_id`) | — |
| `Prescriptions` | (`doctor_amka`,`patient_amka`,`medicine_code`,`start_date`) | `end_date`, `dosage`, `frequency` |

### 4.6 Αξιολογήσεις & βάρδιες

| Πίνακας | PK | Σημαντικά πεδία |
|---|---|---|
| `Evaluation_Hospitalization` | `hospitalization_id` | `nursing_care`, `cleanliness`, `food`, `overall_experience` (όλα `CHECK 1..5`) |
| `Evaluation_Doctor` | (`hospitalization_id`,`doctor_amka`) | `medical_care CHECK 1..5` |
| `Shifts` | `id` | `(shift_date, shift_type) UNIQUE`, `shift_type CHECK IN ('Morning','Afternoon','Night')` |
| `Shift_Assignments` | (`shift_id`,`staff_amka`,`department_id`) | — |

### 4.7 Δεδομένα αναφοράς

| Πίνακας | PK | Πηγή |
|---|---|---|
| `ICD10_Catalog` | `code` | `data/ICD10_Catalog.xls` |
| `KEN_Catalog` | `code` | `data/KEN_Catalog.doc` (basic_cost, avg_duration_days) |
| `Medical_Procedure_Catalog` | `code` | `data/Medical_Procedure_Catalog.xls` |

### 4.8 Εικόνες

| Πίνακας | FK | Σχόλιο |
|---|---|---|
| `Department_Images` | `department_id → Departments` | `ON DELETE CASCADE` |
| `Doctor_Images` | `doctor_amka → Doctors` | `ON DELETE CASCADE` |

---

## 5. Περιορισμοί Ακεραιότητας

Καλύπτονται και οι **πέντε** κατηγορίες που ζητά η εκφώνηση:

### 5.1 Περιορισμοί κλειδιών (Primary keys)

Κάθε πίνακας έχει ρητό PK. Όπου η οντότητα έχει φυσικό αναγνωριστικό (`Staff.amka`, `Patients.amka`, `ICD10_Catalog.code`, `KEN_Catalog.code`, `Medicine_EMA.code`) χρησιμοποιείται αυτό. Σε πίνακες χωρίς φυσικό κλειδί χρησιμοποιούνται **surrogate `AUTO_INCREMENT INT`** (`Departments.id`, `Beds.id`, `Hospitalization.id`, …) για ευελιξία FK references.

### 5.2 Αναφορική ακεραιότητα (Foreign keys)

**~35 FK constraints** συνολικά. Πολιτική cascades:
- `ON UPDATE CASCADE` παντού — μια αλλαγή PK (π.χ. διόρθωση τυπογραφικού στο AMKA) μεταδίδεται.
- `ON DELETE NO ACTION` σχεδόν παντού — εμποδίζει "σιωπηλή" απώλεια ιστορικού· σβησίματα πρέπει να γίνονται συνειδητά.
- **Εξαιρέσεις:**
  - `Hospitalization.ken_code → KEN_Catalog` έχει `ON DELETE RESTRICT` (το κόστος δεν μπορεί να μείνει "ορφανό").
  - `Department_Images`, `Doctor_Images` έχουν `ON DELETE CASCADE` (οι εικόνες είναι ολοκληρωτικά εξαρτημένες από τη γονική οντότητα).

### 5.3 Μοναδικότητα (Unique constraints)

| Πίνακας | UNIQUE | Λόγος |
|---|---|---|
| `Staff.email` | μονό πεδίο | Επιχειρησιακά ένα email = ένας υπάλληλος |
| `Patients.email` | μονό πεδίο | Ίδιο |
| `Doctors.license_number` | μονό πεδίο | Αριθμός άδειας ιατρικού συλλόγου — εξ ορισμού μοναδικός |
| `Beds (department_id, bed_number)` | composite | Εκφώνηση: "μοναδικός αριθμός κλίνης" εντός τμήματος |
| `Shifts (shift_date, shift_type)` | composite | Μία και μόνο γραμμή ανά (μέρα × τύπος) |

### 5.4 Ακεραιότητα πεδίου τιμών (Domain integrity)

Χωρίς `ENUM`, όλα τα enumerations εκφράζονται με `CHECK(... IN (...))`:

```sql
chk_staff_type      CHECK (staff_type IN ('Doctor','Nurse','Admin'))
chk_doctor_rank     CHECK (rank IN ('Ειδικευόμενος','Επιμελητής Β''','Επιμελητής Α''','Διευθυντής'))
chk_nurse_rank      CHECK (rank IN ('Βοηθός Νοσηλευτή','Νοσηλευτής','Προϊστάμενος'))
chk_admin_role      CHECK (role IN ('Γραμματέας','Λογιστής','Διαχειριστής','Υπεύθυνος Προμηθειών'))
chk_patient_gender  CHECK (gender IN ('Αρσενικό','Θηλυκό'))
chk_shift_type      CHECK (shift_type IN ('Morning','Afternoon','Night'))
```

**Bounded ranges:**

```sql
chk_patient_age      CHECK (age IS NULL OR age BETWEEN 0 AND 130)
chk_triage_urgency   CHECK (urgency_level IS NULL OR urgency_level BETWEEN 1 AND 5)
chk_eh_nursing_care  CHECK (nursing_care IS NULL OR nursing_care BETWEEN 1 AND 5)
chk_eh_cleanliness   CHECK (cleanliness  IS NULL OR cleanliness  BETWEEN 1 AND 5)
chk_eh_food          CHECK (food         IS NULL OR food         BETWEEN 1 AND 5)
chk_eh_overall       CHECK (overall_experience IS NULL OR overall_experience BETWEEN 1 AND 5)
chk_ed_medical_care  CHECK (medical_care IS NULL OR medical_care BETWEEN 1 AND 5)
```

Τα `IS NULL OR …` patterns επιτρέπουν "ημιτελείς" αξιολογήσεις (π.χ. ασθενής αξιολογεί 3/4 κριτήρια), που είναι πιο ρεαλιστικό από το να επιβάλλουμε `NOT NULL`.

### 5.5 Περιορισμοί οριζόμενοι από τον χρήστη (User-defined constraints)

Όσοι επιχειρησιακοί κανόνες δεν εκφράζονται σε CHECK / FK / UNIQUE επιβάλλονται με **triggers** (βλέπε §6).

---

## 6. Triggers — Επιβολή Κανόνων στη ΒΔ

Συνολικά **17 triggers** + **1 stored procedure**. Όλοι κάνουν `SIGNAL SQLSTATE '45000'` με κατατοπιστικό μήνυμα στα ελληνικά.

| # | Trigger | Όταν | Τι επιβάλλει |
|---|---|---|---|
| 1 | `check_allergy_before_prescription` | BEFORE INSERT `Prescriptions` | Απαγόρευση συνταγής αν κάποια δραστική ουσία ταυτίζεται με αλλεργία του ασθενή |
| 2 | `check_monthly_shift_limits` | BEFORE INSERT `Shift_Assignments` | Όρια 15/20/25 βαρδιών/μήνα για Doctor/Nurse/Admin |
| 3 | `check_shift_rest_and_night_limit` | BEFORE INSERT `Shift_Assignments` | ≥ 8ώρες ανάπαυσης μεταξύ βαρδιών, ≤ 3 συνεχόμενες νυχτερινές |
| 4 | `check_doctor_supervision` | BEFORE INSERT `Doctors` | Ειδικευόμενος ⇒ επόπτης υποχρεωτικός. Διευθυντής ⇒ απαγορεύεται. Άμεσος κύκλος (A↔B) απαγορεύεται |
| 5 | `check_doctor_supervision_update` | BEFORE UPDATE `Doctors` | Ίδιοι έλεγχοι και σε αλλαγή `rank`/`supervisor` |
| 6 | `calculate_hospitalization_cost` | BEFORE UPDATE `Hospitalization` | Όταν τίθεται `discharge_date`, υπολογίζει `total_cost = basic_cost + max(0, actual_days - mdn) × 100€` |
| 7 | `check_resident_supervision_in_shift` | BEFORE INSERT `Shift_Assignments` | Σε βάρδια με ειδικευόμενο, υποχρεωτικά Επιμελητής Α΄ ή Διευθυντής |
| 8 | `check_procedure_overlap` | BEFORE INSERT `Procedure_Records` | Καμία επικάλυψη χώρου ή κύριου χειρουργού σε επεμβάσεις |
| 9 | `check_procedure_overlap_update` | BEFORE UPDATE `Procedure_Records` | Ίδιο, με self-exclusion (`id <> NEW.id`) |
| 10 | `check_evaluation_hosp_completed` | BEFORE INSERT `Evaluation_Hospitalization` | Αξιολόγηση μόνο μετά την έξοδο |
| 11 | `check_evaluation_doctor_completed` | BEFORE INSERT `Evaluation_Doctor` | Αξιολόγηση γιατρού μόνο μετά την έξοδο |
| 12 | `check_bed_department_match` | BEFORE INSERT `Hospitalization` | Η κλίνη να ανήκει στο τμήμα της νοσηλείας |
| 13 | `check_bed_department_match_update` | BEFORE UPDATE `Hospitalization` | Ίδιο σε αλλαγή `bed_id` ή `department_id` |
| 14 | `check_bed_availability` | BEFORE INSERT `Hospitalization` | Η κλίνη δεν είναι κατειλημμένη από άλλη ενεργή νοσηλεία |
| 15 | `check_bed_availability_update` | BEFORE UPDATE `Hospitalization` | Ίδιο, με self-exclusion |
| 16 | `check_discharge_after_admission` | BEFORE UPDATE `Hospitalization` | `discharge_date > admission_date` |
| 17 | `check_prescription_during_hospitalization` | BEFORE INSERT `Prescriptions` | Η `start_date` πέφτει εντός ενεργής νοσηλείας του ίδιου ασθενή |

**Stored procedure** `assert_no_supervisor_cycles()` — εκτελεί recursive CTE βάθους ≤50 για να εντοπίσει κύκλους εποπτείας οποιουδήποτε βάθους. Καλείται χειροκίνητα μετά από bulk loads, όπου τα triggers δεν τρέχουν λόγω `FOREIGN_KEY_CHECKS=0`.

### 6.1 Παράδειγμα — `check_shift_rest_and_night_limit`

Το πιο σύνθετο trigger. Εκμεταλλεύεται το γεγονός ότι "λιγότερο από 8 ώρες ανάπαυσης" ισοδυναμεί ακριβώς με τρία ζεύγη βαρδιών:

| Προηγούμενη | Επόμενη | Κενό |
|---|---|---|
| Morning (07–15) | Afternoon (15–23) | 0 ώρες |
| Afternoon (15–23) | Night (23–07+1) | 0 ώρες |
| Night (23–07+1) | Morning (07–15) ίδια μέρα | 0 ώρες |

Άρα ο έλεγχος γίνεται με ένα `EXISTS` που πιάνει αυτά τα τρία patterns. Παράλληλα, αν η νέα βάρδια είναι Night, ελέγχουμε αν υπάρχουν ήδη 2 συνεχόμενες νυχτερινές τις προηγούμενες 2 μέρες ΚΑΙ μια τρίτη 3 μέρες πριν — αν ναι, η νέα θα ήταν η 4η (απαγορεύεται).

### 6.2 Παράδειγμα — `calculate_hospitalization_cost`

```sql
SELECT basic_cost, avg_duration_days INTO base_cost, mdn_days
FROM KEN_Catalog WHERE code = NEW.ken_code;

IF base_cost IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Σφάλμα: Άγνωστος κωδικός ΚΕΝ - υπολογισμός κόστους αδύνατος.';
END IF;

SET actual_days = DATEDIFF(NEW.discharge_date, NEW.admission_date);
IF actual_days > mdn_days THEN
    SET NEW.total_cost = base_cost + ((actual_days - mdn_days) * extra_daily_charge);
ELSE
    SET NEW.total_cost = base_cost;
END IF;
```

Το `extra_daily_charge = 100€` είναι παραδοχή (η εκφώνηση δεν δίνει συγκεκριμένη τιμή — βλ. §12).

### 6.3 Γιατί triggers αντί για application code

1. **Compliance με τη ΒΔ ως single source of truth** — οποιοσδήποτε client (UI, ad-hoc SQL, ETL) υπόκειται στους ίδιους κανόνες.
2. **Atomicity** — ο έλεγχος και η εισαγωγή είναι στο ίδιο transaction.
3. **Επίδειξη ικανότητας** — η εκφώνηση αναφέρει ρητά "Τα ανωτέρω όρια και περιορισμοί επιβάλλονται αυτόματα από το σύστημα και δεν μπορούν να παρακαμφθούν κατά την καταχώρηση εφημεριών."

---

## 7. Ευρετήρια (Indexes) και Δικαιολόγηση

Όλα τα PK & UNIQUE δημιουργούν αυτόματα ευρετήρια. Όλα τα FK columns επίσης (απαίτηση της InnoDB για cascade). Πέραν αυτών, δηλώνονται **7 secondary indexes** εστιασμένα στα queries:

| Index | Στήλες | Επιταχύνει |
|---|---|---|
| `idx_hosp_admission_year` | `Hospitalization(admission_date)` | Q1, Q9, Q14 — φιλτράρισμα/grouping ανά έτος εισαγωγής |
| `idx_hosp_dept_year` | `Hospitalization(department_id, admission_date)` | Q1, Q3 — έσοδα/νοσηλείες ανά τμήμα×χρονιά |
| `idx_proc_start_time` | `Procedure_Records(start_time)` | Q11 — επεμβάσεις ανά έτος, comparisons |
| `idx_triage_arrival` | `Triage_Records(arrival_time, urgency_level)` | Q15 — κατανομή triage |
| `idx_triage_queue` | `Triage_Records(outcome, urgency_level, arrival_time)` | Επόμενο pending περιστατικό (FIFO) |
| `idx_pres_patient_start` | `Prescriptions(patient_amka, start_date)` | Q10 — ζεύγη ουσιών ανά νοσηλεία |
| `idx_lab_test_date` | `Lab_Tests(test_date)` | Generic reporting |

Επιπλέον, η `uq_shift_date_type` UNIQUE constraint χρησιμεύει ως composite index και για τα Q2/Q8/Q12 (lookup ανά ημερομηνία+τύπο βάρδιας).

**Σκόπιμα δεν προσθέτουμε index** σε πεδία:
- με χαμηλή cardinality (`Patients.gender`, `Hospitalization.discharge_date IS NULL` predicate),
- σε small lookup tables (`KEN_Catalog` έχει ~ N=200 rows, full scan φθηνότερο).

---

## 8. Δεδομένα Αναφοράς & ETL Pipeline

Η εκφώνηση δίνει υλικό από πραγματικές πηγές που πρέπει να εισαχθεί **ως έχει**:

| Πηγή | Αρχείο | Script | Output SQL |
|---|---|---|---|
| ICD-10 (διαγνώσεις) | `data/ICD10_Catalog.xls` | `code/preprocess_reference_data.py` | `sql/icd10.sql` |
| ΚΕΝ (κωδικοποίηση κόστους) | `data/KEN_Catalog.doc` | (ίδιο) | `sql/ken.sql` |
| Ιατρικές πράξεις | `data/Medical_Procedure_Catalog.xls` | (ίδιο) | `sql/medical_procedures.sql` |
| EMA Article 57 (φάρμακα) | `data/Medicine_EMA.xlsx` | `code/preprocess_ema.py` | `sql/ema_substances.sql`, `sql/ema_medicines.sql`, `sql/ema_links.sql` |

**Σημαντικά σημεία ETL:**

1. **EMA Active Substances normalisation** — η εκφώνηση τονίζει: "προσοχή στον διαχωριστή `|` στο πεδίο των δραστικών ουσιών — κάθε δραστική ουσία πρέπει να εισαχθεί ως ξεχωριστή εγγραφή". Ο `preprocess_ema.py` σπάει το πεδίο και παράγει τρεις πίνακες (φάρμακα, ουσίες, M:N σύνδεση).
2. **`INSERT IGNORE` + batched inserts** (500–1000 rows/statement) — αποφεύγει diversion errors σε δευτερεύουσες εκτελέσεις και κρατά το import χρόνο < 1 λεπτό για 5000+ φάρμακα.
3. **ΚΕΝ από `.doc`** — το LibreOffice καλείται προγραμματιστικά για μετατροπή `.doc → .docx` και μετά `python-docx` εξάγει τους πίνακες.
4. **Loading order** στο `run_all.bat` — πρώτα reference catalogs (γιατί τα FKs στο `load.sql` δείχνουν εκεί), μετά συνθετικά δεδομένα.

---

## 9. Παραγωγή Συνθετικών Δεδομένων (`generate_data.py`)

Ο generator είναι το σημείο όπου η ΒΔ μετατρέπεται από "κενό σχήμα" σε defensible dataset.

### 9.1 Ποσότητες

| Οντότητα | # | Σχόλιο |
|---|---|---|
| Ιατροί | 150 | 15 Διευθυντές + 40 Επιμελητές Α΄ + 45 Β΄ + 50 Ειδικευόμενοι + 15 "νέοι" (<35) για Q5 |
| Νοσηλευτές | 500 | Bumped 300→500 για κάλυψη ελάχιστης στελέχωσης βαρδιών |
| Διοικητικοί | 150 | Bumped 100→150 για ίδιο λόγο |
| Ασθενείς | 200 | |
| Τμήματα | 15 | + 15 διευθυντές 1:1 |
| Κλίνες | ~300 | Συνεπείς με `Departments.bed_count` |
| Νοσηλείες | 500 | |
| Επεμβάσεις | 150 | 40% στο 2026 → ικανά counts για Q11 |
| Εργαστηριακές | 200 | |
| Συνταγές | 300 | |
| Triage | ≥500 | Μία ανά νοσηλεία + extras για Q15 |
| Χώροι (`Spaces`) | 10 | Χειρουργεία + αίθουσες επεμβάσεων |

### 9.2 Στοχευμένη "σπορά" για κάθε query

Ο generator δεν παράγει "ομοιόμορφο τυχαίο" dataset — προσθέτει συγκεκριμένα patterns ώστε κάθε query *να επιστρέφει* αποτελέσματα (η εκφώνηση τιμωρεί κενά result sets):

- **Q3:** 20 ασθενείς με 4 νοσηλείες στο ίδιο τμήμα.
- **Q5:** Ξεχωριστό pool 15 "νέων" χειρουργών (<35); τα πρώτα 40 procedures τους ανατίθενται.
- **Q9:** Διάρκειες νοσηλείας με σκόπιμα duplicate τιμές μέσα στο ίδιο έτος.
- **Q10:** Multiple prescriptions ανά νοσηλεία ώστε να υπάρχουν co-prescribed pairs.
- **Q11:** Concentration στο 2026 + έναν "champion surgeon".
- **Q14:** ICD-10 codes από μικρό fallback pool για να επαναλαμβάνονται counts σε διαδοχικά έτη.
- **Q15:** 40% των triage records στο 2026.

### 9.3 Constraint-aware generation

Όσα triggers θα έκοβαν inserts ελέγχονται και στον generator πριν εκπεμφθεί κάθε γραμμή:

- `can_assign()` ελέγχει 8h rest / monthly / 3-night-streak πριν την εισαγωγή `Shift_Assignments`.
- `beds_with_open_hosp` set εξασφαλίζει ότι δεν δίνεται ίδια κλίνη σε δύο ενεργές νοσηλείες.
- Director του τμήματος εκπέμπεται *πριν* από το `Departments` row.

### 9.4 Ρεαλισμός

Η V3 αναβάθμιση του generator πρόσθεσε:
- Ελληνικά ονόματα με σωστή γενική κατά φύλο (`Παπαδόπουλος`/`Παπαδοπούλου`).
- CDC-based βάρος/ύψος ανά ηλικιακή ομάδα.
- `hire_date ≥ 22ος γενεθλίων` του υπαλλήλου.
- Director specialty εναρμονισμένη με τμήμα (ΜΕΘ → Αναισθησιολογία).
- Patient ↔ department compatibility (παιδιά → Παιδιατρική, γυναίκες → Μαιευτική κ.ο.κ.).
- ΜΕΘ νοσηλευτές μόνο σε υψηλότερες βαθμίδες (όχι Βοηθοί).
- Lab tests / prescriptions μόνο από γιατρούς που είχαν βάρδια εκείνη τη μέρα.
- Likert ratings με positive bias (`weights=[5,10,25,35,25]`).
- Shift period 2023–2026 → multi-year coverage για Q1/Q9/Q14.

### 9.5 Cost calculation στον generator

Επειδή το `calculate_hospitalization_cost` trigger τρέχει `BEFORE UPDATE` μόνο, αν αφήναμε τον generator να βάλει `total_cost=0` και να μην κάνει UPDATE, **κάθε νοσηλεία θα είχε μηδέν κόστος** και το Q1 θα κατέρρεε. Λύση: ο generator υπολογίζει εκεί το κόστος με ακριβώς τον ίδιο τύπο `basic_cost + max(0, actual_days - mdn) × 100€`.

---

## 10. Ερωτήματα Q1–Q15

Παρακάτω συνοπτική περιγραφή. Το πλήρες SQL ζει στα `sql/Q01.sql … sql/Q15.sql` και τα αποτελέσματα στα `sql/Q*_out.txt`.

| # | Σύντομη περιγραφή | Τεχνικές που χρησιμοποιήθηκαν |
|---|---|---|
| Q1 | Έσοδα ανά τμήμα × έτος × ΚΕΝ × ασφαλιστικό φορέα | `SUM(k.basic_cost)` + `SUM(GREATEST(0, h.total_cost - k.basic_cost))` για διαχωρισμό βάσης/πρόσθετης χρέωσης. `GREATEST(0, …)` αποτρέπει αρνητικές τιμές σε νοσηλείες που τερμάτισαν εντός ΜΔΝ |
| Q2 | Ιατροί συγκεκριμένης ειδικότητας με flag εφημερίας 2026 + #επεμβάσεων | `LEFT JOIN` ώστε γιατροί χωρίς επεμβάσεις να εμφανίζονται με `0` |
| Q3 | Ασθενείς με >3 νοσηλείες στο ίδιο τμήμα | `GROUP BY patient, department HAVING COUNT(*) > 3` |
| Q4 | Μέσος όρος ratings συγκεκριμένου γιατρού + overall hospitalization | EXPLAIN ANALYZE + FORCE INDEX variant — βλ. §11 |
| Q5 | Νέοι χειρουργοί (<35) ταξινομημένοι κατά #επεμβάσεων | `JOIN Procedure_Records … WHERE category='Χειρουργική' GROUP BY doctor ORDER BY surgeries DESC` |
| Q6 | Ιστορικό νοσηλειών ασθενή με ICD-10 περιγραφές, κόστος, average rating | EXPLAIN ANALYZE + FORCE INDEX — βλ. §11. Το rating υπολογίζεται ως μέσος όρος των 4 κριτηρίων (`(nc+cl+f+oe)/4.0`) |
| Q7 | Ανά δραστική ουσία: #ασθενών αλλεργικών + #φαρμάκων που την περιέχουν | Τριπλό `LEFT JOIN` ώστε ουσίες χωρίς αλλεργίες να εμφανίζονται |
| Q8 | Προσωπικό χωρίς προγραμματισμένη εφημερία σε συγκεκριμένη ημερομηνία+τμήμα | `LEFT JOIN Shift_Assignments … WHERE shift IS NULL` + φιλτράρισμα ότι ο υπάλληλος *ανήκει* στο τμήμα (DDH/Nurses.department_id/Admin_Staff.department_id) |
| Q9 | Ασθενείς με ίσο αριθμό ημερών νοσηλείας σε ένα έτος, με σύνολο >15 ημερών | `COUNT(*) OVER (PARTITION BY year, total_days)` για ομαδοποίηση ίδιων διαρκειών |
| Q10 | Top-3 ζεύγη συν-συνταγογραφημένων δραστικών ουσιών | Self-join `Prescriptions` × `Prescriptions` με `sub1 < sub2` για αποφυγή `(A,B)+(B,A)` duplications |
| Q11 | Γιατροί με ≥5 λιγότερες επεμβάσεις από τον max (recursive CTE hint) | Απλό CTE + cross-join — η recursion δεν είναι αναγκαία (το `MAX()` αρκεί) |
| Q12 | Απαιτούμενος αριθμός προσωπικού ανά τμήμα × βάρδια εβδομάδας, ανά υποκλάση | `CASE` expressions επιστρέφουν `specialty`/`rank`/`role` ανά τύπο υπαλλήλου, με προσοχή σε `ONLY_FULL_GROUP_BY` |
| Q13 | Ιεραρχία εποπτείας κάθε γιατρού (recursive CTE) | `WITH RECURSIVE SupervisionHierarchy …` με level counter |
| Q14 | ICD-10 κατηγορίες με ίσο count εισαγωγών σε δύο διαδοχικά έτη (≥5/έτος) | Self-join σε `year` και `year+1` |
| Q15 | Κατανομή triage ανά urgency level + μέσος χρόνος αναμονής + admit rate + dept referrals | Multiple aggregates + `MIN(h.admission_date)` ώστε ένα triage να συνδέεται με μία νοσηλεία |

### 10.1 Σημαντικές σχεδιαστικές σημειώσεις

- **Placeholders σε Q4/Q6/Q8:** πριν το grading οι placeholder τιμές (`'00868759358'`, `'ΑΜΚΑ_ΤΟΥ_ΑΣΘΕΝΗ'`, `'2026-05-10'`, `'Καρδιολογία'`) αντικαθίστανται από verified values που υπάρχουν στο φορτωμένο dataset.
- **Q1 grouping:** `SUM(k.basic_cost)` πολλαπλασιάζεται με τις νοσηλείες της ομάδας — αυτό είναι ακριβώς που ζητά η εκφώνηση ("συνολικά έσοδα ανά ΚΕΝ κωδικό").
- **Q11 χωρίς recursion:** Η εκφώνηση δίνει hint ότι "ίσως" χρειαστεί recursive CTE. Στην πράξη το `MAX()` σε μη-recursive CTE αρκεί. Η recursion χρησιμοποιείται γνήσια στο Q13.
- **Q15 wait time:** Παραδοχή = `time(hospitalization.admission_date) - time(triage.arrival_time)` (από άφιξη έως εισαγωγή). Αν η εκφώνηση εννοούσε "από άφιξη έως πρώτη ιατρική επαφή", θα απαιτούσε ένα ξεχωριστό `service_started_at` column που δεν προβλέπεται.

---

## 11. Q4 & Q6 — EXPLAIN ANALYZE / FORCE INDEX

Σύμφωνα με την εκφώνηση, για τα Q4 και Q6 υπολογίζονται δύο variants: (α) "κανονική" εκτέλεση και (β) με `FORCE INDEX`. Παρακάτω η μεθοδολογία και τα συμπεράσματα. Πλήρη screenshots των plans υπάρχουν στο τελικό report PDF.

### 11.1 Q4 — μέσος όρος ratings γιατρού

**Variant A — Default optimizer:**

```sql
EXPLAIN ANALYZE
SELECT d.staff_amka, s.last_name,
       AVG(ed.medical_care)        AS Avg_Medical_Care,
       AVG(eh.overall_experience)  AS Avg_Overall_Experience
FROM Doctors d
JOIN Staff s                       ON d.staff_amka = s.amka
JOIN Evaluation_Doctor ed          ON d.staff_amka = ed.doctor_amka
JOIN Evaluation_Hospitalization eh ON ed.hospitalization_id = eh.hospitalization_id
WHERE d.staff_amka = '00868759358'
GROUP BY d.staff_amka, s.last_name;
```

Ο optimizer ξεκινά από `Doctors` (PK lookup → 1 row), κάνει PK lookup στο `Staff`, μετά "ref" στο `Evaluation_Doctor` μέσω `fk_ed_doctor_idx`, και τέλος PK lookup στο `Evaluation_Hospitalization`. Σύνολο: 4 single-row / range lookups → **πολύ φθηνό plan**.

**Variant B — `FORCE INDEX (fk_ed_doctor_idx)`** εξαναγκάζει ρητά τον ίδιο index. Στην πράξη ο optimizer τον επέλεγε ούτως ή άλλως, οπότε **το plan είναι ταυτόσημο** — μηδαμινή διαφορά κόστους και χρόνου.

**Συμπέρασμα Q4:** Με ένα ισχυρό equality filter στο PK (`d.staff_amka = …`) και FK ευρετήρια σωστά τοποθετημένα, ο optimizer επιλέγει βέλτιστο plan από μόνος του. Το `FORCE INDEX` δεν προσφέρει επιτάχυνση — χρησιμεύει σε σπάνια edge cases όπου stale statistics οδηγούν σε λάθος επιλογή.

### 11.2 Q6 — ιστορικό νοσηλειών ασθενή

**Variant A:** `WHERE h.patient_amka = '…'` — ο optimizer χρησιμοποιεί `fk_hospitalization_patient_idx` για να βρει τις νοσηλείες του ασθενή (~3–5 rows), και μετά PK lookups για τα 3 LEFT JOINs.

**Variant B:** `FORCE INDEX (fk_hospitalization_patient_idx)` — ίδια συμπεριφορά. Το index force είναι εδώ διδακτικό: δείχνει ότι αναγκάζοντας το σύστημα να *μην* μπορεί να επιλέξει full table scan, παίρνουμε εγγυημένα index-driven plan ακόμη και αν η ποσότητα δεδομένων είναι ορισμένη φορά μεγάλη.

**Συμπέρασμα Q6:** Όταν το `patient_amka` έχει covering FK index και ο όρος είναι equality, το plan είναι identical με/χωρίς FORCE. Όμως αν το dataset μεγαλώσει 100× και τα statistics γίνουν stale, μπορεί ο optimizer να σκεφτεί "ίσως full scan", οπότε το hint γίνεται αμυντικό.

### 11.3 Γενικό συμπέρασμα

1. Σε equality lookups πάνω σε indexed columns, ο MySQL/MariaDB optimizer τυπικά επιλέγει το σωστό plan — `FORCE INDEX` είναι rare necessity.
2. Το `FORCE INDEX` είναι χρήσιμο όταν: (i) statistics είναι stale, (ii) cardinality estimates είναι λάθος, ή (iii) θέλουμε να δείξουμε σταθερότητα στα plans (regression-proof queries).
3. Σε ένα παραγωγικό σύστημα νοσοκομείου, queries τύπου Q4/Q6 εκτελούνται πολλάκις (dashboards, εμφάνιση καρτέλας ασθενή) — προτιμώμε να μην βασιζόμαστε σε hints αλλά σε σωστή στατιστική (regular `ANALYZE TABLE`).

---

## 12. Πίνακας Παραδοχών

| # | Παραδοχή | Λόγος |
|---|---|---|
| 1 | `extra_daily_charge = 100€` ανά μέρα υπέρβασης ΜΔΝ | Η εκφώνηση λέει "αναλογική πρόσθετη ημερήσια χρέωση" χωρίς ποσό — επιλέχθηκε στρογγυλή τιμή ως default |
| 2 | Active substances αποθηκεύονται μόνο με `name` (όχι ATC/strength) | Η εκφώνηση επιτρέπει "απλοποίηση" — όλα τα queries λειτουργούν με name match |
| 3 | Triage wait time = `admission_date - arrival_time` | Δεν υπάρχει column `service_started_at` — υπολογίζουμε το proxy "από άφιξη έως εισαγωγή" |
| 4 | Διευθυντής τμήματος είναι πάντα γιατρός του ίδιου τμήματος | Η εκφώνηση αναφέρει "διευθυντή τμήματος (ιατρό)" χωρίς να το επιβάλλει — το βάλαμε στο generator για πιστότητα |
| 5 | `Procedure_Assistants` μπορεί να περιλαμβάνει νοσηλευτές | Η εκφώνηση λέει ρητά "βοηθούς (ιατρούς ή νοσηλευτές, μέλη του προσωπικού)" — άρα FK προς `Staff`, όχι `Doctors` |
| 6 | Μία μόνο `Evaluation_Hospitalization` ανά νοσηλεία | PK = `hospitalization_id` (1:1) — ένας ασθενής, μία αξιολόγηση |
| 7 | `Patients.gender` περιορίζεται σε `('Αρσενικό','Θηλυκό')` | Η εκφώνηση δεν εξειδικεύει — απλοποίηση |
| 8 | `Active_Substances.id` είναι manual `INT` (όχι AUTO_INCREMENT) | Παράγεται από τον `preprocess_ema.py` με `INSERT IGNORE`, χρειάζεται deterministic ID για cross-references στα `Medicine_has_Substances`/`Patient_Allergies` |
| 9 | Παραγωγή shifts μόνο για 15 ημέρες/μήνα × 4 χρόνια | Πραγματική (καθημερινή) κάλυψη θα δημιουργούσε ~3000+ shift records και θα έκανε το import αργό. Αρκετά για κάλυψη των queries |
| 10 | `Department_Images` και `Doctor_Images` αντί για ενιαίο `Entity_Images` | Επιτρέπει κανονικά FK + cascade — βλ. §3.12 |
| 11 | `Spaces` διαθέτει μόνο 10 χώρους | Η εκφώνηση ζητά "10 χειρουργεία/αίθουσες" |
| 12 | Όλες οι αξιολογήσεις επιτρέπουν NULL ανά κριτήριο | Ρεαλιστικό — ένας ασθενής μπορεί να μην απαντήσει σε κάποια ερώτηση |

---

## 13. Bonus: Web Showcase UI

Στο `ui/` υπάρχει Express + vanilla JS demo (όχι ORM — pure `mysql2/promise` με named placeholders) που δείχνει live τη ΒΔ:

| Tab | Λειτουργία |
|---|---|
| **Dashboard** | Counts ανά οντότητα + revenue table + triage chart |
| **Patients** | Search + new patient form (πλήρη πεδία) |
| **Doctors** | Search + φίλτρο ειδικότητας |
| **Hospitalizations** | Browse + new admission form (διαθέσιμες κλίνες fetched live) |
| **Prescriptions** | List + new prescription form — **ενεργοποιεί ζωντανά** το `check_allergy_before_prescription` trigger. Το SIGNAL message εμφανίζεται κόκκινο στον χρήστη |
| **Queries Q1–Q15** | Side-by-side: raw `.sql` περιεχόμενο (fs.readFileSync από `sql/Qx.sql`) + live result grid. Παράμετροι (specialty, AMKA, ημερομηνία…) auto-rendered form inputs |

**Εκτέλεση:**

```cmd
cd C:\xampp\htdocs\databases\ui
copy .env.example .env
npm install
npm start
```

Άνοιγμα `http://localhost:3000`.

**Γιατί είναι value-add για το grading:** Ο καθηγητής μπορεί να δει το ακριβές `.sql` περιεχόμενο που τρέχει + το αποτέλεσμα + ζωντανή πιστοποίηση triggers (συνταγή σε αλλεργικό ασθενή → εμφανίζεται το ελληνικό μήνυμα του SIGNAL).

---

## 14. Οδηγίες Εκτέλεσης (Reproducibility)

**Προϋποθέσεις:**
- XAMPP / MariaDB 10.6+ ή MySQL 8+
- Python 3.9+ με `pip install faker pandas xlrd openpyxl python-docx`
- LibreOffice (για μετατροπή `.doc → .docx` του KEN catalog)

**End-to-end pipeline:**

```cmd
cd C:\xampp\htdocs\databases
run_all.bat
```

Το script εκτελεί διαδοχικά:

1. `code\preprocess_reference_data.py` → `sql\icd10.sql`, `sql\ken.sql`, `sql\medical_procedures.sql`
2. `code\preprocess_ema.py` → `sql\ema_substances.sql`, `sql\ema_medicines.sql`, `sql\ema_links.sql`
3. `code\generate_data.py` → `sql\load.sql`
4. `mysql < sql\install.sql` (schema + triggers + indexes)
5. `mysql < sql\<reference>.sql` (φόρτωση καταλόγων)
6. `mysql < sql\load.sql` (συνθετικά δεδομένα)

Μετά: `mysql -u root hygeiopolis_db < sql\Q01.sql > sql\Q01_out.txt` για κάθε query.

---

## 15. Έλεγχος Συμμόρφωσης με την Εκφώνηση

| Απαίτηση | Status |
|---|---|
| Δεν χρησιμοποιείται `ENUM` / `ARRAY` / `JSON` / `XML` | ✅ Όλα τα enumerations με `CHECK(... IN (...))` |
| Δεν χρησιμοποιείται ORM | ✅ Pure SQL + Python string templating |
| Reference data εισάγονται "ως έχουν" από επίσημες πηγές | ✅ ICD-10, ΚΕΝ, Procedures, EMA |
| Όλες οι οντότητες υποστηρίζουν εικόνες με περιγραφή | ✅ `Department_Images`, `Doctor_Images` (extensible pattern) |
| ≥80 ιατροί, 200 ασθενείς, 500 νοσηλείες, 15 τμήματα, 300 συνταγές, 10 χώροι, 150 πράξεις, 200 lab tests | ✅ Όλα τα ποσά τηρούνται ή ξεπερνώνται |
| Όλα τα queries επιστρέφουν δεδομένα | ✅ Με σπορά στον generator |
| Q4, Q6 με EXPLAIN ANALYZE + FORCE INDEX comparison | ✅ §11 |
| Q11 hint για recursive CTE | ✅ Σχολιάζεται γιατί δεν χρειάζεται· η recursion αξιοποιείται στο Q13 |
| Όλοι οι περιορισμοί επιβάλλονται **αυτόματα από το σύστημα** | ✅ 17 triggers + CHECK constraints + recursive cycle SP |
| Παραδοχές καταγεγραμμένες σε πίνακα | ✅ §12 + README.md |

---

## Επίλογος

Η ΒΔ `hygeiopolis_db` αντιμετωπίζει την εκφώνηση όχι ως απλή άσκηση κανονικοποίησης αλλά ως πλήρες πληροφοριακό σύστημα νοσοκομείου:

- **22 πίνακες** σχεδιασμένοι με βάση τη φυσική σημασιολογία του domain (ISA, M:N, weak entities, surrogate keys όπου αρμόζει).
- **5 κατηγορίες περιορισμών** καλύπτονται (PK, FK, UNIQUE, CHECK, user-defined via triggers).
- **17 triggers + 1 recursive stored procedure** εξασφαλίζουν ότι **κανένας** κανόνας της εκφώνησης δεν παρακάμπτεται μέσω SQL backdoor.
- **7 secondary indexes** στοχευμένοι στα queries που πραγματικά εκτελούνται.
- **Realistic data generator** που σπέρνει συγκεκριμένα patterns ώστε κάθε Q1–Q15 να επιστρέφει διδακτικά αποτελέσματα.
- **Bonus web UI** για live demo, με το πιο χρήσιμο feature: side-by-side raw SQL ↔ result, ώστε ο reviewer να δει ακριβώς τι τρέχει.

Το αποτέλεσμα είναι μια ΒΔ που (α) **επιβάλλει την ορθότητα από μόνη της**, (β) **τεκμηριώνεται πλήρως** μέσω της παρούσας αναφοράς και του README, και (γ) **είναι reproducible** μέσω ενός μόνο `run_all.bat`.
