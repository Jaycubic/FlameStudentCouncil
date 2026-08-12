import mysql.connector
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv
import math
from datetime import datetime

# Load environment variables
load_dotenv()

# ── Columns that hold identifier-like values ────────────────────────────────
# Phone numbers, device IDs, reference numbers, "days" strings, etc. are never
# used for arithmetic, so we always store them as plain digit strings. This
# sidesteps "integer out of range" entirely, no matter how large a number
# shows up or how it got mangled by Excel/MySQL into scientific notation.
STRING_ID_COLUMNS = {
    'student_cvue_no',
    'accompany_with',
    'contact_no',
    'father_mobile_no',
    'mother_mobile_no',
    'device_id',
    'no_of_days',
}

# Postgres BIGINT bounds - used to guard the few columns we DO keep as real
# integers (currently just `id`). If a value somehow exceeds this, we log it
# and store NULL instead of crashing the whole batch.
PG_BIGINT_MIN = -9223372036854775808
PG_BIGINT_MAX = 9223372036854775807


def clean_value(val, pg_column=None):
    if val is None:
        return None

    is_string_id = pg_column in STRING_ID_COLUMNS

    if isinstance(val, str):
        s = val.strip()
        if not s or s.lower() in ('none', 'null', 'nan'):
            return None
        # Parse scientific-notation strings like "9.18E+11" (a mangled phone
        # number/ID) back into a clean plain-digit representation.
        if 'e' in s.lower() or '.' in s:
            try:
                f = float(s)
                if math.isnan(f):
                    return None
                if f.is_integer():
                    if is_string_id:
                        # e.g. 9.18E+11 -> "918000000000"
                        return f"{int(f)}"
                    n = int(f)
                    if not (PG_BIGINT_MIN <= n <= PG_BIGINT_MAX):
                        print(f"⚠️ [{pg_column}] value out of BIGINT range, storing NULL: {s!r}")
                        return None
                    return n
                return s if is_string_id else f
            except (ValueError, OverflowError):
                pass
        return s

    if isinstance(val, float):
        if math.isnan(val):
            return None
        if val.is_integer():
            if is_string_id:
                return f"{int(val)}"
            n = int(val)
            if not (PG_BIGINT_MIN <= n <= PG_BIGINT_MAX):
                print(f"⚠️ [{pg_column}] value out of BIGINT range, storing NULL: {val!r}")
                return None
            return n
        return str(val) if is_string_id else val

    if isinstance(val, int):
        if is_string_id:
            return str(val)
        if not (PG_BIGINT_MIN <= val <= PG_BIGINT_MAX):
            print(f"⚠️ [{pg_column}] value out of BIGINT range, storing NULL: {val!r}")
            return None
        return val

    return val


def sync_data():
    # MySQL connection configuration
    mysql_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
        'database': os.getenv('DB_NAME', 'studenttracking'),
        'port': int(os.getenv('DB_PORT', 3306))
    }

    # PostgreSQL connection configuration
    pg_config = {
        'host': os.getenv('DBP_HOST', '127.0.0.1'),
        'user': os.getenv('DBP_USER', ''),
        'password': os.getenv('DBP_PASSWORD', ''),
        'database': os.getenv('DBP_NAME', 'studentcouncil'),
        'port': int(os.getenv('DBP_PORT', 5432))
    }

    mysql_conn = None
    pg_conn = None

    try:
        # Connect to MySQL
        mysql_conn = mysql.connector.connect(**mysql_config)
        mysql_cursor = mysql_conn.cursor(dictionary=True)
        print("✅ Connected to MySQL")

        # Connect to PostgreSQL
        pg_conn = psycopg2.connect(**pg_config)
        pg_cursor = pg_conn.cursor()
        print("✅ Connected to PostgreSQL")

        # Widen identifier columns to VARCHAR so they can never overflow,
        # no matter how large or malformed the source value is.
        alter_statements = [
            # MySQL's `id` values are apparently large externally-sourced
            # numbers (e.g. 2189642497), not small sequential ones - they
            # exceed Postgres INTEGER's ~2.1B ceiling. Widen to BIGINT.
            "ALTER TABLE app.student_data ALTER COLUMN id TYPE BIGINT;",
            "ALTER TABLE app.student_data ALTER COLUMN student_cvue_no TYPE VARCHAR(255) USING student_cvue_no::text;",
            "ALTER TABLE app.student_data ALTER COLUMN accompany_with TYPE VARCHAR(255) USING accompany_with::text;",
            "ALTER TABLE app.student_data ALTER COLUMN contact_no TYPE VARCHAR(255) USING contact_no::text;",
            "ALTER TABLE app.student_data ALTER COLUMN father_mobile_no TYPE VARCHAR(255) USING father_mobile_no::text;",
            "ALTER TABLE app.student_data ALTER COLUMN mother_mobile_no TYPE VARCHAR(255) USING mother_mobile_no::text;",
            "ALTER TABLE app.student_data ALTER COLUMN device_id TYPE VARCHAR(255) USING device_id::text;",
            "ALTER TABLE app.student_data ALTER COLUMN no_of_days TYPE VARCHAR(255) USING no_of_days::text;",
        ]
        for stmt in alter_statements:
            try:
                pg_cursor.execute(stmt)
                pg_conn.commit()
            except Exception as alter_e:
                pg_conn.rollback()
                print(f"⚠️ Column alter notice: {alter_e}")

        # Fetch data from MySQL
        mysql_cursor.execute("SELECT * FROM studentdata")
        rows = mysql_cursor.fetchall()
        print(f"📦 Fetched {len(rows)} rows from MySQL")

        if not rows:
            print("⚠️ No data to sync")
            return

        column_mapping = {
            'id': 'id',
            'RC Name': 'rc_name',
            'Batch': 'batch',
            'Student Name': 'student_name',
            'Photo': 'photo',
            'Status': 'status',
            'StudentStatus': 'student_status',
            'WithDrawnDate': 'with_drawn_date',
            'WithDrawnReason': 'with_drawn_reason',
            'WithDrawnComment': 'with_drawn_comment',
            'Gender': 'gender',
            'No.of Days': 'no_of_days',
            'DOB': 'dob',
            'Email ID': 'email_id',
            'ContactNo': 'contact_no',
            'HomeTown': 'home_town',
            'House': 'house',
            'Housing Block': 'housing_block',
            'FatherName': 'father_name',
            'Father Email ID': 'father_email_id',
            'Father Mobile No.': 'father_mobile_no',
            'MotherName': 'mother_name',
            'Mother Email ID': 'mother_email_id',
            'Mother Mobile No.': 'mother_mobile_no',
            'Student Cvue No.': 'student_cvue_no',
            'IN-OUT': 'inout',
            'Device Name': 'device_name',
            'Last Punch Date': 'last_punch_date',
            'DeviceId': 'device_id',
            'Reported': 'reported',
            'AccompanyWith': 'accompany_with'
        }

        pg_columns = list(column_mapping.values())
        mysql_columns = list(column_mapping.keys())

        # Build the values list for execute_values, passing the target pg
        # column name into clean_value so it knows whether to keep a value
        # as text or as a real number.
        values = []
        for row in rows:
            cleaned_row = [
                clean_value(row.get(mcol), pcol)
                for mcol, pcol in zip(mysql_columns, pg_columns)
            ]
            values.append(tuple(cleaned_row))

        insert_query = f"""
            INSERT INTO app.student_data ({', '.join(pg_columns)})
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
            {', '.join([f"{col} = EXCLUDED.{col}" for col in pg_columns if col != 'id'])}
        """

        try:
            execute_values(pg_cursor, insert_query, values)
            pg_conn.commit()
            print(f"🚀 Successfully synced {len(rows)} rows to PostgreSQL")
        except Exception as bulk_e:
            # Bulk insert failed - roll back and retry row-by-row so we can
            # (a) still sync every good row, and (b) pinpoint exactly which
            # row/id is the problem instead of guessing.
            pg_conn.rollback()
            print(f"⚠️ Bulk insert failed ({bulk_e}); retrying row-by-row to isolate bad rows...")
            single_query = f"""
                INSERT INTO app.student_data ({', '.join(pg_columns)})
                VALUES ({', '.join(['%s'] * len(pg_columns))})
                ON CONFLICT (id) DO UPDATE SET
                {', '.join([f"{col} = EXCLUDED.{col}" for col in pg_columns if col != 'id'])}
            """
            ok, failed = 0, 0
            for row_values, original_row in zip(values, rows):
                try:
                    pg_cursor.execute(single_query, row_values)
                    pg_conn.commit()
                    ok += 1
                except Exception as row_e:
                    pg_conn.rollback()
                    failed += 1
                    print(f"❌ Row id={original_row.get('id')} failed: {row_e}")
                    print(f"    Raw row data: {original_row}")
            print(f"🚀 Row-by-row sync finished: {ok} succeeded, {failed} failed")

    except Exception as e:
        print(f"❌ Error during sync: {e}")
        if pg_conn:
            pg_conn.rollback()
    finally:
        if mysql_conn:
            mysql_conn.close()
        if pg_conn:
            pg_conn.close()

if __name__ == "__main__":
    print(f"⏰ Sync started at {datetime.now()}")
    sync_data()
    print(f"🏁 Sync finished at {datetime.now()}")