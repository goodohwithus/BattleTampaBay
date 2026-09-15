/**
 * Battle of Tampa Bay 2027 — 참가 신청 접수 스크립트  (v3 · 스팸 차단 포함)
 * battletampabay.com 의 신청서 내용을 구글 시트에 한 줄씩 저장하고
 * 주최측에 알림 메일을 보냅니다.
 *
 * 설치: Apps Script 편집기에 전체를 붙여넣고 저장한 뒤
 *       배포 > 배포 관리 > (연필) > 버전: 새 버전 > 배포
 *       ※ 액세스 권한은 "Anyone" 이어야 합니다.
 */

var SHEET_ID   = '169eKPGDymsfGfdIksmnXmqZv9OOP0FQrU5A7cy7YWTM';
var SHEET_NAME = '접수 명단';
var SPAM_NAME  = '스팸 보관';
var NOTIFY_TO  = 'goodohwithus@gmail.com';
var CAP_TEAMS  = 24;
var FORM_TOKEN = 'botb27-' + (27 * 29).toString(36);   // 신청서 쪽과 같은 값

/* 주최측 현황판 열쇠 — 현황판 페이지에서 입력하는 암호입니다.
   바꾸시려면 아래 값만 고치고 새 버전으로 배포하세요. */
var ADMIN_KEY  = 'tampa27gold';

var HEADERS = [
  '접수일시', '지역 · 팀', '부문',
  '선수1 이름', '선수1 나이', '선수1 영문명', '선수1 연락처', '선수1 이메일', '선수1 핸디',
  '선수2 이름', '선수2 나이', '선수2 영문명', '선수2 연락처', '선수2 이메일', '선수2 핸디',
  '요청 사항', '스폰서 관심', '참가비', '확정', '메모'
];

/* ══════════════════════════════════════════════════════════════
   접수 받기
   ══════════════════════════════════════════════════════════════ */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var verdict = spamCheck_(p);

    var row = [
      new Date(),
      p.team || '', p.div || '',
      p.p1name || '', p.p1age || '', p.p1eng || '', p.p1phone || '', p.p1email || '', p.p1hcp || '',
      p.p2name || '', p.p2age || '', p.p2eng || '', p.p2phone || '', p.p2email || '', p.p2hcp || '',
      p.note || '', (p.sponsor === 'Y' ? 'Y' : 'N'),
      '미납', '대기', ''
    ];

    if (verdict.spam) {
      /* 스팸은 별도 시트로 보내고 알림 메일도 보내지 않습니다.
         봇이 다시 시도하지 않도록 응답은 정상처럼 돌려줍니다. */
      var sp = getSpamSheet_();
      sp.appendRow(row.concat([verdict.score, verdict.why.join(' / ')]));
      return json_({ ok: true });
    }

    getSheet_().appendRow(row);
    notify_(p);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════
   스팸 판정
   ══════════════════════════════════════════════════════════════ */
function spamCheck_(p) {
  var score = 0, why = [];
  function hit(n, msg) { score += n; why.push(msg); }

  /* 1. 사람에게 보이지 않는 칸(허니팟)이 채워짐 — 확실한 봇 */
  if (String(p.hp || p.website || '').trim()) hit(10, '숨김칸 입력');

  /* 2. 신청서를 거치지 않고 주소로 바로 보낸 경우 */
  if (String(p.tk || '') !== FORM_TOKEN) hit(2, '폼 토큰 없음');

  /* 3. 열자마자 5초 안에 제출 — 사람이 채울 수 없는 속도 */
  var el = parseInt(p.el, 10);
  if (!isNaN(el) && el < 5000) hit(3, '제출 속도 ' + el + 'ms');

  /* 4. 이름이 무작위 문자열 */
  if (looksRandom_(p.p1name) || looksRandom_(p.p2name)) hit(4, '이름이 무작위 문자');

  /* 5. 요청 사항이 무작위 문자열 / 링크 포함 */
  if (looksRandom_(p.note)) hit(3, '요청사항이 무작위 문자');
  if (/https?:\/\/|\[url|<a\s/i.test(String(p.note || ''))) hit(3, '요청사항에 링크');

  /* 6. 점 찍기로 만든 임시 지메일 (a.b.c.d@gmail.com) */
  if (dotTrick_(p.p1email) || dotTrick_(p.p2email)) hit(3, '점 다수 이메일');

  /* 7. 두 선수 이메일이 완전히 동일 — 가족 공용일 수 있어 약한 신호 */
  if (p.p1email && p.p1email === p.p2email) hit(1, '두 선수 이메일 동일');

  return { spam: score >= 4, score: score, why: why };
}

/* 한글이 없고, 공백도 없고, 대소문자가 뒤섞인 긴 문자열 = 무작위 생성 */
function looksRandom_(s) {
  s = String(s || '').trim();
  if (!s) return false;
  if (/[가-힣]/.test(s)) return false;
  if (s.length < 10) return false;
  if (/\s/.test(s)) return false;
  var up = (s.match(/[A-Z]/g) || []).length;
  var lo = (s.match(/[a-z]/g) || []).length;
  if (up >= 3 && lo >= 3) return true;
  var vowel = (s.match(/[aeiouAEIOU]/g) || []).length;
  return (vowel / s.length) < 0.2;
}

/* 아이디 부분에 점이 4개 이상 — 같은 주소를 여러 개처럼 쓰는 수법 */
function dotTrick_(m) {
  m = String(m || '');
  var at = m.indexOf('@');
  if (at < 0) return false;
  return (m.slice(0, at).split('.').length - 1) >= 4;
}

/* ══════════════════════════════════════════════════════════════
   접수 현황 조회
     · 열쇠 없이   → 숫자만 (웹사이트 공개용 · 이름·연락처 절대 안 나감)
     · ?key=…      → 전체 명단 (주최측 현황판 전용)
   ══════════════════════════════════════════════════════════════ */
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  try {
    var sheet = getSheet_();
    var last = sheet.getLastRow();
    var vals = (last > 1) ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];

    var rows = [], divs = {}, regions = {};
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (!v[3] && !v[9]) continue;
      var d = String(v[2] || '기타'), rg = String(v[1] || '기타');
      divs[d] = (divs[d] || 0) + 1;
      regions[rg] = (regions[rg] || 0) + 1;
      rows.push({
        no: rows.length + 1,
        ts:   v[0] ? Utilities.formatDate(new Date(v[0]), 'America/New_York', 'yyyy-MM-dd HH:mm') : '',
        team: v[1] || '', div: v[2] || '',
        p1: { n: v[3] || '', a: v[4] || '', e: v[5] || '', p: v[6] || '', m: v[7] || '', h: v[8] || '' },
        p2: { n: v[9] || '', a: v[10] || '', e: v[11] || '', p: v[12] || '', m: v[13] || '', h: v[14] || '' },
        note: v[15] || '', sponsor: v[16] || '', fee: v[17] || '', status: v[18] || '', memo: v[19] || ''
      });
    }

    /* 주최측 현황판 */
    if (p.key && String(p.key) === ADMIN_KEY) {
      var spamCount = 0;
      try {
        var sp = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SPAM_NAME);
        if (sp) spamCount = Math.max(0, sp.getLastRow() - 1);
      } catch (e2) {}
      return json_({
        ok: true, admin: true, cap: CAP_TEAMS, count: rows.length,
        divs: divs, regions: regions, spam: spamCount, rows: rows,
        sheetUrl: 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit'
      });
    }

    /* 열쇠가 틀리면 조용히 공개용으로 내려갑니다 */
    if (p.key) return json_({ ok: false, error: 'AUTH' });

    /* 공개용 — 숫자와 부문 집계만 */
    return json_({ ok: true, cap: CAP_TEAMS, count: rows.length, divs: divs, regions: regions });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ══════════════════════════════════════════════════════════════
   시트 · 알림
   ══════════════════════════════════════════════════════════════ */
function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { sheet = ss.insertSheet(SHEET_NAME); }
  var first = sheet.getRange(1, 1).getValue();
  if (sheet.getLastRow() === 0 || first !== HEADERS[0]) {
    if (sheet.getLastRow() > 0) { sheet.insertRowBefore(1); }
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setFontWeight('bold').setBackground('#0D2240').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSpamSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SPAM_NAME);
  var H = HEADERS.concat(['스팸 점수', '판정 사유']);
  if (!sheet) {
    sheet = ss.insertSheet(SPAM_NAME);
    sheet.getRange(1, 1, 1, H.length).setValues([H]);
    sheet.getRange(1, 1, 1, H.length)
         .setFontWeight('bold').setBackground('#7A1F1F').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notify_(p) {
  try {
    var subject = '[BOTB 2027 신청] ' + (p.p1name || '') + ' · ' + (p.p2name || '') + ' (' + (p.team || '') + ')';
    var body =
      '새 팀이 등록했습니다.\n\n' +
      '지역 · 팀 : ' + (p.team || '') + '\n' +
      '부문      : ' + (p.div || '') + '\n\n' +
      '[선수 1] ' + (p.p1name || '') + ' / 만 ' + (p.p1age || '') + '세 / ' +
                    (p.p1phone || '') + ' / ' + (p.p1email || '') + ' / 핸디 ' + (p.p1hcp || '-') + '\n' +
      '[선수 2] ' + (p.p2name || '') + ' / 만 ' + (p.p2age || '') + '세 / ' +
                    (p.p2phone || '') + ' / ' + (p.p2email || '') + ' / 핸디 ' + (p.p2hcp || '-') + '\n\n' +
      '요청 사항 : ' + (p.note || '없음') + '\n' +
      '스폰서 관심 : ' + (p.sponsor === 'Y' ? '예' : '아니오');
    MailApp.sendEmail(NOTIFY_TO, subject, body);
  } catch (err) {}
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════════════════════════════
   확인용 함수 — 편집기에서 Run 해 보세요
   ══════════════════════════════════════════════════════════════ */
function 정상접수_테스트() {
  var r = doPost({ parameter: {
    tk: FORM_TOKEN, el: '45000',
    team: 'FL · 플로리다', div: '남성부',
    p1name: '테스트일', p1age: '50', p1phone: '000', p1email: 'test1@test.com', p1hcp: '6 – 10',
    p2name: '테스트이', p2age: '50', p2phone: '000', p2email: 'test2@test.com', p2hcp: '11 – 15',
    note: '설치 확인용', sponsor: 'N'
  }});
  Logger.log(r.getContent());
}

function 스팸차단_테스트() {
  var p = {
    team: 'NY · 뉴욕', div: '남성부',
    p1name: 'DHKzlyGwmqpRFWCQJWGKWOVM', p1age: '42', p1phone: '8462999553',
    p1email: 'covo.w.e.q.oqo.c9.29@gmail.com', p1hcp: '스크래치 ~ 5',
    p2name: 'qlCrxvIEqWmVlGlPHalrqws', p2age: '41', p2phone: '6542682600',
    p2email: 'covo.w.e.q.oqo.c9.29@gmail.com', p2hcp: '스크래치 ~ 5',
    note: 'vmiQVfRxOWExyJSpVEEEAKV', sponsor: 'Y'
  };
  Logger.log(JSON.stringify(spamCheck_(p)));   // spam: true 가 나와야 정상
}
