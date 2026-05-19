-- MySQL Workbench Forward Engineering
-- ΣΗΜΑΝΤΙΚΟ: επιβάλλουμε UTF-8 τόσο στη σύνδεση όσο και στη βάση/πίνακες
-- ώστε τα ελληνικά string literals σε CHECK constraints και triggers
-- να αποθηκεύονται και να συγκρίνονται πάντα με το ίδιο encoding.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE SCHEMA IF NOT EXISTS `hygeiopolis_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE `hygeiopolis_db`;
ALTER DATABASE `hygeiopolis_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Table `Staff`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Staff` (
  `amka` CHAR(11) NOT NULL,
  `first_name` VARCHAR(45) NOT NULL,
  `last_name` VARCHAR(45) NOT NULL,
  `age` INT NULL,
  `email` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(45) NULL,
  `hire_date` DATE NULL,
  `staff_type` VARCHAR(45) NULL,
  PRIMARY KEY (`amka`),
  UNIQUE KEY `uq_staff_email` (`email`),
  CONSTRAINT `chk_staff_type`
    CHECK (`staff_type` IN ('Doctor', 'Nurse', 'Admin')))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Doctors`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Doctors` (
  `staff_amka` CHAR(11) NOT NULL,
  `license_number` VARCHAR(45) NOT NULL,
  `specialty` VARCHAR(45) NULL,
  `rank` VARCHAR(45) NULL,
  `supervisor_amka` CHAR(11) NULL,
  PRIMARY KEY (`staff_amka`),
  UNIQUE KEY `uq_doctor_license_number` (`license_number`),
  INDEX `fk_doctor_supervisor_idx` (`supervisor_amka` ASC),
  CONSTRAINT `chk_doctor_rank`
    CHECK (`rank` IN ('Ειδικευόμενος', 'Επιμελητής Β''', 'Επιμελητής Α''', 'Διευθυντής')),
  CONSTRAINT `fk_doctor_staff`
    FOREIGN KEY (`staff_amka`)
    REFERENCES `Staff` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_doctor_supervisor`
    FOREIGN KEY (`supervisor_amka`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Departments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Departments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(45) NOT NULL,
  `description` TEXT NULL,
  `bed_count` INT NULL,
  `floor_building` VARCHAR(45) NULL,
  `director_amka` CHAR(11) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_department_director_idx` (`director_amka` ASC),
  CONSTRAINT `fk_department_director`
    FOREIGN KEY (`director_amka`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Nurses`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Nurses` (
  `staff_amka` CHAR(11) NOT NULL,
  `rank` VARCHAR(45) NULL,
  `department_id` INT NULL,
  PRIMARY KEY (`staff_amka`),
  INDEX `fk_nurse_department_idx` (`department_id` ASC),
  CONSTRAINT `chk_nurse_rank`
    CHECK (`rank` IN ('Βοηθός Νοσηλευτή', 'Νοσηλευτής', 'Προϊστάμενος')),
  CONSTRAINT `fk_nurse_staff`
    FOREIGN KEY (`staff_amka`)
    REFERENCES `Staff` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_nurse_department`
    FOREIGN KEY (`department_id`)
    REFERENCES `Departments` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Admin_Staff`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Admin_Staff` (
  `staff_amka` CHAR(11) NOT NULL,
  `role` VARCHAR(45) NULL,
  `office` VARCHAR(45) NULL,
  `department_id` INT NULL,
  PRIMARY KEY (`staff_amka`),
  INDEX `fk_admin_department_idx` (`department_id` ASC),
  CONSTRAINT `chk_admin_role`
    CHECK (`role` IN ('Γραμματέας', 'Λογιστής', 'Διαχειριστής', 'Υπεύθυνος Προμηθειών')),
  CONSTRAINT `fk_admin_staff`
    FOREIGN KEY (`staff_amka`)
    REFERENCES `Staff` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_admin_department`
    FOREIGN KEY (`department_id`)
    REFERENCES `Departments` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Beds`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Beds` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `department_id` INT NOT NULL,
  `bed_number` VARCHAR(45) NOT NULL,
  `type` VARCHAR(45) NULL,
  `status` VARCHAR(45) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bed_dept_number` (`department_id`, `bed_number`),
  INDEX `fk_bed_department_idx` (`department_id` ASC),
  CONSTRAINT `fk_bed_department`
    FOREIGN KEY (`department_id`)
    REFERENCES `Departments` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Patients`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Patients` (
  `amka` CHAR(11) NOT NULL,
  `first_name` VARCHAR(45) NOT NULL,
  `last_name` VARCHAR(45) NOT NULL,
  `fathers_name` VARCHAR(45) NULL,
  `age` INT NULL,
  `weight` FLOAT NULL,
  `height` FLOAT NULL,
  `gender` VARCHAR(10) NULL,
  `address` VARCHAR(255) NULL,
  `phone` VARCHAR(45) NULL,
  `email` VARCHAR(100) NULL,
  `profession` VARCHAR(45) NULL,
  `citizenship` VARCHAR(45) NULL,
  `emergency_contact` TEXT NULL,
  `insurance_provider` VARCHAR(45) NULL,
  PRIMARY KEY (`amka`),
  UNIQUE KEY `uq_patient_email` (`email`),
  CONSTRAINT `chk_patient_gender`
    CHECK (`gender` IN ('Αρσενικό', 'Θηλυκό')),
  CONSTRAINT `chk_patient_age`
    CHECK (`age` IS NULL OR `age` BETWEEN 0 AND 130))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Triage_Records`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Triage_Records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `patient_amka` CHAR(11) NULL,
  `nurse_amka` CHAR(11) NULL,
  `symptoms` TEXT NULL,
  `urgency_level` INT NULL,
  `arrival_time` DATETIME NULL,
  `outcome` VARCHAR(20) NULL,
  `resolved_at` DATETIME NULL,
  `hospitalization_id` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_triage_patient_idx` (`patient_amka` ASC),
  INDEX `fk_triage_nurse_idx` (`nurse_amka` ASC),
  INDEX `idx_triage_queue` (`outcome` ASC, `urgency_level` ASC, `arrival_time` ASC),
  CONSTRAINT `chk_triage_urgency`
    CHECK (`urgency_level` IS NULL OR `urgency_level` BETWEEN 1 AND 5),
  CONSTRAINT `fk_triage_patient`
    FOREIGN KEY (`patient_amka`)
    REFERENCES `Patients` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_triage_nurse`
    FOREIGN KEY (`nurse_amka`)
    REFERENCES `Nurses` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `ICD10_Catalog`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `ICD10_Catalog` (
  `code` VARCHAR(10) NOT NULL,
  `description` TEXT NULL,
  PRIMARY KEY (`code`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Hospitalization`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Hospitalization` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `patient_amka` CHAR(11) NULL,
  `bed_id` INT NULL,
  `department_id` INT NULL,
  `admission_date` DATETIME NOT NULL,
  `discharge_date` DATETIME NULL,
  `admission_diagnosis_icd10` VARCHAR(45) NULL,
  `discharge_diagnosis_icd10` VARCHAR(45) NULL,
  `ken_code` VARCHAR(45) NULL,
  `total_cost` FLOAT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_hospitalization_patient_idx` (`patient_amka` ASC),
  INDEX `fk_hospitalization_bed_idx` (`bed_id` ASC),
  INDEX `fk_hospitalization_department_idx` (`department_id` ASC),
  INDEX `fk_hospitalization_adm_diag_idx` (`admission_diagnosis_icd10` ASC),
  INDEX `fk_hospitalization_dis_diag_idx` (`discharge_diagnosis_icd10` ASC),
  INDEX `fk_hospitalization_ken_idx` (`ken_code` ASC),
  CONSTRAINT `fk_hospitalization_patient`
    FOREIGN KEY (`patient_amka`)
    REFERENCES `Patients` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hospitalization_bed`
    FOREIGN KEY (`bed_id`)
    REFERENCES `Beds` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hospitalization_department`
    FOREIGN KEY (`department_id`)
    REFERENCES `Departments` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hospitalization_adm_diag`
    FOREIGN KEY (`admission_diagnosis_icd10`)
    REFERENCES `ICD10_Catalog` (`code`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hospitalization_dis_diag`
    FOREIGN KEY (`discharge_diagnosis_icd10`)
    REFERENCES `ICD10_Catalog` (`code`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hospitalization_ken`
    FOREIGN KEY (`ken_code`)
    REFERENCES `KEN_Catalog` (`code`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Doctor_has_Department`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Doctor_has_Department` (
  `doctor_amka` CHAR(11) NOT NULL,
  `department_id` INT NOT NULL,
  PRIMARY KEY (`doctor_amka`, `department_id`),
  INDEX `fk_dhd_department_idx` (`department_id` ASC),
  CONSTRAINT `fk_dhd_doctor`
    FOREIGN KEY (`doctor_amka`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_dhd_department`
    FOREIGN KEY (`department_id`)
    REFERENCES `Departments` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `KEN_Catalog`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `KEN_Catalog` (
  `code` VARCHAR(10) NOT NULL,
  `description` TEXT NULL,
  `basic_cost` FLOAT NULL,
  `avg_duration_days` INT NULL,
  PRIMARY KEY (`code`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Medical_Procedure_Catalog`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Medical_Procedure_Catalog` (
  `code` VARCHAR(10) NOT NULL,
  `name` VARCHAR(255) NULL,
  `category` VARCHAR(100) NULL,
  `standard_duration` TIME NULL,
  `standard_cost` FLOAT NULL,
  PRIMARY KEY (`code`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Spaces`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Spaces` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NULL,
  `type` VARCHAR(45) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Procedure_Records`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Procedure_Records` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `hospitalization_id` INT NULL,
  `procedure_code` VARCHAR(10) NULL,
  `space_id` INT NULL,
  `main_surgeon_amk` CHAR(11) NULL,
  `start_time` DATETIME NULL,
  `end_time` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_proc_hospitalization_idx` (`hospitalization_id` ASC),
  INDEX `fk_proc_proc_code_idx` (`procedure_code` ASC),
  INDEX `fk_proc_space_idx` (`space_id` ASC),
  INDEX `fk_proc_doctor_idx` (`main_surgeon_amk` ASC),
  CONSTRAINT `fk_proc_hospitalization`
    FOREIGN KEY (`hospitalization_id`)
    REFERENCES `Hospitalization` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_proc_proc_code`
    FOREIGN KEY (`procedure_code`)
    REFERENCES `Medical_Procedure_Catalog` (`code`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_proc_space`
    FOREIGN KEY (`space_id`)
    REFERENCES `Spaces` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_proc_doctor`
    FOREIGN KEY (`main_surgeon_amk`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Procedure_Assistants`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Procedure_Assistants` (
  `procedure_record_id` INT NOT NULL,
  `staff_amka` CHAR(11) NOT NULL,
  PRIMARY KEY (`procedure_record_id`, `staff_amka`),
  INDEX `fk_pa_staff_idx` (`staff_amka` ASC),
  CONSTRAINT `fk_pa_proc_rec`
    FOREIGN KEY (`procedure_record_id`)
    REFERENCES `Procedure_Records` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pa_staff`
    FOREIGN KEY (`staff_amka`)
    REFERENCES `Staff` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE
) ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Medicine_EMA`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Medicine_EMA` (
  `code` VARCHAR(50) NOT NULL,
  `brand_name` VARCHAR(255) NULL,
  PRIMARY KEY (`code`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Active_Substances`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Active_Substances` (
  `id` INT NOT NULL,
  `name` VARCHAR(255) NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Medicine_has_Substances`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Medicine_has_Substances` (
  `medicine_code` VARCHAR(50) NOT NULL,
  `substance_id` INT NOT NULL,
  PRIMARY KEY (`medicine_code`, `substance_id`),
  INDEX `fk_mhs_substance_idx` (`substance_id` ASC),
  CONSTRAINT `fk_mhs_medicine`
    FOREIGN KEY (`medicine_code`)
    REFERENCES `Medicine_EMA` (`code`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_mhs_substance`
    FOREIGN KEY (`substance_id`)
    REFERENCES `Active_Substances` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Patient_Allergies`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Patient_Allergies` (
  `patient_amka` CHAR(11) NOT NULL,
  `substance_id` INT NOT NULL,
  PRIMARY KEY (`patient_amka`, `substance_id`),
  INDEX `fk_patall_substance_idx` (`substance_id` ASC),
  CONSTRAINT `fk_patall_patient`
    FOREIGN KEY (`patient_amka`)
    REFERENCES `Patients` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_patall_substance`
    FOREIGN KEY (`substance_id`)
    REFERENCES `Active_Substances` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Prescriptions`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Prescriptions` (
  `doctor_amka` CHAR(11) NOT NULL,
  `patient_amka` CHAR(11) NOT NULL,
  `medicine_code` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NULL,
  `dosage` VARCHAR(100) NULL,
  `frequency` VARCHAR(100) NULL,
  PRIMARY KEY (`doctor_amka`, `patient_amka`, `medicine_code`, `start_date`),
  INDEX `fk_prescr_patient_idx` (`patient_amka` ASC),
  INDEX `fk_prescr_medicine_idx` (`medicine_code` ASC),
  CONSTRAINT `fk_prescr_doctor`
    FOREIGN KEY (`doctor_amka`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_prescr_patient`
    FOREIGN KEY (`patient_amka`)
    REFERENCES `Patients` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_prescr_medicine`
    FOREIGN KEY (`medicine_code`)
    REFERENCES `Medicine_EMA` (`code`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Lab_Tests`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Lab_Tests` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `hospitalization_id` INT NULL,
  `ordering_doctor_amka` CHAR(11) NULL,
  `type` VARCHAR(100) NULL,
  `test_date` DATETIME NULL,
  `result_text` TEXT NULL,
  `result_value` FLOAT NULL,
  `unit` VARCHAR(20) NULL,
  `cost` FLOAT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_lab_hospitalization_idx` (`hospitalization_id` ASC),
  INDEX `fk_lab_doctor_idx` (`ordering_doctor_amka` ASC),
  CONSTRAINT `fk_lab_hospitalization`
    FOREIGN KEY (`hospitalization_id`)
    REFERENCES `Hospitalization` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_lab_doctor`
    FOREIGN KEY (`ordering_doctor_amka`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Evaluation_Hospitalization`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Evaluation_Hospitalization` (
  `hospitalization_id` INT NOT NULL,
  `nursing_care` INT NULL,
  `cleanliness` INT NULL,
  `food` INT NULL,
  `overall_experience` INT NULL,
  PRIMARY KEY (`hospitalization_id`),
  CONSTRAINT `chk_eh_nursing_care`     CHECK (`nursing_care`       IS NULL OR `nursing_care`       BETWEEN 1 AND 5),
  CONSTRAINT `chk_eh_cleanliness`      CHECK (`cleanliness`        IS NULL OR `cleanliness`        BETWEEN 1 AND 5),
  CONSTRAINT `chk_eh_food`             CHECK (`food`               IS NULL OR `food`               BETWEEN 1 AND 5),
  CONSTRAINT `chk_eh_overall`          CHECK (`overall_experience` IS NULL OR `overall_experience` BETWEEN 1 AND 5),
  CONSTRAINT `fk_eh_hospitalization`
    FOREIGN KEY (`hospitalization_id`)
    REFERENCES `Hospitalization` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `Evaluation_Doctor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Evaluation_Doctor` (
  `hospitalization_id` INT NOT NULL,
  `doctor_amka` CHAR(11) NOT NULL,
  `medical_care` INT NULL,
  PRIMARY KEY (`hospitalization_id`, `doctor_amka`),
  INDEX `fk_ed_doctor_idx` (`doctor_amka` ASC),
  CONSTRAINT `chk_ed_medical_care`
    CHECK (`medical_care` IS NULL OR `medical_care` BETWEEN 1 AND 5),
  CONSTRAINT `fk_ed_hospitalization`
    FOREIGN KEY (`hospitalization_id`)
    REFERENCES `Hospitalization` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_ed_doctor`
    FOREIGN KEY (`doctor_amka`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Tables for entity images
--
-- Σημείωση σχεδιασμού: αρχικά υπήρχε ένα γενικό `Entity_Images`
-- με πεδία `entity_type`+`entity_id`, το οποίο όμως δεν επέτρεπε
-- foreign keys (το `entity_id` ποικίλει ανά τύπο). Σπάμε σε
-- ξεχωριστούς πίνακες ανά οντότητα ώστε να μπορούμε να δηλώσουμε
-- κανονικά FK + ON DELETE CASCADE, όπως κάνει και ο υπόλοιπος
-- σχεδιασμός της βάσης.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Department_Images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `department_id` INT NOT NULL,
  `image_url` VARCHAR(500) NULL,
  `description` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_dept_image_dept_idx` (`department_id` ASC),
  CONSTRAINT `fk_dept_image_dept`
    FOREIGN KEY (`department_id`)
    REFERENCES `Departments` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `Doctor_Images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `doctor_amka` CHAR(11) NOT NULL,
  `image_url` VARCHAR(500) NULL,
  `description` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_doctor_image_doctor_idx` (`doctor_amka` ASC),
  CONSTRAINT `fk_doctor_image_doctor`
    FOREIGN KEY (`doctor_amka`)
    REFERENCES `Doctors` (`staff_amka`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `Shifts`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Shifts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shift_date` DATE NOT NULL,
  `shift_type` VARCHAR(20) NOT NULL, -- 'Morning', 'Afternoon', 'Night'
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shift_date_type` (`shift_date`, `shift_type`),
  CONSTRAINT `chk_shift_type`
    CHECK (`shift_type` IN ('Morning', 'Afternoon', 'Night')))
ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table `Shift_Assignments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `Shift_Assignments` (
  `shift_id` INT NOT NULL,
  `staff_amka` CHAR(11) NOT NULL,
  `department_id` INT NOT NULL,
  PRIMARY KEY (`shift_id`, `staff_amka`, `department_id`),
  INDEX `fk_sa_staff_idx` (`staff_amka` ASC),
  INDEX `fk_sa_dept_idx` (`department_id` ASC),
  CONSTRAINT `fk_sa_shift`
    FOREIGN KEY (`shift_id`)
    REFERENCES `Shifts` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sa_staff`
    FOREIGN KEY (`staff_amka`)
    REFERENCES `Staff` (`amka`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE,
  CONSTRAINT `fk_sa_dept`
    FOREIGN KEY (`department_id`)
    REFERENCES `Departments` (`id`)
    ON DELETE NO ACTION
    ON UPDATE CASCADE)
ENGINE = InnoDB;

DROP TRIGGER IF EXISTS check_allergy_before_prescription;
DELIMITER //
CREATE TRIGGER check_allergy_before_prescription
BEFORE INSERT ON Prescriptions
FOR EACH ROW
BEGIN
    DECLARE allergy_count INT;
    
    -- Έλεγχος αν κάποια δραστική ουσία του φαρμάκου υπάρχει στις αλλεργίες του ασθενή
    SELECT COUNT(*) INTO allergy_count
    FROM Medicine_has_Substances mhs
    JOIN Patient_Allergies pa ON mhs.substance_id = pa.substance_id
    WHERE mhs.medicine_code = NEW.medicine_code 
      AND pa.patient_amka = NEW.patient_amka;

    IF allergy_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Αλλεργία: Ο ασθενής είναι αλλεργικός σε δραστική ουσία φαρμάκου.';
    END IF;
END //
DELIMITER ;

DROP TRIGGER IF EXISTS check_monthly_shift_limits;
DELIMITER //
CREATE TRIGGER check_monthly_shift_limits
BEFORE INSERT ON Shift_Assignments
FOR EACH ROW
BEGIN
    DECLARE current_shifts INT;
    DECLARE p_type VARCHAR(45);
    DECLARE s_date DATE;

    SELECT staff_type INTO p_type FROM Staff WHERE amka = NEW.staff_amka;
    SELECT shift_date INTO s_date FROM Shifts WHERE id = NEW.shift_id;

    -- Καταμέτρηση υπαρχουσών βαρδιών για τον συγκεκριμένο μήνα
    SELECT COUNT(*) INTO current_shifts
    FROM Shift_Assignments sa
    JOIN Shifts s ON sa.shift_id = s.id
    WHERE sa.staff_amka = NEW.staff_amka
      AND MONTH(s.shift_date) = MONTH(s_date)
      AND YEAR(s.shift_date) = YEAR(s_date);

    IF (p_type = 'Doctor' AND current_shifts >= 15) OR
       (p_type = 'Nurse' AND current_shifts >= 20) OR
       (p_type = 'Admin' AND current_shifts >= 25) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Υπέρβαση μέγιστου μηνιαίου ορίου βαρδιών για την κατηγορία.';
    END IF;
END //
DELIMITER ;

DROP TRIGGER IF EXISTS check_shift_rest_and_night_limit;
DELIMITER //
CREATE TRIGGER check_shift_rest_and_night_limit
BEFORE INSERT ON Shift_Assignments
FOR EACH ROW
BEGIN
    DECLARE new_shift_type VARCHAR(20);
    DECLARE new_shift_date DATE;
    DECLARE night_streak    INT DEFAULT 0;
    DECLARE streak_ok       INT DEFAULT 1;

    -- Τύπος και ημερομηνία της νέας βάρδιας
    SELECT shift_type, shift_date
      INTO new_shift_type, new_shift_date
      FROM Shifts WHERE id = NEW.shift_id;

    -- ────────────────────────────────────────────────────────────────
    -- 1. Έλεγχος max 3 συνεχόμενων νυχτερινών
    --    Λογική: αν η νέα είναι Night, κοιτάμε τις αμέσως προηγούμενες
    --    βάρδιες (χρονολογικά) του ίδιου ατόμου και μετράμε πόσες
    --    συνεχόμενες νυχτερινές υπάρχουν πριν από αυτήν.
    --    Χρησιμοποιούμε user-variable loop μέσα σε subquery για MariaDB.
    -- ────────────────────────────────────────────────────────────────
    IF new_shift_type = 'Night' THEN
        -- Μετράμε τις αμέσως προηγούμενες ΗΜΕΡΟΛΟΓΙΑΚΑ ΣΥΝΕΧΟΜΕΝΕΣ νυχτερινές.
        -- Κάθε νυχτερινή βάρδια καλύπτει ένα 24ωρο (shift_date),
        -- οπότε "συνεχόμενη" σημαίνει shift_date = νέα - 1, νέα - 2 κλπ.
        SELECT COUNT(*) INTO night_streak
        FROM Shift_Assignments sa
        JOIN Shifts s ON sa.shift_id = s.id
        WHERE sa.staff_amka = NEW.staff_amka
          AND s.shift_type  = 'Night'
          AND s.shift_date  IN (
              DATE_SUB(new_shift_date, INTERVAL 1 DAY),
              DATE_SUB(new_shift_date, INTERVAL 2 DAY)
          );

        -- Αν υπάρχουν ήδη 2 συνεχόμενες νυχτερινές τις 2 προηγούμενες μέρες,
        -- η νέα θα ήταν η 3η: επιτρέπεται.
        -- Αν υπάρχουν 2 ΚΑΙ επίσης υπάρχει νυχτερινή 3 μέρες πριν → 3 ήδη → απαγόρευση.
        IF night_streak >= 2 THEN
            -- Ελέγχουμε αν η 3 μέρες πριν είναι επίσης Night (άρα θα γίνει η 4η)
            IF EXISTS (
                SELECT 1 FROM Shift_Assignments sa2
                JOIN Shifts s2 ON sa2.shift_id = s2.id
                WHERE sa2.staff_amka = NEW.staff_amka
                  AND s2.shift_type  = 'Night'
                  AND s2.shift_date  = DATE_SUB(new_shift_date, INTERVAL 3 DAY)
            ) THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Απαγόρευση: Δεν επιτρέπονται πάνω από 3 συνεχόμενες νυχτερινές.';
            END IF;
        END IF;
    END IF;

    -- ────────────────────────────────────────────────────────────────
    -- 2. Έλεγχος ελάχιστου 8ωρου ανάπαυσης μεταξύ διαδοχικών βαρδιών
    --
    --    Βάρδιες και τα άκρα τους:
    --      Morning   07:00 – 15:00
    --      Afternoon 15:00 – 23:00
    --      Night     23:00 – 07:00 (+1 μέρα)
    --
    --    Ζεύγη με < 8 ώρες ανάπαυσης (= 0 ώρες στο παρακάτω, αφού
    --    οι βάρδιες ακολουθούν η μία την άλλη χωρίς κενό):
    --      Morning   → Afternoon  ίδια μέρα         (τέλος 15:00, έναρξη 15:00)
    --      Afternoon → Night      ίδια μέρα         (τέλος 23:00, έναρξη 23:00)
    --      Night     → Morning    επόμενη μέρα      (τέλος 07:00, έναρξη 07:00)
    --    Άρα απαγορεύουμε και τα τρία.
    -- ────────────────────────────────────────────────────────────────
    IF EXISTS (
        SELECT 1
        FROM Shift_Assignments sa
        JOIN Shifts s_ex ON sa.shift_id = s_ex.id
        WHERE sa.staff_amka = NEW.staff_amka
          AND (
              -- Morning → Afternoon ή Afternoon → Night (ίδια μέρα, διπλανές βάρδιες)
              (s_ex.shift_date = new_shift_date
               AND (
                   (s_ex.shift_type = 'Morning'   AND new_shift_type = 'Afternoon')
                OR (s_ex.shift_type = 'Afternoon' AND new_shift_type = 'Morning')
                OR (s_ex.shift_type = 'Afternoon' AND new_shift_type = 'Night')
                OR (s_ex.shift_type = 'Night'     AND new_shift_type = 'Afternoon')
               )
              )
              OR
              -- Night (χθες) → Morning (σήμερα)
              (DATEDIFF(new_shift_date, s_ex.shift_date) = 1
               AND s_ex.shift_type = 'Night' AND new_shift_type = 'Morning')
              OR
              -- Morning (σήμερα) → Night (χθες) [αν εισάγεται αναδρομικά]
              (DATEDIFF(s_ex.shift_date, new_shift_date) = 1
               AND new_shift_type = 'Night' AND s_ex.shift_type = 'Morning')
          )
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Απαγόρευση: Απαιτείται τουλάχιστον 8ωρο ανάπαυσης μεταξύ βαρδιών.';
    END IF;

END //
DELIMITER ;

DROP TRIGGER IF EXISTS check_doctor_supervision;
DELIMITER //
CREATE TRIGGER check_doctor_supervision
BEFORE INSERT ON Doctors
FOR EACH ROW
BEGIN
    -- Οι Ειδικευόμενοι πρέπει υποχρεωτικά να έχουν επόπτη
    IF NEW.rank = 'Ειδικευόμενος' AND NEW.supervisor_amka IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Οι ειδικευόμενοι ιατροί πρέπει υποχρεωτικά να έχουν επόπτη.';
    END IF;

    -- Οι Διευθυντές δεν επιτρέπεται να έχουν επόπτη
    IF NEW.rank = 'Διευθυντής' AND NEW.supervisor_amka IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Οι Διευθυντές δεν επιτρέπεται να έχουν επόπτη.';
    END IF;

    -- Απαγόρευση άμεσης κυκλικής εποπτείας (A→B και B→A)
    -- Η πλήρης αναδρομική ανίχνευση κύκλων γίνεται με CTE σε stored procedure.
    -- Εδώ ελέγχουμε τουλάχιστον τον άμεσο κύκλο βάθους 1.
    IF NEW.supervisor_amka IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM Doctors
            WHERE staff_amka    = NEW.supervisor_amka
              AND supervisor_amka = NEW.staff_amka
        ) THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Σφάλμα: Κυκλική αλυσίδα εποπτείας απαγορεύεται.';
        END IF;
    END IF;
END //
DELIMITER ;

-- Ίδιοι έλεγχοι και για UPDATE (π.χ. αλλαγή supervisor ή rank)
DROP TRIGGER IF EXISTS check_doctor_supervision_update;
DELIMITER //
CREATE TRIGGER check_doctor_supervision_update
BEFORE UPDATE ON Doctors
FOR EACH ROW
BEGIN
    IF NEW.rank = 'Ειδικευόμενος' AND NEW.supervisor_amka IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Οι ειδικευόμενοι ιατροί πρέπει υποχρεωτικά να έχουν επόπτη.';
    END IF;

    IF NEW.rank = 'Διευθυντής' AND NEW.supervisor_amka IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Οι Διευθυντές δεν επιτρέπεται να έχουν επόπτη.';
    END IF;

    IF NEW.supervisor_amka IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM Doctors
            WHERE staff_amka     = NEW.supervisor_amka
              AND supervisor_amka = NEW.staff_amka
        ) THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Σφάλμα: Κυκλική αλυσίδα εποπτείας απαγορεύεται.';
        END IF;
    END IF;
END //
DELIMITER ;

DROP TRIGGER IF EXISTS calculate_hospitalization_cost;
DELIMITER //
CREATE TRIGGER calculate_hospitalization_cost
BEFORE UPDATE ON Hospitalization
FOR EACH ROW
BEGIN
    DECLARE base_cost FLOAT;
    DECLARE mdn_days INT;
    DECLARE actual_days INT;
    DECLARE extra_daily_charge FLOAT DEFAULT 100.0; -- Παραδοχή για την πρόσθετη χρέωση

    IF NEW.discharge_date IS NOT NULL AND OLD.discharge_date IS NULL THEN
        -- Παίρνουμε τα στοιχεία από τον κατάλογο ΚΕΝ
        SELECT basic_cost, avg_duration_days INTO base_cost, mdn_days
        FROM KEN_Catalog WHERE code = NEW.ken_code;

        -- Αμυντικός έλεγχος: αν για κάποιο λόγο ο κωδικός ΚΕΝ δεν υπάρχει
        -- στον κατάλογο (π.χ. NULL ή stale μετά από bulk load με FK_CHECKS=0),
        -- κόβουμε αντί να αφήσουμε σιωπηλό NULL κόστος.
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
    END IF;
END //
DELIMITER ;

-- =====================================================
-- ΝΕΟΙ TRIGGERS (απαιτήσεις εκφώνησης + λογική ακεραιότητα)
-- =====================================================

-- -----------------------------------------------------
-- Trigger: Ειδικευόμενος σε βάρδια → υποχρεωτικά
--          παρών Επιμελητής Α΄ ή Διευθυντής (εκφώνηση)
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_resident_supervision_in_shift;
DELIMITER //
CREATE TRIGGER check_resident_supervision_in_shift
BEFORE INSERT ON Shift_Assignments
FOR EACH ROW
BEGIN
    DECLARE is_resident   INT DEFAULT 0;
    DECLARE senior_present INT DEFAULT 0;

    SELECT COUNT(*) INTO is_resident
    FROM Doctors
    WHERE staff_amka = NEW.staff_amka
      AND `rank` = 'Ειδικευόμενος';

    IF is_resident > 0 THEN
        SELECT COUNT(*) INTO senior_present
        FROM Shift_Assignments sa
        JOIN Doctors d ON sa.staff_amka = d.staff_amka
        WHERE sa.shift_id      = NEW.shift_id
          AND sa.department_id = NEW.department_id
          AND d.`rank` IN ('Επιμελητής Α''', 'Διευθυντής');

        IF senior_present = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Σφάλμα: Βάρδια με Ειδικευόμενο απαιτεί Επιμελητή Α΄ ή Διευθυντή.';
        END IF;
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- Trigger: Overlap χώρου ή κύριου χειρουργού σε
--          ταυτόχρονες επεμβάσεις (εκφώνηση)
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_procedure_overlap;
DELIMITER //
CREATE TRIGGER check_procedure_overlap
BEFORE INSERT ON Procedure_Records
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM Procedure_Records
        WHERE space_id   = NEW.space_id
          AND start_time < NEW.end_time
          AND end_time   > NEW.start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Ο χώρος είναι ήδη κατειλημμένος αυτή την ώρα.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM Procedure_Records
        WHERE main_surgeon_amk = NEW.main_surgeon_amk
          AND start_time       < NEW.end_time
          AND end_time         > NEW.start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Ο ιατρός συμμετέχει ήδη σε επέμβαση αυτή την ώρα.';
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- Trigger: Αξιολόγηση νοσηλείας μόνο μετά την έξοδο
--          (εκφώνηση: "ασθενείς με ολοκληρωμένη νοσηλεία")
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_evaluation_hosp_completed;
DELIMITER //
CREATE TRIGGER check_evaluation_hosp_completed
BEFORE INSERT ON Evaluation_Hospitalization
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Hospitalization
        WHERE id = NEW.hospitalization_id
          AND discharge_date IS NOT NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Αξιολόγηση νοσηλείας επιτρέπεται μόνο μετά την έξοδο.';
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- Trigger: Αξιολόγηση ιατρού μόνο μετά την έξοδο
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_evaluation_doctor_completed;
DELIMITER //
CREATE TRIGGER check_evaluation_doctor_completed
BEFORE INSERT ON Evaluation_Doctor
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Hospitalization
        WHERE id = NEW.hospitalization_id
          AND discharge_date IS NOT NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Αξιολόγηση ιατρού επιτρέπεται μόνο μετά την έξοδο.';
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- Trigger: Κλίνη να ανήκει στο ίδιο τμήμα της νοσηλείας
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_bed_department_match;
DELIMITER //
CREATE TRIGGER check_bed_department_match
BEFORE INSERT ON Hospitalization
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Beds
        WHERE id            = NEW.bed_id
          AND department_id = NEW.department_id
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Η κλίνη δεν ανήκει στο τμήμα της νοσηλείας.';
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- Trigger: Κλίνη να μην είναι ήδη κατειλημμένη
--          (ενεργή νοσηλεία χωρίς discharge_date)
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_bed_availability;
DELIMITER //
CREATE TRIGGER check_bed_availability
BEFORE INSERT ON Hospitalization
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM Hospitalization
        WHERE bed_id        = NEW.bed_id
          AND discharge_date IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Η κλίνη είναι ήδη κατειλημμένη.';
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- Trigger: Ημερομηνία εξόδου μετά την εισαγωγή
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_discharge_after_admission;
DELIMITER //
CREATE TRIGGER check_discharge_after_admission
BEFORE UPDATE ON Hospitalization
FOR EACH ROW
BEGIN
    IF NEW.discharge_date IS NOT NULL
       AND NEW.discharge_date <= NEW.admission_date THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Η ημερομηνία εξόδου πρέπει να είναι μετά την εισαγωγή.';
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- Trigger: Συνταγογράφηση μόνο κατά τη διάρκεια
--          ενεργής νοσηλείας του ασθενή
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS check_prescription_during_hospitalization;
DELIMITER //
CREATE TRIGGER check_prescription_during_hospitalization
BEFORE INSERT ON Prescriptions
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Hospitalization
        WHERE patient_amka    = NEW.patient_amka
          AND DATE(admission_date) <= NEW.start_date
          AND (discharge_date IS NULL
               OR DATE(discharge_date) >= NEW.start_date)
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Συνταγογράφηση επιτρέπεται μόνο κατά τη διάρκεια νοσηλείας.';
    END IF;
END //
DELIMITER ;

-- =====================================================
-- Secondary indexes (REVIEW §5.3)
-- Κάθε δείκτης επιταχύνει συγκεκριμένα queries:
--   idx_hosp_admission_year       → Q1, Q9, Q14 (φιλτράρισμα/γκρουπάρισμα ανά έτος εισαγωγής)
--   idx_hosp_dept_year            → Q1, Q3      (έσοδα/νοσηλείες ανά τμήμα × χρονιά)
--   idx_proc_start_time           → Q11         (επεμβάσεις ανά έτος / συγκρίσεις counts)
--   idx_shift_date_type υπάρχει ήδη ως UNIQUE key uq_shift_date_type
--   idx_triage_arrival            → Q15         (κατανομή triage ανά ώρα/επίπεδο)
--   idx_pres_patient_start        → Q10         (ζευγάρια ουσιών ανά νοσηλεία/περίοδο)
--   idx_lab_test_date             → reporting   (φιλτράρισμα ανά ημερομηνία εξέτασης)
-- =====================================================
CREATE INDEX `idx_hosp_admission_year` ON `Hospitalization` (`admission_date`);
CREATE INDEX `idx_hosp_dept_year`      ON `Hospitalization` (`department_id`, `admission_date`);
CREATE INDEX `idx_proc_start_time`     ON `Procedure_Records` (`start_time`);
CREATE INDEX `idx_triage_arrival`      ON `Triage_Records` (`arrival_time`, `urgency_level`);
CREATE INDEX `idx_pres_patient_start`  ON `Prescriptions` (`patient_amka`, `start_date`);
CREATE INDEX `idx_lab_test_date`       ON `Lab_Tests` (`test_date`);


-- =====================================================
-- UPDATE-triggers που αντικατοπτρίζουν τα INSERT-triggers
-- για να μην παρακάμπτονται οι κανόνες μέσω UPDATE.
-- =====================================================

-- Κλίνη να μην είναι ήδη κατειλημμένη (UPDATE bed_id σε ενεργή νοσηλεία)
DROP TRIGGER IF EXISTS check_bed_availability_update;
DELIMITER //
CREATE TRIGGER check_bed_availability_update
BEFORE UPDATE ON Hospitalization
FOR EACH ROW
BEGIN
    IF NEW.bed_id IS NOT NULL
       AND (OLD.bed_id IS NULL OR NEW.bed_id <> OLD.bed_id)
       AND EXISTS (
           SELECT 1 FROM Hospitalization
           WHERE bed_id         = NEW.bed_id
             AND id            <> NEW.id
             AND discharge_date IS NULL
       ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Η κλίνη είναι ήδη κατειλημμένη.';
    END IF;
END //
DELIMITER ;

-- Κλίνη να ανήκει στο ίδιο τμήμα της νοσηλείας (και σε UPDATE)
DROP TRIGGER IF EXISTS check_bed_department_match_update;
DELIMITER //
CREATE TRIGGER check_bed_department_match_update
BEFORE UPDATE ON Hospitalization
FOR EACH ROW
BEGIN
    IF (NEW.bed_id        IS NOT NULL)
       AND (NEW.department_id IS NOT NULL)
       AND ( OLD.bed_id <=> NEW.bed_id = 0
             OR OLD.department_id <=> NEW.department_id = 0 )
       AND NOT EXISTS (
           SELECT 1 FROM Beds
           WHERE id            = NEW.bed_id
             AND department_id = NEW.department_id
       ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Η κλίνη δεν ανήκει στο τμήμα της νοσηλείας.';
    END IF;
END //
DELIMITER ;

-- Overlap χώρου ή κύριου χειρουργού (UPDATE, με self-exclusion)
DROP TRIGGER IF EXISTS check_procedure_overlap_update;
DELIMITER //
CREATE TRIGGER check_procedure_overlap_update
BEFORE UPDATE ON Procedure_Records
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM Procedure_Records
        WHERE id         <> NEW.id
          AND space_id    = NEW.space_id
          AND start_time  < NEW.end_time
          AND end_time    > NEW.start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Ο χώρος είναι ήδη κατειλημμένος αυτή την ώρα.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM Procedure_Records
        WHERE id               <> NEW.id
          AND main_surgeon_amk  = NEW.main_surgeon_amk
          AND start_time        < NEW.end_time
          AND end_time          > NEW.start_time
    ) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Ο ιατρός συμμετέχει ήδη σε επέμβαση αυτή την ώρα.';
    END IF;
END //
DELIMITER ;


-- =====================================================
-- Stored procedure: Έλεγχος κυκλικής εποπτείας οποιουδήποτε
-- βάθους μέσω recursive CTE.
--
-- Το trigger check_doctor_supervision εντοπίζει μόνο
-- άμεσους κύκλους (A→B και B→A). Αυτή η διαδικασία
-- εντοπίζει κύκλους ≥ 3 βάθους. Καλέστε:
--     CALL assert_no_supervisor_cycles();
-- μετά από bulk loads (όπου τα triggers ενδέχεται να
-- έχουν παρακαμφθεί λόγω FOREIGN_KEY_CHECKS=0).
-- =====================================================
DROP PROCEDURE IF EXISTS assert_no_supervisor_cycles;
DELIMITER //
CREATE PROCEDURE assert_no_supervisor_cycles()
BEGIN
    DECLARE bad_count INT DEFAULT 0;

    -- Ξεκινάμε από κάθε γιατρό και ανεβαίνουμε στην αλυσίδα εποπτείας του.
    -- `visited` κρατά το μονοπάτι ως ',A,B,C,'. Σε κάθε βήμα, αν ο επόμενος
    -- κόμβος (next_amka) ΕΙΝΑΙ ήδη στο visited → κύκλος (is_cycle = 1).
    -- Σταματάμε την επέκταση αυτής της γραμμής αμέσως μόλις βρούμε κύκλο
    -- ή φτάσουμε σε root (next_amka IS NULL) — αλλιώς θα γινόταν infinite.
    WITH RECURSIVE chain (root_amka, next_amka, depth, visited, is_cycle) AS (
        SELECT staff_amka,
               supervisor_amka,
               1,
               CAST(CONCAT(',', staff_amka, ',') AS CHAR(2000)),
               0
        FROM Doctors

        UNION ALL

        SELECT c.root_amka,
               d.supervisor_amka,
               c.depth + 1,
               CONCAT(c.visited, c.next_amka, ','),
               CASE
                   WHEN LOCATE(CONCAT(',', c.next_amka, ','), c.visited) > 0 THEN 1
                   ELSE 0
               END
        FROM chain c
        JOIN Doctors d ON d.staff_amka = c.next_amka
        WHERE c.next_amka IS NOT NULL
          AND c.is_cycle  = 0
          AND c.depth     < 50
    )
    SELECT COUNT(*) INTO bad_count
    FROM chain
    WHERE is_cycle = 1;

    IF bad_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Εντοπίστηκε κύκλος στην αλυσίδα εποπτείας ιατρών.';
    END IF;
END //
DELIMITER ;


DELIMITER //
CREATE FUNCTION calculate_hospitalization_cost(p_hosp_id INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_basic     DECIMAL(10,2) DEFAULT 0;
    DECLARE v_mdn       INT           DEFAULT 0;
    DECLARE v_actual    INT           DEFAULT 0;
    DECLARE v_extra_per_day DECIMAL(10,2) DEFAULT 100.00;
    DECLARE v_total     DECIMAL(10,2) DEFAULT 0;
    DECLARE v_adm DATETIME;
    DECLARE v_dis DATETIME;

    SELECT k.basic_cost, k.avg_duration_days, h.admission_date, h.discharge_date
      INTO v_basic, v_mdn, v_adm, v_dis
    FROM Hospitalization h
    JOIN KEN_Catalog k ON h.ken_code = k.code
    WHERE h.id = p_hosp_id;

    IF v_dis IS NULL THEN
        -- Ενεργή νοσηλεία: επιστρέφουμε basic cost μόνο
        RETURN v_basic;
    END IF;

    SET v_actual = DATEDIFF(v_dis, v_adm);
    SET v_total  = v_basic + GREATEST(0, v_actual - v_mdn) * v_extra_per_day;
    RETURN v_total;
END //
DELIMITER ;

-- -----------------------------------------------------
-- PROCEDURE 2: recalculate_all_hospitalization_costs()
-- Ξανα-υπολογίζει τα costs όλων των νοσηλειών.
-- Χρήσιμο μετά από bulk import ή αλλαγή ΚΕΝ τιμολογίου.
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS recalculate_all_hospitalization_costs;
DELIMITER //
CREATE PROCEDURE recalculate_all_hospitalization_costs()
BEGIN
    UPDATE Hospitalization h
    SET h.total_cost = calculate_hospitalization_cost(h.id)
    WHERE h.discharge_date IS NOT NULL;

    SELECT ROW_COUNT() AS rows_updated;
END //
DELIMITER ;

-- -----------------------------------------------------
-- FUNCTION 3: get_department_revenue(dept_id, year)
-- Συνολικά έσοδα τμήματος για συγκεκριμένο έτος.
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS get_department_revenue;
DELIMITER //
CREATE FUNCTION get_department_revenue(p_dept_id INT, p_year INT)
RETURNS DECIMAL(12,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_revenue DECIMAL(12,2) DEFAULT 0;

    SELECT COALESCE(SUM(total_cost), 0) INTO v_revenue
    FROM Hospitalization
    WHERE department_id = p_dept_id
      AND YEAR(admission_date) = p_year;

    RETURN v_revenue;
END //
DELIMITER ;

-- -----------------------------------------------------
-- FUNCTION 4: available_beds_in_dept(dept_id)
-- Πόσες κλίνες είναι διαθέσιμες στο τμήμα ΤΩΡΑ.
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS available_beds_in_dept;
DELIMITER //
CREATE FUNCTION available_beds_in_dept(p_dept_id INT)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE v_count INT DEFAULT 0;

    -- Διαθέσιμη = δεν είναι 'Υπό Συντήρηση' ΚΑΙ δεν έχει ενεργή νοσηλεία
    -- (Το status πεδίο δεν είναι αξιόπιστο γιατί δεν συγχρονίζεται πάντα
    --  με την πραγματική κατάσταση — οι ενεργές νοσηλείες είναι το ground truth)
    SELECT COUNT(*) INTO v_count
    FROM Beds b
    WHERE b.department_id = p_dept_id
      AND b.status <> 'Υπό Συντήρηση'
      AND NOT EXISTS (
          SELECT 1 FROM Hospitalization h
          WHERE h.bed_id = b.id
            AND h.discharge_date IS NULL
      );
    RETURN v_count;
END //
DELIMITER ;

-- -----------------------------------------------------
-- PROCEDURE 5: admit_patient(...)
-- Atomic εισαγωγή ασθενή:
--   - Βρίσκει διαθέσιμη κλίνη στο τμήμα
--   - Δημιουργεί νοσηλεία
--   - Ενημερώνει κατάσταση κλίνης
-- Εξάγει το νέο hosp_id μέσω OUT parameter.
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS admit_patient;
DELIMITER //
CREATE PROCEDURE admit_patient(
    IN  p_patient_amka VARCHAR(45),
    IN  p_department_id INT,
    IN  p_admission_diagnosis_icd10 VARCHAR(10),
    IN  p_ken_code VARCHAR(20),
    OUT p_new_hosp_id INT
)
BEGIN
    DECLARE v_bed_id INT DEFAULT NULL;
    DECLARE v_basic_cost DECIMAL(10,2) DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Βρίσκουμε την πρώτη διαθέσιμη κλίνη
    SELECT b.id INTO v_bed_id
    FROM Beds b
    WHERE b.department_id = p_department_id
      AND b.status = 'Διαθέσιμη'
      AND NOT EXISTS (
          SELECT 1 FROM Hospitalization h
          WHERE h.bed_id = b.id AND h.discharge_date IS NULL
      )
    LIMIT 1;

    IF v_bed_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Δεν υπάρχει διαθέσιμη κλίνη στο τμήμα.';
    END IF;

    -- Βασικό κόστος από ΚΕΝ
    SELECT basic_cost INTO v_basic_cost
    FROM KEN_Catalog WHERE code = p_ken_code;

    -- Δημιουργία νοσηλείας
    INSERT INTO Hospitalization
        (patient_amka, bed_id, department_id, admission_date,
         admission_diagnosis_icd10, ken_code, total_cost)
    VALUES
        (p_patient_amka, v_bed_id, p_department_id, NOW(),
         p_admission_diagnosis_icd10, p_ken_code, v_basic_cost);

    SET p_new_hosp_id = LAST_INSERT_ID();

    -- Κλίνη → Κατειλημμένη
    UPDATE Beds SET status = 'Κατειλημμένη' WHERE id = v_bed_id;

    COMMIT;
END //
DELIMITER ;

-- -----------------------------------------------------
-- PROCEDURE 6: discharge_patient(...)
-- Atomic έξοδος ασθενή:
--   - Κλείνει τη νοσηλεία (discharge_date + diagnosis)
--   - Υπολογίζει τελικό κόστος
--   - Ελευθερώνει την κλίνη
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS discharge_patient;
DELIMITER //
CREATE PROCEDURE discharge_patient(
    IN p_hosp_id INT,
    IN p_discharge_date DATETIME,
    IN p_discharge_diagnosis_icd10 VARCHAR(10)
)
BEGIN
    DECLARE v_bed_id INT;
    DECLARE v_final_cost DECIMAL(10,2);
    DECLARE v_already_discharged DATETIME;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT bed_id, discharge_date INTO v_bed_id, v_already_discharged
    FROM Hospitalization WHERE id = p_hosp_id;

    IF v_already_discharged IS NOT NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Σφάλμα: Η νοσηλεία είναι ήδη κλεισμένη.';
    END IF;

    -- Ενημέρωση discharge fields
    UPDATE Hospitalization
    SET discharge_date = p_discharge_date,
        discharge_diagnosis_icd10 = p_discharge_diagnosis_icd10
    WHERE id = p_hosp_id;

    -- Υπολογισμός & αποθήκευση τελικού κόστους
    SET v_final_cost = calculate_hospitalization_cost(p_hosp_id);
    UPDATE Hospitalization
    SET total_cost = v_final_cost
    WHERE id = p_hosp_id;

    -- Απελευθέρωση κλίνης
    UPDATE Beds SET status = 'Διαθέσιμη' WHERE id = v_bed_id;

    COMMIT;
END //
DELIMITER ;

-- -----------------------------------------------------
-- PROCEDURE 7: assign_to_shift(...)
-- Wrapper που εκτελεί assignment βάρδιας μέσα σε
-- transaction. Τα υπάρχοντα triggers κάνουν τους
-- ελέγχους (μηνιαία όρια, 8ωρο rest, supervision, κλπ).
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS assign_to_shift;
DELIMITER //
CREATE PROCEDURE assign_to_shift(
    IN p_shift_id INT,
    IN p_staff_amka VARCHAR(45),
    IN p_department_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    INSERT INTO Shift_Assignments (shift_id, staff_amka, department_id)
    VALUES (p_shift_id, p_staff_amka, p_department_id);
    COMMIT;
END //
DELIMITER ;

-- -----------------------------------------------------
-- PROCEDURE 8: get_patient_history(patient_amka)
-- Επιστρέφει το πλήρες ιστορικό του ασθενή
-- (multi-result-set).
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS get_patient_history;
DELIMITER //
CREATE PROCEDURE get_patient_history(IN p_patient_amka VARCHAR(45))
BEGIN
    -- Νοσηλείες
    SELECT
        h.id, h.admission_date, h.discharge_date,
        d.name AS department,
        h.admission_diagnosis_icd10,
        h.discharge_diagnosis_icd10,
        h.ken_code, h.total_cost
    FROM Hospitalization h
    JOIN Departments d ON h.department_id = d.id
    WHERE h.patient_amka = p_patient_amka
    ORDER BY h.admission_date DESC;

    -- Συνταγές
    SELECT
        p.medicine_code,
        m.brand_name,
        p.start_date, p.end_date,
        p.dosage, p.frequency,
        CONCAT(s.first_name, ' ', s.last_name) AS doctor
    FROM Prescriptions p
    JOIN Medicine_EMA m ON p.medicine_code = m.code
    JOIN Staff s ON p.doctor_amka = s.amka
    WHERE p.patient_amka = p_patient_amka
    ORDER BY p.start_date DESC;

    -- Εξετάσεις (μέσω νοσηλειών)
    SELECT
        l.type, l.test_date, l.result_text,
        l.result_value, l.unit, l.cost
    FROM Lab_Tests l
    JOIN Hospitalization h ON l.hospitalization_id = h.id
    WHERE h.patient_amka = p_patient_amka
    ORDER BY l.test_date DESC;
END //
DELIMITER ;

-- -----------------------------------------------------
-- PROCEDURE 9: get_doctor_workload(doctor_amka, year)
-- Στατιστικά φόρτου εργασίας ιατρού για συγκεκριμένο
-- έτος: βάρδιες, επεμβάσεις, συνταγές.
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS get_doctor_workload;
DELIMITER //
CREATE PROCEDURE get_doctor_workload(
    IN p_doctor_amka VARCHAR(45),
    IN p_year INT
)
BEGIN
    SELECT
        (SELECT COUNT(*)
         FROM Shift_Assignments sa
         JOIN Shifts sh ON sa.shift_id = sh.id
         WHERE sa.staff_amka = p_doctor_amka
           AND YEAR(sh.shift_date) = p_year)        AS total_shifts,

        (SELECT COUNT(*)
         FROM Procedure_Records pr
         WHERE pr.main_surgeon_amk = p_doctor_amka
           AND YEAR(pr.start_time) = p_year)        AS lead_surgeries,

        (SELECT COUNT(*)
         FROM Procedure_Assistants pa
         JOIN Procedure_Records pr ON pa.procedure_record_id = pr.id
         WHERE pa.staff_amka = p_doctor_amka
           AND YEAR(pr.start_time) = p_year)        AS assisted_surgeries,

        (SELECT COUNT(*)
         FROM Prescriptions p
         WHERE p.doctor_amka = p_doctor_amka
           AND YEAR(p.start_date) = p_year)         AS prescriptions_issued,

        (SELECT COUNT(*)
         FROM Lab_Tests l
         WHERE l.ordering_doctor_amka = p_doctor_amka
           AND YEAR(l.test_date) = p_year)          AS lab_tests_ordered;
END //
DELIMITER ;

-- -----------------------------------------------------
-- TRIGGER: auto_update_bed_status
-- Όταν δημιουργείται νοσηλεία → κλίνη γίνεται
-- 'Κατειλημμένη'. Όταν κλείνει → 'Διαθέσιμη'.
-- (Συγχρονισμός Beds.status με ενεργές νοσηλείες)
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS auto_set_bed_occupied;
DELIMITER //
CREATE TRIGGER auto_set_bed_occupied
AFTER INSERT ON Hospitalization
FOR EACH ROW
BEGIN
    IF NEW.discharge_date IS NULL THEN
        UPDATE Beds SET status = 'Κατειλημμένη' WHERE id = NEW.bed_id;
    END IF;
END //
DELIMITER ;

DROP TRIGGER IF EXISTS auto_set_bed_available;
DELIMITER //
CREATE TRIGGER auto_set_bed_available
AFTER UPDATE ON Hospitalization
FOR EACH ROW
BEGIN
    -- Όταν προστίθεται discharge_date (έξοδος ασθενή)
    IF OLD.discharge_date IS NULL AND NEW.discharge_date IS NOT NULL THEN
        UPDATE Beds SET status = 'Διαθέσιμη' WHERE id = NEW.bed_id;
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- TRIGGER: auto_calculate_cost_on_insert
-- Όταν δημιουργείται νοσηλεία, υπολογίζεται αυτόματα
-- το αρχικό cost (basic_cost ή με υπέρβαση αν ήδη
-- υπάρχει discharge_date στο INSERT).
-- Single source of truth για το cost.
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS auto_calculate_cost_on_insert;
DELIMITER //
CREATE TRIGGER auto_calculate_cost_on_insert
BEFORE INSERT ON Hospitalization
FOR EACH ROW
BEGIN
    IF NEW.discharge_date IS NOT NULL THEN
        -- Ολοκληρωμένη νοσηλεία: basic + προσαύξηση υπέρβασης ΜΔΝ
        SET NEW.total_cost = (
            SELECT k.basic_cost
                   + GREATEST(0, DATEDIFF(NEW.discharge_date, NEW.admission_date)
                              - k.avg_duration_days) * 100.00
            FROM KEN_Catalog k WHERE k.code = NEW.ken_code
        );
    ELSE
        -- Ενεργή νοσηλεία: basic cost
        SET NEW.total_cost = (
            SELECT k.basic_cost FROM KEN_Catalog k WHERE k.code = NEW.ken_code
        );
    END IF;
END //
DELIMITER ;

-- -----------------------------------------------------
-- TRIGGER: auto_calculate_cost_on_discharge
-- Όταν προστίθεται discharge_date σε ενεργή νοσηλεία
-- (μέσω UPDATE), ξανα-υπολογίζεται το final cost.
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS auto_calculate_cost_on_discharge;
DELIMITER //
CREATE TRIGGER auto_calculate_cost_on_discharge
BEFORE UPDATE ON Hospitalization
FOR EACH ROW
BEGIN
    IF OLD.discharge_date IS NULL AND NEW.discharge_date IS NOT NULL THEN
        SET NEW.total_cost = (
            SELECT k.basic_cost
                   + GREATEST(0, DATEDIFF(NEW.discharge_date, NEW.admission_date)
                              - k.avg_duration_days) * 100.00
            FROM KEN_Catalog k WHERE k.code = NEW.ken_code
        );
    END IF;
END //
DELIMITER ;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

-- =====================================================
-- Trigger: Ελάχιστη κάλυψη βάρδιας 3/6/2
-- Εμποδίζει διαγραφή Shift_Assignment αν θα αφήσει
-- τη βάρδια κάτω από το minimum (3 ιατροί / 6 νοσηλευτές / 2 διοικητικοί)
-- =====================================================
DROP TRIGGER IF EXISTS check_minimum_shift_staffing_on_delete;
DELIMITER //
CREATE TRIGGER check_minimum_shift_staffing_on_delete
BEFORE DELETE ON Shift_Assignments
FOR EACH ROW
BEGIN
    DECLARE doc_count  INT DEFAULT 0;
    DECLARE nur_count  INT DEFAULT 0;
    DECLARE adm_count  INT DEFAULT 0;
    DECLARE total_remaining INT DEFAULT 0;

    -- Bypass για bulk-delete ολόκληρης βάρδιας ή cascade από διαγραφή προσωπικού.
    -- Ο server θέτει @bypass_shift_min=1 πριν από τέτοιες λειτουργίες.
    IF @bypass_shift_min = 1 THEN
        -- skip check
        BEGIN END;
    ELSE
        SELECT COUNT(*) INTO total_remaining
        FROM Shift_Assignments sa
        WHERE sa.shift_id      = OLD.shift_id
          AND sa.department_id = OLD.department_id
          AND sa.staff_amka   <> OLD.staff_amka;

        -- Αν δεν θα μείνει κανείς, επιτρέπουμε τη διαγραφή
        -- (δεν είναι "ενεργή βάρδια κάτω από το minimum", είναι κατάργηση).
        IF total_remaining > 0 THEN
            SELECT
                SUM(CASE WHEN s.staff_type = 'Doctor' THEN 1 ELSE 0 END),
                SUM(CASE WHEN s.staff_type = 'Nurse'  THEN 1 ELSE 0 END),
                SUM(CASE WHEN s.staff_type = 'Admin'  THEN 1 ELSE 0 END)
            INTO doc_count, nur_count, adm_count
            FROM Shift_Assignments sa
            JOIN Staff s ON sa.staff_amka = s.amka
            WHERE sa.shift_id      = OLD.shift_id
              AND sa.department_id = OLD.department_id
              AND sa.staff_amka   <> OLD.staff_amka;

            IF doc_count < 3 THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Απαγόρευση: η αφαίρεση αφήνει λιγότερους από 3 ιατρούς στη βάρδια.';
            END IF;
            IF nur_count < 6 THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Απαγόρευση: η αφαίρεση αφήνει λιγότερους από 6 νοσηλευτές στη βάρδια.';
            END IF;
            IF adm_count < 2 THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Απαγόρευση: η αφαίρεση αφήνει λιγότερους από 2 διοικητικούς στη βάρδια.';
            END IF;
        END IF;
    END IF;
END //
DELIMITER ;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
