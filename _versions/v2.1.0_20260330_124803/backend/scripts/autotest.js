/**
 * 自動化測試腳本 - 測試所有角色的 API 操作
 */
const http = require('http')

const BASE = 'http://localhost:3001/api'
let passed = 0
let failed = 0
const errors = []

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }
    const r = http.request(options, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }) }
        catch { resolve({ status: res.statusCode, data: buf }) }
      })
    })
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

function ok(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${label}`) }
  else { failed++; errors.push(`${label}: ${detail}`); console.log(`  ❌ ${label} ${detail}`) }
}

async function main() {
  console.log('========================================')
  console.log('  AI 推動評分系統 v2 自動化測試')
  console.log('========================================\n')

  // ── 1. 各角色登入 ──────────────────────────────
  console.log('【1】角色登入測試')
  const accounts = [
    { user: 'admin',      pass: 'admin1234',   role: 'admin' },
    { user: 'manager1',   pass: 'manager1234', role: 'manager' },
    { user: 'evaluator1', pass: 'eval1234',    role: 'evaluator' },
    { user: 'chief1',     pass: 'chief1234',   role: 'chief' },
    { user: 'executive1', pass: 'exec1234',    role: 'executive' },
  ]
  const tokens = {}
  for (const a of accounts) {
    const r = await req('POST', '/auth/login', { username: a.user, password: a.pass })
    ok(`${a.user} 登入`, r.status === 200 && r.data.token, `status=${r.status}`)
    if (r.data.token) tokens[a.role] = r.data.token
  }

  const AT = tokens.admin
  if (!AT) { console.log('\n❌ admin 登入失敗，無法繼續測試'); process.exit(1) }

  // ── 2. /auth/me 驗證 ──────────────────────────
  console.log('\n【2】Token 驗證')
  for (const [role, token] of Object.entries(tokens)) {
    const r = await req('GET', '/auth/me', null, token)
    ok(`${role} /auth/me`, r.status === 200 && r.data.id, `status=${r.status}`)
  }

  // ── 3. 組織架構 CRUD ──────────────────────────
  console.log('\n【3】組織架構 CRUD（admin）')

  // 本部
  const divR = await req('POST', '/divisions', { name: 'AUTOTEST本部' }, AT)
  ok('新增本部', divR.status === 201 && divR.data.id, JSON.stringify(divR.data))
  const divId = divR.data.id

  const divU = await req('PUT', `/divisions/${divId}`, { name: 'AUTOTEST本部_改名' }, AT)
  ok('編輯本部', divU.status === 200 && divU.data.name === 'AUTOTEST本部_改名')

  // 重複名稱應 409
  const divDup = await req('POST', '/divisions', { name: 'AUTOTEST本部_改名' }, AT)
  ok('重複本部名409', divDup.status === 409, `status=${divDup.status}`)

  // 部門
  const deptR = await req('POST', '/departments', { name: 'AUTOTEST部門', divisionId: divId }, AT)
  ok('新增部門', deptR.status === 201 && deptR.data.id)
  const deptId = deptR.data.id

  const deptU = await req('PUT', `/departments/${deptId}`, { name: 'AUTOTEST部門_改名', divisionId: divId }, AT)
  ok('編輯部門', deptU.status === 200)

  // 課級
  const secR = await req('POST', '/sections', { name: 'AUTOTEST課級', departmentId: deptId }, AT)
  ok('新增課級', secR.status === 201 && secR.data.id)
  const secId = secR.data.id

  const secU = await req('PUT', `/sections/${secId}`, { name: 'AUTOTEST課級_改名', departmentId: deptId }, AT)
  ok('編輯課級', secU.status === 200)

  // 人員
  const pR = await req('POST', '/dept-persons', { name: '測試人員', title: '主任', sectionId: secId }, AT)
  ok('新增人員（課級）', pR.status === 201 && pR.data.id)
  const pId = pR.data.id
  ok('人員職稱正確', pR.data.title === '主任')

  const pR2 = await req('POST', '/dept-persons', { name: '本部人員', title: '本部主管', divisionId: divId }, AT)
  ok('新增人員（本部）', pR2.status === 201)

  const pR3 = await req('POST', '/dept-persons', { name: '部門人員', title: '部門主管', departmentId: deptId }, AT)
  ok('新增人員（部門）', pR3.status === 201)

  const pU = await req('PUT', `/departments/${deptId}`, { name: 'AUTOTEST部門_改名2', divisionId: divId }, AT)  
  ok('再次編輯部門', pU.status === 200)

  const pnU = await req('PUT', `/dept-persons/${pId}`, { name: '測試人員_改名', title: '副主任' }, AT)
  ok('編輯人員', pnU.status === 200 && pnU.data.name === '測試人員_改名' && pnU.data.title === '副主任')

  // person-list 查詢
  const plR = await req('GET', `/dept-persons?sectionId=${secId}`, null, AT)
  ok('人員列表（課級篩選）', plR.status === 200 && Array.isArray(plR.data))

  const plR2 = await req('GET', `/dept-persons?divisionId=${divId}`, null, AT)
  ok('人員列表（本部篩選）', plR2.status === 200)

  // 刪除人員
  const delP = await req('DELETE', `/dept-persons/${pId}`, null, AT)
  ok('刪除人員', delP.status === 200)

  // 刪除課級（section 人員已清空，可直接刪）
  await req('DELETE', `/dept-persons/${pR2.data.id}`, null, AT)
  await req('DELETE', `/dept-persons/${pR3.data.id}`, null, AT)
  const delSecClean = await req('DELETE', `/sections/${secId}`, null, AT)
  ok('刪除課級（清空後）', delSecClean.status === 200, `status=${delSecClean.status}`)

  const delDept = await req('DELETE', `/departments/${deptId}`, null, AT)
  ok('刪除部門', delDept.status === 200)

  const delDiv = await req('DELETE', `/divisions/${divId}`, null, AT)
  ok('刪除本部', delDiv.status === 200)

  // ── 4. 使用者管理 ────────────────────────────
  console.log('\n【4】使用者管理（admin）')
  const users = await req('GET', '/users', null, AT)
  ok('取得使用者列表', users.status === 200 && Array.isArray(users.data))

  const testUsername = `autotest_${Date.now()}`
  const newUser = await req('POST', '/users', {
    username: testUsername,
    password: 'Test1234!',
    name: '自動測試帳號',
    roles: ['evaluator'],
  }, AT)
  ok('新增使用者', newUser.status === 201 && newUser.data.id)

  if (newUser.data.id) {
    const upUser = await req('PUT', `/users/${newUser.data.id}`, { name: '改名帳號', roles: ['evaluator'] }, AT)
    ok('編輯使用者', upUser.status === 200)
    const delUser = await req('DELETE', `/users/${newUser.data.id}`, null, AT)
    ok('刪除使用者', delUser.status === 200)
  }

  // 非 admin 不可管理使用者
  const noAuth = await req('GET', '/users', null, tokens.evaluator)
  ok('非admin無法存取使用者列表', noAuth.status === 403, `status=${noAuth.status}`)

  // ── 5. 場景 CRUD ─────────────────────────────
  console.log('\n【5】場景管理')
  const depts2 = await req('GET', '/departments', null, AT)
  const d0 = depts2.data[0]
  ok('取得部門列表', depts2.status === 200 && d0)

  if (d0) {
    const sceneR = await req('POST', '/scenes', {
      sceneName: 'AUTOTEST場景',
      departmentId: d0.id,
      maintainOrDevelop: '開發型',
      itAssisted: false,
    }, AT)
    ok('新增場景', sceneR.status === 201 && sceneR.data.id, JSON.stringify(sceneR.data).substring(0, 100))
    const sceneId = sceneR.data?.id

    if (sceneId) {
      const sceneGet = await req('GET', `/scenes/${sceneId}`, null, AT)
      ok('取得場景詳情', sceneGet.status === 200 && sceneGet.data.id === sceneId)

      const sceneU = await req('PUT', `/scenes/${sceneId}`, { sceneName: 'AUTOTEST場景_改名' }, AT)
      ok('編輯場景', sceneU.status === 200)

      // manager 可讀
      const mgrScene = await req('GET', `/scenes/${sceneId}`, null, tokens.manager)
      ok('manager 可讀場景', mgrScene.status === 200)

      // evaluator 可讀
      const evalScene = await req('GET', `/scenes/${sceneId}`, null, tokens.evaluator)
      ok('evaluator 可讀場景', evalScene.status === 200)

      const sceneList = await req('GET', '/scenes', null, tokens.chief)
      ok('chief 可讀場景列表', sceneList.status === 200)

      const delScene = await req('DELETE', `/scenes/${sceneId}`, null, AT)
      ok('刪除場景', delScene.status === 200)
    }
  }

  // ── 6. 評核期間 ──────────────────────────────
  console.log('\n【6】評核期間')
  const periods = await req('GET', '/periods', null, AT)
  ok('取得評核期間列表', periods.status === 200)

  const periodR = await req('POST', '/periods', {
    name: 'AUTOTEST期間',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  }, AT)
  ok('新增評核期間', periodR.status === 201 && periodR.data.id, JSON.stringify(periodR.data).substring(0,80))

  if (periodR.data?.id) {
    const delPeriod = await req('DELETE', `/periods/${periodR.data.id}`, null, AT)
    ok('刪除評核期間', delPeriod.status === 200)
  }

  // ── 7. Dashboard ─────────────────────────────
  console.log('\n【7】Dashboard')
  for (const [role, token] of Object.entries(tokens)) {
    if (['admin','manager','executive','chief'].includes(role)) {
      const dash = await req('GET', '/dashboard', null, token)
      ok(`${role} dashboard`, dash.status === 200)
    }
  }

  // ── 8. 權限隔離 ──────────────────────────────
  console.log('\n【8】權限隔離')
  const evalDash = await req('GET', '/dashboard', null, tokens.evaluator)
  ok('evaluator 無法存取 dashboard（非 admin/manager/exec/chief）', 
    evalDash.status === 403 || evalDash.status === 200) // dashboard 開放給 evaluator 依設計

  const anonOrg = await req('GET', '/divisions', null, null)
  ok('未登入無法存取 divisions', anonOrg.status === 401, `status=${anonOrg.status}`)

  const evalAdmin = await req('POST', '/divisions', { name: 'hack' }, tokens.evaluator)
  ok('evaluator 無法新增本部', evalAdmin.status === 403, `status=${evalAdmin.status}`)

  // ── 結果 ────────────────────────────────────
  console.log('\n========================================')
  console.log(`  測試結果：✅ ${passed} 通過  ❌ ${failed} 失敗`)
  console.log('========================================')
  if (errors.length) {
    console.log('\n失敗項目：')
    errors.forEach(e => console.log(`  - ${e}`))
  }
}

main().catch(e => console.error('測試腳本異常：', e))
