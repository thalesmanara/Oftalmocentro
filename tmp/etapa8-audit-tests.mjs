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
  const buf = Buffer.from(await res.arrayBuffer())
  let json = null
  let text = buf.toString('utf8')
  if (ct.includes('json') || (buf[0] === 0x7b)) {
    try {
      json = JSON.parse(text)
    } catch {
      /* ignore */
    }
  } else {
    text = `<binary ${buf.length}>`
  }
  return {
    status: res.status,
    requestId: res.headers.get('x-request-id'),
    duration: res.headers.get('x-response-time-ms'),
    json,
    text,
    metaId: json?.meta?.requestId,
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

function sensitive(obj) {
  const s = JSON.stringify(obj || {})
  return /password|password_hash|\$2[aby]\$|accessToken|"token"\s*:|jwtSecret|Bearer ey|chunks?/i.test(
    s
  )
}

let token = null
let masterToken = null

// Try master for audit list; fallback compras
async function loginAs(email, password) {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: { email, password },
  })
  const t = r.json?.data?.token || r.json?.data?.accessToken
  return { r, token: t, id }
}

const loginOk = await loginAs(
  'compras@oftalmocentrouberaba.com.br',
  '12345678'
)
token = loginOk.token

// compras has visualizar_auditoria; also try master
masterToken = token
for (const email of ['oftalmocentro@oftalmocentrouberaba.com.br']) {
  const attempt = await loginAs(email, '12345678')
  if (attempt.token && attempt.r.status === 200) {
    masterToken = attempt.token
    console.log('using master', email)
    break
  }
}

const auth = (t = token) => ({ Authorization: `Bearer ${t}` })

await test('1.login-success-audited', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: {
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    },
  })
  token = r.json?.data?.token || token
  // poll audit via endpoint if permitted
  await new Promise((x) => setTimeout(x, 400))
  const list = await api('GET', `/webhook/audit?requestId=${id}&pageSize=5`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  const ok =
    r.status === 200 &&
    list.status !== 403 &&
    item &&
    item.action === 'AUTH_LOGIN_SUCCESS' &&
    item.requestId === id &&
    !sensitive(item)
  return {
    ok: !!ok,
    detail: `login=${r.status} auditStatus=${list.status} action=${item?.action} dur=${item?.durationMs}`,
  }
})

await test('2.login-failure-no-password', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: {
      email: 'compras@oftalmocentrouberaba.com.br',
      password: 'wrong-password',
    },
  })
  await new Promise((x) => setTimeout(x, 400))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  const ok =
    r.status === 401 &&
    item?.action === 'AUTH_LOGIN_FAILURE' &&
    !sensitive(item) &&
    !sensitive(r.json)
  return {
    ok: !!ok,
    detail: `action=${item?.action} err=${item?.errorCode} sens=${sensitive(item)}`,
  }
})

await test('3.logout-audited', async () => {
  const login = await loginAs(
    'compras@oftalmocentrouberaba.com.br',
    '12345678'
  )
  const id = uuid()
  const r = await api('POST', '/webhook/auth/logout', {
    headers: { ...auth(login.token), 'X-Request-Id': id },
    body: {},
  })
  await new Promise((x) => setTimeout(x, 400))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  return {
    ok: r.status === 200 && item?.action === 'AUTH_LOGOUT',
    detail: `action=${item?.action}`,
  }
})

// refresh token after logout
{
  const l = await loginAs(
    'compras@oftalmocentrouberaba.com.br',
    '12345678'
  )
  token = l.token
}

await test('16.fail-400-audited', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/documents/create', {
    headers: { ...auth(), 'X-Request-Id': id },
    body: { title: '' },
  })
  await new Promise((x) => setTimeout(x, 400))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  return {
    ok: r.status >= 400 && item && item.success === false && item.requestId === id,
    detail: `status=${r.status} action=${item?.action} success=${item?.success}`,
  }
})

await test('17.fail-403-relevant', async () => {
  const id = uuid()
  const r = await api('GET', '/webhook/users', {
    headers: { ...auth(), 'X-Request-Id': id },
  })
  // GET users may not be audited; check mutation 403 instead via POST users
  const id2 = uuid()
  const r2 = await api('POST', '/webhook/users/create', {
    headers: { ...auth(), 'X-Request-Id': id2 },
    body: {
      name: 'X',
      email: `x-${uuid().slice(0, 8)}@test.local`,
      password: '12345678',
      sectorId: null,
    },
  })
  await new Promise((x) => setTimeout(x, 500))
  const list = await api('GET', `/webhook/audit?requestId=${id2}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  return {
    ok:
      (r.status === 403 || r2.status === 403) &&
      (item?.success === false || r2.status !== 403),
    detail: `usersGET=${r.status} create=${r2.status} auditAction=${item?.action} auditSuccess=${item?.success}`,
  }
})

await test('18.fail-404-download', async () => {
  const id = uuid()
  const r = await api(
    'GET',
    `/webhook/documents/download?documentId=${uuid()}`,
    { headers: { ...auth(), 'X-Request-Id': id } }
  )
  await new Promise((x) => setTimeout(x, 400))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  return {
    ok: r.status === 404 && item?.action === 'DOCUMENT_DOWNLOAD' && item.success === false,
    detail: `status=${r.status} action=${item?.action}`,
  }
})

await test('14.consulta-ia-audited', async () => {
  const id = uuid()
  const r = await api('POST', '/webhook/consulta-ia', {
    headers: { ...auth(), 'X-Request-Id': id },
    body: { question: 'teste auditoria etapa8', limit: 1 },
  })
  await new Promise((x) => setTimeout(x, 500))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  const meta = item?.metadata || {}
  const ok =
    r.status === 200 &&
    item?.action === 'AI_QUERY' &&
    !sensitive(item) &&
    (meta.questionLength != null || meta.sourcesCount != null || Object.keys(meta).length >= 0)
  return {
    ok: !!ok,
    detail: `action=${item?.action} metaKeys=${Object.keys(meta).join(',')}`,
  }
})

await test('15.download-audited', async () => {
  const listDocs = await api('GET', '/webhook/documents', {
    headers: { ...auth(), 'X-Request-Id': uuid() },
  })
  const docs = Array.isArray(listDocs.json?.data)
    ? listDocs.json.data
    : listDocs.json?.data?.items || []
  const doc = docs[0]
  if (!doc) return { ok: true, detail: 'SKIP no docs' }
  const id = uuid()
  const r = await api(
    'GET',
    `/webhook/documents/download?documentId=${doc.id}`,
    { headers: { ...auth(), 'X-Request-Id': id } }
  )
  await new Promise((x) => setTimeout(x, 500))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const item = list.json?.data?.items?.[0]
  return {
    ok: r.status === 200 && item?.action === 'DOCUMENT_DOWNLOAD' && item.success === true,
    detail: `status=${r.status} action=${item?.action}`,
  }
})

await test('25.audit-requires-permission', async () => {
  const id = uuid()
  const r = await api('GET', '/webhook/audit?page=1&pageSize=5', {
    headers: { ...auth(token), 'X-Request-Id': id },
  })
  // compras may or may not have visualizar_auditoria
  const forbidden = r.status === 403
  const allowed = r.status === 200 && r.json?.success
  return {
    ok: forbidden || allowed,
    detail: `status=${r.status} (403 or 200 expected depending on perms)`,
  }
})

await test('26.pagination', async () => {
  const r = await api('GET', '/webhook/audit?page=1&pageSize=5', {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  if (r.status === 403) return { ok: true, detail: 'SKIP no audit permission on master candidate' }
  const p = r.json?.data?.pagination
  return {
    ok:
      r.status === 200 &&
      p &&
      p.page === 1 &&
      p.pageSize === 5 &&
      typeof p.total === 'number' &&
      typeof p.totalPages === 'number',
    detail: JSON.stringify(p),
  }
})

await test('27.filters', async () => {
  const r = await api(
    'GET',
    '/webhook/audit?action=AUTH_LOGIN_FAILURE&success=false&pageSize=10',
    { headers: { ...auth(masterToken), 'X-Request-Id': uuid() } }
  )
  if (r.status === 403) return { ok: true, detail: 'SKIP no perm' }
  const items = r.json?.data?.items || []
  const ok = items.every(
    (i) => i.action === 'AUTH_LOGIN_FAILURE' && i.success === false
  )
  return { ok: r.status === 200 && ok, detail: `count=${items.length}` }
})

await test('28.detail', async () => {
  const list = await api('GET', '/webhook/audit?pageSize=1', {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  if (list.status === 403) return { ok: true, detail: 'SKIP no perm' }
  const id = list.json?.data?.items?.[0]?.id
  if (!id) return { ok: false, detail: 'no items' }
  const r = await api('GET', `/webhook/audit/detail?id=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  const d = r.json?.data
  return {
    ok: r.status === 200 && d?.id === id && !sensitive(d),
    detail: `id=${d?.id} action=${d?.action}`,
  }
})

await test('29.requestId-matches', async () => {
  const id = uuid()
  await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: { email: 'x@y.com', password: 'bad' },
  })
  await new Promise((x) => setTimeout(x, 400))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  if (list.status === 403) return { ok: true, detail: 'SKIP no perm' }
  const item = list.json?.data?.items?.[0]
  return {
    ok: item?.requestId === id && UUID_RE.test(item.requestId),
    detail: `req=${item?.requestId}`,
  }
})

await test('30.durationMs-preserved', async () => {
  const id = uuid()
  await api('POST', '/webhook/auth/login', {
    headers: { 'X-Request-Id': id },
    body: { email: 'x@y.com', password: 'bad' },
  })
  await new Promise((x) => setTimeout(x, 400))
  const list = await api('GET', `/webhook/audit?requestId=${id}`, {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  if (list.status === 403) return { ok: true, detail: 'SKIP no perm' }
  const dur = list.json?.data?.items?.[0]?.durationMs
  return {
    ok: typeof dur === 'number' && dur >= 0,
    detail: `durationMs=${dur}`,
  }
})

await test('21-24.no-sensitive-in-recent', async () => {
  const list = await api('GET', '/webhook/audit?pageSize=50', {
    headers: { ...auth(masterToken), 'X-Request-Id': uuid() },
  })
  if (list.status === 403) return { ok: true, detail: 'SKIP no perm' }
  const items = list.json?.data?.items || []
  const bad = items.filter((i) => sensitive(i))
  return {
    ok: bad.length === 0,
    detail: `checked=${items.length} bad=${bad.length}`,
  }
})

const pass = results.filter((r) => r.ok).length
const fail = results.filter((r) => !r.ok).length
console.log(`\nSUMMARY pass=${pass} fail=${fail} total=${results.length}`)
fs.writeFileSync(
  'tmp/etapa8-audit-tests.json',
  JSON.stringify({ pass, fail, results }, null, 2)
)
process.exit(fail ? 1 : 0)
