#!/usr/bin/env python3
"""
preprocess_reference_data.py
─────────────────────────────
Διαβάζει τα αρχεία αναφοράς και παράγει SQL scripts:
  - icd10.sql                → ICD10_Catalog      (11.008 εγγραφές)
  - ken.sql                  → KEN_Catalog         (727 εγγραφές)
  - medical_procedures.sql   → Medical_Procedure_Catalog (~11.000 εγγραφές)
"""

import argparse
import re
import sys
import subprocess
import os
import tempfile
import random
import pandas as pd
from pathlib import Path

random.seed(42)

# ─── Ρεαλιστικά ranges διάρκειας (λεπτά) & κόστους (€) ανά κατηγορία ─────────
PROCEDURE_RANGES = {
    'Αναισθησία':  ( 20,  120,   80,   400),
    'Χειρουργική': ( 30,  360,  300,  8000),
    'Διαγνωστική': ( 15,   90,   30,   600),
    'Θεραπευτική': ( 20,  240,   50,  1500),
}

def random_duration(category):
    mn, mx, _, _ = PROCEDURE_RANGES.get(category, (20, 120, 50, 500))
    minutes = random.randint(mn, mx)
    h, m = divmod(minutes, 60)
    return f'{h:02d}:{m:02d}:00'

def random_cost(category):
    _, _, mn, mx = PROCEDURE_RANGES.get(category, (20, 120, 50, 500))
    return round(random.uniform(mn, mx), 2)

# ─── Ορίσματα ─────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--icd10',  default='data/ICD10_Catalog.xls')
parser.add_argument('--ken',    default='data/KEN_Catalog.doc')
parser.add_argument('--procs',  default='data/Medical_Procedure_Catalog.xls')
parser.add_argument('--outdir', default='sql',
                    help='Φάκελος στον οποίο θα γραφτούν τα παραγόμενα .sql')
args = parser.parse_args()

OUTDIR = args.outdir
os.makedirs(OUTDIR, exist_ok=True)

# ─── Helper ───────────────────────────────────────────────────────────────────
def q(val):
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''").replace('\\', '\\\\').strip() + "'"

def write_sql(path, lines):
    # ΔΙΟΡΘΩΣΗ: Καθαρό utf-8, χωρίς το -sig που μπερδεύει τη MySQL
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f"   ✅ {path} ({len([l for l in lines if l.startswith('INSERT')])} batch inserts)", file=sys.stderr)

def batch_insert(table, columns, rows, batch=500):
    lines = []
    col_str = ', '.join(f'`{c}`' for c in columns)
    for i in range(0, len(rows), batch):
        chunk = rows[i:i+batch]
        values = ',\n'.join('  (' + ', '.join(str(v) for v in row) + ')' for row in chunk)
        lines.append(f"INSERT IGNORE INTO `{table}` ({col_str}) VALUES\n{values};")
        lines.append('')
    return lines

# ═══════════════════════════════════════════════════════════════════════════════
# 1. ICD-10
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n📂 ICD-10: {args.icd10}", file=sys.stderr)

df_icd = pd.read_excel(args.icd10, engine='xlrd', header=None, dtype=str)
df_icd.columns = ['code', 'description']
df_icd['code']        = df_icd['code'].fillna('').str.strip()
df_icd['description'] = df_icd['description'].fillna('').str.strip()
df_icd = df_icd[df_icd['code'].str.match(r'^[A-Z]\d', na=False)].reset_index(drop=True)

print(f"   Εγγραφές: {len(df_icd):,}", file=sys.stderr)

rows_icd = [(q(row['code']), q(row['description'])) for _, row in df_icd.iterrows()]

out = [
    "-- ICD-10 Catalog",
    "-- Πηγή: Υπ. Υγείας / Υγειόπολης project",
    "-- Παράχθηκε από preprocess_reference_data.py",
    "",
    "SET NAMES 'utf8mb4';", # ΔΙΟΡΘΩΣΗ: Προσθήκη SET NAMES
    "SET FOREIGN_KEY_CHECKS=0;",
    "",
]
out += batch_insert('ICD10_Catalog', ['code', 'description'], rows_icd)
out.append("SET FOREIGN_KEY_CHECKS=1;")

write_sql(os.path.join(OUTDIR, 'icd10.sql'), out)

# ═══════════════════════════════════════════════════════════════════════════════
# 2. KEN Catalog
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n📂 KEN: {args.ken}", file=sys.stderr)

def parse_cost(s):
    if not s or str(s).strip() in ('', 'nan'):
        return None
    cleaned = re.sub(r'[€\s\.]', '', str(s)).replace(',', '.')
    try:
        return float(cleaned)
    except ValueError:
        return None

def parse_mdn(s):
    if not s or str(s).strip() in ('', 'nan'):
        return None
    try:
        return int(float(str(s).strip()))
    except ValueError:
        return None

ken_path = args.ken
if ken_path.lower().endswith('.doc'):
    print("   Μετατροπή .doc → .docx ...", file=sys.stderr)
    import shutil, platform
    soffice_cmd = None

    if platform.system() == 'Windows':
        candidates = [
            r'C:\Program Files\LibreOffice\program\soffice.exe',
            r'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
        ]
        for base_dir in [r'C:\Program Files', r'C:\Program Files (x86)']:
            if os.path.isdir(base_dir):
                for entry in os.listdir(base_dir):
                    if 'libreoffice' in entry.lower():
                        candidate = os.path.join(base_dir, entry, 'program', 'soffice.exe')
                        candidates.append(candidate)
        for c in candidates:
            if os.path.isfile(c):
                soffice_cmd = c
                break
    else:
        soffice_cmd = shutil.which('soffice') or shutil.which('libreoffice')

    if not soffice_cmd:
        print("   ❌ Δεν βρέθηκε το LibreOffice!", file=sys.stderr)
        sys.exit(1)

    print(f"   Χρήση: {soffice_cmd}", file=sys.stderr)
    tmpdir = tempfile.mkdtemp()
    result = subprocess.run(
        [soffice_cmd, '--headless', '--convert-to', 'docx', '--outdir', tmpdir, ken_path],
        capture_output=True, text=True, timeout=90
    )
    base = Path(ken_path).stem
    ken_docx = os.path.join(tmpdir, base + '.docx')
    if not os.path.exists(ken_docx):
        sys.exit(1)
    ken_path = ken_docx

from docx import Document
doc_ken = Document(ken_path)

table = doc_ken.tables[1]
rows_ken = []
header_skipped = False
current_category = ''

for row in table.rows:
    cells = [c.text.strip() for c in row.cells]

    if not header_skipped and 'ΚΩΔΙΚ' in cells[0]:
        header_skipped = True
        continue

    code = cells[0] if len(cells) > 0 else ''
    desc = cells[1] if len(cells) > 1 else ''
    cost_str = cells[2] if len(cells) > 2 else ''
    mdn_str  = cells[3] if len(cells) > 3 else ''

    cost = parse_cost(cost_str)
    mdn  = parse_mdn(mdn_str)

    if not code:
        continue

    if cost is None or mdn is None:
        current_category = desc or code
        continue

    rows_ken.append((q(code), q(desc), cost, mdn))

print(f"   Εγγραφές: {len(rows_ken):,}", file=sys.stderr)

out = [
    "-- KEN Catalog (Κλειστά Ενοποιημένα Νοσήλια)",
    "-- Πηγή: Υπ. Υγείας",
    "-- Παράχθηκε από preprocess_reference_data.py",
    "",
    "SET NAMES 'utf8mb4';", # ΔΙΟΡΘΩΣΗ: Προσθήκη SET NAMES
    "SET FOREIGN_KEY_CHECKS=0;",
    "",
]
out += batch_insert('KEN_Catalog', ['code', 'description', 'basic_cost', 'avg_duration_days'], rows_ken)
out.append("SET FOREIGN_KEY_CHECKS=1;")

write_sql(os.path.join(OUTDIR, 'ken.sql'), out)

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Medical Procedures
# ═══════════════════════════════════════════════════════════════════════════════
print(f"\n📂 Ιατρικές Πράξεις: {args.procs}", file=sys.stderr)

CATEGORY_MAP = {
    'Α. ΠΡΑΞΕΙΣ ΑΙΝΑΙΣΘΗΣΙΑΣ':                          'Αναισθησία',
    'Β. ΠΡΑΞΕΙΣ ΧΕΙΡΟΥΡΓΙΚΕΣ':                          'Χειρουργική',
    'Γ. ΑΠΕΙΚΟΝΙΣΗ':                                    'Διαγνωστική',
    'Δ. ΠΡΑΞΕΙΣ ΒΙΟΠΑΘΟΛΟΓΙΑΣ':                         'Διαγνωστική',
    'Ε. ΠΡΑΞΕΙΣ ΙΑΤΡΟΔΙΚΑΣΤΙΚΗΣ':                       'Διαγνωστική',
    'ΣΤ. ΠΡΑΞΕΙΣ ΙΑΤΡΙΚΗΣ ΕΚΤΙΜΗΣΗΣ':                  'Θεραπευτική',
}

def get_category(cat_raw):
    for key, val in CATEGORY_MAP.items():
        if cat_raw.startswith(key[:10]):
            return val
    return 'Θεραπευτική'

df_proc = pd.read_excel(args.procs, engine='xlrd', header=None, dtype=str)
df_proc = df_proc.fillna('')

rows_proc = []
current_cat_raw = ''

for _, row in df_proc.iterrows():
    vals = [str(v).strip() for v in row]

    non_empty = [v for v in vals if v]
    if not non_empty:
        continue
    if non_empty[0] in ('Α/α', 'ΕΛΛΗΝΙΚΗ ΟΝΟΜΑΤΟΛΟΓΙΑ ΚΑΙ ΚΩΔΙΚΟΠΟΙΗΣΗ ΤΩΝ ΙΑΤΡΙΚΩΝ ΠΡΑΞΕΩΝ'):
        continue

    if len(non_empty) == 1 and not non_empty[0].isdigit():
        current_cat_raw = non_empty[0]
        continue

    if len(non_empty) < 3:
        continue

    if not vals[0].isdigit():
        continue

    code = vals[1].strip()
    name = vals[2].strip()[:255]

    if not code or not name:
        continue

    category = get_category(current_cat_raw)
    dur  = random_duration(category)
    cost = random_cost(category)
    rows_proc.append((q(code), q(name), q(category), q(dur), cost))

print(f"   Εγγραφές: {len(rows_proc):,}", file=sys.stderr)

out = [
    "-- Medical Procedure Catalog",
    "-- Πηγή: Υπ. Υγείας - Ελληνική Ονοματολογία Ιατρικών Πράξεων",
    "-- Παράχθηκε από preprocess_reference_data.py",
    "-- Διάρκεια & κόστος: τυχαίες τιμές ανά κατηγορία",
    "",
    "SET NAMES 'utf8mb4';", # ΔΙΟΡΘΩΣΗ: Προσθήκη SET NAMES
    "SET FOREIGN_KEY_CHECKS=0;",
    "",
]
out += batch_insert(
    'Medical_Procedure_Catalog',
    ['code', 'name', 'category', 'standard_duration', 'standard_cost'],
    rows_proc,
    batch=500
)
out.append("SET FOREIGN_KEY_CHECKS=1;")

write_sql(os.path.join(OUTDIR, 'medical_procedures.sql'), out)