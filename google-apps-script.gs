/**
 * ============================================================================
 * DAKOTA KARAOKE SCORING SYSTEM - GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 */

function doGet(e) {
  var action = e.parameter ? e.parameter.action : '';

  if (action === 'getParticipants') {
    var participants = readParticipantsFromSheet();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', participants: participants }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getSubmissions') {
    var submissions = readSubmissionsFromSheet();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...submissions }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ─── LOCK STATUS GET ─────────────────────────────────────────
  if (action === 'getLockStatus') {
    var round = e.parameter.round || '';
    var participantName = e.parameter.participantName || '';
    var judge = e.parameter.judge || '';
    var result = getLockStatus(round, participantName, judge);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'getAllLockStatus') {
    var filterRound = e.parameter.round || '';
    var result = getAllLockStatus(filterRound);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'API Operational' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result;
    
    if (data.action === "login") {
      result = login(data);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "changePin") {
      result = changePin(data);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "saveVocal") {
      result = saveVocal(data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', result: result })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "savePerformance") {
      result = savePerformance(data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', result: result })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "saveStaging") {
      result = saveStaging(data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', result: result })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "toggleLock") {
      result = toggleLockInSheet(data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', result: result })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "saveGlobalLock") {
      PropertiesService.getScriptProperties().setProperty("isGlobalScoringLocked", String(data.isGlobalScoringLocked));
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', isGlobalScoringLocked: data.isGlobalScoringLocked })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === "setLockStatus") {
      // ─── LOCK STATUS (Primary Source of Truth) ────────────────
      var lockResult = setLockStatus(
        data.round || '',
        data.participantName || '',
        data.judge || '',
        data.locked === true || data.locked === 'true'
      );
      return ContentService.createTextOutput(JSON.stringify(lockResult)).setMimeType(ContentService.MimeType.JSON);
    } else {
      throw new Error("Action tidak dikenali: " + data.action);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── TEXT NORMALIZER ──────────────────────────────────────────
// Used for case-insensitive, emoji-safe matching in LOCK_STATUS
function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

// ─── ROLE HELPER ──────────────────────────────────────────────

function normalizeRole(role) {
  var r = String(role || "").toLowerCase().trim();
  if (r === "kenji" || r === "vocal") return "vocal";
  if (r === "ukey" || r === "performance") return "performance";
  if (r === "revan" || r === "staging") return "staging";
  return r;
}

// Judge name → display name (always Kenji/Ukey/Revan)
function normalizeJudgeName(judge) {
  var j = String(judge || '').trim().toLowerCase();
  if (j === 'kenji' || j === 'vocal') return 'Kenji';
  if (j === 'ukey' || j === 'performance') return 'Ukey';
  if (j === 'revan' || j === 'staging') return 'Revan';
  return judge;
}

// ─── LOCK_STATUS SHEET ────────────────────────────────────────
// Primary source of truth for per-round / per-participant / per-judge lock

function getLockStatusSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('LOCK_STATUS');
  if (!sheet) {
    sheet = ss.insertSheet('LOCK_STATUS');
    sheet.appendRow(['round', 'participant_name', 'judge', 'locked', 'updated_at']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
  }
  return sheet;
}

/**
 * getLockStatus – returns {status, locked, round, participantName, judge, updatedAt}
 * Default: locked = false (open) if row does not exist.
 */
function getLockStatus(round, participantName, judge) {
  var normRound = normalizeText(round);
  var normName  = normalizeText(participantName);
  var normJudge = normalizeText(normalizeJudgeName(judge));

  try {
    var sheet = getLockStatusSheet();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var rRound = normalizeText(rows[i][0]);
      var rName  = normalizeText(rows[i][1]);
      var rJudge = normalizeText(rows[i][2]);
      if (rRound === normRound && rName === normName && rJudge === normJudge) {
        var lockedVal = rows[i][3];
        // Coerce to boolean — handles TRUE/FALSE cell values, strings, 0/1
        var locked = (lockedVal === true || lockedVal === 'true' || lockedVal === 1);
        return {
          status: 'success',
          locked: locked,
          round: rows[i][0],
          participantName: rows[i][1],
          judge: rows[i][2],
          updatedAt: rows[i][4] || ''
        };
      }
    }
    // Row not found → default open
    return { status: 'success', locked: false, source: 'default', round: round, participantName: participantName, judge: judge };
  } catch (err) {
    Logger.log('getLockStatus error: ' + err);
    return { status: 'error', locked: false, message: err.toString() };
  }
}

/**
 * setLockStatus – upsert row in LOCK_STATUS sheet.
 * round / participantName / judge: normalized for matching but stored in original form.
 */
function setLockStatus(round, participantName, judge, locked) {
  var normRound = normalizeText(round);
  var normName  = normalizeText(participantName);
  var displayJudge = normalizeJudgeName(judge);
  var normJudge = normalizeText(displayJudge);
  var lockedBool = (locked === true || locked === 'true');
  var now = new Date().toISOString();

  try {
    var sheet = getLockStatusSheet();
    var rows = sheet.getDataRange().getValues();

    for (var i = 1; i < rows.length; i++) {
      var rRound = normalizeText(rows[i][0]);
      var rName  = normalizeText(rows[i][1]);
      var rJudge = normalizeText(rows[i][2]);
      if (rRound === normRound && rName === normName && rJudge === normJudge) {
        var rowIndex = i + 1;
        sheet.getRange(rowIndex, 4).setValue(lockedBool);
        sheet.getRange(rowIndex, 5).setValue(now);
        return {
          status: 'success',
          locked: lockedBool,
          round: round,
          participantName: participantName,
          judge: displayJudge,
          updatedAt: now
        };
      }
    }

    // Insert new row
    sheet.appendRow([round, participantName, displayJudge, lockedBool, now]);
    return {
      status: 'success',
      locked: lockedBool,
      round: round,
      participantName: participantName,
      judge: displayJudge,
      updatedAt: now
    };
  } catch (err) {
    Logger.log('setLockStatus error: ' + err);
    return { status: 'error', message: err.toString() };
  }
}

/**
 * getAllLockStatus – returns all rows (optionally filtered by round)
 */
function getAllLockStatus(filterRound) {
  var normFilter = normalizeText(filterRound || '');
  try {
    var sheet = getLockStatusSheet();
    var rows = sheet.getDataRange().getValues();
    var result = [];
    for (var i = 1; i < rows.length; i++) {
      var rowRound = rows[i][0];
      if (normFilter && normalizeText(rowRound) !== normFilter) continue;
      var lockedVal = rows[i][3];
      var locked = (lockedVal === true || lockedVal === 'true' || lockedVal === 1);
      result.push({
        round: rowRound,
        participantName: rows[i][1],
        judge: rows[i][2],
        locked: locked,
        updatedAt: rows[i][4] || ''
      });
    }
    return { status: 'success', locks: result };
  } catch (err) {
    return { status: 'error', message: err.toString(), locks: [] };
  }
}

/**
 * checkLockBeforeSave – called inside saveVocal/savePerformance/saveStaging.
 * Returns {blocked: true, message: ...} if saving should be denied.
 */
function checkLockBeforeSave(data, judgeName) {
  var round = normalizeText(data.round || 'penyisihan');
  var participantName = data.participantName || '';
  var status = getLockStatus(round, participantName, judgeName);
  if (status.locked === true) {
    return {
      blocked: true,
      status: 'error',
      code: 'SCORING_LOCKED',
      message: 'Penilaian sedang dikunci oleh Admin.'
    };
  }
  return { blocked: false };
}

// ─── AUTHENTICATION (TERPUSAT) ────────────────────────────────

function hashPinGAS(pin) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "dakota_salt_" + pin, Utilities.Charset.UTF_8);
  var txt = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    txt += byteHex;
  }
  return txt;
}

function getAuthSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName("AUTH");
}

function initializeAuthSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getAuthSheet();
  if (!sheet) {
    sheet = ss.insertSheet("AUTH");
    var headers = ["username", "role", "pin_hash", "updated_at"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#4c1d95").setFontColor("#ffffff");
    
    var now = new Date().toISOString();
    var defaultUsers = [
      ["Kenji", "vocal", hashPinGAS("1234"), now],
      ["Ukey", "performance", hashPinGAS("1234"), now],
      ["Revan", "staging", hashPinGAS("1234"), now],
      ["Admin", "admin", hashPinGAS("123456"), now]
    ];
    
    for (var i = 0; i < defaultUsers.length; i++) {
      sheet.appendRow(defaultUsers[i]);
    }
  }
  return sheet;
}

function login(data) {
  if (!data.username || !data.pinHash) {
    return { status: "error", authenticated: false, message: "Username dan PIN hash harus diisi." };
  }
  
  var sheet = getAuthSheet();
  if (!sheet) {
    sheet = initializeAuthSheet();
  }
  
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowUser = String(rows[i][0]).trim();
    var rowRole = String(rows[i][1]).trim();
    var rowHash = String(rows[i][2]).trim();
    
    if (rowUser.toLowerCase() === String(data.username).trim().toLowerCase()) {
      if (rowHash === String(data.pinHash).trim()) {
        return {
          status: "success",
          authenticated: true,
          user: {
            username: rowUser,
            role: rowRole
          }
        };
      } else {
        return {
          status: "error",
          authenticated: false,
          message: "PIN salah. Silakan coba lagi."
        };
      }
    }
  }
  return { status: "error", authenticated: false, message: "Pengguna tidak ditemukan." };
}

function changePin(data) {
  if (!data.username || !data.oldPinHash || !data.newPinHash) {
    return { status: "error", message: "Parameter tidak lengkap." };
  }
  
  var sheet = getAuthSheet();
  if (!sheet) {
    sheet = initializeAuthSheet();
  }
  
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowUser = String(rows[i][0]).trim();
    var rowHash = String(rows[i][2]).trim();
    
    if (rowUser.toLowerCase() === String(data.username).trim().toLowerCase()) {
      if (rowHash === String(data.oldPinHash).trim()) {
        var rowIndex = i + 1;
        var now = new Date().toISOString();
        sheet.getRange(rowIndex, 3).setValue(String(data.newPinHash).trim());
        sheet.getRange(rowIndex, 4).setValue(now);
        return {
          status: "success",
          message: "PIN berhasil diubah."
        };
      } else {
        return {
          status: "error",
          message: "PIN lama tidak sesuai."
        };
      }
    }
  }
  return { status: "error", message: "Pengguna tidak ditemukan." };
}

// ─── SUBMISSIONS DATABASE SHEET ────────────────────────────────

function getSubmissionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("SUBMISSIONS");
  if (!sheet) {
    sheet = ss.insertSheet("SUBMISSIONS");
    var headers = ["eventId", "round", "role", "participantNo", "participantName", "songTitle", "subtotal", "scoresJSON", "notes", "timestamp", "updatedAt", "isLocked"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#1e1b4b").setFontColor("#ffffff");
  }
  return sheet;
}

function upsertSubmissionInSheet(data, role, scoresObj, subtotal, isLocked) {
  var sheet = getSubmissionsSheet();
  var rows = sheet.getDataRange().getValues();
  var eventId = data.eventId || "evt-dakota-2026";
  var round = data.round || "Round Penyisihan";
  var normRole = normalizeRole(role);
  var pNo = Number(data.participantNo);
  var pName = data.participantName || "";
  var songTitle = data.songTitle || "";
  var notes = data.notes || "";
  var timestamp = data.timestamp || new Date().toISOString();
  var scoresJSON = JSON.stringify(scoresObj);
  var updatedAt = new Date().toISOString();
  var lockedVal = isLocked !== undefined ? isLocked : true;

  for (var i = 1; i < rows.length; i++) {
    var rEventId = String(rows[i][0]);
    var rRound = String(rows[i][1]);
    var rRole = normalizeRole(rows[i][2]);
    var rNo = Number(rows[i][3]);

    if (rEventId === eventId && rRound === round && rRole === normRole && rNo === pNo) {
      var rowIndex = i + 1;
      sheet.getRange(rowIndex, 3).setValue(normRole);
      sheet.getRange(rowIndex, 5).setValue(pName);
      sheet.getRange(rowIndex, 6).setValue(songTitle);
      sheet.getRange(rowIndex, 7).setValue(subtotal);
      sheet.getRange(rowIndex, 8).setValue(scoresJSON);
      sheet.getRange(rowIndex, 9).setValue(notes);
      sheet.getRange(rowIndex, 10).setValue(timestamp);
      sheet.getRange(rowIndex, 11).setValue(updatedAt);
      sheet.getRange(rowIndex, 12).setValue(lockedVal);
      return;
    }
  }

  // Append new row
  sheet.appendRow([eventId, round, normRole, pNo, pName, songTitle, subtotal, scoresJSON, notes, timestamp, updatedAt, lockedVal]);
}

function toggleLockInSheet(data) {
  var sheet = getSubmissionsSheet();
  var rows = sheet.getDataRange().getValues();
  var eventId = data.eventId || "evt-dakota-2026";
  var round = data.round || "Round Penyisihan";
  var normRole = normalizeRole(data.role);
  var pNo = Number(data.participantNo);
  var isLocked = data.isLocked === true;
  var updatedAt = new Date().toISOString();

  for (var i = 1; i < rows.length; i++) {
    var rEventId = String(rows[i][0]);
    var rRound = String(rows[i][1]);
    var rRole = normalizeRole(rows[i][2]);
    var rNo = Number(rows[i][3]);

    if (rEventId === eventId && rRound === round && rRole === normRole && rNo === pNo) {
      var rowIndex = i + 1;
      sheet.getRange(rowIndex, 12).setValue(isLocked);
      sheet.getRange(rowIndex, 11).setValue(updatedAt);
      return { updated: true, role: normRole, participantNo: pNo, isLocked: isLocked };
    }
  }

  // If submission row does not exist yet, create a placeholder row with isLocked value!
  sheet.appendRow([eventId, round, normRole, pNo, "", "", 0, "{}", "", updatedAt, updatedAt, isLocked]);
  return { updated: true, created: true, role: normRole, participantNo: pNo, isLocked: isLocked };
}

function readScoringCellsAsFallback() {
  // When SUBMISSIONS sheet has no data, read from the scoring cells directly.
  // This supports the case where scores were entered directly in the spreadsheet.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets();
  var vocalList = [];
  var performanceList = [];
  var stagingList = [];
  var now = new Date().toISOString();

  // Look for sheets with scoring cells (not SUBMISSIONS, AUTH, Penyisihan)
  var skipNames = ["SUBMISSIONS", "AUTH", "Penyisihan", "Semifinal", "Grand Final"];

  for (var si = 0; si < allSheets.length; si++) {
    var sh = allSheets[si];
    var shName = sh.getName();
    if (skipNames.indexOf(shName) >= 0) continue;

    try {
      // Try reading vocal scores (C7:C12)
      var vocalRange = sh.getRange("C7:C12");
      var vocalVals = vocalRange.getValues();
      var accuracy = Number(vocalVals[0][0]);
      var character = Number(vocalVals[1][0]);
      var tempo = Number(vocalVals[2][0]);
      var technique = Number(vocalVals[3][0]);
      var expression = Number(vocalVals[4][0]);
      var vocalSubtotal = Number(vocalVals[5][0]);

      // Only include if at least one score > 0
      if (accuracy > 0 || character > 0 || tempo > 0 || technique > 0 || expression > 0) {
        vocalList.push({
          id: "sub-vocal-0",
          eventId: "evt-dakota-2026",
          round: "Round Penyisihan",
          participantId: "p0",
          participantNo: 0,
          participantName: "Dari Sheet: " + shName,
          songTitle: "",
          scores: { accuracy: accuracy, character: character, tempo: tempo, technique: technique, expression: expression },
          subtotal: vocalSubtotal,
          notes: "",
          isLocked: false,
          timestamp: now,
          deviceInfo: "ScoringSheet",
          userAgent: "GoogleAppsScript"
        });
      }

      // Try reading performance scores (C16:C21)
      var perfRange = sh.getRange("C16:C21");
      var perfVals = perfRange.getValues();
      var perfExpr = Number(perfVals[0][0]);
      var confidence = Number(perfVals[1][0]);
      var appearance = Number(perfVals[2][0]);
      var gesture = Number(perfVals[3][0]);
      var creativity = Number(perfVals[4][0]);
      var perfSubtotal = Number(perfVals[5][0]);

      if (perfExpr > 0 || confidence > 0 || appearance > 0 || gesture > 0 || creativity > 0) {
        performanceList.push({
          id: "sub-performance-0",
          eventId: "evt-dakota-2026",
          round: "Round Penyisihan",
          participantId: "p0",
          participantNo: 0,
          participantName: "Dari Sheet: " + shName,
          songTitle: "",
          scores: { expression: perfExpr, confidence: confidence, appearance: appearance, gesture: gesture, creativity: creativity },
          subtotal: perfSubtotal,
          notes: "",
          isLocked: false,
          timestamp: now,
          deviceInfo: "ScoringSheet",
          userAgent: "GoogleAppsScript"
        });
      }

      // Try reading staging scores (C25:C29)
      var stagingRange = sh.getRange("C25:C29");
      var stagingVals = stagingRange.getValues();
      var interaction = Number(stagingVals[0][0]);
      var communication = Number(stagingVals[1][0]);
      var roomAtmosphere = Number(stagingVals[2][0]);
      var audienceEngagement = Number(stagingVals[3][0]);
      var stagingSubtotal = Number(stagingVals[4][0]);

      if (interaction > 0 || communication > 0 || roomAtmosphere > 0 || audienceEngagement > 0) {
        stagingList.push({
          id: "sub-staging-0",
          eventId: "evt-dakota-2026",
          round: "Round Penyisihan",
          participantId: "p0",
          participantNo: 0,
          participantName: "Dari Sheet: " + shName,
          songTitle: "",
          scores: { interaction: interaction, communication: communication, roomAtmosphere: roomAtmosphere, audienceEngagement: audienceEngagement },
          subtotal: stagingSubtotal,
          notes: "",
          isLocked: false,
          timestamp: now,
          deviceInfo: "ScoringSheet",
          userAgent: "GoogleAppsScript"
        });
      }
    } catch(sheetReadErr) {
      Logger.log("readScoringCellsAsFallback: error reading sheet " + shName + ": " + sheetReadErr);
    }
  }

  return { vocal: vocalList, performance: performanceList, staging: stagingList };
}

function readSubmissionsFromSheet() {
  var sheet = getSubmissionsSheet();
  var globalLockStr = PropertiesService.getScriptProperties().getProperty("isGlobalScoringLocked");
  var isGlobalScoringLocked = globalLockStr === "true";

  if (!sheet) {
    // No SUBMISSIONS sheet — try reading from scoring cells
    var fallback = readScoringCellsAsFallback();
    return Object.assign({ isGlobalScoringLocked: isGlobalScoringLocked }, fallback);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    // SUBMISSIONS sheet is empty — try reading from scoring cells as fallback
    var fallback = readScoringCellsAsFallback();
    return Object.assign({ isGlobalScoringLocked: isGlobalScoringLocked }, fallback);
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  var vocalList = [];
  var performanceList = [];
  var stagingList = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var eventId = String(row[0]);
    var round = String(row[1]);
    var role = normalizeRole(row[2]);
    var participantNo = Number(row[3]);
    var participantName = String(row[4]);
    var songTitle = String(row[5]);
    var subtotal = Number(row[6]);
    var scoresJSON = String(row[7]);
    var notes = String(row[8]);
    var timestamp = String(row[9]);
    var isLockedVal = row[11];
    var isLocked = (isLockedVal === true || String(isLockedVal).toLowerCase() === "true");

    var scores = {};
    try {
      scores = JSON.parse(scoresJSON);
    } catch(e) {
      scores = {};
    }

    // If scores are empty or all zero (placeholder row from toggleLock),
    // supplement from the scoring cells of the active sheet (best-effort)
    var scoreValues = Object.keys(scores).map(function(k) { return Number(scores[k]); });
    var hasRealScores = scoreValues.some(function(v) { return v > 0; });

    if (!hasRealScores) {
      try {
        var ss2 = SpreadsheetApp.getActiveSpreadsheet();
        var activeSheet = ss2.getActiveSheet();
        if (role === "vocal") {
          var vv = activeSheet.getRange("C7:C11").getValues();
          var vAcc = Number(vv[0][0]), vChr = Number(vv[1][0]), vTmp = Number(vv[2][0]);
          var vTec = Number(vv[3][0]), vExp = Number(vv[4][0]);
          if (vAcc > 0 || vChr > 0 || vTmp > 0 || vTec > 0 || vExp > 0) {
            scores = { accuracy: vAcc, character: vChr, tempo: vTmp, technique: vTec, expression: vExp };
          }
        } else if (role === "performance") {
          var pv = activeSheet.getRange("C16:C20").getValues();
          var pExp = Number(pv[0][0]), pConf = Number(pv[1][0]), pApp = Number(pv[2][0]);
          var pGest = Number(pv[3][0]), pCre = Number(pv[4][0]);
          if (pExp > 0 || pConf > 0 || pApp > 0 || pGest > 0 || pCre > 0) {
            scores = { expression: pExp, confidence: pConf, appearance: pApp, gesture: pGest, creativity: pCre };
          }
        } else if (role === "staging") {
          var sv = activeSheet.getRange("C25:C28").getValues();
          var sInt = Number(sv[0][0]), sComm = Number(sv[1][0]), sRoom = Number(sv[2][0]), sAud = Number(sv[3][0]);
          if (sInt > 0 || sComm > 0 || sRoom > 0 || sAud > 0) {
            scores = { interaction: sInt, communication: sComm, roomAtmosphere: sRoom, audienceEngagement: sAud };
          }
        }
      } catch(suppErr) {
        Logger.log("supplement scores error (non-fatal): " + suppErr.toString());
      }
    }

    var baseSub = {
      id: "sub-" + role + "-" + participantNo,
      eventId: eventId,
      round: round,
      participantId: "p" + participantNo,
      participantNo: participantNo,
      participantName: participantName,
      songTitle: songTitle,
      subtotal: subtotal,
      notes: notes,
      isLocked: isLocked,
      timestamp: timestamp,
      deviceInfo: "Sheets Sync",
      userAgent: "GoogleAppsScript"
    };

    if (role === "vocal") {
      vocalList.push(Object.assign({}, baseSub, { scores: scores }));
    } else if (role === "performance") {
      performanceList.push(Object.assign({}, baseSub, { scores: scores }));
    } else if (role === "staging") {
      stagingList.push(Object.assign({}, baseSub, { scores: scores }));
    }
  }

  return { isGlobalScoringLocked: isGlobalScoringLocked, vocal: vocalList, performance: performanceList, staging: stagingList };
}

// ─── SCORING ACTIONS (Sesuai Mapping) ─────────────────────────

function getScoringSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getActiveSheet(); 
}

function saveVocal(data) {
  // ─── BACKEND LOCK VALIDATION (LOCK_STATUS is primary source) ─
  var lockCheck = checkLockBeforeSave(data, 'Kenji');
  if (lockCheck.blocked) {
    return lockCheck; // {status:'error', code:'SCORING_LOCKED', message:...}
  }

  // Try to write to main scoring sheet (non-critical — may fail if wrong sheet is active)
  try {
    var sheet = getScoringSheet();
    sheet.getRange("C7").setValue(data.accuracy || 0);
    sheet.getRange("C8").setValue(data.character || 0);
    sheet.getRange("C9").setValue(data.tempo || 0);
    sheet.getRange("C10").setValue(data.technique || 0);
    sheet.getRange("C11").setValue(data.expression || 0);
    sheet.getRange("C12").setValue(data.vocalSubtotal || 0);
    sheet.getRange("A13").setValue(data.notes || "");
  } catch (sheetErr) {
    Logger.log("saveVocal: main sheet write failed (non-fatal): " + sheetErr.toString());
  }

  // CRITICAL: Always save to SUBMISSIONS sheet regardless of main sheet status
  var vocalScores = {
    accuracy: Number(data.accuracy) || 0,
    character: Number(data.character) || 0,
    tempo: Number(data.tempo) || 0,
    technique: Number(data.technique) || 0,
    expression: Number(data.expression) || 0
  };
  upsertSubmissionInSheet(data, "vocal", vocalScores, Number(data.vocalSubtotal) || 0, true);

  return { updated: true, role: "vocal", message: "Nilai Vocal berhasil disimpan ke sheet." };
}

function savePerformance(data) {
  // ─── BACKEND LOCK VALIDATION ─────────────────────────────────
  var lockCheck = checkLockBeforeSave(data, 'Ukey');
  if (lockCheck.blocked) return lockCheck;

  // Try to write to main scoring sheet (non-critical)
  try {
    var sheet = getScoringSheet();
    sheet.getRange("C16").setValue(data.perfExpression || 0);
    sheet.getRange("C17").setValue(data.confidence || 0);
    sheet.getRange("C18").setValue(data.appearance || 0);
    sheet.getRange("C19").setValue(data.gesture || 0);
    sheet.getRange("C20").setValue(data.creativity || 0);
    sheet.getRange("C21").setValue(data.performanceSubtotal || 0);
    sheet.getRange("A22").setValue(data.notes || "");
  } catch (sheetErr) {
    Logger.log("savePerformance: main sheet write failed (non-fatal): " + sheetErr.toString());
  }

  // CRITICAL: Always save to SUBMISSIONS sheet
  var perfScores = {
    expression: Number(data.perfExpression) || 0,
    confidence: Number(data.confidence) || 0,
    appearance: Number(data.appearance) || 0,
    gesture: Number(data.gesture) || 0,
    creativity: Number(data.creativity) || 0
  };
  upsertSubmissionInSheet(data, "performance", perfScores, Number(data.performanceSubtotal) || 0, true);

  return { updated: true, role: "performance", message: "Nilai Performance berhasil disimpan ke sheet." };
}

function saveStaging(data) {
  // ─── BACKEND LOCK VALIDATION ─────────────────────────────────
  var lockCheck = checkLockBeforeSave(data, 'Revan');
  if (lockCheck.blocked) return lockCheck;

  // Try to write to main scoring sheet (non-critical)
  try {
    var sheet = getScoringSheet();
    sheet.getRange("C25").setValue(data.interaction || 0);
    sheet.getRange("C26").setValue(data.communication || 0);
    sheet.getRange("C27").setValue(data.roomAtmosphere || 0);
    sheet.getRange("C28").setValue(data.audienceEngagement || 0);
    sheet.getRange("C29").setValue(data.stagingSubtotal || 0);
    sheet.getRange("A30").setValue(data.notes || "");
  } catch (sheetErr) {
    Logger.log("saveStaging: main sheet write failed (non-fatal): " + sheetErr.toString());
  }

  // CRITICAL: Always save to SUBMISSIONS sheet
  var stagingScores = {
    interaction: Number(data.interaction) || 0,
    communication: Number(data.communication) || 0,
    roomAtmosphere: Number(data.roomAtmosphere) || 0,
    audienceEngagement: Number(data.audienceEngagement) || 0
  };
  upsertSubmissionInSheet(data, "staging", stagingScores, Number(data.stagingSubtotal) || 0, true);

  return { updated: true, role: "staging", message: "Nilai Staging berhasil disimpan ke sheet." };
}

// ─── GET PARTICIPANTS ────────────────────────────────────────

function readParticipantsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); 
  const sheet = ss.getSheetByName("Penyisihan");

  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const participants = values
    .filter(function(row) { return row[1] })
    .map(function(row) {
      return { number: row[0], name: row[1] };
    });

  return participants;
}
// ─── LOCK_STATUS API ───────────────────────────────────────
// Sheet "LOCK_STATUS" stores lock state per round, participant, and judge.
// Columns: round, participantName, judge, locked (TRUE/FALSE), updated_at

function getLockStatus(e) {
  // Expected query parameters: round, participantName, judge
  var round = e.parameter.round;
  var participantName = e.parameter.participantName;
  var judge = e.parameter.judge;
  if (!round || !participantName || !judge) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing parameters" })).setMimeType(ContentService.MimeType.JSON);
  }
  var sheet = getOrCreateLockSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === round && String(data[i][1]) === participantName && String(data[i][2]) === judge) {
      var locked = data[i][3] === true || String(data[i][3]).toLowerCase() === "true";
      return ContentService.createTextOutput(JSON.stringify({ status: "success", locked: locked, updatedAt: data[i][4] })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  // Not found – default unlocked
  return ContentService.createTextOutput(JSON.stringify({ status: "success", locked: false })).setMimeType(ContentService.MimeType.JSON);
}

function setLockStatus(e) {
  // Expected POST body JSON: { round, participantName, judge, locked }
  var payload = JSON.parse(e.postData.contents || "{}");
  var round = payload.round;
  var participantName = payload.participantName;
  var judge = payload.judge;
  var locked = payload.locked;
  if (round == null || participantName == null || judge == null || locked == null) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing fields" })).setMimeType(ContentService.MimeType.JSON);
  }
  var sheet = getOrCreateLockSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === round && String(data[i][1]) === participantName && String(data[i][2]) === judge) {
      sheet.getRange(i + 1, 4).setValue(locked);
      sheet.getRange(i + 1, 5).setValue(now);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  // Append new row
  sheet.appendRow([round, participantName, judge, locked, now]);
  return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
}

function getAllLockStatus(e) {
  var sheet = getOrCreateLockSheet();
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    rows.push({
      round: data[i][0],
      participantName: data[i][1],
      judge: data[i][2],
      locked: data[i][3] === true || String(data[i][3]).toLowerCase() === "true",
      updatedAt: data[i][4]
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "success", lockStatuses: rows })).setMimeType(ContentService.MimeType.JSON);
}

// ─── GET PARTICIPANT SCORES ───────────────────────────────────────
function getParticipantScores(e) {
  var round = e.parameter.round;
  var participantName = e.parameter.participantName;
  var judge = e.parameter.judge;
  if (!round || !participantName || !judge) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing parameters" })).setMimeType(ContentService.MimeType.JSON);
  }
  var data = readSubmissionsFromSheet();
  var roleMap = { Kenji: "vocal", Ukey: "performance", Revan: "staging" };
  var role = roleMap[judge] || judge.toLowerCase();
  var list = data[role] || [];
  for (var i = 0; i < list.length; i++) {
    var sub = list[i];
    if (String(sub.round) === round && String(sub.participantName) === participantName) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        round: sub.round,
        participantName: sub.participantName,
        judge: judge,
        scores: sub.scores || {},
        subtotal: sub.subtotal || 0,
        notes: sub.notes || "",
        isLocked: sub.isLocked === true || String(sub.isLocked).toLowerCase() === "true",
        updatedAt: sub.updatedAt || ""
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  // Not found – default empty
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    round: round,
    participantName: participantName,
    judge: judge,
    scores: {},
    subtotal: 0,
    notes: "",
    isLocked: false,
    updatedAt: ""
  })).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateLockSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("LOCK_STATUS");
  if (!sheet) {
    sheet = ss.insertSheet("LOCK_STATUS");
    // Header row
    sheet.appendRow(["round", "participantName", "judge", "locked", "updated_at"]);
    sheet.setFrozenRows(1);
    // Optional: protect headers
  }
  return sheet;
}

// Route actions
function doGet(e) {
  var action = e.parameter.action;
  if (action === "getLockStatus") return getLockStatus(e);
  if (action === "getAllLockStatus") return getAllLockStatus(e);
  // existing GET handling (participants, submissions, etc.) should be placed before or after as needed
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var action = e.parameter.action;
  if (action === "setLockStatus") return setLockStatus(e);
  // existing POST handling (saveVocal, savePerformance, saveStaging) should be placed before or after as needed
  return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unknown action" })).setMimeType(ContentService.MimeType.JSON);
}

// End of script
