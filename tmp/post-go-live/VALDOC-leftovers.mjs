import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const n = (
  await c.query(
    `SELECT COUNT(*)::int AS n FROM documents
     WHERE title LIKE 'VALDOC%'
        OR title LIKE 'VALDOC2%'
        OR title LIKE 'HOTFIX UUID%'
        OR title LIKE 'MANUAL AMIL TESTE%'`,
  )
).rows[0].n;
console.log('leftovers=' + n);
await c.end();
