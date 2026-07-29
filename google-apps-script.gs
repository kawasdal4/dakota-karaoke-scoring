/**
 * ============================================================================
 * DAKOTA KARAOKE SCORING SYSTEM - GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * 
 * Flow System Architecture:
 * Judge HP (PWA) -> Apps Script Web App -> Google Spreadsheet -> Existing Dakota Formulas
 * 
 * INSTRUCTIONS FOR DEPLOYMENT:
 * 1. Open your Dakota Karaoke Google Spreadsheet.
 * 2. Click Extensions > Apps Script.
 * 3. Replace all existing code with this file.
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Execute as: "Me", Who has access: "Anyone".
 * 7. Copy the Web App URL and paste it in Admin Settings or NEXT_PUBLIC_GOOGLE_SCRIPT_URL.
 */

function doGet(e) {
  var action = e.parameter ? e.parameter.action : '';
  
  if (action === 'getScores') {
    var eventId = e.parameter.eventId || '';
    var scores = readScoresFromSheet(eventId);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', scores: scores }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Dakota Karaoke Scoring API Operational' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === 'saveScore') {
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

/**
 * Writes raw score inputs without breaking pre-existing formulas in the sheet.
 */
function appendOrUpdateScore(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Nilai_" + (data.judgeName || "Scoring");
  var sheet = ss.getSheetByName(sheetName);
  
  // If sheet doesn't exist for this judge, create it with standard columns
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
  
  // Check if row for this participant already exists (to prevent duplicating rows for same judge)
  var lastRow = sheet.getLastRow();
  var targetRow = -1;
  
  if (lastRow > 1) {
    var participantData = sheet.getRange(2, 5, lastRow - 1, 1).getValues(); // Column 5 = No Peserta
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
    // Update existing row score inputs
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    // Append new participant row
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
