/**
 * ============================================================================
 * DAKOTA KARAOKE SCORING SYSTEM - GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * 
 * Flow System Architecture:
 * Judge HP (PWA) -> Apps Script Web App -> Google Spreadsheet -> Existing Dakota Formulas
 * 
 * INSTRUCTIONS FOR DEPLOYMENT / RE-DEPLOYMENT:
 * 1. Open your Dakota Karaoke Google Spreadsheet.
 * 2. Click Extensions > Apps Script.
 * 3. Replace all code in the editor with the contents of this file.
 * 4. Click "Deploy" > "Manage deployments".
 * 5. Click the Edit (pencil icon) on your active Web App deployment.
 * 6. Under "Version", select "New version".
 * 7. Click "Deploy".
 */

function doGet(e) {
  var action = e.parameter ? e.parameter.action : '';
  
  if (action === 'getScores') {
    var eventId = e.parameter.eventId || '';
    var scores = readScoresFromSheet(eventId);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', scores: scores }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  if (action === 'getParticipants') {
    var participants = readParticipantsFromSheet();
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', participants: participants }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Dakota Karaoke Scoring API Operational' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    // ─── AUTHENTICATION ACTIONS ────────────────────────────────
    if (action === 'login') {
      var loginRes = handleLogin(data.username, data.pinHash);
      return ContentService.createTextOutput(JSON.stringify(loginRes))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'changePin') {
      var changeRes = handleChangePin(data.username, data.oldPinHash, data.newPinHash);
      return ContentService.createTextOutput(JSON.stringify(changeRes))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // ─── SCORING ACTIONS ───────────────────────────────────────
    if (action === 'saveScore' || action === 'saveVocal' || action === 'savePerformance' || action === 'saveStaging') {
      var result = appendOrUpdateScore(data);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', result: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── AUTHENTICATION HELPERS ─────────────────────────────────

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

function ensureAuthSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("AUTH");
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

function handleLogin(username, pinHash) {
  if (!username || !pinHash) {
    return { status: "error", authenticated: false, message: "Username dan PIN hash harus diisi." };
  }
  var sheet = ensureAuthSheet();
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var rowUser = String(data[i][0]).trim();
    var rowRole = String(data[i][1]).trim();
    var rowHash = String(data[i][2]).trim();
    
    if (rowUser.toLowerCase() === String(username).trim().toLowerCase()) {
      if (rowHash === String(pinHash).trim()) {
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

function handleChangePin(username, oldPinHash, newPinHash) {
  if (!username || !oldPinHash || !newPinHash) {
    return { status: "error", message: "Parameter tidak lengkap." };
  }
  var sheet = ensureAuthSheet();
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    var rowUser = String(data[i][0]).trim();
    var rowHash = String(data[i][2]).trim();
    
    if (rowUser.toLowerCase() === String(username).trim().toLowerCase()) {
      if (rowHash === String(oldPinHash).trim()) {
        var rowIndex = i + 1; // 1-indexed row in sheet
        var now = new Date().toISOString();
        sheet.getRange(rowIndex, 3).setValue(String(newPinHash).trim());
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

// ─── SCORING HELPERS ────────────────────────────────────────

/**
 * Writes raw score inputs without breaking pre-existing formulas in the sheet.
 */
function appendOrUpdateScore(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Nilai_" + (data.judgeName || "Scoring");
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "Timestamp", "Event ID", "Round", "Juri", "No Peserta", "Nama Peserta", "Judul Lagu",
      "Accuracy", "Character", "Tempo", "Technique", "Vocal Expression",
      "Performance Expression", "Confidence", "Appearance", "Gesture", "Creativity",
      "Interaction", "Communication", "Room Atmosphere", "Audience Engagement",
      "Nilai Total (Raw)", "Catatan", "Device", "User Agent"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#6d28d9").setFontColor("#ffffff");
  }
  
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  
  if (lastRow > 1) {
    var participantData = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    for (var i = 0; i < participantData.length; i++) {
      if (participantData[i][0] == data.participantNo) {
        targetRow = i + 2;
        break;
      }
    }
  }
  
  var rowValues = [
    new Date(),
    data.eventId,
    data.round,
    data.judgeName,
    data.participantNo,
    data.participantName,
    data.songTitle,
    // Vocal
    data.accuracy,
    data.character,
    data.tempo,
    data.technique,
    data.expression,
    // Performance
    data.performanceExpression,
    data.confidence,
    data.appearance,
    data.gesture,
    data.creativity,
    // Staging
    data.interaction,
    data.communication,
    data.roomAtmosphere,
    data.audienceEngagement,
    // Total
    data.totalScore,
    data.notes || "",
    data.deviceInfo || "",
    data.userAgent || ""
  ];
  
  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  
  return { updatedRow: targetRow > 0 ? targetRow : sheet.getLastRow() };
}

function readScoresFromSheet(eventId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var allScores = [];
  
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    if (sheet.getName().indexOf("Nilai_") === 0) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!eventId || row[1] === eventId) {
          allScores.push({
            eventId: row[1],
            round: row[2],
            judgeName: row[3],
            participantNo: row[4],
            participantName: row[5],
            songTitle: row[6],
            totalScore: row[21],
            notes: row[22],
            timestamp: row[0],
            isLocked: true
          });
        }
      }
    }
  }
  
  return allScores;
}

function readParticipantsFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); 
  const sheet = ss.getSheetByName("Penyisihan");

  if (!sheet) return [];

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

  const participants = values
    .filter(row => row[1])
    .map(row => ({
      number: row[0],
      name: row[1]
    }));

  return participants;
}
