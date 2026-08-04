import mysql.connector
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

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

    try:
        # Connect to MySQL
        mysql_conn = mysql.connector.connect(**mysql_config)
        mysql_cursor = mysql_conn.cursor(dictionary=True)
        print("✅ Connected to MySQL")

        # Connect to PostgreSQL
        pg_conn = psycopg2.connect(**pg_config)
        pg_cursor = pg_conn.cursor()
        print("✅ Connected to PostgreSQL")

        # Fetch data from MySQL
        mysql_cursor.execute("SELECT * FROM studentdata")
        rows = mysql_cursor.fetchall()
        print(f"📦 Fetched {len(rows)} rows from MySQL")

        if not rows:
            print("⚠️ No data to sync")
            return

        # Prepare PostgreSQL upsert query
        # We need to map MySQL columns to PostgreSQL columns
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

        # Build the values list for execute_values
        values = []
        for row in rows:
            val_tuple = tuple(row.get(col) for col in mysql_columns)
            values.append(val_tuple)

        # Upsert query
        insert_query = f"""
            INSERT INTO app.student_data ({', '.join(pg_columns)})
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
            {', '.join([f"{col} = EXCLUDED.{col}" for col in pg_columns if col != 'id'])}
        """

        execute_values(pg_cursor, insert_query, values)
        pg_conn.commit()
        print(f"🚀 Successfully synced {len(rows)} rows to PostgreSQL")

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
