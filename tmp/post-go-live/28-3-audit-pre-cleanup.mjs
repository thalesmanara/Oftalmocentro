import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const summary = (
  await c.query(`
  SELECT COUNT(*)::int AS total,
         MIN(created_at) AS min_at,
         MAX(created_at) AS max_at
  FROM audit_logs`)
).rows[0];

const byAction = (
  await c.query(`
  SELECT action, COUNT(*)::int AS n
  FROM audit_logs GROUP BY action ORDER BY n DESC`)
).rows;

const byResource = (
  await c.query(`
  SELECT COALESCE(resource_type,'(null)') AS resource_type, COUNT(*)::int AS n
  FROM audit_logs GROUP BY resource_type ORDER BY n DESC`)
).rows;

const byDay = (
  await c.query(`
  SELECT created_at::date AS day, COUNT(*)::int AS n
  FROM audit_logs GROUP BY 1 ORDER BY 1`)
).rows;

const users = (
  await c.query(`
  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS distinct_users,
    COUNT(*) FILTER (WHERE user_id IS NULL)::int AS null_user_rows
  FROM audit_logs`)
).rows[0];

const clinicEmails = (
  await c.query(`
  SELECT LOWER(email) AS email, is_master, is_technical_admin, active
  FROM users ORDER BY email`)
).rows;

const out = {
  at: new Date().toISOString(),
  total: summary.total,
  min_at: summary.min_at,
  max_at: summary.max_at,
  byAction,
  byResource,
  byDay,
  users,
  clinicUserCount: clinicEmails.length,
  note: 'No PII/content bodies included. Emails listed only as active system accounts for cleanup decision.',
  clinicEmails: clinicEmails.map((u) => ({
    email: u.email,
    isMaster: u.is_master,
    isTechnicalAdmin: u.is_technical_admin,
    active: u.active,
  })),
};

writeFileSync('tmp/post-go-live/audit-pre-cleanup-summary.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ total: out.total, min_at: out.min_at, max_at: out.max_at, actions: byAction.length, days: byDay.length }, null, 2));
await c.end();
