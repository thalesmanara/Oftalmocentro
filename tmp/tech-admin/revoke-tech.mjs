import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const r = await c.query(
  `UPDATE users SET is_technical_admin=false, updated_at=NOW()
   WHERE email='compras@oftalmocentrouberaba.com.br'
   RETURNING email, is_technical_admin`,
);
console.log(r.rows);
await c.end();
