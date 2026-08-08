import { writeFileSync } from 'fs';

const res = await fetch('https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/');
const html = await res.text();
const m = html.match(/assets\/index-[^"'\\s>]+\.js/);
writeFileSync(
  'tmp/post-go-live/28-2-live-frontend.json',
  JSON.stringify({ status: res.status, asset: m?.[0] || null, at: new Date().toISOString() }, null, 2),
);
console.log(res.status, m?.[0]);
