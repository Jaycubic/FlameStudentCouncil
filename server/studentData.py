#!/usr/bin/env python3
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

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

DELETION_THRESHOLD = 100  # Threshold to prevent massive deletions

def fetch_existing_students():
    qry = "SELECT `Student Cvue No.` FROM studentdata"
    df = pd.read_sql_query(qry, mysql_engine)
    s = set(df['Student Cvue No.'].astype(str))
    print(f"[{datetime.now().isoformat()}] Found {len(s)} existing students locally.")
    return s

def fetch_essl_students():
    qry = """
    SELECT
      [Student Cvue No.]    AS StudentCvueNo,
      [Student Name]        AS StudentName,
      [Status]              AS Status,
      [Gender]              AS Gender,
      [Batch]               AS Batch,
      [Email ID]            AS EmailID,
      [IN-OUT]              AS INOUT,
      [Device Name]         AS DeviceName,
      [Last Punch Date]     AS LastPunchDate,
      DeviceId              AS DeviceId,
      [No.of Days]          AS NoOfDays
    FROM [NewView for Student Tracking for INOUT]
    """
    df = pd.read_sql_query(qry, mssql_engine)
    print(f"[{datetime.now().isoformat()}] Fetched {len(df)} student records from ESSL.")
    return df

def clean_value(val):
    if pd.isna(val):
        return None
    if isinstance(val, pd.Timestamp):
        return val.to_pydatetime()
    return val

def sync_with_local_database(df):
    # Upsert into studentdata
    df['LastPunchDate'] = pd.to_datetime(df['LastPunchDate'], errors='coerce')
    records = []
    for _, row in df.iterrows():
        records.append({
            "cvno":    str(row['StudentCvueNo']),
            "name":    row['StudentName'],
            "status":  row['Status'],
            "gender":  row['Gender'],
            "batch":   row['Batch'],
            "email":   row['EmailID'],
            "inout":   clean_value(row['INOUT']),
            "devname": clean_value(row['DeviceName']),
            "lpdate":  clean_value(row['LastPunchDate']),
            "did":     clean_value(row['DeviceId']),
            "nod":     clean_value(row['NoOfDays']),
        })

    sql = text("""
    INSERT INTO studentdata (
      `Student Cvue No.`,
      `Student Name`,
      `Status`,
      `Gender`,
      `Batch`,
      `Email ID`,
      `IN-OUT`,
      `Device Name`,
      `Last Punch Date`,
      DeviceId,
      `No.of Days`
    ) VALUES (
      :cvno, :name, :status, :gender, :batch, :email,
      :inout, :devname, :lpdate, :did, :nod
    )
    ON DUPLICATE KEY UPDATE
      `Student Name`    = VALUES(`Student Name`),
      `Status`          = VALUES(`Status`),
      `Gender`          = VALUES(`Gender`),
      `Batch`           = CASE
                            WHEN `Batch` IS NULL OR `Batch` = ''
                            THEN VALUES(`Batch`)
                            ELSE `Batch`
                          END,
      `Email ID`        = CASE
                            WHEN `Email ID` IS NULL OR `Email ID` = ''
                            THEN VALUES(`Email ID`)
                            ELSE `Email ID`
                          END,
      `IN-OUT`          = VALUES(`IN-OUT`),
      `Device Name`     = VALUES(`Device Name`),
      `Last Punch Date` = VALUES(`Last Punch Date`),
      DeviceId          = VALUES(DeviceId),
      `No.of Days`      = VALUES(`No.of Days`)
    """)

    try:
        with mysql_engine.begin() as conn:
            for chunk in [records[i:i+1000] for i in range(0, len(records), 1000)]:
                conn.execute(sql, chunk)
        print(f"[{datetime.now().isoformat()}] Synced {len(records)} records with the local database.")
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Error during upsert: {e}")
        return  # Do not clear caches if upsert fails

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
    lock = 'esslFetchLock'
    if not redis_client.set(lock, '1', nx=True, ex=10):
        print(f"[{datetime.now().isoformat()}] Previous sync still running; skipping.")
        return

    try:
        # 1) Fetch sets
        local_set = fetch_existing_students()
        essl_df   = fetch_essl_students()
        essl_set  = set(essl_df['StudentCvueNo'].astype(str))

        # 2) Detect orphans: in local but not in ESSL
        missing = sorted(local_set - essl_set)
        if len(missing) > DELETION_THRESHOLD:
            print(f"[{datetime.now().isoformat()}] Warning: Too many local-only CVUEs ({len(missing)} > {DELETION_THRESHOLD}), skipping deletion.")
        else:
            if missing:
                print(f"[{datetime.now().isoformat()}] Found {len(missing)} local-only CVUE(s):")
                print("  " + ", ".join(missing))
                try:
                    cvues_str = ",".join([f"'{cvue}'" for cvue in missing])
                    delete_sql = text(f"DELETE FROM studentdata WHERE `Student Cvue No.` IN ({cvues_str})")
                    with mysql_engine.begin() as conn:
                        conn.execute(delete_sql)
                    print(f"[{datetime.now().isoformat()}] Deleted {len(missing)} local-only CVUE(s).")
                except Exception as e:
                    print(f"[{datetime.now().isoformat()}] Error during deletion: {e}")

        # 3) Sync/upsert
        sync_with_local_database(essl_df)

        # 4) Verify record counts
        try:
            local_count = pd.read_sql_query("SELECT COUNT(*) FROM studentdata", mysql_engine).iloc[0,0]
            essl_count = len(essl_df)
            if local_count != essl_count:
                print(f"[{datetime.now().isoformat()}] Warning: Record counts do not match. Local: {local_count}, ESSL: {essl_count}")
            else:
                print(f"[{datetime.now().isoformat()}] Record counts match: {local_count}")
        except Exception as e:
            print(f"[{datetime.now().isoformat()}] Error during record count verification: {e}")

    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Error in sync_job: {e}")
    finally:
        redis_client.delete(lock)

# Schedule every 10 seconds
schedule.every(10).seconds.do(sync_job)

print("Starting student data sync server...")
while running:
    schedule.run_pending()
    time.sleep(1)

mssql_engine.dispose()
mysql_engine.dispose()
print(f"[{datetime.now().isoformat()}] Shutdown complete.")
