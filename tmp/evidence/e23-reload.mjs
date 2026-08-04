#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const ids = [
  'c23EvidenceRuntime01',
  '8EXk5RkFW5cxnenL',
  'c23EvidenceList0001',
  'c23EvidenceDetail001',
  'c23EvidenceCreate001',
  'c23EvidenceUpdate001',
  'c23EvidenceValidate01',
  'c23EvidencePublish01',
  'c23EvidenceRollback1',
  'c23EvidenceCompare01',
  'qAyYc9DrHIqe4L9i',
  '2UPHcxASp2PboC9M',
];
for (const id of ids) {
  await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id=$1`, [id]);
}
console.log('toggled', ids.length);
await c.end();
