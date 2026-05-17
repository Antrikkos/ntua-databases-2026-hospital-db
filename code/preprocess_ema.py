#!/usr/bin/env python3
"""
preprocess_ema.py
─────────────────
Διαβάζει το Medicine_EMA.xlsx (Article 57 EMA) και παράγει:
  - ema_medicines.sql   → INSERTs για Medicine_EMA
  - ema_substances.sql  → INSERTs για Active_Substances
  - ema_links.sql       → INSERTs για Medicine_has_Substances
"""

import argparse
import os
import sys
import re
import pandas as pd
from pathlib import Path

# ─── Ορίσματα ─────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument('--input',  default='data/Medicine_EMA.xlsx')
parser.add_argument('--limit',  type=int, default=3000,
                    help='Μέγιστος αριθμός φαρμάκων (0 = όλα)')
parser.add_argument('--outdir', default='sql',
                    help='Φάκελος στον οποίο θα γραφτούν τα παραγόμενα .sql')
parser.add_argument('--mapping-dir', default='data',
                    help='Φάκελος στον οποίο θα γραφτεί το ema_code_mapping.txt')
args = parser.parse_args()

INPUT_FILE   = args.input
LIMIT        = args.limit if args.limit > 0 else None
HEADER_ROW   = 19   # 0-indexed· η γραμμή 20 του Excel

OUTDIR       = args.outdir
MAPPING_DIR  = args.mapping_dir
os.makedirs(OUTDIR, exist_ok=True)
os.makedirs(MAPPING_DIR, exist_ok=True)

OUT_MEDICINES  = os.path.join(OUTDIR, 'ema_medicines.sql')
OUT_SUBSTANCES = os.path.join(OUTDIR, 'ema_substances.sql')
OUT_LINKS      = os.path.join(OUTDIR, 'ema_links.sql')

# ─── Helper ───────────────────────────────────────────────────────────────────
def q(val):
    """SQL-safe single-quoted string."""
    if val is None:
        return 'NULL'
    return "'" + str(val).replace("'", "''").replace('\\', '\\\\') + "'"

def slugify_code(name: str, idx: int) -> str:
    clean = re.sub(r'[^A-Za-z0-9]', '', name).upper()[:8]
    return f"{clean}-{idx}"

# ─── Φόρτωση ──────────────────────────────────────────────────────────────────
print(f"📂 Φόρτωση {INPUT_FILE} ...", file=sys.stderr)
df = pd.read_excel(
    INPUT_FILE,
    sheet_name='Art57 product data',
    header=HEADER_ROW,
    dtype=str,
)
df.columns = ['product_name', 'active_substance', 'route',
              'country', 'holder', 'pvsmf', 'email', 'phone']

df = df[['product_name', 'active_substance']].copy()
df['product_name']     = df['product_name'].fillna('').str.strip()
df['active_substance'] = df['active_substance'].fillna('').str.strip()

df = df[df['product_name'] != ''].reset_index(drop=True)
df = df.drop_duplicates(subset=['product_name']).reset_index(drop=True)

if LIMIT:
    df = df.head(LIMIT)

total = len(df)
print(f"   Φάρμακα μετά dedup/limit: {total:,}", file=sys.stderr)

# ─── 1. Active Substances ─────────────────────────────────────────────────────
print("⚗️  Επεξεργασία δραστικών ουσιών ...", file=sys.stderr)

substance_to_id: dict[str, int] = {}
sid_counter = 1

for raw in df['active_substance']:
    if not raw:
        continue
    parts = [p.strip() for p in raw.split('|') if p.strip()]
    for part in parts:
        sub_parts = [s.strip() for s in part.split(',') if s.strip()] if '|' not in raw else [part]
        for sp in sub_parts:
            norm = sp.strip()
            if norm and norm not in substance_to_id:
                substance_to_id[norm] = sid_counter
                sid_counter += 1

print(f"   Μοναδικές δραστικές ουσίες: {len(substance_to_id):,}", file=sys.stderr)

# ─── 2. Παραγωγή SQL ──────────────────────────────────────────────────────────

# ── ema_substances.sql ────────────────────────────────────────────────────────
print(f"✍️  Γράψιμο {OUT_SUBSTANCES} ...", file=sys.stderr)
# ΔΙΟΡΘΩΣΗ: Αλλαγή από utf-8-sig σε utf-8 παντού
with open(OUT_SUBSTANCES, 'w', encoding='utf-8') as f:
    f.write("-- Active Substances από EMA Article 57\n")
    f.write("-- Παράχθηκε από preprocess_ema.py\n\n")
    f.write("SET FOREIGN_KEY_CHECKS=0;\n\n")
    f.write("SET NAMES 'utf8mb4';\n")
    items = list(substance_to_id.items())
    BATCH = 1000
    for i in range(0, len(items), BATCH):
        batch = items[i:i+BATCH]
        f.write("INSERT IGNORE INTO Active_Substances (id, name) VALUES\n")
        lines = [f"  ({sid}, {q(name)})" for name, sid in batch]
        f.write(',\n'.join(lines))
        f.write(';\n\n')
    f.write("SET FOREIGN_KEY_CHECKS=1;\n")

# ── ema_medicines.sql ─────────────────────────────────────────────────────────
print(f"✍️  Γράψιμο {OUT_MEDICINES} ...", file=sys.stderr)

codes: list[str] = []
seen_codes: set[str] = set()
for i, name in enumerate(df['product_name'], 1):
    code = slugify_code(name, i)
    while code in seen_codes:
        code = f"{code[:-len(str(i))]}{i}X"
    seen_codes.add(code)
    codes.append(code)

df['code'] = codes

with open(OUT_MEDICINES, 'w', encoding='utf-8') as f:
    f.write("-- Medicine EMA από Article 57\n")
    f.write("-- Παράχθηκε από preprocess_ema.py\n\n")
    f.write("SET FOREIGN_KEY_CHECKS=0;\n\n")
    f.write("SET NAMES 'utf8mb4';\n")
    BATCH = 500
    rows = list(zip(df['code'], df['product_name']))
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i+BATCH]
        f.write("INSERT IGNORE INTO Medicine_EMA (code, brand_name) VALUES\n")
        lines = [f"  ({q(code)}, {q(name)})" for code, name in batch]
        f.write(',\n'.join(lines))
        f.write(';\n\n')
    f.write("SET FOREIGN_KEY_CHECKS=1;\n")

# ── ema_links.sql ─────────────────────────────────────────────────────────────
print(f"✍️  Γράψιμο {OUT_LINKS} ...", file=sys.stderr)

with open(OUT_LINKS, 'w', encoding='utf-8') as f:
    f.write("-- Medicine_has_Substances από EMA Article 57\n")
    f.write("-- Παράχθηκε από preprocess_ema.py\n\n")
    f.write("SET FOREIGN_KEY_CHECKS=0;\n\n")
    f.write("SET NAMES 'utf8mb4';\n")

    link_rows: list[tuple[str,int]] = []
    for _, row in df.iterrows():
        code = row['code']
        raw  = row['active_substance']
        if not raw:
            continue
        parts = [p.strip() for p in raw.split('|') if p.strip()]
        for part in parts:
            sub_parts = [s.strip() for s in part.split(',') if s.strip()] if '|' not in raw else [part]
            for sp in sub_parts:
                norm = sp.strip()
                if norm and norm in substance_to_id:
                    link_rows.append((code, substance_to_id[norm]))

    link_rows = list(set(link_rows))
    print(f"   Συνδέσεις medicine↔substance: {len(link_rows):,}", file=sys.stderr)

    BATCH = 1000
    for i in range(0, len(link_rows), BATCH):
        batch = link_rows[i:i+BATCH]
        f.write("INSERT IGNORE INTO Medicine_has_Substances (medicine_code, substance_id) VALUES\n")
        lines = [f"  ({q(code)}, {sid})" for code, sid in batch]
        f.write(',\n'.join(lines))
        f.write(';\n\n')

    f.write("SET FOREIGN_KEY_CHECKS=1;\n")

# ─── Αποθήκευση αντιστοίχισης code→name ─────
mapping_file = os.path.join(MAPPING_DIR, 'ema_code_mapping.txt')
with open(mapping_file, 'w', encoding='utf-8') as f:
    for code, name in zip(df['code'], df['product_name']):
        f.write(f"{code}\t{name}\n")