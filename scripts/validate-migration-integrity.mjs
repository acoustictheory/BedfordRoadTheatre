import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve(process.argv[2] || 'migration-exports/complete-database-v2.json');
const reportPath = path.resolve(process.argv[3] || 'migration-exports/migration-integrity-report.json');
const sourceBytes = fs.readFileSync(sourcePath);
const source = JSON.parse(sourceBytes.toString('utf8'));
const failures = [];
const warnings = [];

const rows = table => source[table]?.records || [];
const idFields = new Map();
const ids = (table, field) => {
  const key = `${table}.${field}`;
  if (!idFields.has(key)) idFields.set(key, new Set(rows(table).map(row => String(row[field] || '')).filter(Boolean)));
  return idFields.get(key);
};

function fail(code, message, details = {}) { failures.push({ code, message, ...details }); }
function warn(code, message, details = {}) { warnings.push({ code, message, ...details }); }

function unique(table, field) {
  const seen = new Set();
  for (const [index, row] of rows(table).entries()) {
    const value = String(row[field] || '');
    if (!value) fail('MISSING_ID', `${table} row ${index + 1} has no ${field}.`, { table, field, row: index + 1 });
    else if (seen.has(value)) fail('DUPLICATE_ID', `${table}.${field} contains duplicate ${value}.`, { table, field, value });
    seen.add(value);
  }
}

function reference(fromTable, fromField, toTable, toField, { optional = true } = {}) {
  const targets = ids(toTable, toField);
  for (const [index, row] of rows(fromTable).entries()) {
    const value = String(row[fromField] || '');
    if (!value && optional) continue;
    if (!value || !targets.has(value)) fail('BROKEN_REFERENCE', `${fromTable}.${fromField} points to missing ${toTable}.${toField}: ${value || '(blank)'}.`, { fromTable, fromField, toTable, toField, value, row: index + 1 });
  }
}

const primaryKeys = {
  Settings:'SettingID', AnnouncementReads:'AnnouncementReadID', MusicalInterest:'MusicalInterestID', AuditionBookings:'AuditionBookingID',
  BlockingMusicMaps:'MusicMapID', BlockingReferenceMedia:'ReferenceMediaID', BlockingSceneRecordings:'RecordingID', BlockingTimelineMedia:'TimelineMediaID',
  BlockingTimelineMarkers:'TimelineMarkerID', BlockingTimelineKeyframes:'TimelineKeyframeID', BlockingTimelineMotions:'TimelineMotionID', BlockingSections:'SectionID',
  BlockingCues:'CueID', BlockingCharacters:'CharacterID', BlockingGroups:'GroupID', BlockingCast:'BlockingCastID', BlockingScriptAnchors:'AnchorID',
  BlockingBackgrounds:'BackgroundID', BlockingSnapshots:'SnapshotID', BlockingPlacements:'PlacementID', BlockingObjects:'ObjectID', BlockingMovements:'MovementID',
  BlockingSnapshotVersions:'VersionID', BlockingActivity:'BlockingActivityID', CostumeCharacters:'CharacterID', CostumeChanges:'CostumeChangeID',
  CostumeMeasurements:'MeasurementID', CostumeFittings:'FittingID', CostumePieces:'CostumePieceID', CostumeDeadlines:'CostumeDeadlineID', CostumeImages:'CostumeImageID',
  CostumeSuggestions:'CostumeSuggestionID', CostumeActivity:'CostumeActivityID', ScenicSets:'SetID', ScenicElements:'ScenicElementID', ScenicTransitions:'ScenicTransitionID',
  ScenicDeadlines:'ScenicDeadlineID', ScenicImages:'ScenicImageID', ScenicSuggestions:'ScenicSuggestionID', ScenicActivity:'ScenicActivityID',
  PropsInventory:'PropID', PropsPresets:'PresetID', PropsDeadlines:'PropsDeadlineID', PropsImages:'PropsImageID', PropsSuggestions:'PropsSuggestionID', PropsActivity:'PropsActivityID',
  DepartmentRequests:'DepartmentRequestID', Productions:'ProductionID', Users:'UserID', Profiles:'ProfileID', Departments:'DepartmentID', UserDepartments:'UserDepartmentID',
  Permissions:'PermissionID', PermissionGroups:'PermissionGroupID', GroupPermissions:'GroupPermissionID', UserPermissionGroups:'UserPermissionGroupID',
  RegistrationCodes:'RegistrationCodeID', Announcements:'AnnouncementID', AnnouncementAudiences:'AnnouncementAudienceID', Acknowledgements:'AcknowledgementID',
  Events:'EventID', Tasks:'TaskID', PageNotes:'NoteID', NoteHistory:'NoteHistoryID', JournalEntries:'JournalEntryID', JournalFeedback:'JournalFeedbackID',
  Resources:'ResourceID', Tracks:'TrackID', DepartmentItems:'DepartmentItemID', Files:'FileID', ResetRequests:'ResetRequestID', AuditLog:'AuditID'
};
for (const [table, field] of Object.entries(primaryKeys)) if (rows(table).length) unique(table, field);

// Identity, authorization, registration, and production ownership.
reference('Profiles', 'UserID', 'Users', 'UserID', { optional:false });
reference('UserDepartments', 'UserID', 'Users', 'UserID', { optional:false });
reference('UserDepartments', 'DepartmentID', 'Departments', 'DepartmentID', { optional:false });
reference('UserDepartments', 'ProductionID', 'Productions', 'ProductionID', { optional:false });
reference('UserPermissionGroups', 'UserID', 'Users', 'UserID', { optional:false });
reference('UserPermissionGroups', 'PermissionGroupID', 'PermissionGroups', 'PermissionGroupID', { optional:false });
reference('GroupPermissions', 'PermissionGroupID', 'PermissionGroups', 'PermissionGroupID', { optional:false });
reference('GroupPermissions', 'PermissionID', 'Permissions', 'PermissionID', { optional:false });
reference('DepartmentRequests', 'UserID', 'Users', 'UserID', { optional:false });
reference('DepartmentRequests', 'DepartmentID', 'Departments', 'DepartmentID', { optional:false });

for (const table of Object.keys(source)) {
  if (rows(table).some(row => Object.hasOwn(row, 'ProductionID'))) reference(table, 'ProductionID', 'Productions', 'ProductionID');
}

// Recruitment records must retain their production and booked slot identity.
for (const row of rows('AuditionBookings')) {
  if (!row.SlotKey || !row.AuditionDate || !row.StartTime || !row.EndTime) fail('INVALID_AUDITION', `Audition ${row.AuditionBookingID || '(unknown)'} is missing its slot date or time.`, { id:row.AuditionBookingID });
}
for (const row of rows('MusicalInterest')) {
  if (!row.FirstName || !row.LastName || !row.SubmittedAt) fail('INVALID_INTEREST', `Musical-interest record ${row.MusicalInterestID || '(unknown)'} is incomplete.`, { id:row.MusicalInterestID });
}

// Blocking relationships.
reference('BlockingCast', 'UserID', 'Users', 'UserID');
reference('BlockingCast', 'CharacterID', 'BlockingCharacters', 'CharacterID', { optional:false });
reference('BlockingSnapshots', 'AnchorID', 'BlockingScriptAnchors', 'AnchorID');
reference('BlockingSnapshots', 'BackgroundID', 'BlockingBackgrounds', 'BackgroundID');
reference('BlockingPlacements', 'SnapshotID', 'BlockingSnapshots', 'SnapshotID', { optional:false });
reference('BlockingPlacements', 'BlockingCastID', 'BlockingCast', 'BlockingCastID', { optional:false });
reference('BlockingObjects', 'SnapshotID', 'BlockingSnapshots', 'SnapshotID', { optional:false });
reference('BlockingMovements', 'SnapshotID', 'BlockingSnapshots', 'SnapshotID', { optional:false });
reference('BlockingSnapshotVersions', 'SnapshotID', 'BlockingSnapshots', 'SnapshotID', { optional:false });

// Costume, scenic, and props relationships.
reference('CostumeChanges', 'CharacterID', 'CostumeCharacters', 'CharacterID', { optional:false });
reference('CostumeMeasurements', 'CharacterID', 'CostumeCharacters', 'CharacterID', { optional:false });
reference('CostumeFittings', 'CharacterID', 'CostumeCharacters', 'CharacterID', { optional:false });
reference('CostumePieces', 'CharacterID', 'CostumeCharacters', 'CharacterID', { optional:false });
reference('CostumePieces', 'CostumeChangeID', 'CostumeChanges', 'CostumeChangeID');
reference('CostumeDeadlines', 'CharacterID', 'CostumeCharacters', 'CharacterID');
reference('CostumeImages', 'CharacterID', 'CostumeCharacters', 'CharacterID');
reference('CostumeImages', 'CostumePieceID', 'CostumePieces', 'CostumePieceID');
reference('ScenicElements', 'SetID', 'ScenicSets', 'SetID', { optional:false });
reference('ScenicTransitions', 'SetID', 'ScenicSets', 'SetID');
reference('ScenicDeadlines', 'SetID', 'ScenicSets', 'SetID');
reference('ScenicImages', 'SetID', 'ScenicSets', 'SetID');
reference('ScenicImages', 'ScenicElementID', 'ScenicElements', 'ScenicElementID');
reference('PropsPresets', 'PropID', 'PropsInventory', 'PropID', { optional:false });
reference('PropsDeadlines', 'PropID', 'PropsInventory', 'PropID');
reference('PropsImages', 'PropID', 'PropsInventory', 'PropID');

// Shared production content.
reference('AnnouncementAudiences', 'AnnouncementID', 'Announcements', 'AnnouncementID', { optional:false });
reference('AnnouncementReads', 'AnnouncementID', 'Announcements', 'AnnouncementID', { optional:false });
reference('AnnouncementReads', 'UserID', 'Users', 'UserID', { optional:false });
reference('Tasks', 'DepartmentID', 'Departments', 'DepartmentID');
reference('JournalEntries', 'StudentUserID', 'Users', 'UserID', { optional:false });
reference('JournalFeedback', 'JournalEntryID', 'JournalEntries', 'JournalEntryID', { optional:false });

const userNames = new Set();
for (const row of rows('Users')) {
  const normalized = String(row.Username || '').trim().toLowerCase();
  if (!normalized) fail('MISSING_USERNAME', `User ${row.UserID} has no username.`, { userId:row.UserID });
  else if (userNames.has(normalized)) fail('DUPLICATE_USERNAME', `Username ${normalized} occurs more than once.`, { username:normalized });
  userNames.add(normalized);
}
if (rows('Users').length !== rows('Profiles').length) warn('IDENTITY_COUNT', 'User and profile counts differ.', { users:rows('Users').length, profiles:rows('Profiles').length });

const report = {
  checkedAt:new Date().toISOString(), sourcePath, sourceSha256:crypto.createHash('sha256').update(sourceBytes).digest('hex'),
  tables:Object.keys(source).length, rows:Object.values(source).reduce((sum, table) => sum + (table.records?.length || 0), 0),
  criticalCounts:{ users:rows('Users').length, profiles:rows('Profiles').length, auditions:rows('AuditionBookings').length, interests:rows('MusicalInterest').length,
    blockingSnapshots:rows('BlockingSnapshots').length, blockingPlacements:rows('BlockingPlacements').length, props:rows('PropsInventory').length,
    costumes:rows('CostumeCharacters').length, costumePieces:rows('CostumePieces').length, scenicSets:rows('ScenicSets').length },
  failures, warnings, valid:failures.length === 0
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
