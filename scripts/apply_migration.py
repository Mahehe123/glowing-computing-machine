"""One-off: apply 03_migrate.sql + 02_products_seed.sql to the live Supabase DB.
Connects directly to Postgres with the DB password (admin use). Not committed-secret:
password is passed via env DB_PASSWORD so it never lands in the repo.
"""
import os
import sys
import psycopg2

REF = "rfeycajbnikmzlsnccif"
HOSTS = [
    f"db.{REF}.supabase.co",                       # direct
    "aws-0-ap-southeast-1.pooler.supabase.com",    # session pooler (SG)
]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["supabase/03_migrate.sql", "supabase/02_products_seed.sql"]

pw = os.environ["DB_PASSWORD"]


def connect():
    last = None
    for host in HOSTS:
        user = "postgres" if host.startswith("db.") else f"postgres.{REF}"
        for port in (5432, 6543):
            try:
                print(f"connecting {host}:{port} as {user} …")
                return psycopg2.connect(host=host, port=port, user=user,
                                        password=pw, dbname="postgres",
                                        connect_timeout=10, sslmode="require")
            except Exception as e:  # noqa
                last = e
                print(f"  failed: {str(e).strip()[:120]}")
    raise SystemExit(f"Could not connect. Last error: {last}")


conn = connect()
conn.autocommit = True
cur = conn.cursor()
for f in FILES:
    with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
        sql = fh.read()
    print(f"running {f} …")
    cur.execute(sql)
print("--- verify ---")
cur.execute("select model, category, price_rm, lead_time_weeks from public.products order by category, model;")
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
print("DONE")
