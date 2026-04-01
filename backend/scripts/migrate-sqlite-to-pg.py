"""
一次性腳本：將 SQLite (dev.db) 全部資料搬移到本機 PostgreSQL (ai_scoring)
執行方式：python backend/scripts/migrate-sqlite-to-pg.py
"""
import sqlite3
import psycopg2
import psycopg2.extras
import os
import sys
from datetime import datetime, timezone

SQLITE_PATH = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'dev.db')
PG_DSN = "host=localhost port=5432 dbname=ai_scoring user=postgres password=ru/w/777"

# 搬移順序（尊重 FK 依賴）
TABLES = [
    'Division',
    'Department',
    'Section',
    'DeptPerson',
    'OrgChief',
    'User',
    'SystemConfig',
    'ExcelImportLog',
    'Scene',
    'SceneExecutionLog',
    'SceneBenefit',
]

def get_pg_timestamp_cols(pg_cur, table):
    """取得 PostgreSQL 某資料表的所有 timestamp 欄位名稱"""
    pg_cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
    """, (table,))
    return {row[0] for row in pg_cur.fetchall()}

def get_pg_bool_cols(pg_cur, table):
    """取得 PostgreSQL 某資料表的所有 boolean 欄位名稱"""
    pg_cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND data_type = 'boolean'
    """, (table,))
    return {row[0] for row in pg_cur.fetchall()}

def convert_value(val, is_timestamp, is_bool):
    """將 SQLite 值轉換成 PostgreSQL 相容格式"""
    if val is None:
        return val
    if is_bool:
        return bool(val)
    if is_timestamp:
        if isinstance(val, (int, float)):
            if val > 1e11:
                val = val / 1000.0  # ms → s
            return datetime.fromtimestamp(val, tz=timezone.utc)
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val.replace('Z', '+00:00'))
            except ValueError:
                return val
    return val

def migrate():
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_cur = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(PG_DSN)
    pg_conn.autocommit = False
    pg_cur = pg_conn.cursor()

    total_inserted = 0

    try:
        for table in TABLES:
            # 取得 SQLite 資料
            sqlite_cur.execute(f'SELECT * FROM "{table}"')
            rows = sqlite_cur.fetchall()
            if not rows:
                print(f'  {table}: 無資料，跳過')
                continue

            cols = [d[0] for d in sqlite_cur.description]
            ts_cols = get_pg_timestamp_cols(pg_cur, table)
            bool_cols = get_pg_bool_cols(pg_cur, table)
            col_names = ', '.join(f'"{c}"' for c in cols)

            # 轉換各欄位值
            converted = []
            for row in rows:
                new_row = tuple(
                    convert_value(v, cols[i] in ts_cols, cols[i] in bool_cols)
                    for i, v in enumerate(row)
                )
                converted.append(new_row)

            pg_cur.execute(f'DELETE FROM "{table}"')  # 清空目標（允許重跑）
            psycopg2.extras.execute_values(
                pg_cur,
                f'INSERT INTO "{table}" ({col_names}) VALUES %s',
                converted,
                page_size=200
            )
            print(f'  {table}: 搬移 {len(converted)} 筆')
            total_inserted += len(converted)

        # 重設所有資料表的 id 序列
        for table in TABLES:
            pg_cur.execute(f"""
                SELECT setval(
                    pg_get_serial_sequence('"{table}"', 'id'),
                    COALESCE(MAX(id), 1)
                ) FROM "{table}"
            """)

        pg_conn.commit()
        print(f'\n完成！共搬移 {total_inserted} 筆資料。')

    except Exception as e:
        pg_conn.rollback()
        print(f'\n錯誤：{e}')
        import traceback; traceback.print_exc()
        sys.exit(1)
    finally:
        sqlite_cur.close()
        sqlite_conn.close()
        pg_cur.close()
        pg_conn.close()

if __name__ == '__main__':
    print(f'SQLite 來源：{os.path.abspath(SQLITE_PATH)}')
    print(f'目標：PostgreSQL ai_scoring @ localhost:5432\n')
    migrate()
