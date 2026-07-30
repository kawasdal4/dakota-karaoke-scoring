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
    } else {
      throw new Error("Action tidak dikenali: " + data.action);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
    var rRole = String(rows[i][2]);
    var rNo = Number(rows[i][3]);

    if (rEventId === eventId && rRound === round && rRole === role && rNo === pNo) {
      var rowIndex = i + 1;
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
  sheet.appendRow([eventId, round, role, pNo, pName, songTitle, subtotal, scoresJSON, notes, timestamp, updatedAt, lockedVal]);
}

function toggleLockInSheet(data) {
  var sheet = getSubmissionsSheet();
  var rows = sheet.getDataRange().getValues();
  var eventId = data.eventId || "evt-dakota-2026";
  var round = data.round || "Round Penyisihan";
  var role = String(data.role || "").toLowerCase();
  var pNo = Number(data.participantNo);
  var isLocked = data.isLocked === true;
  var updatedAt = new Date().toISOString();

  for (var i = 1; i < rows.length; i++) {
    var rEventId = String(rows[i][0]);
    var rRound = String(rows[i][1]);
    var rRole = String(rows[i][2]).toLowerCase();
    var rNo = Number(rows[i][3]);

    if (rEventId === eventId && rRound === round && rRole === role && rNo === pNo) {
      var rowIndex = i + 1;
      sheet.getRange(rowIndex, 12).setValue(isLocked);
      sheet.getRange(rowIndex, 11).setValue(updatedAt);
      return { updated: true, role: role, participantNo: pNo, isLocked: isLocked };
    }
  }

  // If submission row does not exist yet, create a placeholder row with isLocked value!
  sheet.appendRow([eventId, round, role, pNo, "", "", 0, "{}", "", updatedAt, updatedAt, isLocked]);
  return { updated: true, created: true, role: role, participantNo: pNo, isLocked: isLocked };
}

function readSubmissionsFromSheet() {
  var sheet = getSubmissionsSheet();
  var globalLockStr = PropertiesService.getScriptProperties().getProperty("isGlobalScoringLocked");
  var isGlobalScoringLocked = globalLockStr === "true";

  if (!sheet) return { isGlobalScoringLocked: isGlobalScoringLocked, vocal: [], performance: [], staging: [] };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { isGlobalScoringLocked: isGlobalScoringLocked, vocal: [], performance: [], staging: [] };

  var rows = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
  var vocalList = [];
  var performanceList = [];
  var stagingList = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var eventId = String(row[0]);
    var round = String(row[1]);
    var role = String(row[2]).toLowerCase();
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
  var sheet = getScoringSheet();
  
  // Mapping Kenji (Vocal)
  sheet.getRange("C7").setValue(data.accuracy || 0);
  sheet.getRange("C8").setValue(data.character || 0);
  sheet.getRange("C9").setValue(data.tempo || 0);
  sheet.getRange("C10").setValue(data.technique || 0);
  sheet.getRange("C11").setValue(data.expression || 0);
  sheet.getRange("C12").setValue(data.vocalSubtotal || 0);
  sheet.getRange("A13").setValue(data.notes || "");
  
  // Save to SUBMISSIONS sheet
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
  var sheet = getScoringSheet();
  
  // Mapping Ukey (Performance)
  sheet.getRange("C16").setValue(data.perfExpression || 0);
  sheet.getRange("C17").setValue(data.confidence || 0);
  sheet.getRange("C18").setValue(data.appearance || 0);
  sheet.getRange("C19").setValue(data.gesture || 0);
  sheet.getRange("C20").setValue(data.creativity || 0);
  sheet.getRange("C21").setValue(data.performanceSubtotal || 0);
  sheet.getRange("A22").setValue(data.notes || "");
  
  // Save to SUBMISSIONS sheet
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
  var sheet = getScoringSheet();
  
  // Mapping Revan (Staging)
  sheet.getRange("C25").setValue(data.interaction || 0);
  sheet.getRange("C26").setValue(data.communication || 0);
  sheet.getRange("C27").setValue(data.roomAtmosphere || 0);
  sheet.getRange("C28").setValue(data.audienceEngagement || 0);
  sheet.getRange("C29").setValue(data.stagingSubtotal || 0);
  sheet.getRange("A30").setValue(data.notes || "");
  
  // Save to SUBMISSIONS sheet
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
