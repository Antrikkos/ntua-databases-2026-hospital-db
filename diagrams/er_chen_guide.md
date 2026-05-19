# ER Diagram (Chen notation) — Build Guide for draw.io

This file is a hand-drawing checklist for the Chen-style ER diagram of the
`hygeiopolis_db` schema. Each section lists the shapes, attributes,
relationships and cardinalities you need to place on the canvas. Work through
the sections top-to-bottom; the layout suggestion at the end groups things so
the canvas does not turn into a spaghetti plate.

---

## 1. Chen-notation legend (shapes you will need from the draw.io shape panel)

In draw.io the relevant shapes live under **Entity Relation** (toggle it on via
*More Shapes → Software → Entity Relation*). The Chen-style shapes are also
available under the standard library:

| Concept | Shape | Notes |
|---|---|---|
| Strong entity | Rectangle | Plain border |
| Weak entity | Rectangle with double border | Use the "double rectangle" or stack two rectangles |
| Relationship | Diamond | Plain border |
| Identifying relationship | Diamond with double border | Connects a weak entity to its owner |
| Attribute | Ellipse (oval) | Plain border |
| Key attribute | Ellipse with **underlined** text | Underline the attribute name |
| Partial key (weak ent.) | Ellipse with **dashed-underlined** text | Discriminator for weak entities |
| Multi-valued attribute | Ellipse with double border | e.g. for `emergency_contact` if you treat it as multi-valued |
| Derived attribute | Ellipse with dashed border | e.g. `age`, `total_cost` |
| Composite attribute | Ellipse linked to child ellipses | e.g. `address` → street/city/postal |
| ISA / specialization | Triangle labelled **ISA** | Double line from supertype = total participation |
| Disjointness | Letter `d` (disjoint) or `o` (overlap) inside or next to the triangle | Our hierarchy is **disjoint, total** |
| Connection line | Plain line | Add the cardinality label on the line |
| Total participation | Double line between entity and relationship | Single line = partial |

Cardinality labels in Chen are written on the line between entity and
relationship, normally as `1`, `N`, `M`. Use `(min, max)` only if you prefer
that style — be consistent across the whole diagram.

---

## 2. Strong entities (rectangles) — with their attributes

For each entity below: draw a rectangle, then attach the listed attributes as
ovals connected by plain lines. Underline the primary-key attribute(s).

### 2.1 `Staff` (supertype — see ISA section)
- **amka** (key, underlined, CHAR(11))
- first_name
- last_name
- age (mark as **derived** → dashed oval, since it can be computed from a DOB; keep plain if you prefer to model it as stored)
- email (mark as a candidate key — underline with dashed line, or add an annotation "UNIQUE")
- phone
- hire_date
- staff_type (discriminator for the ISA — value ∈ {Doctor, Nurse, Admin})

### 2.2 `Patient`
- **amka** (key)
- first_name
- last_name
- fathers_name
- age (derived)
- weight
- height
- gender (∈ {Αρσενικό, Θηλυκό})
- address (you may model as composite if you want extra polish)
- phone
- email (unique)
- profession
- citizenship
- emergency_contact (could be multi-valued — double ellipse)
- insurance_provider

### 2.3 `Department`
- **id** (key, surrogate)
- name
- description
- bed_count (derived — equals `COUNT(Bed)` for the department; use dashed ellipse)
- floor_building

### 2.4 `Hospitalization`
- **id** (key, surrogate)
- admission_date
- discharge_date
- total_cost (derived — computed by the `calculate_hospitalization_cost` trigger; dashed ellipse)

(Note: `patient_amka`, `bed_id`, `department_id`, `ken_code`, `admission_diagnosis_icd10`, `discharge_diagnosis_icd10` are **not** attributes — they appear as relationships in §5.)

### 2.5 `Triage_Record`
- **id** (key)
- symptoms
- urgency_level (1–5)
- arrival_time
- outcome
- resolved_at

### 2.6 `Procedure_Record`
- **id** (key)
- start_time
- end_time

### 2.7 `Lab_Test`
- **id** (key)
- type
- test_date
- result_text
- result_value
- unit
- cost

### 2.8 `Space` (operating rooms / examination rooms)
- **id** (key)
- name
- type

### 2.9 `Shift`
- **id** (key)
- shift_date
- shift_type (∈ {Morning, Afternoon, Night})

### 2.10 Catalogs (reference data — model as plain entities)

`ICD10_Catalog`
- **code** (key)
- description

`KEN_Catalog`
- **code** (key)
- description
- basic_cost
- avg_duration_days

`Medical_Procedure_Catalog`
- **code** (key)
- name
- category
- standard_duration
- standard_cost

`Medicine_EMA`
- **code** (key)
- brand_name

`Active_Substance`
- **id** (key)
- name

### 2.11 `Evaluation_Hospitalization`
- nursing_care
- cleanliness
- food
- overall_experience

(No own primary key — its identity comes from the `Hospitalization` it
evaluates. You can either (a) model this as a **weak entity** owned by
Hospitalization, or (b) model it as a relationship with attributes between
Hospitalization and "the act of evaluation". Recommended: option (a), weak
entity with the four scores as attributes and `Hospitalization` as the owner.)

---

## 3. Weak entities (double rectangles)

For each weak entity: draw a double-bordered rectangle and connect it to its
owner via an **identifying relationship** (double-bordered diamond). The owner
side gets a double-line connection (total participation of the weak entity in
the identifying relationship is implicit and shown via the double border).

### 3.1 `Bed` (weak — identified by Department + bed_number)
- **bed_number** (partial key — dashed underline)
- type
- status
- Identifying relationship: `BELONGS_TO` (double diamond) → `Department`
  - cardinality on Department side: **1**
  - cardinality on Bed side: **N**
  - both sides total participation (Bed must belong to a department; we
    assume every department has ≥1 bed — if not, make Department's
    participation partial)

### 3.2 `Department_Image` (weak — identified by Department + image_url)
- **image_url** (partial key)
- description
- Identifying relationship: `DEPT_HAS_IMAGE` (double diamond) → `Department`
  - 1 (Department) : N (Department_Image)

### 3.3 `Doctor_Image` (weak — identified by Doctor + image_url)
- **image_url** (partial key)
- description
- Identifying relationship: `DOC_HAS_IMAGE` (double diamond) → `Doctor`
  - 1 (Doctor) : N (Doctor_Image)

### 3.4 `Evaluation_Hospitalization` (weak — see §2.11)
- nursing_care, cleanliness, food, overall_experience
- Identifying relationship: `HAS_EVALUATION` (double diamond) → `Hospitalization`
  - 1 (Hospitalization) : 1 (Evaluation_Hospitalization)
  - Hospitalization side: partial (not every hospitalization is rated)
  - Evaluation side: total

---

## 4. ISA hierarchy — Staff specialization

Draw a single **ISA triangle** below `Staff` with the letter `d` (disjoint).
Use a **double line** from `Staff` down into the triangle to indicate **total
participation** (the `chk_staff_type` constraint guarantees every Staff is
exactly one of the three subtypes).

From the triangle, draw lines to three subtype entities (plain rectangles):

### 4.1 `Doctor` (subtype of Staff)
- license_number (key inside the subtype — underlined; it is unique among doctors)
- specialty
- rank (∈ {Ειδικευόμενος, Επιμελητής Β΄, Επιμελητής Α΄, Διευθυντής})

(`staff_amka` is inherited from `Staff.amka` via the ISA — do not redraw it.)

### 4.2 `Nurse` (subtype of Staff)
- rank (∈ {Βοηθός Νοσηλευτή, Νοσηλευτής, Προϊστάμενος})

### 4.3 `Admin_Staff` (subtype of Staff)
- role (∈ {Γραμματέας, Λογιστής, Διαχειριστής, Υπεύθυνος Προμηθειών})
- office

---

## 5. Relationships (diamonds) — with cardinalities, participation, and any relationship attributes

Each row below = one diamond on the canvas. The format is:
`Entity_A —[cardinality_A]— ◇ RELATIONSHIP ◇ —[cardinality_B]— Entity_B`

Use a **double line** from an entity to the diamond when participation is
**total** (every instance must take part); use a **single line** when partial.
Add relationship attributes as ovals hanging off the diamond itself.

### 5.1 Staff / Department relationships

| # | Entity A | card A | Relationship | card B | Entity B | Participation A / B | Notes |
|---|---|---|---|---|---|---|---|
| R1 | Doctor | 1 | **DIRECTS** | 1 | Department | partial / **total** | every Department has exactly one director (NOT NULL `director_amka`); most doctors are not directors |
| R2 | Nurse | N | **WORKS_IN** | 1 | Department | partial / partial | `Nurses.department_id` (nullable) |
| R3 | Admin_Staff | N | **ASSIGNED_TO** | 1 | Department | partial / partial | `Admin_Staff.department_id` (nullable) |
| R4 | Doctor | M | **AFFILIATED_WITH** | N | Department | partial / partial | from `Doctor_has_Department` — a doctor may belong to several departments |
| R5 | Doctor | 1 | **SUPERVISES** | N | Doctor (same set, recursive) | partial / partial | self-loop on Doctor; label the two roles `supervisor` and `supervisee` next to each end. Residents are total on the supervisee side (Ειδικευόμενος must have a supervisor); Directors are total non-participants on the supervisee side. |

### 5.2 Patient / Triage / Hospitalization relationships

| # | Entity A | card A | Relationship | card B | Entity B | Participation | Notes |
|---|---|---|---|---|---|---|---|
| R6 | Patient | 1 | **UNDERGOES_TRIAGE** | N | Triage_Record | partial / **total** | every triage record refers to exactly one patient |
| R7 | Nurse | 1 | **PERFORMS_TRIAGE** | N | Triage_Record | partial / partial | the triage nurse (nullable in schema) |
| R8 | Triage_Record | 0..1 | **LEADS_TO** | 0..1 | Hospitalization | partial / partial | `hospitalization_id` in `Triage_Records` (nullable). Draw this as a thin diamond between Triage_Record and Hospitalization. |
| R9 | Patient | 1 | **HOSPITALIZED_AS** | N | Hospitalization | partial / **total** | every hospitalization belongs to a patient |
| R10 | Bed | 1 | **OCCUPIED_BY** | N | Hospitalization | partial / **total** | a hospitalization is in exactly one bed; a bed has many hospitalizations over time |
| R11 | Department | 1 | **TAKES_PLACE_IN** | N | Hospitalization | partial / **total** | redundant-but-modelled department FK on hospitalization |
| R12 | Hospitalization | N | **ADMITTED_WITH** | 1 | ICD10_Catalog | partial / partial | role label = "admission diagnosis" |
| R13 | Hospitalization | N | **DISCHARGED_WITH** | 1 | ICD10_Catalog | partial / partial | role label = "discharge diagnosis"  — **same** ICD10 entity, two separate diamonds with distinct role names |
| R14 | Hospitalization | N | **CLASSIFIED_BY** | 1 | KEN_Catalog | partial / partial | one KEN code per hospitalization |

### 5.3 Procedures

| # | Entity A | card A | Relationship | card B | Entity B | Participation | Notes |
|---|---|---|---|---|---|---|---|
| R15 | Hospitalization | 1 | **HAS_PROCEDURE** | N | Procedure_Record | partial / **total** | every procedure belongs to a hospitalization |
| R16 | Procedure_Record | N | **OF_TYPE** | 1 | Medical_Procedure_Catalog | partial / partial | the procedure code |
| R17 | Procedure_Record | N | **IN_SPACE** | 1 | Space | partial / partial | operating room / examination space |
| R18 | Doctor | 1 | **MAIN_SURGEON_OF** | N | Procedure_Record | partial / partial | role label = "main surgeon" |
| R19 | Staff | M | **ASSISTS_IN** | N | Procedure_Record | partial / partial | `Procedure_Assistants` — note this connects **Staff** (not Doctor), since assistants can be doctors or nurses |

### 5.4 Lab tests, prescriptions, allergies

| # | Entity A | card A | Relationship | card B | Entity B | Participation | Notes |
|---|---|---|---|---|---|---|---|
| R20 | Hospitalization | 1 | **HAS_LAB** | N | Lab_Test | partial / **total** | lab tests scoped to a hospitalization |
| R21 | Doctor | 1 | **ORDERS_LAB** | N | Lab_Test | partial / partial | ordering doctor |
| R22 | Patient | M | **ALLERGIC_TO** | N | Active_Substance | partial / partial | from `Patient_Allergies` |
| R23 | Medicine_EMA | M | **CONTAINS** | N | Active_Substance | partial / partial | from `Medicine_has_Substances` |
| R24 | **Ternary**: Doctor + Patient + Medicine_EMA | M : N : K | **PRESCRIBES** | — | — | partial on all three | This is a **ternary** relationship: draw one diamond connected to all three entities. Relationship attributes: `start_date` (part of identifier), `end_date`, `dosage`, `frequency`. |

### 5.5 Evaluations

| # | Entity A | card A | Relationship | card B | Entity B | Participation | Notes |
|---|---|---|---|---|---|---|---|
| R25 | Hospitalization | 1 | **HAS_EVALUATION** | 1 | Evaluation_Hospitalization | partial / total | identifying relationship — already in §3.4 (double diamond, double border on the weak entity) |
| R26 | Hospitalization | M | **RATES_DOCTOR** | N | Doctor | partial / partial | from `Evaluation_Doctor`. Relationship attribute: `medical_care` (oval hanging off the diamond). |

### 5.6 Shifts (ternary)

| # | Description |
|---|---|
| R27 | **Ternary**: `Shift` + `Staff` + `Department` joined by a single diamond labelled **SHIFT_ASSIGNMENT**. Cardinality marks: M (Shift side), N (Staff side), K (Department side). No relationship attributes — the row is identified by the combination. Participation: partial on all three sides. |

### 5.7 Image weak-entity relationships

Already drawn as identifying relationships in §3.2 and §3.3 — do not duplicate.

---

## 6. Suggested canvas layout (so the diagram stays readable)

Use a 3-band layout, left-to-right:

```
┌────────────────────────┬───────────────────────────┬──────────────────────────┐
│   STAFF cluster        │   HOSPITALIZATION core    │   CATALOGS column        │
│                        │                           │                          │
│  Staff                 │   Patient                 │   ICD10_Catalog          │
│   │ ISA (d, total)     │     │                     │   KEN_Catalog            │
│   ├── Doctor           │     ◇ HOSPITALIZED_AS     │   Medical_Procedure_     │
│   ├── Nurse            │     │                     │     Catalog              │
│   └── Admin_Staff      │   Hospitalization ◇──────►│   Medicine_EMA           │
│                        │     │  │  │               │   Active_Substance       │
│  Department            │     │  │  └─◇ HAS_LAB ──► │                          │
│   │                    │     │  │   Lab_Test       │                          │
│   ◇ BELONGS_TO         │     │  └──◇ HAS_PROCEDURE │                          │
│   Bed (weak)           │     │      Procedure_Rec  │                          │
│   ◇ DEPT_HAS_IMAGE     │     │      │              │                          │
│   Department_Image     │     │      ◇ IN_SPACE     │                          │
│   (weak)               │     │      │ Space        │                          │
│                        │     ◇ HAS_EVALUATION      │                          │
│  Shift  ── ◇ SHIFT_    │     Evaluation_Hosp (weak)│                          │
│           ASSIGNMENT   │                           │                          │
│           (ternary)    │   Triage_Record           │                          │
│                        │     ◇ LEADS_TO            │                          │
│                        │                           │                          │
└────────────────────────┴───────────────────────────┴──────────────────────────┘
```

Place the **PRESCRIBES** ternary diamond between the Staff column (Doctor),
the centre (Patient), and the right column (Medicine_EMA). Place
**RATES_DOCTOR** as a diamond between Hospitalization and Doctor.

Tips while drawing:
- Lock the grid (View → Grid) and snap shapes to it; this makes alignment painless.
- Group each cluster (select shapes → right-click → Edit → Group) once it is laid out, so you can move it as a block.
- Use **Edit Style** on the connection line to add the cardinality as a midpoint label (`1`, `N`, `M`, `K`) — do not use arrowheads; Chen lines are undirected.
- Pick one cardinality convention (`1/N/M` **or** `(min,max)`) and stick to it.
- Keep attribute ovals small; the diagram has ~80 attributes total. If a single entity gets crowded, attach its attributes in a half-circle below the rectangle.

---

## 7. Sanity checklist before exporting to PDF

- [ ] Every entity has at least one underlined key attribute (weak entities have a dashed-underlined partial key + their owner's key inherited via the identifying diamond).
- [ ] `Staff` has the ISA triangle with `d` and a double line for totality.
- [ ] `Bed`, `Department_Image`, `Doctor_Image`, `Evaluation_Hospitalization` are drawn with **double borders** and each has a **double diamond** to its owner.
- [ ] The `Hospitalization → ICD10_Catalog` link appears **twice** (admission diagnosis, discharge diagnosis) with distinct role labels.
- [ ] The `Doctor → Doctor` self-loop (SUPERVISES) has two role labels: *supervisor* and *supervisee*.
- [ ] `PRESCRIBES` is a single diamond touching **three** entities (Doctor, Patient, Medicine_EMA) with attributes `start_date`, `end_date`, `dosage`, `frequency`.
- [ ] `SHIFT_ASSIGNMENT` is a single diamond touching **three** entities (Shift, Staff, Department).
- [ ] `ASSISTS_IN` connects **Staff** (the supertype), not Doctor only — the schema allows nurses to assist.
- [ ] Derived attributes (`age`, `bed_count`, `total_cost`) use **dashed** ovals.
- [ ] Cardinality labels are present on **every** connection between an entity and a relationship.
- [ ] Total participations (Hospitalization↔Patient, Bed↔Department, Triage↔Patient, Procedure↔Hospitalization, Lab_Test↔Hospitalization, Director↔Department) use **double lines**; everything else is a single line.
- [ ] Export via *File → Export as → PDF…* with "Crop" disabled and "Fit page" enabled; save to `diagrams/er.pdf`.
