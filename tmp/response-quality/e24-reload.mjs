#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const ids = [
  'c24ResponseQuality01',
  '8EXk5RkFW5cxnenL',
  'qAyYc9DrHIqe4L9i',
  '2UPHcxASp2PboC9M',
  'c24QualityList0001',
  'c24QualityDetail001',
  'c24QualityCompare01',
  'c24QualityCreate001',
  'c24QualityUpdate001',
  'c24QualityValidate01',
  'c24QualityPublish01',
  'c24QualityRollback1',
];
for (const id of ids) {
  await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id=$1`, [id]);
}
console.log('toggled', ids.length);
await c.end();
