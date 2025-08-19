import pandas as pd
import sqlalchemy
import redis
import schedule
import time
from datetime import datetime
from sqlalchemy import text
import signal

# Redis connection
redis_client = redis.Redis(host='localhost', port=6379, password=None)

# MSSQL connection (ESSL database)
mssql_url = (
    "mssql+pyodbc://essl:essl@192.168.3.22:1433/etimetracklite1?"
    "driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes"
)
mssql_engine = sqlalchemy.create_engine(mssql_url)

# MySQL connection (local database)
mysql_url = (
    "mysql+mysqlconnector://root:@localhost:3306/studenttracking?charset=utf8mb4"
)
mysql_engine = sqlalchemy.create_engine(mysql_url)

# Flag for graceful shutdown
running = True

def signal_handler(signum, frame):
    global running
    running = False
    print(f"[{datetime.now().isoformat()}] Received signal {signum}, shutting down...")

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def fetch_existing_students():
    query = "SELECT `Student Cvue No.` FROM studentdata"
    try:
        df = pd.read_sql_query(query, mysql_engine)
        s = set(df['Student Cvue No.'].astype(str))
        print(f"[{datetime.now().isoformat()}] Found {len(s)} existing students locally.")
        return s
    except Exception as e:
        print(f"Error fetching local students: {e}")
        return set()

def fetch_all_punches(student_cvue_nos):
    if not student_cvue_nos:
        return pd.DataFrame()

    cvue_list = ",".join(f"'{no}'" for no in student_cvue_nos)
    query = f"""
    SELECT
      [Student Cvue No.]    AS StudentCvueNo,
      [IN-OUT]              AS INOUT,
      [Device Name]         AS DeviceName,
      [Last Punch Date]     AS LastPunchDate,
      DeviceId              AS DeviceId,
      [No.of Days]          AS NoOfDays
    FROM [NewView for Student Tracking for INOUT]
    WHERE [Student Cvue No.] IN ({cvue_list})
    """
    try:
        df = pd.read_sql_query(query, mssql_engine)
        print(f"[{datetime.now().isoformat()}] Fetched {len(df)} total punch records.")
        return df
    except Exception as e:
        print(f"Error fetching ESSL data: {e}")
        return pd.DataFrame()

def clean_value(val):
    """Convert pandas NaN/NaT to None, leave datetimes as Python datetimes."""
    if pd.isna(val):
        return None
    if isinstance(val, pd.Timestamp):
        return val.to_pydatetime()
    return val

def update_local_database(df):
    if df.empty:
        print(f"[{datetime.now().isoformat()}] No records to update locally.")
        return

    df['LastPunchDate'] = pd.to_datetime(df['LastPunchDate'], errors='coerce')
    latest = df.sort_values('LastPunchDate').groupby('StudentCvueNo', as_index=False).last()

    # Prepare data for batch update
    records = []
    for _, row in latest.iterrows():
        cvue_no = str(row['StudentCvueNo'])
        records.append({
            "cvno":    cvue_no,
            "inout":   clean_value(row['INOUT']),
            "devname": clean_value(row['DeviceName']),
            "lpdate":  clean_value(row['LastPunchDate']),
            "did":     clean_value(row['DeviceId']),
            "nod":     clean_value(row['NoOfDays']),
        })

    # Update statement for existing records only
    update_sql = text("""
    UPDATE studentdata
    SET
      `IN-OUT`           = :inout,
      `Device Name`      = :devname,
      `Last Punch Date`  = :lpdate,
      DeviceId           = :did,
      `No.of Days`       = :nod
    WHERE `Student Cvue No.` = :cvno
    """)

    with mysql_engine.begin() as conn:
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            for record in batch:
                conn.execute(update_sql, record)

    print(f"[{datetime.now().isoformat()}] Updated {len(records)} local records.")

    # Clear Redis caches
    patterns = [
        'totalStudentCount',
        'genderBatchCount',
        'inOutCount',
        'inOutBatchCount',
        'housingDetails:page:*',
        'trackingInfo:page:*',
        'allStudents:page:*',
    ]
    for p in patterns:
        if '*' in p:
            keys = redis_client.keys(p)
            if keys:
                redis_client.delete(*keys)
        else:
            redis_client.delete(p)
    print(f"[{datetime.now().isoformat()}] Cleared related Redis caches.")

def fetch_essl_students():
    """Fetch student data from the ESSL database."""
    query = """
    SELECT
      [Student Cvue No.]    AS StudentCvueNo,
      [Student Name]        AS StudentName,
      [Status]              AS Status,
      [Gender]              AS Gender,
      [Batch]               AS Batch,
      [IN-OUT]              AS INOUT,
      [Device Name]         AS DeviceName,
      [Last Punch Date]     AS LastPunchDate,
      DeviceId              AS DeviceId,
      [No.of Days]          AS NoOfDays
    FROM [NewView for Student Tracking for INOUT]
    """
    try:
        df = pd.read_sql_query(query, mssql_engine)
        print(f"[{datetime.now().isoformat()}] Fetched {len(df)} student records from ESSL.")
        return df
    except Exception as e:
        print(f"Error fetching ESSL data: {e}")
        return pd.DataFrame()

def sync_with_local_database(df):
    """Sync the fetched data with the local database."""
    if df.empty:
        print(f"[{datetime.now().isoformat()}] No records to sync.")
        return

    # Convert LastPunchDate to datetime
    df['LastPunchDate'] = pd.to_datetime(df['LastPunchDate'], errors='coerce')

    # Prepare data for insertion or update
    records = []
    for _, row in df.iterrows():
        records.append({
            "cvno":    str(row['StudentCvueNo']),
            "name":    row['StudentName'],
            "status":  row['Status'],
            "gender":  row['Gender'],
            "batch":   row['Batch'],
            "inout":   clean_value(row['INOUT']),
            "devname": clean_value(row['DeviceName']),
            "lpdate":  clean_value(row['LastPunchDate']),
            "did":     clean_value(row['DeviceId']),
            "nod":     clean_value(row['NoOfDays']),
        })

    # Insert or update records in the local database
    insert_sql = text("""
    INSERT INTO studentdata (
      `Student Cvue No.`, `Student Name`, `Status`, `Gender`, `Batch`,
      `IN-OUT`, `Device Name`, `Last Punch Date`, DeviceId, `No.of Days`
    ) VALUES (
      :cvno, :name, :status, :gender, :batch,
      :inout, :devname, :lpdate, :did, :nod
    )
    ON DUPLICATE KEY UPDATE
      `Student Name`       = VALUES(`Student Name`),
      `Status`             = VALUES(`Status`),
      `Gender`             = VALUES(`Gender`),
      `Batch`              = VALUES(`Batch`),
      `IN-OUT`             = VALUES(`IN-OUT`),
      `Device Name`        = VALUES(`Device Name`),
      `Last Punch Date`    = VALUES(`Last Punch Date`),
      DeviceId             = VALUES(DeviceId),
      `No.of Days`         = VALUES(`No.of Days`)
    """)

    with mysql_engine.begin() as conn:
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            conn.execute(insert_sql, batch)

    print(f"[{datetime.now().isoformat()}] Synced {len(records)} records with the local database.")

    # Clear Redis caches
    patterns = [
        'totalStudentCount',
        'genderBatchCount',
        'inOutCount',
        'inOutBatchCount',
        'housingDetails:page:*',
        'trackingInfo:page:*',
        'allStudents:page:*',
    ]
    for p in patterns:
        if '*' in p:
            keys = redis_client.keys(p)
            if keys:
                redis_client.delete(*keys)
        else:
            redis_client.delete(p)
    print(f"[{datetime.now().isoformat()}] Cleared related Redis caches.")

def sync_job():
    """Main sync job to fetch data from ESSL and sync with the local database."""
    lock = 'esslFetchLock'
    if not redis_client.set(lock, '1', nx=True, ex=10):
        print(f"[{datetime.now().isoformat()}] Previous sync still running; skipping.")
        return

    try:
        essl_data = fetch_essl_students()
        sync_with_local_database(essl_data)
    except Exception as e:
        print(f"Error in sync_job: {e}")
    finally:
        redis_client.delete(lock)

# Schedule every 10 seconds
schedule.every(10).seconds.do(sync_job)

print("Starting student data sync server...")
while running:
    schedule.run_pending()
    time.sleep(1)

# Cleanup on shutdown
mssql_engine.dispose()
mysql_engine.dispose()
print(f"[{datetime.now().isoformat()}] Shutdown complete.")