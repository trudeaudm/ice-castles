/**
 * One tiny data layer, two engines.
 *
 *   - No DATABASE_URL  -> SQLite file on disk. Zero setup, great for local dev.
 *   - DATABASE_URL set -> Postgres. This is what Render uses.
 *
 * Every query in this codebase is written with `?` placeholders and plain
 * TEXT / INTEGER / REAL columns, so the same SQL runs on both engines.
 */

const path = require('path');
const fs = require('fs');

const usingPostgres = Boolean(process.env.DATABASE_URL);

let sqlite = null;
let pgPool = null;

if (usingPostgres) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false },
    max: 5,
  });
} else {
  const Database = require('better-sqlite3');
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  fs.mkdirSync(dir, { recursive: true });
  sqlite = new Database(path.join(dir, 'park.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
}

/** Rewrite `?` placeholders into Postgres `$1, $2, ...` form. */
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function all(sql, params = []) {
  if (usingPostgres) {
    const res = await pgPool.query(toPg(sql), params);
    return res.rows;
  }
  return sqlite.prepare(sql).all(params);
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  if (usingPostgres) {
    const res = await pgPool.query(toPg(sql), params);
    return { changes: res.rowCount };
  }
  const info = sqlite.prepare(sql).run(params);
  return { changes: info.changes };
}

/** Execute a multi-statement script (migrations only). */
async function exec(sql) {
  if (usingPostgres) {
    await pgPool.query(sql);
    return;
  }
  sqlite.exec(sql);
}

module.exports = { all, get, run, exec, usingPostgres };
