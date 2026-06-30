/* G1 게이트 — 배포 index.html에서 엔진 함수를 추출해 극단입력 견고성 검증.
   사용자가 실제로 돌리는 코드(배포 HTML)를 검증 대상으로 삼는다(SW품질QA §2 무빌드 특칙).
   실행: node test_robustness.js   (run_tests.bat 가 호출) */
const fs = require('fs'), path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error('script 블록 없음'); process.exit(1); }
let src = m[1];
// DOM 부트스트랩(init) 제거 — 함수만 추출
src = src.replace(/\n\s*buildForm\(\);\s*\n\s*renderManual\(\);\s*/, '\n');
// 최소 스텁(추출 잔여 전역 참조 방어) + export
const stub =
  'var localStorage={_:{},getItem(k){return this._[k]||null},setItem(k,v){this._[k]=String(v)},removeItem(k){delete this._[k]}};' +
  'var document={getElementById(){return null},querySelectorAll(){return[]},createElement(){return{style:{},classList:{add(){},toggle(){},contains(){return false}},appendChild(){},click(){},remove(){}}},body:{appendChild(){}}};' +
  'var window={};var navigator={};\n';
src = stub + src + '\nmodule.exports={sanitizeDims,geo,render,placeholderSVG,calcBOM,DEFAULTS,DIM_RULES,isConn,bayN,DIA};';
const tmp = path.join(__dirname, '_extracted.cjs');
fs.writeFileSync(tmp, src);
let M;
try { M = require(tmp); } finally { fs.unlinkSync(tmp); }

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.error('  FAIL: ' + name); } };
const finiteAll = d => ['w', 'd', 'h', 'levels', 'bays', 'load'].every(k => Number.isFinite(d[k]) && d[k] > 0);
const validSVG = s => typeof s === 'string' && s.indexOf('<svg') === 0 && !/(NaN|Infinity|undefined|null)/.test(s) && /viewBox="0 0 [\d.]+ [\d.]+"/.test(s);
const base = { w: 1138, d: 531, h: 2000, levels: 4, bays: 1, load: 100, type: '독립형' };
const S = (d, o) => ({ dims: d, options: Object.assign({ antiTip: true, casters: false, backPanel: false, brace: false }, o || {}) });

// ---- G1-a: 비정상 입력 6종 → sanitizeDims가 유한·양수·정수로 정상화 ----
const bad = [{ levels: NaN }, { levels: -3 }, { levels: 0 }, { w: 'abc' }, { levels: 2.5 }, {}];
for (const b of bad) {
  const d = M.sanitizeDims(Object.assign({}, base, b));
  ok('sanitize 유한양수 ' + JSON.stringify(b), finiteAll(d));
  ok('sanitize 정수단수/bay ' + JSON.stringify(b), Number.isInteger(d.levels) && Number.isInteger(d.bays));
  ok('sanitize 위반기록 ' + JSON.stringify(b), Array.isArray(d.__violations));
}
// 빈/누락 입력도 안전
ok('빈 dims 안전', finiteAll(M.sanitizeDims({})));
ok('null dims 안전', finiteAll(M.sanitizeDims(null)));

// ---- G1-b: levels=1 단일단 + 범위 클램프 ----
ok('levels=1 유지', M.sanitizeDims(Object.assign({}, base, { levels: 1 })).levels === 1);
ok('levels=99 → max12', M.sanitizeDims(Object.assign({}, base, { levels: 99 })).levels === 12);
ok('w=10 → min300', M.sanitizeDims(Object.assign({}, base, { w: 10 })).w === 300);
{
  const g1 = M.geo(1138, 531, 2000, 1);
  ok('geo L=1 zs 유한(분모붕괴 없음)', g1.zs.length >= 1 && g1.zs.every(Number.isFinite));
}

// ---- 극단입력에서 SVG 유효(viewBox 유한·NaN 없음) ----
const cases = [
  ['levels=1', { levels: 1 }], ['levels=8·bays=6', { levels: 8, bays: 6, type: '연결형' }],
  ['w=0→clamp', { w: 0 }], ['h=음수→clamp', { h: -500 }], ['문자단수', { levels: 'x' }],
];
for (const [nm, ov] of cases) {
  const d = M.sanitizeDims(Object.assign({}, base, ov));
  ok('DIA.full 유효SVG ' + nm, validSVG(M.DIA.full(d)));
}
// render placeholder: 빈 parts / 단일점 → 유효 placeholder(NaN 없음)
ok('render([]) placeholder 유효', validSVG(M.render([])));
ok('placeholderSVG 유효', validSVG(M.placeholderSVG(240)));

// ---- G1-c: BOM 각 수량 양의 정수 ----
const bomCases = [base, Object.assign({}, base, { levels: 1 }), Object.assign({}, base, { levels: 8, bays: 6, type: '연결형' })];
for (const raw of bomCases) {
  const d = M.sanitizeDims(raw);
  const bom = M.calcBOM(S(d));
  ok('BOM 양의정수 ' + JSON.stringify({ l: d.levels, b: d.bays }), bom.every(it => Number.isInteger(it.qty) && it.qty > 0));
  ok('BOM 알파벳라벨 ' + JSON.stringify({ l: d.levels, b: d.bays }), bom.every(it => /^[A-Z]$/.test(it.code)));
}
// 비정상 raw도 sanitize 거치면 BOM 정상(음수/null 인쇄 0)
{
  const d = M.sanitizeDims(Object.assign({}, base, { levels: -3 }));
  const bom = M.calcBOM(S(d));
  ok('음수입력→BOM 음수/null 0', bom.every(it => Number.isInteger(it.qty) && it.qty > 0));
}

// ---- 골든 회귀: 원주 1110×562×2000 4단 6연 = 기둥14·중판24 (실견적 ±0) ----
{
  const d = M.sanitizeDims({ w: 1110, d: 562, h: 2000, levels: 4, bays: 6, type: '연결형', load: 100 });
  const bom = M.calcBOM(S(d));
  const post = bom.find(x => x.part.indexOf('기둥') === 0), shelf = bom.find(x => x.part.indexOf('중판') === 0);
  ok('골든 원주 기둥=14', post && post.qty === 14);
  ok('골든 원주 중판=24', shelf && shelf.qty === 24);
}
// 독립 기본 4단 → 기둥4
{
  const bom = M.calcBOM(S(M.sanitizeDims(base)));
  ok('독립4단 기둥=4', bom.find(x => x.part.indexOf('기둥') === 0).qty === 4);
}

console.log('\n  PASS ' + pass + ' / FAIL ' + fail + '  (총 ' + (pass + fail) + '검)');
process.exit(fail ? 1 : 0);
