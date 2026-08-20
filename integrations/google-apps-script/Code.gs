/**
 * Northstar Brief — Google Apps Script submission provider
 *
 * Required Script Properties:
 * SHEET_ID, DRIVE_FOLDER_ID, NOTIFICATION_EMAIL
 */
function doPost(event) {
  try {
    var payload = JSON.parse(event.postData.contents);
    if (payload.action === 'upload') return uploadAsset_(payload);
    return saveSubmission_(payload.data);
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function saveSubmission_(data) {
  var properties = PropertiesService.getScriptProperties();
  var sheet = SpreadsheetApp.openById(properties.getProperty('SHEET_ID')).getSheets()[0];
  var submissionId = Utilities.getUuid();
  var submittedAt = data.project.submittedAt || new Date().toISOString();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Submission ID',
      'Submitted at',
      'Business',
      'Contact',
      'Email',
      'Phone',
      'Industry',
      'Primary action',
      'Status',
      'Structured JSON'
    ]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    submissionId,
    submittedAt,
    data.business.name,
    data.contact.name,
    data.contact.email,
    data.contact.phone,
    data.business.industry,
    data.websiteGoals.primaryAction,
    'new',
    JSON.stringify(data)
  ]);

  var recipient = properties.getProperty('NOTIFICATION_EMAIL');
  if (recipient) {
    MailApp.sendEmail({
      to: recipient,
      subject: 'New Website Intake — ' + data.business.name,
      htmlBody: buildEmail_(data, submissionId),
      name: 'Northstar Brief',
      replyTo: data.contact.email
    });
  }

  return json_({ ok: true, submissionId: submissionId });
}

function uploadAsset_(payload) {
  var properties = PropertiesService.getScriptProperties();
  var root = DriveApp.getFolderById(properties.getProperty('DRIVE_FOLDER_ID'));
  var folders = root.getFoldersByName(payload.submissionId);
  var folder = folders.hasNext() ? folders.next() : root.createFolder(payload.submissionId);
  var bytes = Utilities.base64Decode(payload.file.base64);
  var blob = Utilities.newBlob(bytes, payload.file.type, payload.file.name);
  var file = folder.createFile(blob);
  file.setDescription(payload.file.category || 'Business asset');
  return json_({ ok: true, fileId: file.getId() });
}

function buildEmail_(data, submissionId) {
  var services = data.services.map(function (service) {
    return '<li><strong>' + safe_(service.name) + '</strong> — ' +
      safe_(service.description || 'No description') + ' (' + safe_(service.priority) + ')</li>';
  }).join('');
  var inspiration = data.brand.inspirationSites.map(function (site) {
    return '<li><a href="' + safe_(site.url) + '">' + safe_(site.url) + '</a>' +
      (site.notes ? ' — ' + safe_(site.notes) : '') + '</li>';
  }).join('');

  return '<div style="font-family:Arial,sans-serif;color:#17221f;max-width:680px;margin:auto">' +
    '<div style="background:#0e2e27;color:#fff;padding:28px;border-radius:14px 14px 0 0">' +
    '<div style="color:#a8e3cf;font-size:12px;text-transform:uppercase;letter-spacing:1px">New website intake</div>' +
    '<h1 style="margin:8px 0 0;font-size:30px">' + safe_(data.business.name) + '</h1></div>' +
    '<div style="padding:28px;border:1px solid #dfe5e0;border-top:0">' +
    emailSection_('Contact', safe_(data.contact.name) + '<br>' + safe_(data.contact.email) + '<br>' + safe_(data.contact.phone)) +
    emailSection_('Business', '<strong>Industry:</strong> ' + safe_(data.business.industry) + '<br><br>' + safe_(data.business.description)) +
    emailSection_('Services / products', '<ul>' + services + '</ul>') +
    emailSection_('Customers', safe_(data.customers.typicalCustomers)) +
    emailSection_('Primary website goal', safe_(data.websiteGoals.goals.join(', ')) + '<br><strong>Primary CTA:</strong> ' + safe_(data.websiteGoals.primaryAction)) +
    emailSection_('Features', safe_(data.features.join(', ') || 'None selected')) +
    emailSection_('Brand assets', safe_(data.brand.assets.map(function (asset) { return asset.name; }).join(', ') || 'None attached')) +
    emailSection_('Inspiration', inspiration ? '<ul>' + inspiration + '</ul>' : 'None provided') +
    emailSection_('Competitors', safe_(data.competitors.join(', ') || 'None provided')) +
    emailSection_('Additional notes', safe_(data.additionalNotes || 'None')) +
    '<p style="margin-top:28px;color:#718079;font-size:12px">Submission ID: ' + submissionId + '</p></div></div>';
}

function emailSection_(title, content) {
  return '<div style="margin:0 0 24px"><h2 style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#32715f;margin:0 0 8px">' +
    title + '</h2><div style="font-size:14px;line-height:1.6">' + content + '</div></div>';
}

function safe_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
