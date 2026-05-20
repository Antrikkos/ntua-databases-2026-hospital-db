@echo off
REM ============================================================
REM  run_queries_txt.bat - run Q01..Q15 and save each output as
REM  the default MySQL ASCII-table format at sql\<name>_out.txt
REM ============================================================

SET /P DB_USER=MySQL Username (default: root):
IF "%DB_USER%"=="" SET DB_USER=root

SET /P DB_NAME=Database name (default: hygeiopolis_db):
IF "%DB_NAME%"=="" SET DB_NAME=hygeiopolis_db

SET /P DB_PASS=MySQL Password (leave empty if none):

IF "%DB_PASS%"=="" (
    SET MYSQL_AUTH=-u %DB_USER% --default-character-set=utf8mb4
) ELSE (
    SET MYSQL_AUTH=-u %DB_USER% "--password=%DB_PASS%" --default-character-set=utf8mb4 --table
)

echo.
for %%f in (sql\Q*.sql) do (
    echo Running %%f -^> sql\%%~nf_out.txt
    mysql %MYSQL_AUTH% -t --default-character-set=utf8mb4 %DB_NAME% < "%%f" > "sql\%%~nf_out.txt" 2>&1
)

echo.
echo Done.
pause