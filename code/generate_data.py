#!/usr/bin/env python3
"""
generate_data.py  (V3 — Πλήρης αναθεώρηση για ρεαλιστικά δεδομένα)
Γεννήτρια τυχαίων δεδομένων για τη ΒΔ Υγειόπολης (MariaDB/MySQL)
Παράγει: load.sql

ΔΙΟΡΘΩΣΕΙΣ V3:
  1.  Gender-aware ονόματα + last name κατάληξη (-ης/-ου, -άκης/-άκη)
  2.  Ρεαλιστικό weight/height ανά ηλικία (CDC-style growth charts)
  3.  hire_date συμβατό με ηλικία (≥22 ετών κατά την πρόσληψη)
  4.  Διευθυντής τμήματος → ειδικότητα συμβατή με το τμήμα
  5.  Director ανήκει στο τμήμα του (Doctor_has_Department)
  6.  Hospitalization cost ΠΟΤΕ δεν είναι 0 για ολοκληρωμένες νοσηλείες
  7.  Καθαρισμός διεύθυνσης από διπλά κόμματα
  8.  Triage symptoms συσχετίζονται με ηλικία/φύλο
  9.  Νοσηλεία σε Παιδιατρική μόνο για παιδιά <18
  10. Νοσηλεία σε Μαιευτική μόνο για γυναίκες 15-50
  11. Φάρμακα-νοσηλεία: συνταγή αμα ο γιατρός είναι staff
  12. Procedure χρόνος εντός εργάσιμων ωρών (06:00-22:00)
  13. Lab tests εντός νοσηλείας
  14. EAN-like medicine codes
  15. Νοσηλευτές/Διοικητικοί ΜΕΘ → only Νοσηλευτής/Προϊστάμενος (όχι Βοηθοί)
"""

import argparse
import os
import random
from collections import defaultdict
import string
from datetime import date, datetime, timedelta
import sys

random.seed(42)

# ─── Ορίσματα ─────────────────────────────────────────────────────────────────
_parser = argparse.ArgumentParser()
_parser.add_argument('--outdir', default='sql',
                     help='Φάκελος εξόδου για το load.sql (default: sql)')
_parser.add_argument('--datadir', default='data',
                     help='Φάκελος όπου βρίσκονται τα xls/xlsx reference files (default: data)')
_parser.add_argument('--sqldir', default='sql',
                     help='Φάκελος όπου βρίσκεται το ken.sql που παρήγαγε το preprocess_reference_data.py (default: sql)')
_args, _ = _parser.parse_known_args()
OUTDIR  = _args.outdir
DATADIR = _args.datadir
SQLDIR  = _args.sqldir
os.makedirs(OUTDIR, exist_ok=True)

# ============================================================
# REALISTIC GREEK NAMES (gender-aware, with proper endings)
# ============================================================

MALE_FIRST_NAMES = [
    'Γιώργος', 'Νίκος', 'Δημήτρης', 'Κώστας', 'Γιάννης', 'Παναγιώτης', 'Χρήστος',
    'Βασίλης', 'Σπύρος', 'Μιχάλης', 'Πέτρος', 'Παύλος', 'Στέλιος', 'Στέφανος',
    'Ανδρέας', 'Αντώνης', 'Θανάσης', 'Φώτης', 'Λευτέρης', 'Μάνος', 'Άρης',
    'Αλέξανδρος', 'Θοδωρής', 'Μάριος', 'Νικόλας', 'Σωτήρης', 'Τάσος', 'Φίλιππος',
    'Χάρης', 'Λάμπρος', 'Μάκης', 'Μάρκος', 'Ηλίας', 'Γρηγόρης', 'Σάββας',
    'Λάζαρος', 'Ευάγγελος', 'Απόστολος', 'Λουκάς', 'Ορέστης'
]

FEMALE_FIRST_NAMES = [
    'Μαρία', 'Ελένη', 'Κατερίνα', 'Σοφία', 'Ευαγγελία', 'Άννα', 'Γεωργία',
    'Δήμητρα', 'Παναγιώτα', 'Αναστασία', 'Χριστίνα', 'Βασιλική', 'Ειρήνη',
    'Αικατερίνη', 'Αγγελική', 'Νικολέτα', 'Δέσποινα', 'Στέλλα', 'Ζωή',
    'Ελισάβετ', 'Όλγα', 'Ιωάννα', 'Παρασκευή', 'Φωτεινή', 'Χαρά', 'Αλεξάνδρα',
    'Λίτσα', 'Μαρίνα', 'Νατάσα', 'Πελαγία', 'Σπυριδούλα', 'Τασία', 'Φανή',
    'Χρυσούλα', 'Ασημίνα', 'Βαρβάρα', 'Καλλιόπη', 'Λαμπρινή', 'Ντίνα', 'Πόπη'
]

# Greek surnames have male/female forms (e.g. Παπαδόπουλος / Παπαδοπούλου)
# Each tuple: (male_form, female_form)
SURNAMES = [
    ('Παπαδόπουλος', 'Παπαδοπούλου'), ('Γεωργίου', 'Γεωργίου'),
    ('Παπαδάκης', 'Παπαδάκη'), ('Νικολάου', 'Νικολάου'),
    ('Δημητρίου', 'Δημητρίου'), ('Αντωνίου', 'Αντωνίου'),
    ('Κωνσταντίνου', 'Κωνσταντίνου'), ('Ιωαννίδης', 'Ιωαννίδου'),
    ('Παπαϊωάννου', 'Παπαϊωάννου'), ('Παππάς', 'Παππά'),
    ('Βασιλείου', 'Βασιλείου'), ('Αναγνώστου', 'Αναγνώστου'),
    ('Οικονόμου', 'Οικονόμου'), ('Μακρής', 'Μακρή'),
    ('Πετρόπουλος', 'Πετροπούλου'), ('Παπανικολάου', 'Παπανικολάου'),
    ('Στεφανίδης', 'Στεφανίδου'), ('Καραγιάννης', 'Καραγιάννη'),
    ('Σταυρόπουλος', 'Σταυροπούλου'), ('Δημόπουλος', 'Δημοπούλου'),
    ('Αλεξίου', 'Αλεξίου'), ('Παπακωνσταντίνου', 'Παπακωνσταντίνου'),
    ('Λάμπρου', 'Λάμπρου'), ('Παπαγεωργίου', 'Παπαγεωργίου'),
    ('Σπυρόπουλος', 'Σπυροπούλου'), ('Καραμανλής', 'Καραμανλή'),
    ('Μαυρίδης', 'Μαυρίδου'), ('Παπαντωνίου', 'Παπαντωνίου'),
    ('Χατζηγεωργίου', 'Χατζηγεωργίου'), ('Σαμαράς', 'Σαμαρά'),
    ('Βλάχος', 'Βλάχου'), ('Καραμπίνης', 'Καραμπίνη'),
    ('Πολίτης', 'Πολίτη'), ('Σιδέρης', 'Σιδέρη'),
    ('Ζαφειρόπουλος', 'Ζαφειροπούλου'), ('Καρράς', 'Καρρά'),
    ('Τσιπράς', 'Τσιπρά'), ('Μητσοτάκης', 'Μητσοτάκη'),
    ('Παπανδρέου', 'Παπανδρέου'), ('Καραβίας', 'Καραβία'),
    ('Σαββίδης', 'Σαββίδου'), ('Κουρής', 'Κουρή'),
    ('Μανωλάς', 'Μανωλά'), ('Πατέρας', 'Πατέρα'),
    ('Φωτόπουλος', 'Φωτοπούλου'),
]

GREEK_CITIES = [
    'Αθήνα', 'Θεσσαλονίκη', 'Πάτρα', 'Ηράκλειο', 'Λάρισα', 'Βόλος',
    'Ιωάννινα', 'Χανιά', 'Καβάλα', 'Σέρρες', 'Καλαμάτα', 'Καλαμάτα',
    'Κέρκυρα', 'Χαλκίδα', 'Αγρίνιο', 'Καρδίτσα', 'Τρίκαλα', 'Ξάνθη',
    'Κατερίνη', 'Λαμία', 'Αλεξανδρούπολη', 'Κοζάνη', 'Βέροια', 'Δράμα'
]

GREEK_STREETS = [
    'Πατησίων', 'Σταδίου', 'Πανεπιστημίου', 'Ακαδημίας', 'Σόλωνος', 'Σόλωνος',
    'Ιπποκράτους', 'Ασκληπιού', 'Σίνα', 'Διδότου', 'Μαυρομιχάλη', 'Σόλωνος',
    'Αιόλου', 'Ερμού', 'Μητροπόλεως', 'Νίκης', 'Καραγεώργη Σερβίας',
    'Λεωφόρος Συγγρού', 'Λεωφόρος Κηφισίας', 'Βασιλίσσης Σοφίας',
    'Πεντέλης', 'Μεσογείων', 'Αλεξάνδρας', 'Κηφισίας', 'Παπανδρέου'
]

def male_name():
    return random.choice(MALE_FIRST_NAMES)

def female_name():
    return random.choice(FEMALE_FIRST_NAMES)

def staff_name():
    """Staff: 50/50 αρσενικά/θηλυκά."""
    return male_name() if random.random() < 0.5 else female_name()

def gendered_surname(gender):
    """Επώνυμο με σωστή κατάληξη ανά φύλο."""
    male_form, female_form = random.choice(SURNAMES)
    return male_form if gender == 'male' else female_form

def greek_phone():
    """Σταθερό ή κινητό ελληνικό τηλέφωνο."""
    if random.random() < 0.5:
        # Κινητό
        return f"69{random.randint(10000000, 99999999)}"
    else:
        # Σταθερό
        return f"21{random.randint(10000000, 99999999)}"

def greek_address():
    """Καθαρή ελληνική διεύθυνση, χωρίς διπλά κόμματα."""
    street = random.choice(GREEK_STREETS)
    num = random.randint(1, 250)
    city = random.choice(GREEK_CITIES)
    tk = random.randint(10000, 99999)
    return f"{street} {num}, {tk} {city}"

# ============================================================
# REALISTIC WEIGHT / HEIGHT (CDC-style, by age + gender)
# ============================================================

def realistic_weight_height(age, gender):
    """Επιστρέφει (weight_kg, height_m) ρεαλιστικά για ηλικία+φύλο."""
    is_male = (gender == 'Αρσενικό')
    # Νεογνά / βρέφη
    if age < 1:
        return round(random.uniform(3.0, 9.0), 1), round(random.uniform(0.50, 0.75), 2)
    # Νήπιο 1-3
    if age <= 3:
        return round(random.uniform(10.0, 16.0), 1), round(random.uniform(0.75, 0.95), 2)
    # Παιδί 4-7
    if age <= 7:
        return round(random.uniform(15.0, 26.0), 1), round(random.uniform(0.95, 1.25), 2)
    # Παιδί 8-11
    if age <= 11:
        return round(random.uniform(25.0, 45.0), 1), round(random.uniform(1.25, 1.50), 2)
    # Έφηβος 12-15
    if age <= 15:
        if is_male:
            return round(random.uniform(40.0, 70.0), 1), round(random.uniform(1.45, 1.75), 2)
        return round(random.uniform(40.0, 65.0), 1), round(random.uniform(1.45, 1.68), 2)
    # 16-17
    if age <= 17:
        if is_male:
            return round(random.uniform(55.0, 85.0), 1), round(random.uniform(1.65, 1.85), 2)
        return round(random.uniform(48.0, 70.0), 1), round(random.uniform(1.55, 1.72), 2)
    # Ενήλικας
    if is_male:
        return round(random.uniform(60.0, 110.0), 1), round(random.uniform(1.65, 1.95), 2)
    return round(random.uniform(48.0, 90.0), 1), round(random.uniform(1.50, 1.78), 2)

# ============================================================
# OUTPUT HELPERS
# ============================================================

out = []
def w(line): out.append(line)

def q(val):
    if val is None: return 'NULL'
    return "'" + str(val).replace("'", "''") + "'"

def sql_date(d):
    if d is None: return 'NULL'
    return f"'{d.strftime('%Y-%m-%d')}'"

def sql_dt(d):
    if d is None: return 'NULL'
    return f"'{d.strftime('%Y-%m-%d %H:%M:%S')}'"

_amka_pool = set()
def gen_amka():
    while True:
        a = ''.join(random.choices(string.digits, k=11))
        if a not in _amka_pool:
            _amka_pool.add(a)
            return a

_email_counter = [0]
def safe_email(prefix='staff'):
    _email_counter[0] += 1
    return f"{prefix}{_email_counter[0]}@hygeiopolis.gr"

def random_date(start, end):
    delta = (end - start).days
    if delta <= 0: return start
    return start + timedelta(days=random.randint(0, delta))

def random_datetime(start, end):
    d = random_date(start, end)
    return datetime(d.year, d.month, d.day, random.randint(0, 23), random.randint(0, 59))

def random_work_datetime(start, end):
    """Random datetime με ώρες εργασίας (06:00-22:00)."""
    d = random_date(start, end)
    return datetime(d.year, d.month, d.day, random.randint(6, 21), random.randint(0, 59))

# ============================================================
# STATIC LISTS
# ============================================================

# Departments + ταιριαστή ειδικότητα διευθυντή
DEPT_INFO = [
    ('Καρδιολογία',    'Καρδιολογία'),
    ('Χειρουργική',    'Χειρουργική'),
    ('ΜΕΘ',            'Αναισθησιολογία'),
    ('Επείγοντα',      'Παθολογία'),
    ('Νευρολογία',     'Νευρολογία'),
    ('Ορθοπεδική',     'Ορθοπεδική'),
    ('Παιδιατρική',    'Παιδιατρική'),
    ('Μαιευτική',      'Μαιευτική-Γυναικολογία'),
    ('Ογκολογία',      'Ογκολογία'),
    ('Πνευμονολογία',  'Πνευμονολογία'),
    ('Νεφρολογία',     'Νεφρολογία'),
    ('Ουρολογία',      'Ουρολογία'),
    ('Οφθαλμολογία',   'Οφθαλμολογία'),
    ('ΩΡΛ',            'ΩΡΛ'),
    ('Δερματολογία',   'Δερματολογία'),
]

# Πιθανές ειδικότητες για non-director γιατρούς ανά τμήμα
DEPT_RELATED_SPECIALTIES = {
    'Καρδιολογία':   ['Καρδιολογία', 'Παθολογία', 'Αιματολογία'],
    'Χειρουργική':   ['Χειρουργική', 'Αναισθησιολογία'],
    'ΜΕΘ':           ['Αναισθησιολογία', 'Παθολογία', 'Καρδιολογία', 'Πνευμονολογία'],
    'Επείγοντα':     ['Παθολογία', 'Χειρουργική', 'Καρδιολογία', 'Παιδιατρική'],
    'Νευρολογία':    ['Νευρολογία', 'Ψυχιατρική'],
    'Ορθοπεδική':    ['Ορθοπεδική', 'Χειρουργική', 'Ρευματολογία'],
    'Παιδιατρική':   ['Παιδιατρική'],
    'Μαιευτική':     ['Μαιευτική-Γυναικολογία', 'Γυναικολογία'],
    'Ογκολογία':     ['Ογκολογία', 'Αιματολογία', 'Παθολογία'],
    'Πνευμονολογία': ['Πνευμονολογία', 'Παθολογία', 'Μολυσματολογία'],
    'Νεφρολογία':    ['Νεφρολογία', 'Παθολογία'],
    'Ουρολογία':     ['Ουρολογία', 'Χειρουργική'],
    'Οφθαλμολογία':  ['Οφθαλμολογία', 'Χειρουργική'],
    'ΩΡΛ':           ['ΩΡΛ', 'Χειρουργική'],
    'Δερματολογία':  ['Δερματολογία', 'Παθολογία'],
}

ALL_SPECIALTIES = sorted({s for specs in DEPT_RELATED_SPECIALTIES.values() for s in specs} |
                         {info[1] for info in DEPT_INFO})

NURSE_RANKS  = ['Βοηθός Νοσηλευτή', 'Νοσηλευτής', 'Προϊστάμενος']
ICU_NURSE_RANKS = ['Νοσηλευτής', 'Προϊστάμενος']  # ΜΕΘ: όχι βοηθοί
ADMIN_ROLES  = ['Γραμματέας', 'Λογιστής', 'Διαχειριστής', 'Υπεύθυνος Προμηθειών']

SHIFT_TYPES = ['Morning', 'Afternoon', 'Night']
BED_STATUSES  = ['Διαθέσιμη', 'Κατειλημμένη', 'Υπό Συντήρηση']
INSURANCE     = ['ΕΦΚΑ', 'Ιδιωτική Ασφάλεια', 'Ανασφάλιστος']
URGENCY_LEVELS = [1, 2, 3, 4, 5]
LAB_TYPES     = ['Αιματολογική', 'Βιοχημική', 'Απεικονιστική', 'Μικροβιολογική']
GENDERS       = ['Αρσενικό', 'Θηλυκό']
CITIZENSHIPS  = ['Ελληνική', 'Ελληνική', 'Ελληνική', 'Αλβανική', 'Βουλγαρική',
                 'Γερμανική', 'Βρετανική', 'Ρουμανική']

# Επαγγέλματα ανά ηλικιακή ομάδα
ADULT_PROFESSIONS = ['Εκπαιδευτικός', 'Μηχανικός', 'Ιατρός', 'Δικηγόρος', 'Λογιστής',
                     'Δημόσιος Υπάλληλος', 'Έμπορος', 'Αγρότης', 'Οικοδόμος',
                     'Πωλητής', 'Σερβιτόρος', 'Οδηγός', 'Νοσηλευτής', 'Άνεργος']
RETIRED = ['Συνταξιούχος']
STUDENT = ['Μαθητής']
TODDLER = ['Νήπιο']

def random_profession(age):
    if age < 5: return random.choice(TODDLER)
    if age < 18: return 'Μαθητής'
    if age < 22 and random.random() < 0.5: return 'Φοιτητής'
    if age > 65: return random.choice(RETIRED)
    return random.choice(ADULT_PROFESSIONS)

# Συμπτώματα με αντίστοιχο εύρος επιπέδου επείγοντος (min, max)
# Βασισμένο στο Manchester Triage System
SYMPTOMS_WITH_URGENCY = [
    # Level 1 — Άμεσο (απειλητικά για τη ζωή)
    ('Καρδιακή ανακοπή',         1, 1),
    ('Έμφραγμα μυοκαρδίου',      1, 1),
    ('Εγκεφαλικό επεισόδιο',     1, 1),
    ('Αναπνευστική ανακοπή',     1, 1),
    ('Αναφυλακτικό σοκ',         1, 1),
    ('Σοβαρό τραύμα κεφαλής',    1, 2),
    ('Σπασμοί',                  1, 2),
    # Level 2 — Επείγον
    ('Οξύ κοιλιακό άλγος',       2, 2),
    ('Σοβαρή δύσπνοια',          2, 2),
    ('Πόνος στο στήθος',         2, 2),
    ('Υψηλός πυρετός (>39°C)',   2, 3),
    ('Ταχυκαρδία',               2, 3),
    ('Λιποθυμία',                2, 3),
    ('Αλλεργική αντίδραση',      2, 3),
    ('Υπερτασική κρίση',         2, 3),
    # Level 3 — Επιτακτικό
    ('Ήπιος πόνος στο στήθος',   3, 3),
    ('Πυρετός (38-39°C)',        3, 3),
    ('Κεφαλαλγία',               3, 4),
    ('Κοιλιακό άλγος',           3, 4),
    ('Εμετός',                   3, 4),
    ('Ζάλη',                     3, 4),
    ('Ήπιο τραύμα',              3, 4),
    # Level 4 — Λιγότερο επείγον
    ('Ήπια κεφαλαλγία',          4, 4),
    ('Ήπιος πυρετός (<38°C)',    4, 5),
    ('Βήχας',                    4, 5),
    ('Διάρροια',                 4, 5),
    ('Μέτριο κοιλιακό άλγος',   4, 5),
    # Level 5 — Μη επείγον
    ('Ήπιος πονοκέφαλος',        5, 5),
    ('Κόπωση',                   5, 5),
    ('Ήπια ναυτία',              5, 5),
    ('Δερματικό εξάνθημα',       5, 5),
    ('Ρινική συμφόρηση',         5, 5),
]

# Παιδιατρικά συμπτώματα με urgency (παιδιά κλιμακώνουν πιο γρήγορα)
SYMPTOMS_CHILD_URGENCY = [
    ('Υψηλός πυρετός (>39°C)',     1, 2),
    ('Δύσπνοια',                   1, 2),
    ('Σπασμοί',                    1, 1),
    ('Αλλεργική αντίδραση',        2, 2),
    ('Εμετός με πυρετό',           2, 3),
    ('Κοιλιακό άλγος',             3, 4),
    ('Πτώση / τραύμα',             3, 4),
    ('Διάρροια',                   4, 5),
    ('Βήχας',                      4, 5),
    ('Ήπιος πυρετός',              4, 5),
]

def random_symptoms(age):
    """Επιστρέφει (symptoms_text, urgency_level) κλινικά συνεπή."""
    pool = SYMPTOMS_CHILD_URGENCY if age < 16 else SYMPTOMS_WITH_URGENCY
    symptom, u_min, u_max = random.choice(pool)
    urgency = random.randint(u_min, u_max)
    return symptom, urgency

# ─── ΦΟΡΤΩΣΗ ΔΕΔΟΜΕΝΩΝ ΑΝΑΦΟΡΑΣ ────────────────────────────────────────────
# Διαβάζουμε τα πραγματικά αρχεία αν βρίσκονται στον τρέχοντα φάκελο.
# Αν δεν βρεθούν, χρησιμοποιούμε hardcoded placeholders (fallback).
# Κανονική ροή: run_all.bat τρέχει preprocess_*.py πρώτα που παράγουν
# icd10.sql, ken.sql κλπ., οπότε η βάση φορτώνεται με πραγματικά δεδομένα.
# Εδώ το generate_data.py χρησιμοποιεί τους κωδικούς για να κάνει
# cross-reference στα inserts (νοσηλείες, συνταγές, πράξεις).

import re as _re2
_os = os  # alias kept for parity with original code

def _load_icd10(path=None):
    if path is None: path = os.path.join(DATADIR, 'ICD10_Catalog.xls')
    _FALLBACK = [
        ('I21','Οξύ έμφραγμα μυοκαρδίου'), ('I63','Εγκεφαλικό επεισόδιο'),
        ('J18','Πνευμονία'), ('J44','COPD'), ('K35','Σκωληκοειδίτιδα'),
        ('K80','Χολολιθίαση'), ('S72','Κάταγμα μηριαίου'), ('S06','ΚΕΚ'),
        ('C34','Νεόπλασμα πνεύμονα'), ('C50','Νεόπλασμα μαστού'),
        ('N18','Χρόνια νεφρική νόσος'), ('E11','ΣΔ τύπου 2'),
        ('M16','Κοξάρθρωση'), ('O80','Φυσιολογικός τοκετός'),
        ('A09','Γαστρεντερίτιδα'),
    ]
    if not _os.path.exists(path):
        return _FALLBACK
    try:
        import pandas as _pd
        df = _pd.read_excel(path, engine='xlrd', header=None, dtype=str)
        df.columns = ['code', 'description']
        df['code'] = df['code'].fillna('').str.strip()
        df['description'] = df['description'].fillna('').str.strip()
        df = df[df['code'].str.match(r'^[A-Z]\d', na=False)].reset_index(drop=True)
        print(f"  ICD-10: {len(df):,} κωδικοί από {path}", file=sys.stderr)
        return list(zip(df['code'], df['description']))
    except Exception as e:
        print(f"  ICD-10: σφάλμα ({e}), χρήση fallback", file=sys.stderr)
        return _FALLBACK

def _load_ken(path_sql=None):
    if path_sql is None: path_sql = os.path.join(SQLDIR, 'ken.sql')
    _FALLBACK = [
        ('KEN001',2500.0,5), ('KEN002',4000.0,8), ('KEN003',1800.0,3),
        ('KEN004',6000.0,12), ('KEN005',3200.0,7), ('KEN006',1500.0,2),
        ('KEN007',5500.0,10), ('KEN008',2800.0,6), ('KEN009',3800.0,9),
        ('KEN010',7000.0,14),
    ]
    # Διαβάζουμε από ken.sql αν το έχει παράξει το preprocess_reference_data.py
    if not _os.path.exists(path_sql):
        return _FALLBACK
    try:
        items = []
        with open(path_sql, encoding='utf-8') as f:
            for line in f:
                m = _re2.search(r"\('([^']+)',\s*'[^']*',\s*([0-9.]+),\s*(\d+)\)", line)
                if m:
                    items.append((m.group(1), float(m.group(2)), int(m.group(3))))
        if items:
            print(f"  KEN: {len(items)} κωδικοί από {path_sql}", file=sys.stderr)
            return items
    except Exception as e:
        print(f"  KEN: σφάλμα ({e}), χρήση fallback", file=sys.stderr)
    return _FALLBACK

def _load_procedures(path=None):
    if path is None: path = os.path.join(DATADIR, 'Medical_Procedure_Catalog.xls')
    _FALLBACK = [
        ('A001','Σκωληκοειδεκτομή','Χειρουργική','01:30:00',1200.0),
        ('A002','Χολοκυστεκτομή','Χειρουργική','02:00:00',2000.0),
        ('A003','Αρθροπλαστική ισχίου','Χειρουργική','02:30:00',4500.0),
        ('A004','Καρδιοχειρουργική bypass','Χειρουργική','05:00:00',8000.0),
        ('A005','Αρθροσκόπηση γόνατος','Χειρουργική','01:30:00',1800.0),
        ('B001','Γαστροσκόπηση','Διαγνωστική','00:30:00',300.0),
        ('B002','Κολονοσκόπηση','Διαγνωστική','00:45:00',400.0),
        ('B003','Βρογχοσκόπηση','Διαγνωστική','00:30:00',350.0),
        ('B004','Μαγνητική τομογραφία','Διαγνωστική','00:45:00',450.0),
        ('B005','Αξονική τομογραφία','Διαγνωστική','00:20:00',250.0),
        ('C001','Χημειοθεραπεία','Θεραπευτική','04:00:00',1500.0),
        ('C002','Αιμοκάθαρση','Θεραπευτική','04:00:00',600.0),
        ('C003','Ακτινοθεραπεία','Θεραπευτική','00:20:00',800.0),
    ]
    if not _os.path.exists(path):
        return _FALLBACK
    try:
        import pandas as _pd
        _CMAP = {'Α':'Αναισθησία','Β':'Χειρουργική','Γ':'Διαγνωστική',
                 'Δ':'Διαγνωστική','Ε':'Διαγνωστική','ΣΤ':'Θεραπευτική'}
        _DUR  = {'Αναισθησία':(20,120),'Χειρουργική':(30,360),
                 'Διαγνωστική':(15,90),'Θεραπευτική':(20,240)}
        _COST = {'Αναισθησία':(80,400),'Χειρουργική':(300,8000),
                 'Διαγνωστική':(30,600),'Θεραπευτική':(50,1500)}
        df = _pd.read_excel(path, engine='xlrd', header=None, dtype=str).fillna('')
        rows = []
        current_cat = 'Θεραπευτική'
        for _, row in df.iterrows():
            vals = [str(v).strip() for v in row]
            non_empty = [v for v in vals if v]
            if not non_empty: continue
            if len(non_empty) == 1 and not non_empty[0].isdigit():
                for pfx, cat in _CMAP.items():
                    if non_empty[0].startswith(pfx):
                        current_cat = cat; break
                continue
            if len(non_empty) < 3 or not vals[0].isdigit(): continue
            code = vals[1].strip(); name = vals[2].strip()[:200]
            if not code or not name: continue
            mn, mx = _DUR.get(current_cat,(20,120))
            mins = random.randint(mn, mx); h, m2 = divmod(mins,60)
            dur = f'{h:02d}:{m2:02d}:00'
            cmn, cmx = _COST.get(current_cat,(50,500))
            cost = round(random.uniform(cmn, cmx), 2)
            rows.append((code, name, current_cat, dur, cost))
        if rows:
            print(f"  Ιατρικές πράξεις: {len(rows):,} από {path}", file=sys.stderr)
            return rows
    except Exception as e:
        print(f"  Πράξεις: σφάλμα ({e}), χρήση fallback", file=sys.stderr)
    return _FALLBACK

def _load_ema(path=None, limit=3000):
    if path is None: path = os.path.join(DATADIR, 'Medicine_EMA.xlsx')
    _FB_MEDS = [(f'EU-MED-{i:03d}',f'Medicine_{i}') for i in range(1,21)]
    _FB_SUBS = [(i,f'Substance_{i}') for i in range(1,21)]
    _FB_LINK = {f'EU-MED-{i:03d}':[i] for i in range(1,21)}
    if not _os.path.exists(path):
        return _FB_MEDS, _FB_SUBS, _FB_LINK
    try:
        import pandas as _pd
        df = _pd.read_excel(path, sheet_name='Art57 product data', header=19, dtype=str)
        df.columns = ['product_name','active_substance','route','country',
                      'holder','pvsmf','email','phone']
        df = df[['product_name','active_substance']].copy()
        df['product_name'] = df['product_name'].fillna('').str.strip()
        df['active_substance'] = df['active_substance'].fillna('').str.strip()
        df = df[df['product_name'] != ''].drop_duplicates(subset=['product_name']).head(limit)
        # Substances
        sub_to_id = {}; sid = 1
        for raw in df['active_substance']:
            if not raw: continue
            for part in (raw.split('|') if '|' in raw else [raw]):
                for sp in (part.split(',') if ',' in part and '|' not in raw else [part]):
                    norm = sp.strip()
                    if norm and norm not in sub_to_id:
                        sub_to_id[norm] = sid; sid += 1
        # Codes
        seen_c = set(); codes = []
        for i, name in enumerate(df['product_name'], 1):
            c = _re2.sub(r'[^A-Za-z0-9]','', name).upper()[:8] + f'-{i}'
            while c in seen_c: c += 'X'
            seen_c.add(c); codes.append(c)
        df['code'] = codes
        meds = list(zip(df['code'], df['product_name']))
        subs = [(sid2, nm) for nm, sid2 in sub_to_id.items()]
        links = {}
        for _, row in df.iterrows():
            raw = row['active_substance']
            if not raw: continue
            for part in (raw.split('|') if '|' in raw else [raw]):
                for sp in (part.split(',') if ',' in part and '|' not in raw else [part]):
                    norm = sp.strip()
                    if norm and norm in sub_to_id:
                        links.setdefault(row['code'], []).append(sub_to_id[norm])
        print(f"  EMA: {len(meds):,} φάρμακα, {len(subs):,} δραστικές ουσίες", file=sys.stderr)
        return meds, subs, links
    except Exception as e:
        print(f"  EMA: σφάλμα ({e}), χρήση fallback", file=sys.stderr)
        return _FB_MEDS, _FB_SUBS, _FB_LINK

print("Φόρτωση δεδομένων αναφοράς...", file=sys.stderr)
SAMPLE_ICD10      = _load_icd10()
SAMPLE_KEN        = _load_ken()
SAMPLE_PROCEDURES = _load_procedures()
_ema_meds, _ema_subs, MED_SUBSTANCES = _load_ema()
SAMPLE_MEDICINES  = _ema_meds
SAMPLE_SUBSTANCES = _ema_subs

# ============================================================
# ΠΑΡΑΓΩΓΗ SQL
# ============================================================

w("-- ============================================================")
w("-- load.sql  –  Αυτόματα παραγόμενα δεδομένα για Υγειόπολη")
w("-- Παράχθηκε από generate_data.py (V3 — Ρεαλιστικά δεδομένα)")
w("-- ============================================================")
w("USE `hygeiopolis_db`;")
w("SET FOREIGN_KEY_CHECKS=0;")
w("SET SQL_MODE='';")
w("SET NAMES 'utf8mb4';")
w("")

# ── 1. ICD-10 minimal ─────────────────────────────────────────
w("-- ICD-10 (minimal fallback)")
for code, desc in SAMPLE_ICD10:
    w(f"INSERT IGNORE INTO ICD10_Catalog (code, description) VALUES ({q(code)}, {q(desc)});")
w("")

# ── 2. KEN ─────────────────────────────────────────────────────
w("-- KEN Catalog")
for code, cost, days in SAMPLE_KEN:
    w(f"INSERT IGNORE INTO KEN_Catalog (code, basic_cost, avg_duration_days) VALUES ({q(code)}, {cost}, {days});")
w("")

# ── 3. Medical Procedures ────────────────────────────────────
w("-- Medical Procedures")
for code, name, cat, dur, cost in SAMPLE_PROCEDURES:
    w(f"INSERT IGNORE INTO Medical_Procedure_Catalog (code, name, category, standard_duration, standard_cost) VALUES ({q(code)}, {q(name)}, {q(cat)}, {q(dur)}, {cost});")
w("")

# ── 4. EMA ─────────────────────────────────────────────────────
w("-- Active Substances")
for sid, sname in SAMPLE_SUBSTANCES:
    w(f"INSERT IGNORE INTO Active_Substances (id, name) VALUES ({sid}, {q(sname)});")
w("")
w("-- Medicine EMA")
for code, brand in SAMPLE_MEDICINES:
    w(f"INSERT IGNORE INTO Medicine_EMA (code, brand_name) VALUES ({q(code)}, {q(brand)});")
w("")
w("-- Medicine_has_Substances")
for mcode, sids in MED_SUBSTANCES.items():
    for sid in sids:
        w(f"INSERT IGNORE INTO Medicine_has_Substances (medicine_code, substance_id) VALUES ({q(mcode)}, {sid});")
w("")

# ── 5. Spaces ──────────────────────────────────────────────────
w("-- Spaces")
spaces = list(range(1, 11))
for i in spaces:
    stype = 'Χειρουργείο' if i <= 6 else 'Αίθουσα Επέμβασης'
    w(f"INSERT IGNORE INTO Spaces (id, name, type) VALUES ({i}, {q(stype+' '+str(i))}, {q(stype)});")
w("")

# ============================================================
# STAFF GENERATION — Συμβατή με τμήματα/ειδικότητες
# ============================================================

w("-- Staff (Doctors)")

# ΣΗΜΑΝΤΙΚΟ: Πρώτα ΔΗΜΙΟΥΡΓΟΥΜΕ έναν Διευθυντή ανά τμήμα με σωστή ειδικότητα
director_amkas = []
director_dept_map = {}  # dept_idx (1-based) -> director_amka
director_spec_map = {}  # amka -> specialty

# 15 Διευθυντές, ένας ανά τμήμα, με ειδικότητα ίδια με του τμήματος
for i, (dept_name, dept_spec) in enumerate(DEPT_INFO, 1):
    amka = gen_amka()
    gender = 'male' if random.random() < 0.55 else 'female'  # ελαφρώς αρσενικό bias σε διευθυντές
    fn = male_name() if gender == 'male' else female_name()
    ln = gendered_surname(gender)
    age = random.randint(48, 65)
    email = safe_email('dr')
    phone = greek_phone()
    # hire_date: όχι νεότερος από 22 ετών κατά πρόσληψη, max 30 χρόνια πίσω
    earliest_hire = date(2026 - (age - 22), 1, 1)
    latest_hire   = date(2018, 12, 31)
    hire = random_date(max(earliest_hire, date(1995, 1, 1)), latest_hire)
    w(f"INSERT INTO Staff (amka,first_name,last_name,age,email,phone,hire_date,staff_type) VALUES ({q(amka)},{q(fn)},{q(ln)},{age},{q(email)},{q(phone)},{sql_date(hire)},'Doctor');")
    w(f"INSERT INTO Doctors (staff_amka,license_number,specialty,`rank`,supervisor_amka) VALUES ({q(amka)},{q('LIC1'+str(i).zfill(4))},{q(dept_spec)},'Διευθυντής',NULL);")
    director_amkas.append(amka)
    director_dept_map[i] = amka
    director_spec_map[amka] = dept_spec

# SQL-escaped rank strings (απόστροφος μέσα χρειάζεται double single-quote)
RANK_DIR = "'Διευθυντής'"
RANK_A   = "'Επιμελητής Α''" + chr(39)   # 'Επιμελητής Α\''
RANK_B   = "'Επιμελητής Β''" + chr(39)
RANK_RES = "'Ειδικευόμενος'"

doctor_amkas = list(director_amkas)
doctor_spec_map = dict(director_spec_map)

# Senior A (40) — με ποικιλία ειδικοτήτων
senior_a_amkas = []
for i in range(40):
    amka = gen_amka()
    gender = 'male' if random.random() < 0.5 else 'female'
    fn = male_name() if gender == 'male' else female_name()
    ln = gendered_surname(gender)
    age = random.randint(38, 55)
    email = safe_email('dr')
    phone = greek_phone()
    earliest_hire = date(2026 - (age - 22), 1, 1)
    hire = random_date(max(earliest_hire, date(2005, 1, 1)), date(2020, 12, 31))
    spec = random.choice(ALL_SPECIALTIES)
    sup  = random.choice(director_amkas)
    w(f"INSERT INTO Staff (amka,first_name,last_name,age,email,phone,hire_date,staff_type) VALUES ({q(amka)},{q(fn)},{q(ln)},{age},{q(email)},{q(phone)},{sql_date(hire)},'Doctor');")
    w(f"INSERT INTO Doctors (staff_amka,license_number,specialty,`rank`,supervisor_amka) VALUES ({q(amka)},{q('LIC2'+str(i).zfill(4))},{q(spec)},{RANK_A},{q(sup)});")
    senior_a_amkas.append(amka)
    doctor_amkas.append(amka)
    doctor_spec_map[amka] = spec

# Senior B (45)
senior_b_amkas = []
for i in range(45):
    amka = gen_amka()
    gender = 'male' if random.random() < 0.5 else 'female'
    fn = male_name() if gender == 'male' else female_name()
    ln = gendered_surname(gender)
    age = random.randint(32, 48)
    email = safe_email('dr')
    phone = greek_phone()
    earliest_hire = date(2026 - (age - 22), 1, 1)
    hire = random_date(max(earliest_hire, date(2010, 1, 1)), date(2023, 12, 31))
    spec = random.choice(ALL_SPECIALTIES)
    sup  = random.choice(director_amkas + senior_a_amkas)
    w(f"INSERT INTO Staff (amka,first_name,last_name,age,email,phone,hire_date,staff_type) VALUES ({q(amka)},{q(fn)},{q(ln)},{age},{q(email)},{q(phone)},{sql_date(hire)},'Doctor');")
    w(f"INSERT INTO Doctors (staff_amka,license_number,specialty,`rank`,supervisor_amka) VALUES ({q(amka)},{q('LIC3'+str(i).zfill(4))},{q(spec)},{RANK_B},{q(sup)});")
    senior_b_amkas.append(amka)
    doctor_amkas.append(amka)
    doctor_spec_map[amka] = spec

# Residents (50)
resident_amkas = []
for i in range(50):
    amka = gen_amka()
    gender = 'male' if random.random() < 0.5 else 'female'
    fn = male_name() if gender == 'male' else female_name()
    ln = gendered_surname(gender)
    age = random.randint(26, 34)
    email = safe_email('dr')
    phone = greek_phone()
    earliest_hire = date(2026 - (age - 24), 1, 1)
    hire = random_date(max(earliest_hire, date(2018, 1, 1)), date(2024, 12, 31))
    spec = random.choice(ALL_SPECIALTIES)
    sup  = random.choice(senior_a_amkas + senior_b_amkas)
    w(f"INSERT INTO Staff (amka,first_name,last_name,age,email,phone,hire_date,staff_type) VALUES ({q(amka)},{q(fn)},{q(ln)},{age},{q(email)},{q(phone)},{sql_date(hire)},'Doctor');")
    w(f"INSERT INTO Doctors (staff_amka,license_number,specialty,`rank`,supervisor_amka) VALUES ({q(amka)},{q('LIC4'+str(i).zfill(4))},{q(spec)},{q('Ειδικευόμενος')},{q(sup)});")
    resident_amkas.append(amka)
    doctor_amkas.append(amka)
    doctor_spec_map[amka] = spec

# Young surgeons (15) <35 με ειδικότητα Χειρουργική (για Q5)
young_surgeon_amkas = []
for i in range(15):
    amka = gen_amka()
    gender = 'male' if random.random() < 0.6 else 'female'
    fn = male_name() if gender == 'male' else female_name()
    ln = gendered_surname(gender)
    age = random.randint(28, 34)
    email = safe_email('youngdr')
    phone = greek_phone()
    earliest_hire = date(2026 - (age - 24), 1, 1)
    hire = random_date(max(earliest_hire, date(2020, 1, 1)), date(2024, 12, 31))
    sup  = random.choice(senior_a_amkas + senior_b_amkas)
    w(f"INSERT INTO Staff (amka,first_name,last_name,age,email,phone,hire_date,staff_type) VALUES ({q(amka)},{q(fn)},{q(ln)},{age},{q(email)},{q(phone)},{sql_date(hire)},'Doctor');")
    w(f"INSERT INTO Doctors (staff_amka,license_number,specialty,`rank`,supervisor_amka) VALUES ({q(amka)},{q('LIC5'+str(i).zfill(4))},'Χειρουργική','Ειδικευόμενος',{q(sup)});")
    young_surgeon_amkas.append(amka)
    doctor_amkas.append(amka)
    resident_amkas.append(amka)
    doctor_spec_map[amka] = 'Χειρουργική'

w("")

# ============================================================
# DEPARTMENTS
# ============================================================
# FIX: Προ-καθορίζουμε τον αριθμό κλινών ανά τμήμα, ώστε να συμπίπτει
# η δηλωμένη τιμή (Departments.bed_count) με τις πραγματικά παραγόμενες
# κλίνες στον πίνακα Beds.
dept_bed_counts = {i: random.randint(15, 25) for i, _ in enumerate(DEPT_INFO, 1)}

w("-- Departments")
dept_ids = []
for i, (dname, _spec) in enumerate(DEPT_INFO, 1):
    director = director_dept_map[i]
    floor    = f"Όροφος {random.randint(1,5)}, Κτίριο {'ΑΒΓΔ'[i%4]}"
    beds_cnt = dept_bed_counts[i]
    desc     = f"Τμήμα {dname} του νοσοκομείου Υγειόπολης"
    w(f"INSERT INTO Departments (id,name,description,bed_count,floor_building,director_amka) VALUES ({i},{q(dname)},{q(desc)},{beds_cnt},{q(floor)},{q(director)});")
    dept_ids.append(i)
w("")

# ============================================================
# DOCTOR_HAS_DEPARTMENT — Διευθυντές ανήκουν στο τμήμα τους
# ============================================================
w("-- Doctor_has_Department")

# Πρώτα οι διευθυντές στα τμήματά τους
for dept_id, director_amka in director_dept_map.items():
    w(f"INSERT IGNORE INTO Doctor_has_Department (doctor_amka,department_id) VALUES ({q(director_amka)},{dept_id});")

# Helper: ποια τμήματα είναι συμβατά με την ειδικότητα ενός γιατρού
def compatible_depts(spec):
    matches = []
    for dept_id, (dname, _) in enumerate(DEPT_INFO, 1):
        if spec in DEPT_RELATED_SPECIALTIES.get(dname, []):
            matches.append(dept_id)
    if not matches:
        # fallback: αν δεν ταιριάζει κανού, τα γενικά (Επείγοντα/Παθολογία)
        matches = [4]  # Επείγοντα
    return matches

# Υπόλοιποι γιατροί ανήκουν σε 1-3 τμήματα συμβατά με την ειδικότητά τους
for amka in doctor_amkas:
    if amka in director_amkas:
        continue
    spec = doctor_spec_map.get(amka, 'Παθολογία')
    compat = compatible_depts(spec)
    ndepts = random.randint(1, min(3, len(compat)))
    for d in random.sample(compat, ndepts):
        w(f"INSERT IGNORE INTO Doctor_has_Department (doctor_amka,department_id) VALUES ({q(amka)},{d});")
w("")

# ============================================================
# BEDS — Τύπος ανάλογα με τμήμα
# ============================================================
w("-- Beds")
DEPT_BED_TYPES = {
    'ΜΕΘ':          ['ΜΕΘ'],
    'Παιδιατρική':  ['Παιδιατρική'],
    'Μαιευτική':    ['Μονόκλινο', 'Πολύκλινο'],
    'Επείγοντα':    ['Μονόκλινο', 'Πολύκλινο'],
}
bed_ids = []
bid = 1
for dept_id in dept_ids:
    dname = DEPT_INFO[dept_id-1][0]
    allowed = DEPT_BED_TYPES.get(dname, ['Μονόκλινο', 'Πολύκλινο'])
    # FIX: ακριβώς dept_bed_counts[dept_id] κλίνες — συμπίπτει με Departments.bed_count
    for j in range(1, dept_bed_counts[dept_id] + 1):
        btype = random.choice(allowed)
        bstat = random.choices(BED_STATUSES, weights=[70, 25, 5])[0]
        w(f"INSERT INTO Beds (id,department_id,bed_number,type,status) VALUES ({bid},{dept_id},{q(f'B{dept_id:02d}-{j:03d}')},{q(btype)},{q(bstat)});")
        bed_ids.append((bid, dept_id))
        bid += 1
w("")

# ============================================================
# NURSES — ΜΕΘ μόνο senior nurses
# ============================================================
w("-- Nurses")
nurse_amkas = []
nurse_dept_map = {}
for i in range(500):  # FIX: από 300→500 για επαρκή κάλυψη 6/βάρδια/τμήμα
    amka = gen_amka()
    gender = 'male' if random.random() < 0.25 else 'female'  # bias θηλυκό για νοσηλευτές
    fn = male_name() if gender == 'male' else female_name()
    ln = gendered_surname(gender)
    age = random.randint(23, 58)
    email = safe_email('nurse')
    phone = greek_phone()
    earliest_hire = date(2026 - (age - 22), 1, 1)
    hire = random_date(max(earliest_hire, date(2000, 1, 1)), date(2024, 6, 30))
    dept = random.choice(dept_ids)
    dname = DEPT_INFO[dept-1][0]
    # ΜΕΘ: μόνο senior
    if dname == 'ΜΕΘ':
        rank = random.choice(ICU_NURSE_RANKS)
    else:
        rank = random.choice(NURSE_RANKS)
    w(f"INSERT INTO Staff (amka,first_name,last_name,age,email,phone,hire_date,staff_type) VALUES ({q(amka)},{q(fn)},{q(ln)},{age},{q(email)},{q(phone)},{sql_date(hire)},'Nurse');")
    w(f"INSERT INTO Nurses (staff_amka,`rank`,department_id) VALUES ({q(amka)},{q(rank)},{dept});")
    nurse_amkas.append(amka)
    nurse_dept_map[amka] = dept
w("")

# ============================================================
# ADMIN STAFF
# ============================================================
w("-- Admin Staff")
admin_amkas = []
admin_dept_map = {}  # amka -> dept_id
for i in range(150):  # FIX: από 100→150 για επαρκή κάλυψη 2/βάρδια/τμήμα
    amka = gen_amka()
    gender = 'male' if random.random() < 0.4 else 'female'
    fn = male_name() if gender == 'male' else female_name()
    ln = gendered_surname(gender)
    age = random.randint(23, 62)
    email = safe_email('admin')
    phone = greek_phone()
    earliest_hire = date(2026 - (age - 22), 1, 1)
    hire = random_date(max(earliest_hire, date(2000, 1, 1)), date(2024, 6, 30))
    role = random.choice(ADMIN_ROLES)
    office = f"Γραφείο {random.randint(1, 50)}"
    dept = random.choice(dept_ids)
    w(f"INSERT INTO Staff (amka,first_name,last_name,age,email,phone,hire_date,staff_type) VALUES ({q(amka)},{q(fn)},{q(ln)},{age},{q(email)},{q(phone)},{sql_date(hire)},'Admin');")
    w(f"INSERT INTO Admin_Staff (staff_amka,role,office,department_id) VALUES ({q(amka)},{q(role)},{q(office)},{dept});")
    admin_amkas.append(amka)
    admin_dept_map[amka] = dept
w("")

# ============================================================
# PATIENTS — Ρεαλιστικά
# ============================================================
w("-- Patients")
patient_amkas = []
patient_info = {}  # amka -> dict(gender, age)

for i in range(240):
    amka = gen_amka()
    gender = random.choice(GENDERS)
    gender_key = 'male' if gender == 'Αρσενικό' else 'female'
    fn = male_name() if gender_key == 'male' else female_name()
    ln = gendered_surname(gender_key)
    fn2 = male_name()  # πατρώνυμο πάντα αρσενικό
    # ηλικιακή κατανομή που μοιάζει με πληθυσμό νοσοκομείου
    age_choice = random.random()
    if age_choice < 0.10:   age = random.randint(0, 14)    # παιδιά 10%
    elif age_choice < 0.35: age = random.randint(15, 39)   # νεαροί 25%
    elif age_choice < 0.65: age = random.randint(40, 64)   # μέσοι 30%
    else:                   age = random.randint(65, 92)   # ηλικιωμένοι 35%

    weight, height = realistic_weight_height(age, gender)
    addr   = greek_address()
    phone  = greek_phone()
    email  = f"patient{i+1}@example.com"
    prof   = random_profession(age)
    citz   = random.choice(CITIZENSHIPS)
    # emergency contact: αρσενικό 50/50
    ec_gender = 'male' if random.random() < 0.5 else 'female'
    ec_fn = male_name() if ec_gender == 'male' else female_name()
    ec_ln = gendered_surname(ec_gender)
    emerg = f"{ec_fn} {ec_ln}, τηλ: {greek_phone()}"
    insur = random.choices(INSURANCE, weights=[70, 20, 10])[0]
    patient_info[amka] = {'gender': gender, 'age': age}
    w(f"INSERT INTO Patients (amka,first_name,last_name,fathers_name,age,weight,height,gender,address,phone,email,profession,citizenship,emergency_contact,insurance_provider) VALUES ({q(amka)},{q(fn)},{q(ln)},{q(fn2)},{age},{weight},{height},{q(gender)},{q(addr)},{q(phone)},{q(email)},{q(prof)},{q(citz)},{q(emerg)},{q(insur)});")
    patient_amkas.append(amka)
w("")

# ============================================================
# PATIENT ALLERGIES
# ============================================================
w("-- Patient Allergies")
allergy_map = {}
for pamka in random.sample(patient_amkas, 60):
    nsubs = random.randint(1, 3)
    chosen = random.sample(SAMPLE_SUBSTANCES, nsubs)
    allergy_map[pamka] = set()
    for sid, _ in chosen:
        allergy_map[pamka].add(sid)
        w(f"INSERT IGNORE INTO Patient_Allergies (patient_amka,substance_id) VALUES ({q(pamka)},{sid});")
w("")

# ============================================================
# SHIFTS & ASSIGNMENTS
# ============================================================
w("-- Shifts & Assignments (2025-07 + 2026-01 → 2026-05-10)")

sid_counter = 1
monthly_counts = {}
staff_last_shift = {}
staff_night_streak = {}
doctor_shift_dates = {}  # amka -> set of date objects (για matching activities)

def can_assign(amka, staff_type, shift_date, shift_type_name):
    ym = (shift_date.year, shift_date.month)
    max_shifts = {'Doctor': 15, 'Nurse': 20, 'Admin': 25}.get(staff_type, 25)
    if monthly_counts.get(amka, {}).get(ym, 0) >= max_shifts:
        return False
    last_d, last_s = staff_last_shift.get(amka, (None, None))
    if last_d is None: return True
    if last_d == shift_date: return False
    if last_d == shift_date - timedelta(days=1) and last_s == 'Night' and shift_type_name == 'Morning':
        return False
    if shift_type_name == 'Night' and last_d == shift_date - timedelta(days=1) and last_s == 'Night':
        if staff_night_streak.get(amka, 0) >= 3: return False
    return True

def do_assign(shift_id, amka, dept_id, staff_type, shift_date, shift_type_name):
    ym = (shift_date.year, shift_date.month)
    monthly_counts.setdefault(amka, {})[ym] = monthly_counts.get(amka, {}).get(ym, 0) + 1
    last_d, last_s = staff_last_shift.get(amka, (None, None))
    if shift_type_name == 'Night' and last_d == shift_date - timedelta(days=1) and last_s == 'Night':
        staff_night_streak[amka] = staff_night_streak.get(amka, 0) + 1
    else:
        staff_night_streak[amka] = 1 if shift_type_name == 'Night' else 0
    staff_last_shift[amka] = (shift_date, shift_type_name)
    if staff_type == 'Doctor':
        doctor_shift_dates.setdefault(amka, set()).add(shift_date)
    w(f"INSERT IGNORE INTO Shift_Assignments (shift_id,staff_amka,department_id) VALUES ({shift_id},{q(amka)},{dept_id});")

def rank_of(amka):
    if amka in director_amkas: return "Διευθυντής"
    if amka in senior_a_amkas: return "Επιμελητής Α'"
    if amka in senior_b_amkas: return "Επιμελητής Β'"
    return 'Ειδικευόμενος'

SENIOR_RANKS = ["Επιμελητής Α'", 'Διευθυντής']

# Επέκταση βαρδιών σε όλη την περίοδο νοσηλειών (2023-2026)
# Δειγματοληπτικά: 1 εβδομάδα ανά μήνα + πλήρες Ιαν-Μάι 2026
# FIX: Lookup maps για dept membership (για targeted shift assignment)
doc_dept_map = {}
for dept_id in dept_ids:
    doc_dept_map[dept_id] = []
for amka in doctor_amkas:
    spec = doctor_spec_map.get(amka, 'Παθολογία')
    for dept_id in compatible_depts(spec):
        doc_dept_map.setdefault(dept_id, []).append(amka)

# FIX: Εξασφαλίζουμε min 15 γιατρούς ανά τμήμα
# Αν λείπουν, προσθέτουμε οποιοδήποτε διαθέσιμο γιατρό
for dept_id in dept_ids:
    current = set(doc_dept_map.get(dept_id, []))
    if len(current) < 15:
        needed = 15 - len(current)
        # Πρώτα δοκιμάζουμε γενικές ειδικότητες, μετά όλους
        extras = [a for a in doctor_amkas if a not in current]
        random.shuffle(extras)
        for a in extras[:needed]:
            doc_dept_map[dept_id].append(a)
            w(f"INSERT IGNORE INTO Doctor_has_Department (doctor_amka,department_id) VALUES ({q(a)},{dept_id});")

# Βάρδιες: 15 πρώτες μέρες κάθε μήνα, 2023-2026
# Δίνει 15 μέρες × 3 shifts × 41 μήνες = 1.845 shift days
# Κάθε γιατρός: έως 15/μήνα × 41 = 615 βάρδιες (ρεαλιστικό)
shift_periods = []
from calendar import monthrange as _mr
for y in [2023, 2024, 2025]:
    for mo in range(1, 13):
        shift_periods.append((date(y, mo, 1), date(y, mo, 15)))
for mo in range(1, 5):
    shift_periods.append((date(2026, mo, 1), date(2026, mo, 15)))
shift_periods.append((date(2026, 5, 1), date(2026, 5, 10)))

for period_start, period_end in shift_periods:
    current = period_start
    while current <= period_end:
        for stype in SHIFT_TYPES:
            w(f"INSERT INTO Shifts (id,shift_date,shift_type) VALUES ({sid_counter},{sql_date(current)},{q(stype)});")
            cur_sid = sid_counter
            sid_counter += 1

            for dept_id in dept_ids:
                # FIX: Γιατροί μόνο αν ανήκουν στο τμήμα (Doctor_has_Department)
                dept_doctors = doc_dept_map.get(dept_id, [])

                # Βήμα 1: Seniors πρώτα
                avail_seniors   = [a for a in dept_doctors if rank_of(a) in SENIOR_RANKS and can_assign(a, 'Doctor', current, stype)]
                avail_others    = [a for a in dept_doctors if rank_of(a) not in SENIOR_RANKS and can_assign(a, 'Doctor', current, stype)]
                avail_residents = [a for a in avail_others if rank_of(a) == 'Ειδικευόμενος']
                avail_mid       = [a for a in avail_others if rank_of(a) not in ('Ειδικευόμενος',)]
                random.shuffle(avail_seniors); random.shuffle(avail_mid); random.shuffle(avail_residents)

                # Βήμα 2: Φτιάχνουμε τη λίστα: seniors, μετά mid, μετά residents
                assigned_docs = []
                for a in avail_seniors + avail_mid:
                    if len(assigned_docs) >= 3: break
                    assigned_docs.append(a)

                # Βήμα 3: Residents μόνο αν ήδη υπάρχει senior
                has_senior_assigned = any(rank_of(a) in SENIOR_RANKS for a in assigned_docs)
                if has_senior_assigned:
                    for a in avail_residents:
                        if len(assigned_docs) >= 3: break
                        assigned_docs.append(a)

                # Νοσηλευτές ανά τμήμα
                dept_nurses_avail = [a for a in nurse_amkas
                                     if nurse_dept_map.get(a) == dept_id
                                     and can_assign(a, 'Nurse', current, stype)]
                random.shuffle(dept_nurses_avail)
                assigned_nurses = dept_nurses_avail[:6]

                # Διοικητικοί ανά τμήμα
                dept_admins_avail = [a for a in admin_amkas
                                     if admin_dept_map.get(a) == dept_id
                                     and can_assign(a, 'Admin', current, stype)]
                random.shuffle(dept_admins_avail)
                assigned_admins = dept_admins_avail[:2]

                # FIX: Γράφουμε assignments ΜΟΝΟ αν πληρείται το minimum staffing
                # (3 γιατροί, 6 νοσηλευτές, 2 διοικητικοί)
                if len(assigned_docs) < 3 or len(assigned_nurses) < 6 or len(assigned_admins) < 2:
                    continue  # skip αυτό το dept για αυτή τη βάρδια

                for a in assigned_docs:
                    do_assign(cur_sid, a, dept_id, 'Doctor', current, stype)
                for a in assigned_nurses:
                    do_assign(cur_sid, a, dept_id, 'Nurse', current, stype)
                for a in assigned_admins:
                    do_assign(cur_sid, a, dept_id, 'Admin', current, stype)

        current += timedelta(days=1)
w("")

# ============================================================
# TRIAGE
# ============================================================
w("-- Hospitalizations")

icd10_codes = [c for c, _ in SAMPLE_ICD10]
ken_codes   = [c for c, _, _ in SAMPLE_KEN]
ken_data    = {c: (cost, days) for c, cost, days in SAMPLE_KEN}

# FIX Q14: only 25 common ICD codes for hospitalizations
_COMMON_ICD = ['I21','I50','I63','J18','J44','K35','K80','K92',
               'S72','S06','C34','C50','C18','N18','N39','E11',
               'E87','M16','O80','O34','A09','B97','F20','G35','I10']
_icd_set = {c for c, _ in SAMPLE_ICD10}
HOSP_ICD_POOL = [c for c in _COMMON_ICD if c in _icd_set] or icd10_codes[:25]

# Διαθεσιμότητα κλίνης
beds_with_open = set()
bed_periods = {}

def bed_available(bed_id, adm, dis):
    if bed_id in beds_with_open: return False
    for (a, d) in bed_periods.get(bed_id, []):
        if not (dis <= a or adm >= d): return False
    return True

def select_compatible_patient_dept(pamka, dept_id):
    """Επιστρέφει True αν ο ασθενής ταιριάζει με το τμήμα."""
    info = patient_info[pamka]
    age, gender = info['age'], info['gender']
    dname = DEPT_INFO[dept_id-1][0]
    if dname == 'Παιδιατρική' and age >= 18: return False
    if dname == 'Μαιευτική' and (gender != 'Θηλυκό' or age < 18 or age > 50): return False
    if age < 18 and dname not in ('Παιδιατρική', 'Επείγοντα'): return False
    return True

hosp_ids = []
hid = 1
attempts = 0

# Pools κατάλληλων ασθενών ανά τμήμα (για ταχύτερη επιλογή)
def pick_compatible(dept_id):
    dname = DEPT_INFO[dept_id-1][0]
    if dname == 'Παιδιατρική':
        pool = [p for p in patient_amkas if patient_info[p]['age'] < 18]
    elif dname == 'Μαιευτική':
        pool = [p for p in patient_amkas if patient_info[p]['gender'] == 'Θηλυκό'
                and 18 <= patient_info[p]['age'] <= 50]
    else:
        pool = [p for p in patient_amkas if patient_info[p]['age'] >= 18]
    return random.choice(pool) if pool else None

while hid <= 600 and attempts < 15000:
    attempts += 1
    bed_id, dept_id = random.choice(bed_ids)
    pamka = pick_compatible(dept_id)
    if not pamka: continue

    adm = random_datetime(date(2023, 1, 1), date(2026, 4, 1))
    stay = random.randint(1, 20)
    has_discharge = random.random() < 0.92
    dis = adm + timedelta(days=stay) if has_discharge else None

    adm_d = adm.date()
    dis_d = dis.date() if dis else date(2099, 1, 1)

    if not bed_available(bed_id, adm_d, dis_d): continue

    bed_periods.setdefault(bed_id, []).append((adm_d, dis_d))
    if dis is None:
        beds_with_open.add(bed_id)

    adm_icd = random.choice(HOSP_ICD_POOL)
    dis_icd = random.choice(HOSP_ICD_POOL) if dis else None
    ken = random.choice(ken_codes)

    # FIX: ο trigger calculate_hospitalization_cost είναι BEFORE UPDATE και
    # ενεργοποιείται μόνο όταν συμπληρώνεται discharge_date σε επόμενο UPDATE.
    # Όταν εισάγουμε την εγγραφή με discharge_date εξαρχής, ο trigger ΔΕΝ τρέχει,
    # οπότε υπολογίζουμε το κόστος εδώ ώστε να μην μένει total_cost = 0
    # (αυτό θα έσπαγε το Q1 — Total_Revenue).
    base_cost, mdn = ken_data[ken]
    if dis is not None:
        actual_days = (dis.date() - adm.date()).days
        total_cost = base_cost + max(0, actual_days - mdn) * 100.0
    else:
        total_cost = 0.0
    dis_val = sql_dt(dis) if dis else 'NULL'
    dis_icd_val = q(dis_icd) if dis_icd else 'NULL'

    w(f"INSERT INTO Hospitalization (id,patient_amka,bed_id,department_id,admission_date,discharge_date,admission_diagnosis_icd10,discharge_diagnosis_icd10,ken_code,total_cost) VALUES ({hid},{q(pamka)},{bed_id},{dept_id},{sql_dt(adm)},{dis_val},{q(adm_icd)},{dis_icd_val},{q(ken)},{round(total_cost, 2)});")
    hosp_ids.append((hid, pamka, dept_id, adm, dis))
    hid += 1

# Q3: ασθενείς με >3 νοσηλείες στο ίδιο τμήμα
q3_patients = random.sample([p for p in patient_amkas if patient_info[p]['age'] >= 18], 15)
for pamka in q3_patients:
    # Επιλογή τμήματος συμβατού με τον ασθενή
    info = patient_info[pamka]
    valid_depts = [d for d in dept_ids if select_compatible_patient_dept(pamka, d)]
    if not valid_depts: continue
    target_dept = random.choice(valid_depts)
    dept_beds = [b for b, d in bed_ids if d == target_dept]
    if not dept_beds: continue
    for k in range(4):
        bed_id = random.choice(dept_beds)
        year = random.choice([2023, 2024, 2025, 2026])
        if year == 2026:
            adm = random_datetime(date(2026, 1, 1), date(2026, 3, 1))
        else:
            adm = random_datetime(date(year, 1, 1), date(year, 11, 30))
        stay = random.randint(3, 15)
        dis = adm + timedelta(days=stay)
        adm_d, dis_d = adm.date(), dis.date()
        if not bed_available(bed_id, adm_d, dis_d):
            for alt in dept_beds:
                if bed_available(alt, adm_d, dis_d):
                    bed_id = alt
                    break
            else:
                continue
        bed_periods.setdefault(bed_id, []).append((adm_d, dis_d))
        adm_icd = random.choice(HOSP_ICD_POOL)
        dis_icd = random.choice(HOSP_ICD_POOL)
        ken = random.choice(ken_codes)
        # Όπως παραπάνω: υπολογισμός cost στον Python (ο trigger είναι BEFORE UPDATE).
        base_cost, mdn = ken_data[ken]
        actual_days = (dis.date() - adm.date()).days
        total_cost = base_cost + max(0, actual_days - mdn) * 100.0
        w(f"INSERT INTO Hospitalization (id,patient_amka,bed_id,department_id,admission_date,discharge_date,admission_diagnosis_icd10,discharge_diagnosis_icd10,ken_code,total_cost) VALUES ({hid},{q(pamka)},{bed_id},{target_dept},{sql_dt(adm)},{sql_dt(dis)},{q(adm_icd)},{q(dis_icd)},{q(ken)},{round(total_cost, 2)});")
        hosp_ids.append((hid, pamka, target_dept, adm, dis))
        hid += 1
w("")

# ============================================================
# PROCEDURE RECORDS — εντός ωρών εργασίας
# ============================================================
w("-- Triage Records")
# FIX: Κάθε νοσηλεία πρέπει να έχει triage που προηγήθηκε
# (εκφώνηση: κάθε ασθενής πρώτα περνά από triage)
triage_ids = []
tid = 1
triage_nurse_amkas = [a for a in nurse_amkas[:100]]  # νοσηλευτές triage

# 1. Triage για κάθε νοσηλεία — outcome=Admitted, resolved
for hid_r, pamka, dept_id, adm, dis in hosp_ids:
    namka = random.choice(triage_nurse_amkas)
    age = patient_info[pamka]['age']
    dname = DEPT_INFO[dept_id-1][0]
    if dname in ('ΜΕΘ', 'Επείγοντα'):
        # Serious symptoms only for ICU/ER admissions
        serious_pool = [s for s in (SYMPTOMS_CHILD_URGENCY if age < 16 else SYMPTOMS_WITH_URGENCY) if s[2] <= 2]
        row = random.choice(serious_pool) if serious_pool else SYMPTOMS_WITH_URGENCY[0]
        symptoms, urgency = row[0], random.randint(row[1], row[2])
        urgency = min(urgency, 2)
    else:
        symptoms, urgency = random_symptoms(age)
    arr_time = adm - timedelta(hours=random.randint(0, 12), minutes=random.randint(0, 59))
    w(f"INSERT INTO Triage_Records (id,patient_amka,nurse_amka,symptoms,urgency_level,arrival_time,outcome,resolved_at,hospitalization_id) VALUES ({tid},{q(pamka)},{q(namka)},{q(symptoms)},{urgency},{sql_dt(arr_time)},'Admitted',{sql_dt(adm)},{hid_r});")
    triage_ids.append((tid, pamka, urgency, arr_time))
    tid += 1

# 2. Extra triage — αποχωρούν (outcome=Discharged), ιστορικά resolved
hosp_patients_set = set(pamka for _, pamka, _, _, _ in hosp_ids)
extra_count = 0
for i in range(200):
    if extra_count >= 120: break
    pamka = random.choice(patient_amkas)
    namka = random.choice(triage_nurse_amkas)
    age = patient_info[pamka]['age']
    # Discharged patients have mild symptoms (urgency 3-5 only)
    # Pick from symptoms that map to urgency >=3
    mild_pool = [s for s in (SYMPTOMS_CHILD_URGENCY if age < 16 else SYMPTOMS_WITH_URGENCY) if s[1] >= 3]
    if not mild_pool:
        mild_pool = SYMPTOMS_WITH_URGENCY[-5:]
    symptom_row = random.choice(mild_pool)
    symptoms = symptom_row[0]
    urgency = random.randint(symptom_row[1], symptom_row[2])
    arr_time = random_datetime(date(2023, 1, 1), date(2026, 5, 14))
    resolved_dt = arr_time + timedelta(minutes=random.randint(20, 240))
    w(f"INSERT INTO Triage_Records (id,patient_amka,nurse_amka,symptoms,urgency_level,arrival_time,outcome,resolved_at) VALUES ({tid},{q(pamka)},{q(namka)},{q(symptoms)},{urgency},{sql_dt(arr_time)},'Discharged',{sql_dt(resolved_dt)});")
    triage_ids.append((tid, pamka, urgency, arr_time))
    tid += 1
    extra_count += 1

# 3. Pending triage — μόνο τελευταίες 48 ώρες (outcome IS NULL → φαίνεται στη queue)
for i in range(12):
    pamka = random.choice(patient_amkas)
    namka = random.choice(triage_nurse_amkas)
    age = patient_info[pamka]['age']
    symptoms, urgency = random_symptoms(age)
    hours_ago = random.randint(1, 47)
    arr_time = datetime(2026, 5, 17, 12, 0, 0) - timedelta(hours=hours_ago, minutes=random.randint(0, 59))
    w(f"INSERT INTO Triage_Records (id,patient_amka,nurse_amka,symptoms,urgency_level,arrival_time) VALUES ({tid},{q(pamka)},{q(namka)},{q(symptoms)},{urgency},{sql_dt(arr_time)});")
    triage_ids.append((tid, pamka, urgency, arr_time))
    tid += 1
w("")

w("")

# ============================================================
# HOSPITALIZATIONS — με dept compatibility checks
# ============================================================

w("-- Procedure Records")

proc_codes = [c for c, _, _, _, _ in SAMPLE_PROCEDURES]
proc_dur_map = {c: d for c, _, _, d, _ in SAMPLE_PROCEDURES}
used_space_periods = {}
used_doc_periods = {}

def time_overlap(s1, e1, s2, e2):
    return not (e1 <= s2 or s1 >= e2)

proc_ids = []
pid = 1
hosp_2026 = [h for h in hosp_ids if h[3].year == 2026 and h[4] is not None]
hosp_other = [h for h in hosp_ids if h[3].year != 2026 and h[4] is not None]

for attempt in range(3000):
    if pid > 180: break
    if pid <= 60 and hosp_2026:
        hid_r, pamka, dept_id, adm, dis = random.choice(hosp_2026)
    else:
        pool = hosp_other or [h for h in hosp_ids if h[4] is not None]
        if not pool: continue
        hid_r, pamka, dept_id, adm, dis = random.choice(pool)

    proc_code = random.choice(proc_codes)
    dur_str = proc_dur_map[proc_code]
    h_h, h_m, h_s = map(int, dur_str.split(':'))
    dur_delta = timedelta(hours=h_h, minutes=h_m, seconds=h_s)

    end_limit = (dis - timedelta(days=1)).date() if dis else adm.date()
    if end_limit <= adm.date(): continue

    # FIX: εντός εργάσιμων ωρών (06:00-20:00 για start)
    start = random_work_datetime(adm.date(), end_limit)
    # Έλεγχος ότι ο τερματισμός είναι ως 23:59
    if start + dur_delta > start.replace(hour=23, minute=59):
        continue
    end = start + dur_delta

    space_id = random.choice(spaces)

    # Χειρουργός: δεν απαιτείται βάρδια (τακτικό χειρουργείο)
    if pid <= 40:
        candidates = young_surgeon_amkas[:]
    else:
        candidates = doctor_amkas[:]
    if not candidates: continue
    surgeon = random.choice(candidates)

    ok_s = all(not time_overlap(start, end, ss, se) for (ss, se) in used_space_periods.get(space_id, []))
    ok_d = all(not time_overlap(start, end, ds, de) for (ds, de) in used_doc_periods.get(surgeon, []))
    if not ok_s or not ok_d: continue

    used_space_periods.setdefault(space_id, []).append((start, end))
    used_doc_periods.setdefault(surgeon, []).append((start, end))

    w(f"INSERT INTO Procedure_Records (id,hospitalization_id,procedure_code,space_id,main_surgeon_amk,start_time,end_time) VALUES ({pid},{hid_r},{q(proc_code)},{space_id},{q(surgeon)},{sql_dt(start)},{sql_dt(end)});")
    proc_ids.append(pid)
    pid += 1
w("")

# Procedure assistants
w("-- Procedure Assistants")
for prid in proc_ids:
    n = random.randint(1, 3)
    assistants = random.sample(nurse_amkas[:80] + doctor_amkas[:30], n)
    for a in assistants:
        w(f"INSERT IGNORE INTO Procedure_Assistants (procedure_record_id,staff_amka) VALUES ({prid},{q(a)});")
w("")

# ============================================================
# LAB TESTS — εντός νοσηλείας
# ============================================================
w("-- Lab Tests")
completed_hosps = [(h, p, d, a, di) for h, p, d, a, di in hosp_ids if di is not None]
lab_count = 0
attempts = 0
while lab_count < 240 and attempts < 4000:
    attempts += 1
    hid_r, _, _, adm_h, dis_h = random.choice(completed_hosps)
    ldate = random_datetime(adm_h.date(), dis_h.date())
    # FIX: γιατρός με βάρδια εκείνη τη μέρα
    candidates = [d for d in doctor_amkas if ldate.date() in doctor_shift_dates.get(d, set())]
    if not candidates: continue
    doc = random.choice(candidates)
    ltype = random.choice(LAB_TYPES)
    rtext = random.choice(['Φυσιολογικά', 'Ανώτερα φυσιολογικά', 'Παθολογικά', 'Εντός ορίων'])
    rval = round(random.uniform(0.1, 200.0), 2)
    unit = random.choice(['mg/dL', 'g/L', 'mmol/L', 'U/L', '%'])
    cost = round(random.uniform(20, 300), 2)
    w(f"INSERT INTO Lab_Tests (hospitalization_id,ordering_doctor_amka,type,test_date,result_text,result_value,unit,cost) VALUES ({hid_r},{q(doc)},{q(ltype)},{sql_dt(ldate)},{q(rtext)},{rval},{q(unit)},{cost});")
    lab_count += 1
w("")

# ============================================================
# PRESCRIPTIONS — εντός νοσηλείας, χωρίς αλλεργίες
# ============================================================
w("-- Prescriptions")
med_codes = [c for c, _ in SAMPLE_MEDICINES]
presc_count = 0
presc_unique = set()

# Παίρνουμε όλες τις completed hosps, και αν τρέξει το pool ξανατρέχουμε
for hid_r, pamka, dept_id, adm, dis in (random.sample(completed_hosps, len(completed_hosps)) * 5):
    if dis is None or presc_count >= 360: break
    start_d = random_date(adm.date(), dis.date())
    # FIX: γιατρός με βάρδια στην ημερομηνία συνταγής
    candidates = [d for d in doctor_amkas if start_d in doctor_shift_dates.get(d, set())]
    if not candidates: continue
    doc = random.choice(candidates)
    allergies = allergy_map.get(pamka, set())
    safe_meds = [m for m in med_codes if not allergies.intersection(set(MED_SUBSTANCES.get(m, [])))]
    if not safe_meds: continue
    mcode = random.choice(safe_meds)
    key = (doc, pamka, mcode, str(start_d))
    if key in presc_unique: continue
    presc_unique.add(key)
    end_d = start_d + timedelta(days=random.randint(3, 21))
    dosage = random.choice(['1 ταμπλέτα', '2 ταμπλέτες', '500mg', '1g', '250mg', '5ml'])
    freq = random.choice(['Κάθε 8 ώρες', 'Κάθε 12 ώρες', 'Μία φορά ημερησίως',
                          'Δύο φορές ημερησίως', 'Πριν τα γεύματα'])
    w(f"INSERT IGNORE INTO Prescriptions (doctor_amka,patient_amka,medicine_code,start_date,end_date,dosage,frequency) VALUES ({q(doc)},{q(pamka)},{q(mcode)},{sql_date(start_d)},{sql_date(end_d)},{q(dosage)},{q(freq)});")
    presc_count += 1
w("")

# ============================================================
# EVALUATIONS
# ============================================================
w("-- Evaluations Hospitalization")
eval_hosp_ids = set()
LIKERT = [1, 2, 3, 4, 5]
for hid_r, _, _, _, _ in random.sample(completed_hosps, min(150, len(completed_hosps))):
    if hid_r in eval_hosp_ids: continue
    eval_hosp_ids.add(hid_r)
    # bias: περισσότεροι θετικοί από αρνητικούς
    nc = random.choices(LIKERT, weights=[5, 10, 25, 35, 25])[0]
    cl = random.choices(LIKERT, weights=[5, 10, 25, 35, 25])[0]
    fo = random.choices(LIKERT, weights=[10, 15, 30, 30, 15])[0]
    oe = random.choices(LIKERT, weights=[5, 10, 25, 35, 25])[0]
    w(f"INSERT IGNORE INTO Evaluation_Hospitalization (hospitalization_id,nursing_care,cleanliness,food,overall_experience) VALUES ({hid_r},{nc},{cl},{fo},{oe});")
w("")

w("-- Evaluations Doctor")
for hid_r in list(eval_hosp_ids)[:100]:
    doc = random.choice(doctor_amkas[:30])
    mc = random.choices(LIKERT, weights=[5, 10, 20, 35, 30])[0]
    w(f"INSERT IGNORE INTO Evaluation_Doctor (hospitalization_id,doctor_amka,medical_care) VALUES ({hid_r},{q(doc)},{mc});")
w("")

# ============================================================
# ENTITY IMAGES
# ============================================================
DEPT_IMAGES = {
    'Καρδιολογία':   'https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?w=800',
    'Χειρουργική':   'https://images.unsplash.com/photo-1551190822-a9333d879b1f?w=800',
    'ΜΕΘ':           'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800',
    'Επείγοντα':     'https://images.unsplash.com/photo-1587745416684-47953f16f02f?w=800',
    'Νευρολογία':    'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800',
    'Ορθοπεδική':    'https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=800',
    'Παιδιατρική':   'https://images.unsplash.com/photo-1576671081837-49000212a370?w=800',
    'Μαιευτική':     'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800',
    'Ογκολογία':     'https://images.unsplash.com/photo-1666214280391-8ff5bd3c0bf0?w=800',
    'Πνευμονολογία': 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800',
    'Νεφρολογία':    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800',
    'Ουρολογία':     'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800',
    'Οφθαλμολογία':  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800',
    'ΩΡΛ':           'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800',
    'Δερματολογία':  'https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800',
}
DOCTOR_IMGS = [
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400',
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400',
    'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400',
    'https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?w=400',
    'https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=400',
]
w("-- Department & Doctor Images")
for i, dept_id in enumerate(dept_ids):
    dname = DEPT_INFO[i][0]
    url = DEPT_IMAGES.get(dname, 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800')
    w(f"INSERT IGNORE INTO Department_Images (department_id,image_url,description) VALUES ({dept_id},{q(url)},{q(f'Φωτογραφία τμήματος {dname}')});")
for amka in random.sample(doctor_amkas, min(30, len(doctor_amkas))):
    url = random.choice(DOCTOR_IMGS)
    w(f"INSERT IGNORE INTO Doctor_Images (doctor_amka,image_url,description) VALUES ({q(amka)},{q(url)},'Φωτογραφία ιατρού');")
w("")
w("")

w("SET FOREIGN_KEY_CHECKS=1;")
w("")
w("-- ============================================================")
w("-- ΤΕΛΟΣ load.sql")
w("-- ============================================================")

# ============================================================
# WRITE OUTPUT
# ============================================================
_out_path = os.path.join(OUTDIR, 'load.sql')
with open(_out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print(f"✅ Δημιουργήθηκε: {_out_path}", file=sys.stderr)
print(f"   Γραμμές SQL:       {len(out):,}", file=sys.stderr)
print(f"   Ειδικότητες:       {len(ALL_SPECIALTIES)}", file=sys.stderr)
print(f"   Ιατροί:            {len(doctor_amkas)}", file=sys.stderr)
print(f"   Νοσηλευτές:        {len(nurse_amkas)}", file=sys.stderr)
print(f"   Διοικητικοί:       {len(admin_amkas)}", file=sys.stderr)
print(f"   Ασθενείς:          {len(patient_amkas)}", file=sys.stderr)
print(f"   Νοσηλείες:         {len(hosp_ids)}", file=sys.stderr)
print(f"   Επεμβάσεις:        {len(proc_ids)}", file=sys.stderr)
print(f"   Συνταγές:          {presc_count}", file=sys.stderr)
print(f"   Νέοι χειρ/γοί:     {len(young_surgeon_amkas)}", file=sys.stderr)