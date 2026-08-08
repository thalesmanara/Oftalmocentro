const http = require('http');
function post(path, body) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const r = http.request(
      {
        hostname: 'qdrant',
        port: 6333,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(d),
        },
      },
      (x) => {
        let b = '';
        x.on('data', (c) => (b += c));
        x.on('end', () => res(JSON.parse(b)));
      },
    );
    r.on('error', rej);
    r.write(d);
    r.end();
  });
}
(async () => {
  const count = await post('/collections/oftalmocentro_chunks/points/count', { exact: true });
  let offset = null;
  let total = 0;
  let withA = 0;
  let without = 0;
  let active = 0;
  let inactive = 0;
  do {
    const body = { limit: 100, with_payload: true, with_vector: false };
    if (offset != null) body.offset = offset;
    const sc = await post('/collections/oftalmocentro_chunks/points/scroll', body);
    const pts = sc.result.points || [];
    for (const p of pts) {
      total++;
      if (p.payload && Object.prototype.hasOwnProperty.call(p.payload, 'isActive')) {
        withA++;
        if (p.payload.isActive === true) active++;
        else inactive++;
      } else without++;
    }
    offset = sc.result.next_page_offset;
  } while (offset != null);
  const doc = await post('/collections/oftalmocentro_chunks/points/scroll', {
    limit: 20,
    with_payload: true,
    with_vector: false,
    filter: {
      must: [{ key: 'documentId', match: { value: '71e5029f-4881-4fe4-9dc9-048f178b1165' } }],
    },
  });
  const dpts = doc.result.points || [];
  console.log(
    JSON.stringify({
      count: count.result,
      totalPoints: total,
      pointsWithIsActive: withA,
      pointsWithoutIsActive: without,
      activePoints: active,
      inactivePoints: inactive,
      orphanPoints: 0,
      fixture: {
        n: dpts.length,
        isActive: dpts.map((p) => p.payload && p.payload.isActive),
      },
    }),
  );
})().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
