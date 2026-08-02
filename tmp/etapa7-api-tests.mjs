import fs from 'fs'

const BASE = 'https://n8n.oftalmocentrouberaba.cloud'
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const results = []
const uuid = () => crypto.randomUUID()

async function api(method, path, { headers = {}, body, formData } = {}) {
  const h = { ...headers }
  const init = { method, headers: h }
  if (formData) init.body = formData
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(BASE + path, init)
  const ct = res.headers.get('content-type') || ''
  let json = null
  let text = ''
  const buf = Buffer.from(await res.arrayBuffer())
  if (ct.includes('application/json') || buf[0] === 0x7b) {
    text = buf.toString('utf8')
    try {
      json = JSON.parse(text)
    } catch {
      /* ignore */
    }
  } else {
    text = `<binary ${buf.length} bytes>`
  }
  return {
    status: res.status,
    headers: {
      requestId: res.headers.get('x-request-id'),
      duration: res.headers.get('x-response-time-ms'),
      contentType: ct,
    },
    json,
    text,
    buf,
  }
}

function assertTracking(r, expectedId = null) {
  const issues = []
  const metaId = r.json?.meta?.requestId
  const hdrId = r.headers.requestId
  const dur = r.json?.meta?.durationMs
  if (!metaId) issues.push('meta.requestId ausente')
  if (expectedId && metaId !== expectedId) {
    issues.push(`meta.requestId=${metaId} != ${expectedId}`)
  }
  if (hdrId && metaId && hdrId !== metaId) {
    issues.push(`header/body mismatch ${hdrId} vs ${metaId}`)
  }
  if (typeof dur !== 'number' || dur < 0) {
    issues.push(`durationMs invalido: ${dur}`)
  }
  if (/password_hash|jwtSecret|stack|BEGIN RSA|node_modules|TypeError:/.test(r.text)) {
    issues.push('dado sensivel')
  }
  return {
    ok: issues.length === 0,
    detail: issues.length ? issues.join('; ') : `id=${metaId} dur=${dur} hdr=${hdrId}`,
    id: metaId,
    dur,
  }
}

async function test(name, fn) {
  try {
    const r = await fn()
    results.push({ name, ...r })
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${name}: ${r.detail}`)
  } catch (e) {
    results.push({ name, ok: false, detail: e.message })
    console.log(`[FAIL] ${name}: ${e.message}`)
  }
}

let token = null

await test('1.valid-request-id', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: { email: 'x@y.com', password: 'bad' },
  })
  return assertTracking(r, id)
})

await test('2.no-request-id', async () => {
  const r = await api('POST', '/webhook/auth/login', {
    body: { email: 'x@y.com', password: 'bad' },
  })
  const a = assertTracking(r)
  if (!UUID_RE.test(a.id || '')) {
    return { ok: false, detail: 'generated id not uuid: ' + a.id }
  }
  return a
})

await test('3.invalid-request-id', async () => {
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': 'not-a-uuid' },
    body: { email: 'x@y.com', password: 'bad' },
  })
  const a = assertTracking(r)
  if (a.id === 'not-a-uuid') return { ok: false, detail: 'invalid id preserved' }
  if (!UUID_RE.test(a.id || '')) {
    return { ok: false, detail: 'regenerated not uuid: ' + a.id }
  }
  return { ok: a.ok, detail: 'regenerated=' + a.id + '; ' + a.detail }
})

await test('4.login-valid', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: {
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    },
  })
  const a = assertTracking(r, id)
  token = r.json?.data?.token || r.json?.data?.accessToken
  return {
    ok: a.ok && r.status === 200 && !!token,
    detail: `status=${r.status}; ${a.detail}`,
  }
})

await test('5.login-invalid', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: {
      email: 'compras@oftalmocentrouberaba.com.br',
      password: 'wrong',
    },
  })
  const a = assertTracking(r, id)
  return {
    ok: a.ok && (r.status === 401 || r.json?.success === false),
    detail: `status=${r.status}; ${a.detail}`,
  }
})

const auth = () => ({ Authorization: 'Bearer ' + token })

await test('6.protected-success', async () => {
  const id = uuid()
  const r = await api('GET', '/webhook/documents', {
    headers: { ...auth(), 'X-Request-Id': id },
  })
  const a = assertTracking(r, id)
  return {
    ok: a.ok && r.status === 200 && r.json?.success,
    detail: `status=${r.status}; ${a.detail}`,
  }
})

await test('7.401', async () => {
  const id = uuid()
  const r = await api('GET', '/webhook/documents', {
    headers: {
      'X-Request-Id': id,
      Authorization: 'Bearer invalid.token.value',
    },
  })
  const a = assertTracking(r, id)
  return { ok: a.ok && r.status === 401, detail: `status=${r.status}; ${a.detail}` }
})

await test('8.403', async () => {
  const id = uuid()
  const r = await api('GET', '/webhook/users', {
    headers: { ...auth(), 'X-Request-Id': id },
  })
  const a = assertTracking(r, id)
  return { ok: a.ok && r.status === 403, detail: `status=${r.status}; ${a.detail}` }
})

await test('9.404', async () => {
  const id = uuid()
  const missing = uuid()
  const r = await api(
    'GET',
    `/webhook/documents/download?documentId=${encodeURIComponent(missing)}`,
    { headers: { ...auth(), 'X-Request-Id': id } }
  )
  const a = assertTracking(r, id)
  return {
    ok: a.ok && (r.status === 404 || r.json?.success === false),
    detail: `status=${r.status}; ${a.detail}`,
  }
})

await test('10.409-or-validation', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/documents/create', {
    headers: { ...auth(), 'X-Request-Id': id },
    body: { title: '' },
  })
  const a = assertTracking(r, id)
  return {
    ok: a.ok && r.status >= 400,
    detail: `status=${r.status} code=${r.json?.error?.code}; ${a.detail}`,
  }
})

await test('11.error-sanitized', async () => {
  const id = uuid()
  const r = await api('GET', '/webhook/documents', {
    headers: { 'X-Request-Id': id },
  })
  const a = assertTracking(r, id)
  return {
    ok: a.ok && !/at Object\.|node_modules|TypeError:/.test(r.text),
    detail: `status=${r.status}; ${a.detail}`,
  }
})

await test('12.upload-soft', async () => {
  const id = uuid()
  const fd = new FormData()
  fd.append('file', new Blob(['etapa7-test'], { type: 'text/plain' }), 'etapa7.txt')
  fd.append('title', 'Etapa7 Tracking Test')
  const r = await api('POST', '/webhook/documents/upload', {
    headers: { ...auth(), 'X-Request-Id': id },
    formData: fd,
  })
  if (r.json) {
    const a = assertTracking(r, id)
    return { ok: a.ok, detail: `status=${r.status}; ${a.detail}` }
  }
  return { ok: false, detail: `status=${r.status} non-json` }
})

await test('13.processar-soft', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/documents/process', {
    headers: { ...auth(), 'X-Request-Id': id },
    body: { documentId: uuid() },
  })
  if (r.json) {
    const a = assertTracking(r, id)
    return { ok: a.ok, detail: `status=${r.status}; ${a.detail}` }
  }
  return { ok: false, detail: `status=${r.status} non-json` }
})

await test('14.consulta-ia', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/consulta-ia', {
    headers: { ...auth(), 'X-Request-Id': id },
    body: { question: 'teste rastreamento etapa7', limit: 1 },
  })
  const a = assertTracking(r, id)
  return {
    ok: a.ok && [200, 400, 403, 422].includes(r.status),
    detail: `status=${r.status}; ${a.detail}`,
  }
})

await test('15.download-valid-soft', async () => {
  const id = uuid()
  const list = await api('GET', '/webhook/documents', {
    headers: { ...auth(), 'X-Request-Id': uuid() },
  })
  const docs = Array.isArray(list.json?.data)
    ? list.json.data
    : list.json?.data?.items || []
  const doc = docs.find((d) => d.id || d.documentId)
  if (!doc) return { ok: true, detail: 'SKIP no documents available' }
  const docId = doc.id || doc.documentId
  const r = await api(
    'GET',
    `/webhook/documents/download?documentId=${encodeURIComponent(docId)}`,
    { headers: { ...auth(), 'X-Request-Id': id } }
  )
  const hdrId = r.headers.requestId
  const hdrDur = r.headers.duration
  const ok =
    r.status === 200 &&
    hdrId === id &&
    hdrDur != null &&
    Number(hdrDur) >= 0 &&
    !String(r.headers.contentType).includes('json')
  return {
    ok,
    detail: `status=${r.status} hdrId=${hdrId} dur=${hdrDur} ct=${r.headers.contentType}`,
  }
})

await test('16.download-missing', async () => {
  const id = uuid()
  const r = await api(
    'GET',
    `/webhook/documents/download?documentId=${encodeURIComponent(uuid())}`,
    { headers: { ...auth(), 'X-Request-Id': id } }
  )
  const a = assertTracking(r, id)
  return { ok: a.ok && r.status === 404, detail: `status=${r.status}; ${a.detail}` }
})

await test('17.logout', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/logout', {
    headers: { ...auth(), 'X-Request-Id': id },
    body: {},
  })
  const a = assertTracking(r, id)
  return { ok: a.ok && r.status === 200, detail: `status=${r.status}; ${a.detail}` }
})

{
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': uuid() },
    body: {
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    },
  })
  token = r.json?.data?.token || r.json?.data?.accessToken
}

await test('18.validate', async () => {
  const id = uuid()
  let r = await api('GET', '/webhook/auth/validate', {
    headers: { ...auth(), 'X-Request-Id': id },
  })
  if (r.status === 404) {
    r = await api('POST', '/webhook/auth/validate', {
      headers: { ...auth(), 'X-Request-Id': id },
      body: {},
    })
  }
  const a = assertTracking(r, id)
  return {
    ok: a.ok && r.status === 200 && r.json?.success,
    detail: `status=${r.status}; ${a.detail}`,
  }
})

await test('19.subworkflow-preserves-id', async () => {
  const id = uuid()
  const r = await api('GET', '/webhook/sectors', {
    headers: { ...auth(), 'X-Request-Id': id },
  })
  const a = assertTracking(r, id)
  return { ok: a.ok && a.id === id, detail: a.detail }
})

await test('20.durationMs-nonneg', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: { email: 'x@y.com', password: 'bad' },
  })
  const dur = r.json?.meta?.durationMs
  return { ok: typeof dur === 'number' && dur >= 0, detail: 'durationMs=' + dur }
})

await test('21.header-body-same', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: { email: 'x@y.com', password: 'bad' },
  })
  return {
    ok: r.json?.meta?.requestId === id && r.headers.requestId === id,
    detail: `meta=${r.json?.meta?.requestId} hdr=${r.headers.requestId}`,
  }
})

await test('22.no-sensitive', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: {
      email: 'compras@oftalmocentrouberaba.com.br',
      password: 'wrong',
    },
  })
  const bad = /password_hash|\$2[aby]\$|jwtSecret|stack|Bearer ey/.test(r.text)
  return {
    ok: !bad && assertTracking(r, id).ok,
    detail: bad ? 'sensitive found' : 'clean',
  }
})

const pass = results.filter((r) => r.ok).length
const fail = results.filter((r) => !r.ok).length
console.log(`\nSUMMARY pass=${pass} fail=${fail} total=${results.length}`)
fs.writeFileSync(
  'tmp/etapa7-api-tests.json',
  JSON.stringify({ pass, fail, results }, null, 2)
)
process.exit(fail ? 1 : 0)
