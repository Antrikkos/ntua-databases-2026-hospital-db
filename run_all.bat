@echo off
REM ============================================================
REM  run_all.bat  -  Hygeiopolis Database Setup
REM  Δομή φακέλων:
REM    code/   → Python preprocess + generator scripts
REM    data/   → Source files (ICD-10 xls, KEN doc, EMA xlsx, ...)
REM    sql/    → install.sql, Q*.sql, παραγόμενα load/ema/icd10/...
REM    diagrams/  → .mwb, ER/relational PDFs
REM    docs/   → report.pdf, screenshots
REM ============================================================

echo.
echo ============================================================
echo   Hygeiopolis - Database Setup
echo ============================================================
echo.

SET /P DB_USER=MySQL Username (default: root):
IF "%DB_USER%"=="" SET DB_USER=root

SET /P DB_NAME=Database name (default: hygeiopolis_db):
IF "%DB_NAME%"=="" SET DB_NAME=hygeiopolis_db

SET /P DB_PASS=MySQL Password (leave empty if none):

IF "%DB_PASS%"=="" (
    SET MYSQL_AUTH=-u %DB_USER% --default-character-set=utf8mb4
) ELSE (
    SET MYSQL_AUTH=-u %DB_USER% "--password=%DB_PASS%" --default-character-set=utf8mb4
)

echo.
echo   DB User : %DB_USER%
echo   DB Name : %DB_NAME%
echo   DB Pass : (hidden)
echo ============================================================
echo.

REM ── Step 0: Drop and recreate database ───────────────────────
echo [0/10] Dropping existing database (if exists)...
mysql %MYSQL_AUTH% -e "DROP DATABASE IF EXISTS `%DB_NAME%`;"
IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not connect to MySQL. Check user/password.
    pause
    exit /b 1
)
echo       OK - Database dropped (or did not exist)

REM ── Step 1: Python dependencies ──────────────────────────────
echo [1/10] Installing Python libraries...
pip install faker pandas xlrd openpyxl python-docx --quiet
IF %ERRORLEVEL% NEQ 0 (echo ERROR: pip install failed & pause & exit /b 1)
echo       OK

REM ── Step 2: Generate reference SQL from data/ ────────────────
echo [2/10] Processing ICD-10 / KEN / Medical Procedures...
python code\preprocess_reference_data.py ^
    --icd10  data\ICD10_Catalog.xls ^
    --ken    data\KEN_Catalog.doc ^
    --procs  data\Medical_Procedure_Catalog.xls ^
    --outdir sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: preprocess_reference_data.py failed & pause & exit /b 1)
echo       OK

REM ── Step 3: Generate EMA SQL ─────────────────────────────────
echo [3/10] Processing EMA medicines (3000 records)...
python code\preprocess_ema.py ^
    --input       data\Medicine_EMA.xlsx ^
    --limit       3000 ^
    --outdir      sql ^
    --mapping-dir data
IF %ERRORLEVEL% NEQ 0 (echo ERROR: preprocess_ema.py failed & pause & exit /b 1)
echo       OK

REM ── Step 4: Generate random data ─────────────────────────────
echo [4/10] Generating random data (sql\load.sql)...
python code\generate_data.py --outdir sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: generate_data.py failed & pause & exit /b 1)
echo       OK

REM ── Step 5: Create schema ─────────────────────────────────────
echo [5/10] Creating schema (sql\install.sql)...
mysql %MYSQL_AUTH% < sql\install.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: install.sql failed & pause & exit /b 1)
echo       OK

REM ── Step 6: Load ICD-10 ───────────────────────────────────────
echo [6/10] Loading ICD-10...
mysql %MYSQL_AUTH% %DB_NAME% < sql\icd10.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: icd10.sql failed & pause & exit /b 1)
echo       OK

REM ── Step 7: Load KEN ──────────────────────────────────────────
echo [7/10] Loading KEN...
mysql %MYSQL_AUTH% %DB_NAME% < sql\ken.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: ken.sql failed & pause & exit /b 1)
echo       OK

REM ── Step 8: Load Medical Procedures ──────────────────────────
echo [8/10] Loading Medical Procedures...
mysql %MYSQL_AUTH% %DB_NAME% < sql\medical_procedures.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: medical_procedures.sql failed & pause & exit /b 1)
echo       OK

REM ── Step 9: Load EMA medicines ────────────────────────────────
echo [9/10] Loading EMA medicines...
mysql %MYSQL_AUTH% %DB_NAME% < sql\ema_substances.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: ema_substances.sql failed & pause & exit /b 1)
mysql %MYSQL_AUTH% %DB_NAME% < sql\ema_medicines.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: ema_medicines.sql failed & pause & exit /b 1)
mysql %MYSQL_AUTH% %DB_NAME% < sql\ema_links.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: ema_links.sql failed & pause & exit /b 1)
echo       OK

REM ── Step 10: Load random data ─────────────────────────────────
echo [10/10] Loading random data (sql\load.sql)...
mysql %MYSQL_AUTH% %DB_NAME% < sql\load.sql
IF %ERRORLEVEL% NEQ 0 (echo ERROR: load.sql failed & pause & exit /b 1)
echo       OK

echo.
echo ============================================================
echo   COMPLETED SUCCESSFULLY!
echo ============================================================
pause