/**
 * Battle of Tampa Bay 2027 — 참가 신청 접수 스크립트
 * battletampabay.com 의 신청서 내용을 구글 시트에 한 줄씩 저장하고
 * 주최측에 알림 메일을 보냅니다.
 *
 * 설치: 구글 시트 > 확장 프로그램 > Apps Script 에 붙여넣고
 *       배포 > 새 배포 > 웹 앱 > 액세스 권한 "Anyone" 으로 배포하세요.
 */

var SHEET_ID   = '169eKPGDymsfGfdIksmnXmqZv9OOP0FQrU5A7cy7YWTM';
var SHEET_NAME = '접수 명단';
var NOTIFY_TO  = 'goodohwithus@gmail.com';

var HEADERS = [
  '접수일시', '지역 · 팀', '부문',
  '선수1 이름', '선수1 나이', '선수1 영문명', '선수1 연락처', '선수1 이메일', '선수1 핸디',
  '선수2 이름', '선수2 나이', '선수2 영문명', '선수2 연락처', '선수2 이메일', '선수2 핸디',
  '요청 사항', '스폰서 관심', '참가비', '확정', '메모'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var p = (e && e.parameter) ? e.parameter : {};
    sheet.appendRow([
      new Date(),
      p.team || '', p.div || '',
      p.p1name || '', p.p1age || '', p.p1eng || '', p.p1phone || '', p.p1email || '', p.p1hcp || '',
      p.p2name || '', p.p2age || '', p.p2eng || '', p.p2phone || '', p.p2email || '', p.p2hcp || '',
      p.note || '', (p.sponsor === 'Y' ? 'Y' : 'N'),
      '미납', '대기', ''
    ]);
    notify_(p);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, message: 'Battle of Tampa Bay 2027 registration endpoint' });
}

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

/* 설치 확인용 — 이 함수를 Run 하면 시트에 테스트 줄이 들어갑니다 */
function 테스트() {
  doPost({ parameter: {
    team: 'FL · 플로리다', div: '남성부',
    p1name: '테스트일', p1age: '50', p1phone: '000', p1email: 'test1@test.com', p1hcp: '6 – 10',
    p2name: '테스트이', p2age: '50', p2phone: '000', p2email: 'test2@test.com', p2hcp: '11 – 15',
    note: '설치 확인용', sponsor: 'N'
  }});
}
