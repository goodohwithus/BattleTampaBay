/**
 * Battle of Tampa Bay 2027 — 참가 신청 접수 스크립트
 *
 * battletampabay.com 의 신청서에서 보낸 내용을 이 스프레드시트에 한 줄씩 쌓습니다.
 * 구글 시트 > 확장 프로그램 > Apps Script 에 이 코드를 붙여넣고 배포하세요.
 */

var SHEET_NAME = '참가 명단';

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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    var head = sheet.getRange(1, 1, 1, HEADERS.length);
    head.setFontWeight('bold').setBackground('#0D2240').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** 새 신청이 들어오면 주최측에 알림 메일을 보냅니다. */
function notify_(p) {
  try {
    var to = 'goodohwithus@gmail.com';
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
      '스폰서 관심 : ' + (p.sponsor === 'Y' ? '예' : '아니오') + '\n\n' +
      '전체 명단은 구글 시트에서 확인하세요.';
    MailApp.sendEmail(to, subject, body);
  } catch (err) {
    // 알림 실패해도 접수는 정상 처리합니다.
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
