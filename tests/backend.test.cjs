const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function app(extra = {}) {
  const ctx = vm.createContext({ ...extra });
  vm.runInContext(fs.readFileSync('Code.js', 'utf8'), ctx);
  return ctx;
}
test('reject invalid calendar dates and malformed dates', () => {
  const c = app();
  for (const v of ['2026-02-29', '2026-13-01', '', 'bad', '2026-01-01junk']) assert.throws(() => c.parseDate_(v));
  assert.equal(c.parseDate_('2024-02-29').getDate(), 29);
});
test('validate quantities, stage and result on server', () => {
  const c = app();
  const good = {InspectDate:'2026-10-21', Stage:'Incoming', Result:'Pass', SampleQty:10, DefectQty:0};
  c.validateInspection_(good);
  for (const patch of [{SampleQty:0}, {SampleQty:-1}, {SampleQty:1.5}, {DefectQty:11}, {DefectQty:-1}, {SampleQty:'NaN'}, {Stage:'bad'}, {Result:'bad'}]) assert.throws(() => c.validateInspection_({...good,...patch}));
});
test('neutralize spreadsheet formulas without changing normal text/numbers', () => {
  const c = app();
  for (const v of ['=IMPORTXML("x")', '+cmd', '-cmd', '@SUM(A1)', '\t=1']) assert.equal(c.safeCell_(v), "'" + v);
  assert.equal(c.safeCell_('ทูน่า'), 'ทูน่า');
  assert.equal(c.safeCell_(12), 12);
});
test('unknown CAPA updates must not create records', () => {
  const c = app(); c.withLock_ = fn => fn(); c.findRow_ = () => -1;
  c.createCapa_ = () => { throw new Error('unexpected create'); };
  assert.throws(() => c.saveCapa({CapaNo:'missing', Issue:'test'}), /ไม่พบ CAPA/);
  assert.throws(() => c.saveCapa({Status:'bad'}), /สถานะ/);
});
test('master data rejects malformed input before clearing sheet', () => {
  const c = app(); c.withLock_ = fn => fn(); c.sh_ = () => { throw new Error('unexpected sheet access'); };
  assert.throws(() => c.saveMaster({Line:'bad'}), /ข้อมูลหลัก/);
  assert.throws(() => c.saveMaster({Unexpected:[]}), /ข้อมูลหลัก/);
});
test('frontend inline scripts parse', () => {
  const html = fs.readFileSync('Index.html', 'utf8');
  for (const [,src] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(src);
});
