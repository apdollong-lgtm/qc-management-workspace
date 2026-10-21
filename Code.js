/**
 * QC Management Workspace — Backend (Google Apps Script)
 * ไฟล์คู่กัน: Code.gs + Index.html
 *
 * วิธีติดตั้ง (สรุป)
 * 1) สร้าง Google Sheet ใหม่ > Extensions > Apps Script
 * 2) วางโค้ดนี้ใน Code.gs และสร้างไฟล์ HTML ชื่อ "Index" แล้ววางโค้ด Index.html
 * 3) เลือกฟังก์ชัน setup แล้วกด Run (อนุญาตสิทธิ์) — ถ้าต้องการข้อมูลตัวอย่าง ให้ Run seedDemoData
 * 4) Deploy > New deployment > Web app (Execute as: Me, Who has access: ตามต้องการ)
 * 5) (ทางเลือก) Run installTriggers เพื่อเปิดสรุปรายวัน 08:00 และเตือน CAPA 09:00
 */

const CONFIG = {
  SPREADSHEET_ID: '',               // เว้นว่าง = ใช้ Sheet ที่ผูกกับสคริปต์นี้
  APP_TITLE: 'QC Management Workspace',
  CLAUDE_MODEL: 'claude-sonnet-4-5', // ใช้เมื่อใส่ ANTHROPIC_API_KEY ในหน้า Automation
  CAPA_DUE_DAYS: 7
};

const SHEETS = {
  Inspections: ['ID', 'LotNo', 'InspectDate', 'Stage', 'Line', 'Product', 'Material', 'Supplier',
    'Inspector', 'SampleQty', 'DefectQty', 'DefectType', 'Result', 'Note', 'CreatedAt', 'CreatedBy', 'UpdatedAt'],
  CAPA: ['CapaNo', 'LotNo', 'Issue', 'RootCause', 'Action', 'Owner', 'DueDate', 'Status', 'CreatedAt', 'ClosedAt'],
  Master: ['Type', 'Value'],
  Log: ['Time', 'User', 'Action', 'Detail']
};

const DEFAULT_MASTER = {
  Line: ['ไลน์ผลิต A', 'ไลน์ผลิต B', 'ไลน์ผลิต C'],
  Product: ['ทูน่ากระป๋อง', 'ซาร์ดีนกระป๋อง', 'อาหารแมวกระป๋อง'],
  Material: ['เนื้อทูน่าแช่แข็ง', 'ฟิล์มบรรจุภัณฑ์', 'ฝาอะลูมิเนียมกระป๋อง', 'กระป๋องเปล่า', 'น้ำมันพืช'],
  Supplier: ['บจก. ซีฟู้ด ซัพพลาย', 'บจก. แพ็คพลัส', 'บจก. เมทัลแคน'],
  Inspector: ['กิตติพงศ์', 'สุภาพร', 'อนุชา'],
  DefectType: ['บรรจุภัณฑ์', 'น้ำหนัก', 'อุณหภูมิ', 'สิ่งแปลกปลอม', 'ฉลาก', 'ซีลรั่ว']
};

/* ---------------- Web app ---------------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CONFIG.APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('QC App')
      .addItem('ตั้งค่าครั้งแรก (Setup)', 'setup')
      .addItem('ใส่ข้อมูลตัวอย่าง', 'seedDemoData')
      .addItem('ติดตั้งงานอัตโนมัติ', 'installTriggers')
      .addToUi();
  } catch (e) { /* standalone script */ }
}

/* ---------------- Helpers ---------------- */

function tz_() { return Session.getScriptTimeZone() || 'Asia/Bangkok'; }
function props_() { return PropertiesService.getScriptProperties(); }
function ss_() {
  const id = props_().getProperty('SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID;
  const book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('กรุณา Run setup จาก Apps Script ที่ผูกกับ Google Sheet ก่อนใช้งาน');
  return book;
}
function sh_(name) {
  const ss = ss_();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    const h = SHEETS[name];
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#FBEDE5');
    s.setFrozenRows(1);
  }
  return s;
}
function fmtD_(d, p) { return Utilities.formatDate(d, tz_(), p || 'yyyy-MM-dd'); }
function parseDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('วันที่ต้องเป็น YYYY-MM-DD');
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) throw new Error('วันที่ไม่ถูกต้อง');
  return d;
}
function safeCell_(v) { return typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }
function validateInspection_(d) {
  parseDate_(d.InspectDate);
  if (['Incoming', 'In-process', 'Final'].indexOf(d.Stage) < 0) throw new Error('ขั้นตอนการตรวจไม่ถูกต้อง');
  if (['Pass', 'Hold', 'Reject'].indexOf(d.Result) < 0) throw new Error('ผลการตรวจไม่ถูกต้อง');
  const sample = Number(d.SampleQty), defect = Number(d.DefectQty);
  if (!Number.isSafeInteger(sample) || sample < 1 || !Number.isSafeInteger(defect) || defect < 0 || defect > sample) throw new Error('จำนวนตัวอย่างต้องเป็นจำนวนเต็มมากกว่า 0 และของเสียต้องไม่เกินตัวอย่าง');
}
function cell_(x) { return x instanceof Date ? fmtD_(x, 'yyyy-MM-dd HH:mm') : x; }
function user_() { return Session.getActiveUser().getEmail() || 'unknown'; }
function isOn_(k) { return props_().getProperty('AUTO_' + k) !== 'false'; }

function readTable_(name) {
  const s = sh_(name);
  const last = s.getLastRow();
  if (last < 2) return [];
  const h = SHEETS[name];
  const vals = s.getRange(2, 1, last - 1, h.length).getValues();
  const out = [];
  vals.forEach(function (r, i) {
    if (r.join('') === '') return;
    const o = { _row: i + 2 };
    h.forEach(function (k, j) { o[k] = cell_(r[j]); });
    out.push(o);
  });
  return out;
}
function toRow_(name, obj) {
  return SHEETS[name].map(function (k) { return (obj[k] === undefined || obj[k] === null) ? '' : safeCell_(obj[k]); });
}
function findRow_(name, key, val) {
  const s = sh_(name);
  const last = s.getLastRow();
  if (last < 2) return -1;
  const col = SHEETS[name].indexOf(key) + 1;
  const vals = s.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(val)) return i + 2;
  return -1;
}
function updateRow_(name, row, fields) {
  const s = sh_(name);
  const h = SHEETS[name];
  Object.keys(fields).forEach(function (k) {
    const c = h.indexOf(k);
    if (c >= 0) s.getRange(row, c + 1).setValue(safeCell_(fields[k]));
  });
}
function log_(action, detail) {
  try { sh_('Log').appendRow([new Date(), user_(), action, detail || '']); } catch (e) {}
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function prevMonth_(m) {
  const p = m.split('-').map(Number);
  return fmtD_(new Date(p[0], p[1] - 2, 1), 'yyyy-MM');
}

/* ---------------- Setup ---------------- */

function setup() {
  props_().setProperty('SPREADSHEET_ID', ss_().getId());
  Object.keys(SHEETS).forEach(sh_);
  const m = sh_('Master');
  if (m.getLastRow() < 2) {
    const rows = [];
    Object.keys(DEFAULT_MASTER).forEach(function (t) { DEFAULT_MASTER[t].forEach(function (v) { rows.push([t, v]); }); });
    m.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  const p = props_();
  ['AUTO_rejectAlert', 'AUTO_capaDue', 'AUTO_dailySummary'].forEach(function (k) {
    if (p.getProperty(k) === null) p.setProperty(k, 'true');
  });
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  return 'ตั้งค่าเสร็จแล้ว';
}

/* ---------------- Read ---------------- */

function getAppData(month) {
  month = month || fmtD_(new Date(), 'yyyy-MM');
  const prev = prevMonth_(month);
  const insp = readTable_('Inspections').filter(function (r) {
    const m = String(r.InspectDate).slice(0, 7);
    return m === month || m === prev;
  });
  const email = Session.getActiveUser().getEmail() || '';
  return {
    month: month,
    prevMonth: prev,
    inspections: insp,
    capa: readTable_('CAPA'),
    master: getMaster(),
    settings: getSettings(),
    user: { email: email, name: email ? email.split('@')[0] : 'QC User' },
    serverTime: fmtD_(new Date(), 'dd/MM/yyyy HH:mm')
  };
}

function listInspections(f) {
  f = f || {};
  const q = String(f.q || '').toLowerCase().trim();
  let rows = readTable_('Inspections').filter(function (r) {
    if (f.stage && r.Stage !== f.stage) return false;
    if (f.result && r.Result !== f.result) return false;
    if (!q) return true;
    return [r.LotNo, r.Product, r.Material, r.Supplier, r.Inspector, r.Line].join(' ').toLowerCase().indexOf(q) >= 0;
  });
  rows.sort(function (a, b) { return String(b.InspectDate + b.CreatedAt).localeCompare(String(a.InspectDate + a.CreatedAt)); });
  return rows.slice(0, f.limit || 300);
}

function getMaster() {
  const out = {};
  Object.keys(DEFAULT_MASTER).forEach(function (k) { out[k] = []; });
  readTable_('Master').forEach(function (r) {
    if (!out[r.Type]) out[r.Type] = [];
    if (r.Value !== '') out[r.Type].push(String(r.Value));
  });
  return out;
}

/* ---------------- Write: Inspections ---------------- */

function saveInspection(d) {
  return withLock_(function () {
    if (!d || !d.InspectDate || !d.Stage || !d.Result) throw new Error('กรอกวันที่ ขั้นตอนการตรวจ และผลการตรวจให้ครบ');
    validateInspection_(d);
    if (['Pass', 'Hold', 'Reject'].indexOf(d.Result) < 0) throw new Error('ผลการตรวจต้องเป็น Pass, Hold หรือ Reject');
    const now = new Date();
    const rec = Object.assign({}, d, {
      ID: Utilities.getUuid().slice(0, 8),
      LotNo: d.LotNo ? String(d.LotNo).trim() : nextLot_(d.InspectDate),
      InspectDate: parseDate_(d.InspectDate),
      SampleQty: Number(d.SampleQty) || 0,
      DefectQty: Number(d.DefectQty) || 0,
      CreatedAt: now, CreatedBy: user_(), UpdatedAt: now
    });
    sh_('Inspections').appendRow(toRow_('Inspections', rec));
    log_('ADD_INSPECTION', rec.LotNo + ' ' + rec.Result);

    let capaNo = '';
    if (rec.Result === 'Reject') {
      if (d.autoCapa) {
        capaNo = createCapa_({
          LotNo: rec.LotNo,
          Issue: 'Reject: ' + (rec.DefectType || '-') + ' (' + (rec.Material || rec.Product || '') + ')',
          Owner: rec.Inspector,
          DueDate: new Date(now.getTime() + CONFIG.CAPA_DUE_DAYS * 864e5)
        });
      }
      if (isOn_('rejectAlert')) {
        notify_('พบผลตรวจไม่ผ่าน ' + rec.LotNo,
          'ขั้นตอน: ' + rec.Stage + '\nไลน์: ' + (rec.Line || '-') + '\nสินค้า/วัตถุดิบ: ' + (rec.Product || '') + ' ' + (rec.Material || '') +
          '\nปัญหา: ' + (rec.DefectType || '-') + ' (' + rec.DefectQty + '/' + rec.SampleQty + ')\nผู้ตรวจ: ' + (rec.Inspector || '-') +
          (capaNo ? '\nเปิด CAPA: ' + capaNo : ''));
      }
    }
    return { ok: true, ID: rec.ID, LotNo: rec.LotNo, CapaNo: capaNo };
  });
}

function updateInspection(id, fields) {
  return withLock_(function () {
    const row = findRow_('Inspections', 'ID', id);
    if (row < 0) throw new Error('ไม่พบรายการตรวจนี้ อาจถูกลบไปแล้ว');
    const f = Object.assign({}, fields);
    delete f.ID; delete f.CreatedAt; delete f.CreatedBy;
    const existing = readTable_('Inspections').find(function (r) { return String(r.ID) === String(id); });
    validateInspection_(Object.assign({}, existing, f, { InspectDate: String(f.InspectDate || existing.InspectDate).slice(0, 10) }));
    if (f.InspectDate) f.InspectDate = parseDate_(f.InspectDate);
    f.UpdatedAt = new Date();
    updateRow_('Inspections', row, f);
    log_('UPDATE_INSPECTION', id + ' ' + JSON.stringify(fields));
    return { ok: true };
  });
}

function deleteInspection(id) {
  return withLock_(function () {
    const row = findRow_('Inspections', 'ID', id);
    if (row < 0) throw new Error('ไม่พบรายการตรวจนี้');
    sh_('Inspections').deleteRow(row);
    log_('DELETE_INSPECTION', id);
    return { ok: true };
  });
}

function nextLot_(dateStr) {
  const prefix = 'L' + fmtD_(parseDate_(dateStr), 'yyMM') + '-';
  const nums = readTable_('Inspections').map(function (r) { return String(r.LotNo); })
    .filter(function (l) { return l.indexOf(prefix) === 0; })
    .map(function (l) { return parseInt(l.slice(prefix.length), 10) || 0; });
  const n = nums.reduce(function (a, b) { return Math.max(a, b); }, 0) + 1;
  return prefix + String(n).padStart(4, '0');
}

/* ---------------- Write: CAPA ---------------- */

function saveCapa(d) {
  return withLock_(function () {
    if (!d) throw new Error('กรุณาระบุข้อมูล CAPA');
    if (d.Status && ['Open', 'In progress', 'Closed'].indexOf(d.Status) < 0) throw new Error('สถานะ CAPA ไม่ถูกต้อง');
    if (d.CapaNo) {
      const row = findRow_('CAPA', 'CapaNo', d.CapaNo);
      if (row > 0) {
        const f = Object.assign({}, d);
        delete f.CapaNo; delete f.CreatedAt;
        if (f.DueDate) f.DueDate = parseDate_(f.DueDate);
        if (f.Status === 'Closed') f.ClosedAt = new Date();
        else if (f.Status) f.ClosedAt = '';
        updateRow_('CAPA', row, f);
        log_('UPDATE_CAPA', d.CapaNo);
        return { ok: true, CapaNo: d.CapaNo };
      }
      throw new Error('ไม่พบ CAPA นี้ อาจถูกลบไปแล้ว');
    }
    if (!d.Issue) throw new Error('ระบุปัญหาที่พบก่อนบันทึก CAPA');
    return { ok: true, CapaNo: createCapa_(d) };
  });
}

function updateCapa(no, fields) { return saveCapa(Object.assign({}, fields, { CapaNo: no })); }

function createCapa_(d) {
  const prefix = 'CAPA-' + fmtD_(new Date(), 'yyMM') + '-';
  const nums = readTable_('CAPA').map(function (r) { return String(r.CapaNo); })
    .filter(function (c) { return c.indexOf(prefix) === 0; })
    .map(function (c) { return parseInt(c.slice(prefix.length), 10) || 0; });
  const n = nums.reduce(function (a, b) { return Math.max(a, b); }, 0) + 1;
  const no = prefix + String(n).padStart(3, '0');
  const status = d.Status || 'Open';
  const rec = Object.assign({}, d, {
    CapaNo: no,
    DueDate: d.DueDate ? parseDate_(d.DueDate) : new Date(Date.now() + CONFIG.CAPA_DUE_DAYS * 864e5),
    Status: status,
    CreatedAt: new Date(),
    ClosedAt: status === 'Closed' ? new Date() : ''
  });
  sh_('CAPA').appendRow(toRow_('CAPA', rec));
  log_('ADD_CAPA', no);
  return no;
}

/* ---------------- Master data ---------------- */

function saveMaster(obj) {
  return withLock_(function () {
    if (!obj || Object.keys(obj).some(function (t) { return !Object.prototype.hasOwnProperty.call(DEFAULT_MASTER, t) || !Array.isArray(obj[t]); })) throw new Error('ข้อมูลหลักไม่ถูกต้อง');
    const rows = [];
    Object.keys(obj).forEach(function (t) {
      obj[t].forEach(function (v) { v = String(v).trim(); if (v) rows.push([t, safeCell_(v)]); });
    });
    const s = sh_('Master');
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 2).clearContent();
    if (rows.length) s.getRange(2, 1, rows.length, 2).setValues(rows);
    log_('SAVE_MASTER', rows.length + ' rows');
    return { ok: true, master: getMaster() };
  });
}

/* ---------------- Settings & automation ---------------- */

function getSettings() {
  const p = props_().getProperties();
  let triggers = [];
  try { triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }); } catch (e) {}
  return {
    rejectAlert: p.AUTO_rejectAlert !== 'false',
    capaDue: p.AUTO_capaDue !== 'false',
    dailySummary: p.AUTO_dailySummary !== 'false',
    notifyEmail: p.NOTIFY_EMAIL || '',
    hasTeams: !!p.TEAMS_WEBHOOK,
    hasClaudeKey: !!p.ANTHROPIC_API_KEY,
    triggers: triggers
  };
}

function saveSettings(s) {
  const p = props_();
  ['rejectAlert', 'capaDue', 'dailySummary'].forEach(function (k) {
    if (typeof s[k] === 'boolean') p.setProperty('AUTO_' + k, String(s[k]));
  });
  if (typeof s.notifyEmail === 'string') p.setProperty('NOTIFY_EMAIL', s.notifyEmail.trim());
  if (s.teamsWebhook) p.setProperty('TEAMS_WEBHOOK', s.teamsWebhook.trim());
  if (s.clearTeams) p.deleteProperty('TEAMS_WEBHOOK');
  if (s.claudeKey) p.setProperty('ANTHROPIC_API_KEY', s.claudeKey.trim());
  if (s.clearClaudeKey) p.deleteProperty('ANTHROPIC_API_KEY');
  log_('SAVE_SETTINGS', '');
  return getSettings();
}

function installTriggers() {
  const handlers = ['dailySummaryJob', 'capaDueJob'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySummaryJob').timeBased().everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('capaDueJob').timeBased().everyDays(1).atHour(9).create();
  return 'ตั้งเวลาแล้ว: สรุป QC ทุกวัน 08:00 และเตือน CAPA ทุกวัน 09:00';
}

function dailySummaryJob() {
  if (!isOn_('dailySummary')) return;
  const ds = fmtD_(new Date(Date.now() - 864e5));
  const rows = readTable_('Inspections').filter(function (r) { return String(r.InspectDate).slice(0, 10) === ds; });
  const s = stats_(rows);
  const top = Object.keys(s.defects).sort(function (a, b) { return s.defects[b] - s.defects[a]; }).slice(0, 3)
    .map(function (k) { return k + ' ' + s.defects[k]; }).join(', ') || '-';
  notify_('สรุป QC ประจำวัน ' + ds,
    'รายการตรวจ: ' + s.total + '\nผ่าน: ' + s.pass + ' (' + s.passRate.toFixed(1) + '%)\nรออนุมัติ: ' + s.hold +
    '\nไม่ผ่าน: ' + s.reject + '\nปัญหาที่พบบ่อย: ' + top);
}

function capaDueJob() {
  if (!isOn_('capaDue')) return;
  const limit = fmtD_(new Date(Date.now() + CONFIG.CAPA_DUE_DAYS * 864e5));
  const due = readTable_('CAPA').filter(function (c) {
    return c.Status !== 'Closed' && c.DueDate && String(c.DueDate).slice(0, 10) <= limit;
  });
  if (!due.length) return;
  notify_('CAPA ใกล้ครบกำหนด ' + due.length + ' งาน',
    due.map(function (c) { return c.CapaNo + ' | ' + c.Issue + ' | ผู้รับผิดชอบ ' + (c.Owner || '-') + ' | ครบ ' + String(c.DueDate).slice(0, 10); }).join('\n'));
}

function notify_(subject, body) {
  const p = props_();
  const email = p.getProperty('NOTIFY_EMAIL');
  if (email) MailApp.sendEmail(email, '[QC] ' + subject, body);
  const hook = p.getProperty('TEAMS_WEBHOOK');
  if (hook) {
    // รองรับ Teams Incoming Webhook / Power Automate "When a HTTP request is received"
    UrlFetchApp.fetch(hook, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ title: subject, text: body.replace(/\n/g, '  \n') })
    });
  }
  log_('NOTIFY', subject);
}

function testNotify() {
  const p = props_();
  if (!p.getProperty('NOTIFY_EMAIL') && !p.getProperty('TEAMS_WEBHOOK')) throw new Error('ใส่อีเมลหรือ Teams webhook ก่อนทดสอบ');
  notify_('ทดสอบการแจ้งเตือน', 'ระบบ QC ส่งข้อความทดสอบเมื่อ ' + fmtD_(new Date(), 'dd/MM/yyyy HH:mm'));
  return 'ส่งข้อความทดสอบแล้ว';
}

/* ---------------- Analytics & summary ---------------- */

function stats_(rows) {
  const s = { total: rows.length, pass: 0, hold: 0, reject: 0, sample: 0, defectQty: 0, defects: {}, passRate: 0 };
  rows.forEach(function (r) {
    if (r.Result === 'Pass') s.pass++; else if (r.Result === 'Hold') s.hold++; else if (r.Result === 'Reject') s.reject++;
    s.sample += Number(r.SampleQty) || 0;
    s.defectQty += Number(r.DefectQty) || 0;
    if (r.DefectType) s.defects[r.DefectType] = (s.defects[r.DefectType] || 0) + 1;
  });
  s.passRate = s.total ? s.pass / s.total * 100 : 0;
  return s;
}

function generateSummary(month) {
  month = month || fmtD_(new Date(), 'yyyy-MM');
  const data = getAppData(month);
  const cur = data.inspections.filter(function (r) { return String(r.InspectDate).slice(0, 7) === month; });
  const prev = data.inspections.filter(function (r) { return String(r.InspectDate).slice(0, 7) === data.prevMonth; });
  const s = stats_(cur), sp = stats_(prev);
  const openCapa = data.capa.filter(function (c) { return c.Status !== 'Closed'; });
  const byLine = {};
  cur.forEach(function (r) { const k = r.Line || '-'; byLine[k] = byLine[k] || []; byLine[k].push(r); });
  const lines = Object.keys(byLine).map(function (k) { const x = stats_(byLine[k]); return { line: k, total: x.total, passRate: +x.passRate.toFixed(1), reject: x.reject }; });
  const facts = {
    month: month, total: s.total, passRate: +s.passRate.toFixed(1), prevPassRate: +sp.passRate.toFixed(1),
    hold: s.hold, reject: s.reject, defectRate: s.sample ? +(s.defectQty / s.sample * 100).toFixed(2) : 0,
    topDefects: Object.keys(s.defects).sort(function (a, b) { return s.defects[b] - s.defects[a]; }).slice(0, 5)
      .map(function (k) { return { type: k, count: s.defects[k] }; }),
    byLine: lines,
    openCapa: openCapa.map(function (c) { return { no: c.CapaNo, issue: c.Issue, owner: c.Owner, due: String(c.DueDate).slice(0, 10) }; })
  };

  const key = props_().getProperty('ANTHROPIC_API_KEY');
  if (key) {
    try {
      const prompt = 'คุณเป็นผู้ช่วยผู้จัดการ QC โรงงานอาหาร สรุปข้อมูลคุณภาพเดือนนี้เป็นภาษาไทย กระชับ อ่านง่าย ' +
        'แบ่งเป็น: ภาพรวม, แนวโน้มเทียบเดือนก่อน, ปัญหาเด่นและข้อเสนอแนะ, งานที่ต้องติดตาม (CAPA) ' +
        'ใช้เฉพาะตัวเลขจากข้อมูลนี้:\n' + JSON.stringify(facts);
      const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        payload: JSON.stringify({ model: CONFIG.CLAUDE_MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
      });
      const j = JSON.parse(res.getContentText());
      if (j.content) return { source: 'claude', text: j.content.map(function (c) { return c.text || ''; }).join('\n'), facts: facts };
      log_('CLAUDE_ERROR', res.getContentText().slice(0, 300));
    } catch (e) { log_('CLAUDE_ERROR', String(e)); }
  }
  return { source: 'rules', text: ruleSummary_(facts), facts: facts };
}

function ruleSummary_(f) {
  const diff = f.passRate - f.prevPassRate;
  const out = [];
  out.push('ภาพรวมเดือน ' + f.month);
  out.push('• ตรวจทั้งหมด ' + f.total + ' รายการ ผ่านเกณฑ์ ' + f.passRate + '% (' + (diff >= 0 ? 'ดีขึ้น ' : 'ลดลง ') + Math.abs(diff).toFixed(1) + ' จุดจากเดือนก่อน)');
  out.push('• รออนุมัติ ' + f.hold + ' รายการ, ไม่ผ่าน ' + f.reject + ' รายการ, Defect rate ' + f.defectRate + '%');
  if (f.topDefects.length) {
    out.push('', 'ปัญหาที่พบบ่อย');
    f.topDefects.forEach(function (d) { out.push('• ' + d.type + ' ' + d.count + ' ครั้ง'); });
    out.push('ข้อเสนอแนะ: ทบทวนสาเหตุของ "' + f.topDefects[0].type + '" กับผู้รับผิดชอบไลน์และซัพพลายเออร์ที่เกี่ยวข้องก่อน');
  }
  const worst = f.byLine.slice().sort(function (a, b) { return a.passRate - b.passRate; })[0];
  if (worst) out.push('', 'ไลน์ที่ควรเฝ้าระวัง: ' + worst.line + ' ผ่านเกณฑ์ ' + worst.passRate + '% (ไม่ผ่าน ' + worst.reject + ')');
  out.push('', 'งานที่ต้องติดตาม: CAPA ค้าง ' + f.openCapa.length + ' งาน');
  f.openCapa.slice(0, 5).forEach(function (c) { out.push('• ' + c.no + ' ' + c.issue + ' — ' + (c.owner || '-') + ', ครบ ' + c.due); });
  return out.join('\n');
}

/* ---------------- Demo data ---------------- */

function seedDemoData() {
  setup();
  const M = DEFAULT_MASTER;
  const pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  const stages = ['Incoming', 'In-process', 'Final'];
  const now = new Date();
  const rows = [];
  const counter = {};
  for (let back = 1; back >= 0; back--) {
    const y = now.getFullYear(), m = now.getMonth() - back;
    const days = back ? new Date(y, m + 1, 0).getDate() : now.getDate();
    for (let d = 1; d <= days; d++) {
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const date = new Date(y, m, d);
        const r = Math.random();
        const result = r < 0.955 ? 'Pass' : r < 0.975 ? 'Hold' : 'Reject';
        const stage = pick(stages);
        const sample = pick([50, 80, 100, 125]);
        const defect = result === 'Pass' ? (Math.random() < 0.35 ? 1 + Math.floor(Math.random() * 2) : 0) : 2 + Math.floor(Math.random() * 6);
        const pre = 'L' + fmtD_(date, 'yyMM') + '-';
        counter[pre] = (counter[pre] || 0) + 1;
        rows.push(toRow_('Inspections', {
          ID: Utilities.getUuid().slice(0, 8), LotNo: pre + String(counter[pre]).padStart(4, '0'), InspectDate: date, Stage: stage,
          Line: pick(M.Line), Product: pick(M.Product), Material: stage === 'Incoming' ? pick(M.Material) : '',
          Supplier: stage === 'Incoming' ? pick(M.Supplier) : '', Inspector: pick(M.Inspector),
          SampleQty: sample, DefectQty: defect, DefectType: defect ? pick(M.DefectType) : '', Result: result,
          Note: '', CreatedAt: date, CreatedBy: 'demo', UpdatedAt: date
        }));
      }
    }
  }
  const s = sh_('Inspections');
  s.getRange(s.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  for (let i = 0; i < 7; i++) {
    createCapa_({ LotNo: '', Issue: 'ปัญหา' + pick(M.DefectType) + ' ซ้ำ', Owner: pick(M.Inspector),
      DueDate: new Date(Date.now() + (i - 1) * 3 * 864e5), Status: i < 2 ? 'In progress' : 'Open' });
  }
  return 'เพิ่มข้อมูลตัวอย่าง ' + rows.length + ' รายการ';
}
