/**
 * BEDFORD ROAD MUSICAL — BLOCKING & STAGING HUB v24
 * Scene/song database + interactive visual blocking backend.
 *
 * The seed data contains structure, labels, cast entities, and short anchors.
 * It deliberately does not publish the complete licensed libretto.
 */

var BLOCKING_BUILD = 'blocking-hub-v42-persistent-music-video-avatar-height-20260826';
var BLOCKING_SHEET_HEADERS = {
  BlockingSections: ['SectionID','ProductionID','ActNumber','SceneNumber','SectionType','Title','BookPage','SortOrder','Status','Verified','SourceLabel','UpdatedAt'],
  BlockingCues: ['CueID','ProductionID','ActNumber','SceneNumber','CueNumber','Title','BookPage','Performers','CueType','Optional','SortOrder','Status','Verified','SourceLabel','UpdatedAt'],
  BlockingCharacters: ['CharacterID','ProductionID','CharacterKey','CharacterName','World','CharacterType','Description','SortOrder','Status','UpdatedAt'],
  BlockingGroups: ['GroupID','ProductionID','GroupKey','GroupName','Description','MemberCharacterKeys','SortOrder','Status','UpdatedAt'],
  BlockingCast: ['BlockingCastID','ProductionID','UserID','CharacterID','DisplayLabel','RoleLabel','CastGroup','HeightFeet','AvatarType','TokenBackgroundColor','TokenInitialColor','TokenOutlineColor','Status','SortOrder','AssignedBy','AssignedAt','UpdatedAt'],
  BlockingScriptAnchors: ['AnchorID','ProductionID','SceneNumber','CueNumber','AnchorType','Speaker','TextSnippet','BookPage','Measure','CountLabel','CueWord','SortOrder','VerificationStatus','Notes','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt'],
  BlockingBackgrounds: ['BackgroundID','ProductionID','SceneNumber','Title','FileID','PhotoRef','MimeType','Status','CreatedBy','CreatedAt','UpdatedAt'],
  BlockingSnapshots: ['SnapshotID','ProductionID','SceneNumber','CueNumber','AnchorID','Title','SnapshotType','BackgroundID','Status','LockState','Notes','SortOrder','VersionNumber','CanvasVersion','CreatedBy','CreatedAt','UpdatedBy','UpdatedAt'],
  BlockingPlacements: ['PlacementID','ProductionID','SnapshotID','BlockingCastID','CharacterID','UserID','XPercent','YPercent','Facing','Level','Scale','Visible','Locked','LabelOverride','MovementNote','Counts','UpdatedAt'],
  BlockingObjects: ['ObjectID','ProductionID','SnapshotID','TimelineKey','ObjectType','ShapeType','Label','XPercent','YPercent','WidthPercent','HeightPercent','Rotation','PointsJSON','FillColor','FillOpacity','EdgeColorsJSON','StrokeWidth','ZIndex','TextColor','TextSize','TextBold','LabelVisible','LabelBackground','LabelPosition','Notes','Status','UpdatedAt'],
  BlockingMovements: ['MovementID','ProductionID','FromSnapshotID','ToSnapshotID','BlockingCastID','PathType','PathPointsJSON','StartCue','EndCue','Counts','Notes','Status','UpdatedAt'],
  BlockingSnapshotVersions: ['VersionID','ProductionID','SnapshotID','VersionNumber','StateJSON','CreatedBy','CreatedAt'],
  BlockingTimelineMedia: ['TimelineMediaID','ProductionID','SceneNumber','CueNumber','MediaSource','TrackID','TrackTitle','TrackType','FileID','MimeType','DurationSeconds','RecordingTitle','RecordingID','SourceType','OriginalFilename','RecordedAt','Status','UpdatedBy','UpdatedAt'],
  BlockingSceneRecordings: ['RecordingID','ProductionID','SceneNumber','Title','FileID','MimeType','DurationSeconds','SourceType','OriginalFilename','OriginalMimeType','OriginalByteLength','StoredByteLength','OptimizedForBlocking','OptimizationNote','CreatedBy','CreatedAt','Status','UpdatedAt'],
  BlockingTimelineMarkers: ['TimelineMarkerID','ProductionID','SceneNumber','CueNumber','TimeSeconds','Label','MarkerType','Speaker','DialogueText','Measure','CountLabel','Notes','SortOrder','Status','UpdatedBy','UpdatedAt'],
  BlockingTimelineKeyframes: ['TimelineKeyframeID','ProductionID','SceneNumber','CueNumber','TimeSeconds','Title','StateJSON','Status','UpdatedBy','UpdatedAt'],
  BlockingTimelineMotions: ['TimelineMotionID','ProductionID','SceneNumber','CueNumber','EntityType','EntityKey','Label','MotionType','StartSeconds','EndSeconds','PathJSON','Easing','Status','UpdatedBy','UpdatedAt'],
  BlockingMusicMaps: ['MusicMapID','ProductionID','SceneNumber','CueNumber','MapJSON','VersionNumber','Status','UpdatedBy','UpdatedAt'],
  BlockingReferenceMedia: ['ReferenceMediaID','ProductionID','SceneNumber','CueNumber','Title','FileID','MimeType','DurationSeconds','OffsetSeconds','Status','UpdatedBy','UpdatedAt'],
  BlockingActivity: ['BlockingActivityID','ProductionID','Action','EntityType','EntityID','UserID','DetailsJSON','CreatedAt']
};

function ensureBlockingSheet_(sheetName) {
  var spreadsheet = getDb_();
  var expected = BLOCKING_SHEET_HEADERS[sheetName];
  assert_(expected, 'Unknown blocking sheet: ' + sheetName, 'INVALID_SHEET');
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1,1,1,expected.length).setValues([expected]);
    sheet.setFrozenRows(1);
  } else {
    var current = headers_(sheet);
    expected.forEach(function (header) {
      if (current.indexOf(header) < 0) {
        sheet.getRange(1,current.length + 1).setValue(header);
        current.push(header);
      }
    });
  }

  sheet.getRange(1,1,1,expected.length)
    .setFontWeight('bold')
    .setBackground('#2b1740')
    .setFontColor('#ffffff');

  return sheet;
}

function ensureBlockingSheets_() {
  Object.keys(BLOCKING_SHEET_HEADERS).forEach(ensureBlockingSheet_);
}

function blockingHasPermission_(context, key) {
  return isFullAdmin_(context) || hasPermission_(context, key);
}

function blockingCanEdit_(context) {
  return isFullAdmin_(context)
    || hasPermission_(context,'blocking.edit')
    || hasPermission_(context,'blocking.manage');
}

function blockingCanManage_(context) {
  return isFullAdmin_(context) || hasPermission_(context,'blocking.manage');
}

function blockingCanAudit_(context) {
  return isFullAdmin_(context)
    || hasPermission_(context,'blocking.audit')
    || hasPermission_(context,'blocking.manage');
}

function requireBlockingEdit_(context) {
  assert_(blockingCanEdit_(context), 'Blocking editor permission is required.', 'FORBIDDEN');
}

function requireBlockingManage_(context) {
  assert_(blockingCanManage_(context), 'Blocking manager permission is required.', 'FORBIDDEN');
}

function ensureBlockingPermission_(permissionKey, description) {
  var existing = listRecords_('Permissions', function (record) {
    return String(record.PermissionKey) === String(permissionKey);
  })[0];
  if (existing) return existing.PermissionID;
  var id = uuid_('PERM');
  appendRecord_('Permissions', {
    PermissionID:id,
    PermissionKey:permissionKey,
    Category:'Blocking & Staging',
    Description:description
  });
  return id;
}

function ensureBlockingPermissionGroup_(groupName, description, permissionKeys) {
  var group = listRecords_('PermissionGroups', function (record) {
    return String(record.GroupName) === String(groupName);
  })[0];

  if (!group) {
    group = {
      PermissionGroupID:uuid_('PGRP'),
      GroupName:groupName,
      Description:description,
      Status:'Active'
    };
    appendRecord_('PermissionGroups', group);
  } else {
    updateRecordByRow_('PermissionGroups', group._row, {
      Description:description,
      Status:'Active'
    });
  }

  permissionKeys.forEach(function (permissionKey) {
    var permission = listRecords_('Permissions', function (record) {
      return String(record.PermissionKey) === String(permissionKey);
    })[0];
    if (!permission) return;

    var link = listRecords_('GroupPermissions', function (record) {
      return String(record.PermissionGroupID) === String(group.PermissionGroupID)
        && String(record.PermissionID) === String(permission.PermissionID);
    })[0];

    if (!link) {
      appendRecord_('GroupPermissions', {
        GroupPermissionID:uuid_('GP'),
        PermissionGroupID:group.PermissionGroupID,
        PermissionID:permission.PermissionID,
        Allowed:true
      });
    } else if (!bool_(link.Allowed)) {
      updateRecordByRow_('GroupPermissions', link._row, {Allowed:true});
    }
  });

  return group.PermissionGroupID;
}

function addBlockingPermissionsToExistingGroup_(groupName, permissionKeys) {
  var group = listRecords_('PermissionGroups', function (record) {
    return normalize_(record.GroupName) === normalize_(groupName);
  })[0];
  if (!group) return;

  permissionKeys.forEach(function (permissionKey) {
    var permission = listRecords_('Permissions', function (record) {
      return String(record.PermissionKey) === String(permissionKey);
    })[0];
    if (!permission) return;
    var link = listRecords_('GroupPermissions', function (record) {
      return String(record.PermissionGroupID) === String(group.PermissionGroupID)
        && String(record.PermissionID) === String(permission.PermissionID);
    })[0];
    if (!link) {
      appendRecord_('GroupPermissions', {
        GroupPermissionID:uuid_('GP'),
        PermissionGroupID:group.PermissionGroupID,
        PermissionID:permission.PermissionID,
        Allowed:true
      });
    }
  });
}

function installBlockingPermissionsV24_() {
  ensureBlockingPermission_('blocking.edit','Create and edit blocking snapshots, script anchors, placements, objects, and movement notes.');
  ensureBlockingPermission_('blocking.manage','Manage cast assignments, backgrounds, locking, archives, and blocking structure.');
  ensureBlockingPermission_('blocking.audit','View and restore blocking snapshot history and detailed activity.');

  ensureBlockingPermissionGroup_(
    'Blocking & Staging Editor',
    'Stage-management, choreography, or directing access to record and update official blocking.',
    ['notes.post','blocking.edit']
  );
  ensureBlockingPermissionGroup_(
    'Blocking & Staging Manager',
    'Full Blocking Hub management except platform-wide administrator functions.',
    ['notes.post','blocking.edit','blocking.manage','blocking.audit']
  );

  addBlockingPermissionsToExistingGroup_('Stage Management Lead',['blocking.edit','blocking.manage','blocking.audit']);
}

function blockingFolderKey_(suffix) {
  return 'BLOCKING_HUB_' + suffix + '_' + getActiveProductionId_();
}

function ensureBlockingFolders_() {
  var rootId = getScriptSetting_(blockingFolderKey_('FOLDER_ID'),'');
  var bgId = getScriptSetting_(blockingFolderKey_('BACKGROUNDS_FOLDER_ID'),'');
  var recordingsId = getScriptSetting_(blockingFolderKey_('SCENE_RECORDINGS_FOLDER_ID'),'');
  var root = null;
  var backgrounds = null;
  var recordings = null;

  if (rootId) { try { root = DriveApp.getFolderById(rootId); } catch (error) {} }
  if (!root) {
    var production = getActiveProduction_();
    var parentId = getScriptSetting_('PRODUCTION_FILES_FOLDER_ID','');
    var parent = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
    root = parent.createFolder(String(production.Title || 'Bedford Musical') + ' - Blocking & Staging');
    setScriptSetting_(blockingFolderKey_('FOLDER_ID'),root.getId());
  }

  if (bgId) { try { backgrounds = DriveApp.getFolderById(bgId); } catch (error) {} }
  if (!backgrounds) {
    backgrounds = root.createFolder('Stage Backgrounds & Ground Plans');
    setScriptSetting_(blockingFolderKey_('BACKGROUNDS_FOLDER_ID'),backgrounds.getId());
  }

  if (recordingsId) { try { recordings = DriveApp.getFolderById(recordingsId); } catch (error) {} }
  if (!recordings) {
    recordings = root.createFolder('Scene Rehearsal Audio');
    setScriptSetting_(blockingFolderKey_('SCENE_RECORDINGS_FOLDER_ID'),recordings.getId());
  }

  return {
    folderId:root.getId(),
    folderUrl:root.getUrl(),
    backgroundsFolderId:backgrounds.getId(),
    backgroundsFolderUrl:backgrounds.getUrl(),
    sceneRecordingsFolderId:recordings.getId(),
    sceneRecordingsFolderUrl:recordings.getUrl()
  };
}

function blockingActivity_(context, action, entityType, entityId, details) {
  ensureBlockingSheet_('BlockingActivity');
  appendRecord_('BlockingActivity', {
    BlockingActivityID:uuid_('BACT'),
    ProductionID:getActiveProductionId_(),
    Action:action,
    EntityType:entityType,
    EntityID:entityId || '',
    UserID:context && context.userId || 'SYSTEM',
    DetailsJSON:jsonStringify_(details || {}),
    CreatedAt:nowIso_()
  });
}

function seedBlockingStructureV24_() {
  var productionId = getActiveProductionId_();
  var sceneByNumber = {};
  var charByKey = {};

  DESCENDANTS_BLOCKING_SCENES_V24.forEach(function (scene) {
    var existing = listRecords_('BlockingSections', function (record) {
      return String(record.ProductionID) === String(productionId)
        && Number(record.SceneNumber) === Number(scene.SceneNumber);
    })[0];

    var values = {
      ProductionID:productionId,
      ActNumber:scene.ActNumber,
      SceneNumber:scene.SceneNumber,
      SectionType:'Scene',
      Title:scene.Title,
      BookPage:scene.BookPage,
      SortOrder:scene.SortOrder,
      Status:'Active',
      Verified:true,
      SourceLabel:'Libretto/Vocal Book contents — normalized v24',
      UpdatedAt:nowIso_()
    };

    if (!existing) {
      values.SectionID = uuid_('BSEC');
      appendRecord_('BlockingSections',values);
      sceneByNumber[String(scene.SceneNumber)] = values;
    } else {
      updateRecordByRow_('BlockingSections',existing._row,values);
      sceneByNumber[String(scene.SceneNumber)] = existing;
    }
  });

  DESCENDANTS_BLOCKING_CUES_V24.forEach(function (cue) {
    var existing = listRecords_('BlockingCues', function (record) {
      return String(record.ProductionID) === String(productionId)
        && Number(record.CueNumber) === Number(cue.CueNumber);
    })[0];

    var values = {
      ProductionID:productionId,
      ActNumber:cue.ActNumber,
      SceneNumber:cue.SceneNumber,
      CueNumber:cue.CueNumber,
      Title:cue.Title,
      BookPage:cue.BookPage,
      Performers:cue.Performers,
      CueType:cue.CueType,
      Optional:cue.Optional,
      SortOrder:cue.SortOrder,
      Status:'Active',
      Verified:true,
      SourceLabel:cue.CueNumber === 45
        ? 'Production note — optional Entr’acte before Scene 13'
        : 'Libretto/Vocal Book contents — normalized v24',
      UpdatedAt:nowIso_()
    };

    if (!existing) {
      values.CueID = uuid_('BCUE');
      appendRecord_('BlockingCues',values);
    } else {
      updateRecordByRow_('BlockingCues',existing._row,values);
    }
  });

  DESCENDANTS_BLOCKING_CHARACTERS_V24.forEach(function (character) {
    var existing = listRecords_('BlockingCharacters', function (record) {
      return String(record.ProductionID) === String(productionId)
        && String(record.CharacterKey) === String(character.CharacterKey);
    })[0];
    var values = {
      ProductionID:productionId,
      CharacterKey:character.CharacterKey,
      CharacterName:character.CharacterName,
      World:character.World,
      CharacterType:character.CharacterType,
      Description:character.Description,
      SortOrder:character.SortOrder,
      Status:'Active',
      UpdatedAt:nowIso_()
    };
    if (!existing) {
      values.CharacterID = uuid_('BCHR');
      appendRecord_('BlockingCharacters',values);
      charByKey[character.CharacterKey] = values.CharacterID;
    } else {
      updateRecordByRow_('BlockingCharacters',existing._row,values);
      charByKey[character.CharacterKey] = existing.CharacterID;
    }
  });

  DESCENDANTS_BLOCKING_GROUPS_V24.forEach(function (group) {
    var existing = listRecords_('BlockingGroups', function (record) {
      return String(record.ProductionID) === String(productionId)
        && String(record.GroupKey) === String(group.GroupKey);
    })[0];
    var values = {
      ProductionID:productionId,
      GroupKey:group.GroupKey,
      GroupName:group.GroupName,
      Description:group.Description,
      MemberCharacterKeys:group.MemberCharacterKeys,
      SortOrder:group.SortOrder,
      Status:'Active',
      UpdatedAt:nowIso_()
    };
    if (!existing) {
      values.GroupID = uuid_('BGRP');
      appendRecord_('BlockingGroups',values);
    } else {
      updateRecordByRow_('BlockingGroups',existing._row,values);
    }
  });

  // Reliable navigation anchors only. Exact dialogue/lyric anchors are added in the private editor.
  DESCENDANTS_BLOCKING_SCENES_V24.forEach(function (scene) {
    ensureSeedBlockingAnchor_(productionId, scene.SceneNumber, '', 'Scene Start', '', 'Scene ' + scene.SceneNumber + ': ' + scene.Title, scene.BookPage, scene.SortOrder * 1000);
  });

  DESCENDANTS_BLOCKING_CUES_V24.forEach(function (cue) {
    ensureSeedBlockingAnchor_(productionId, cue.SceneNumber, cue.CueNumber, 'Music Cue', cue.Performers, '#' + cue.CueNumber + ' ' + cue.Title, cue.BookPage, cue.SortOrder * 1000 + 100);
  });
}

function ensureSeedBlockingAnchor_(productionId, sceneNumber, cueNumber, type, speaker, text, bookPage, sortOrder) {
  var existing = listRecords_('BlockingScriptAnchors', function (record) {
    return String(record.ProductionID) === String(productionId)
      && String(record.AnchorType) === String(type)
      && String(record.SceneNumber) === String(sceneNumber)
      && String(record.CueNumber) === String(cueNumber)
      && String(record.TextSnippet) === String(text);
  })[0];
  if (existing) return;

  appendRecord_('BlockingScriptAnchors', {
    AnchorID:uuid_('BANC'),
    ProductionID:productionId,
    SceneNumber:sceneNumber || '',
    CueNumber:cueNumber || '',
    AnchorType:type,
    Speaker:speaker || '',
    TextSnippet:text,
    BookPage:bookPage || '',
    Measure:'',
    CountLabel:'',
    CueWord:'',
    SortOrder:sortOrder || 0,
    VerificationStatus:'Verified',
    Notes:'Structural anchor seeded from the normalized source.',
    CreatedBy:'SYSTEM',
    CreatedAt:nowIso_(),
    UpdatedBy:'SYSTEM',
    UpdatedAt:nowIso_()
  });
}

function installBlockingHubValidationsV24_() {
  var spreadsheet = getDb_();
  function rule(values) {
    return SpreadsheetApp.newDataValidation().requireValueInList(values,true).setAllowInvalid(true).build();
  }
  [
    ['BlockingScriptAnchors','AnchorType',['Scene Start','Dialogue','Lyric','Stage Direction','Music Cue','Measure','Count','Transition','Other']],
    ['BlockingScriptAnchors','VerificationStatus',['Verified','Needs Review','Draft']],
    ['BlockingSnapshots','SnapshotType',['Actor Blocking','Choreography','Scenic Transition','Crew Traffic','Prop Movement','Picture/Tableau']],
    ['BlockingSnapshots','Status',['Draft','Current','Archived']],
    ['BlockingSnapshots','LockState',['Unlocked','Locked']],
    ['BlockingPlacements','Facing',['Front','Upstage','Stage Left','Stage Right','Diagonal UL','Diagonal UR','Diagonal DL','Diagonal DR']],
    ['BlockingPlacements','Level',['Standing','Sitting','Kneeling','Crouching','Lying','Platform','Stairs','Offstage']],
    ['BlockingObjects','ObjectType',['Set Piece','Furniture','Prop','Spike','Entrance','Exit','Text Note','Zone']]
  ].forEach(function (config) {
    var sheet = spreadsheet.getSheetByName(config[0]);
    if (!sheet) return;
    var hs = headers_(sheet);
    var index = hs.indexOf(config[1]);
    if (index < 0) return;
    sheet.getRange(2,index+1,Math.max(1,sheet.getMaxRows()-1),1).setDataValidation(rule(config[2]));
  });
}

function installBlockingAndStagingHubV24() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  seedBlockingStructureV24_();
  installBlockingHubValidationsV24_();
  var folders = ensureBlockingFolders_();
  Logger.log('Blocking & Staging Hub v24 installed.');
  Logger.log('Blocking Drive folder: ' + folders.folderUrl);
  return {
    success:true,
    build:BLOCKING_BUILD,
    scenes:listRecords_('BlockingSections',function(r){return String(r.ProductionID)===String(getActiveProductionId_());}).length,
    cues:listRecords_('BlockingCues',function(r){return String(r.ProductionID)===String(getActiveProductionId_());}).length,
    characters:listRecords_('BlockingCharacters',function(r){return String(r.ProductionID)===String(getActiveProductionId_());}).length,
    folderUrl:folders.folderUrl
  };
}

function blockingV25MigrationKey_() {
  return 'BLOCKING_CANVAS_V25_MIGRATED_' + String(getActiveProductionId_());
}

function migrateBlockingCanvasToV25_() {
  var productionId=getActiveProductionId_();
  var key=blockingV25MigrationKey_();
  if(String(getScriptSetting_(key,''))==='YES'){
    return {migrated:false,reason:'already-migrated'};
  }
  var modernSnapshots=listRecords_('BlockingSnapshots',function(r){
    var v=String(r.CanvasVersion||'');
    return String(r.ProductionID)===String(productionId) && (v.indexOf('v25-')===0 || v.indexOf('v26-')===0);
  });
  if(modernSnapshots.length){
    setScriptSetting_(key,'YES');
    return {migrated:false,reason:'modern-canvas-detected'};
  }

  var placementCount=0;
  listRecords_('BlockingPlacements',function(r){
    return String(r.ProductionID)===String(productionId);
  }).forEach(function(record){
    updateRecordByRow_('BlockingPlacements',record._row,{
      YPercent:Math.max(0,Math.min(50,number_(record.YPercent,50)*0.5)),
      UpdatedAt:nowIso_()
    });
    placementCount++;
  });

  var objectCount=0;
  listRecords_('BlockingObjects',function(r){
    return String(r.ProductionID)===String(productionId);
  }).forEach(function(record){
    updateRecordByRow_('BlockingObjects',record._row,{
      YPercent:Math.max(0,Math.min(50,number_(record.YPercent,50)*0.5)),
      HeightPercent:Math.max(0.5,Math.min(50,number_(record.HeightPercent,8)*0.5)),
      ShapeType:record.ShapeType||'Rectangle',
      FillColor:record.FillColor||'#5e000f',
      FillOpacity:record.FillOpacity===''||record.FillOpacity===null?0.72:record.FillOpacity,
      StrokeWidth:record.StrokeWidth||3,
      ZIndex:record.ZIndex||0,
      UpdatedAt:nowIso_()
    });
    objectCount++;
  });

  var snapshotCount=0;
  listRecords_('BlockingSnapshots',function(r){
    return String(r.ProductionID)===String(productionId);
  }).forEach(function(record){
    updateRecordByRow_('BlockingSnapshots',record._row,{
      CanvasVersion:'v25-floor',
      UpdatedAt:nowIso_()
    });
    snapshotCount++;
  });

  setScriptSetting_(key,'YES');
  return {migrated:true,placements:placementCount,objects:objectCount,snapshots:snapshotCount};
}

function upgradeBlockingStudioV25() {
  ensureBlockingSheets_();
  installBlockingHubValidationsV24_();
  var migration=migrateBlockingCanvasToV25_();
  Logger.log('Blocking & Staging Studio v25 upgraded.');
  Logger.log(JSON.stringify(migration));
  return {success:true,build:BLOCKING_BUILD,migration:migration};
}

function installBlockingAndStagingHubV25() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  seedBlockingStructureV24_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  var migration=migrateBlockingCanvasToV25_();
  return {
    success:true,
    build:BLOCKING_BUILD,
    migration:migration,
    scenes:listRecords_('BlockingSections',function(r){return String(r.ProductionID)===String(getActiveProductionId_());}).length,
    cues:listRecords_('BlockingCues',function(r){return String(r.ProductionID)===String(getActiveProductionId_());}).length,
    folderUrl:folders.folderUrl
  };
}


function blockingV26MigrationKey_() {
  return 'BLOCKING_CANVAS_V26_MIGRATED_' + String(getActiveProductionId_());
}

function blockingV25YToV26_(value) {
  var y=Math.max(0,Math.min(100,number_(value,50)));
  // In v25, the stage/floor split was 50%. In the real Bedford sketch,
  // the downstage lip is about 35.8% of the total auditorium depth.
  if(y<=50) return y * (35.8333333333/50);
  return 35.8333333333 + (y-50) * ((100-35.8333333333)/50);
}

function migrateBlockingCanvasToV26_() {
  var productionId=getActiveProductionId_();
  var key=blockingV26MigrationKey_();
  if(String(getScriptSetting_(key,''))==='YES'){
    return {migrated:false,reason:'already-migrated'};
  }

  var snapshots=listRecords_('BlockingSnapshots',function(r){
    return String(r.ProductionID)===String(productionId);
  });
  var already=snapshots.filter(function(r){return String(r.CanvasVersion||'')==='v26-auditorium';});
  if(snapshots.length && already.length===snapshots.length){
    setScriptSetting_(key,'YES');
    return {migrated:false,reason:'v26-detected'};
  }

  var placementCount=0;
  listRecords_('BlockingPlacements',function(r){
    return String(r.ProductionID)===String(productionId);
  }).forEach(function(record){
    updateRecordByRow_('BlockingPlacements',record._row,{
      YPercent:Math.max(0,Math.min(100,blockingV25YToV26_(record.YPercent))),
      UpdatedAt:nowIso_()
    });
    placementCount++;
  });

  var objectCount=0;
  listRecords_('BlockingObjects',function(r){
    return String(r.ProductionID)===String(productionId);
  }).forEach(function(record){
    // PointsJSON uses logical local coordinates and is intentionally left alone;
    // that preserves the actual drawn size. HeightPercent is rescaled for older
    // percentage-only objects because the canvas height changed 1000 -> 1800.
    updateRecordByRow_('BlockingObjects',record._row,{
      YPercent:Math.max(0,Math.min(100,blockingV25YToV26_(record.YPercent))),
      HeightPercent:Math.max(0.25,Math.min(100,number_(record.HeightPercent,8)*(1000/1800))),
      UpdatedAt:nowIso_()
    });
    objectCount++;
  });

  var snapshotCount=0;
  snapshots.forEach(function(record){
    updateRecordByRow_('BlockingSnapshots',record._row,{
      CanvasVersion:'v26-auditorium',
      UpdatedAt:nowIso_()
    });
    snapshotCount++;
  });

  setScriptSetting_(key,'YES');
  return {migrated:true,placements:placementCount,objects:objectCount,snapshots:snapshotCount};
}

function upgradeBlockingStudioV26() {
  ensureBlockingSheets_();
  installBlockingHubValidationsV24_();
  var v25=migrateBlockingCanvasToV25_();
  var v26=migrateBlockingCanvasToV26_();
  Logger.log('Blocking & Staging Studio v26 auditorium layout upgraded.');
  Logger.log(JSON.stringify({v25:v25,v26:v26}));
  return {success:true,build:BLOCKING_BUILD,v25:v25,v26:v26};
}

function installBlockingAndStagingHubV26() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  seedBlockingStructureV24_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  var v25=migrateBlockingCanvasToV25_();
  var v26=migrateBlockingCanvasToV26_();
  return {
    success:true,
    build:BLOCKING_BUILD,
    v25:v25,
    v26:v26,
    scenes:listRecords_('BlockingSections',function(r){return String(r.ProductionID)===String(getActiveProductionId_());}).length,
    cues:listRecords_('BlockingCues',function(r){return String(r.ProductionID)===String(getActiveProductionId_());}).length,
    folderUrl:folders.folderUrl
  };
}

function blockingExtractProfilePhotoFileId_(value) {
  var text = String(value || '').trim();
  if (!text) return '';
  if (text.indexOf('drivefile:') === 0) return text.substring('drivefile:'.length);
  var query = text.match(/[?&]id=([^&#]+)/i);
  if (query && query[1]) {
    try { return decodeURIComponent(query[1]); } catch (error) { return query[1]; }
  }
  var path = text.match(/\/d\/([^/]+)/i);
  return path && path[1] ? path[1] : '';
}

function blockingProfileHasPhoto_(profile) {
  if (!profile) return false;
  return !!(String(profile.PhotoFileID || '').trim() || blockingExtractProfilePhotoFileId_(profile.PhotoURL || '') || String(profile.PhotoURL || '').trim());
}

function blockingChooseProfile_(rows) {
  var list = (rows || []).slice();
  list.sort(function(a,b) {
    var ah = blockingProfileHasPhoto_(a), bh = blockingProfileHasPhoto_(b);
    if (ah !== bh) return ah ? -1 : 1;
    return String(b.UpdatedAt || '').localeCompare(String(a.UpdatedAt || ''));
  });
  return list[0] || {};
}


/**
 * v32 cast-photo resolver.
 *
 * Blocking Studio asks for a BlockingCastID, not an arbitrary Drive file ID.
 * The server resolves BlockingCast -> UserID -> best Profiles row -> Drive file.
 * This keeps private Workspace files private and removes the fragile requirement
 * that PhotoFileID has already been copied perfectly into the blocking payload.
 */
function blockingProfileRowsForUser_(userId) {
  return listRecords_('Profiles', function (profile) {
    return String(profile.UserID || '') === String(userId || '');
  });
}

function blockingProfilePhotoCandidateIds_(profile) {
  var ids = [];
  function add(value) {
    value = String(value || '').trim();
    if (value && ids.indexOf(value) < 0) ids.push(value);
  }
  add(profile && profile.PhotoFileID);
  add(blockingExtractProfilePhotoFileId_(profile && profile.PhotoURL));
  return ids;
}

function blockingPhotoProfileCandidates_(userId) {
  var rows = blockingProfileRowsForUser_(userId);
  rows.sort(function (a, b) {
    var ah = blockingProfilePhotoCandidateIds_(a).length > 0;
    var bh = blockingProfilePhotoCandidateIds_(b).length > 0;
    if (ah !== bh) return ah ? -1 : 1;
    return String(b.UpdatedAt || '').localeCompare(String(a.UpdatedAt || ''));
  });
  return rows;
}

function blockingReadProfilePhoto_(context, profile) {
  if (!profile) return null;

  if (typeof profilePhotoPermission_ === 'function') {
    if (!profilePhotoPermission_(context, profile)) return null;
  }

  var ids = blockingProfilePhotoCandidateIds_(profile);
  for (var i = 0; i < ids.length; i++) {
    var fileId = ids[i];
    try {
      var file = DriveApp.getFileById(fileId);
      if (file.isTrashed()) continue;

      var blob = file.getBlob();
      var mimeType = String(blob.getContentType() || file.getMimeType() || '').toLowerCase();
      if (mimeType.indexOf('image/') !== 0) continue;

      var bytes = blob.getBytes();
      // Profile uploads are normally compressed well below this. The generous
      // guard prevents a bad legacy file from creating an enormous JSON reply.
      if (bytes.length > 5 * 1024 * 1024) continue;

      return {
        hasPhoto: true,
        fileId: fileId,
        mimeType: mimeType,
        byteLength: bytes.length,
        updatedAt: profile.UpdatedAt || file.getLastUpdated().toISOString(),
        dataUrl: 'data:' + mimeType + ';base64,' + Utilities.base64Encode(bytes)
      };
    } catch (error) {
      // Try the next profile/file candidate rather than failing the whole page.
    }
  }

  var external = String(profile.PhotoURL || '').trim();
  if (/^https?:\/\//i.test(external) && !blockingExtractProfilePhotoFileId_(external)) {
    return {
      hasPhoto: true,
      fileId: '',
      mimeType: '',
      byteLength: 0,
      updatedAt: profile.UpdatedAt || '',
      externalUrl: external
    };
  }

  return null;
}

function getBlockingCastPhotoData_(context, payload) {
  var productionId = getActiveProductionId_();
  var blockingCastId = sanitizeText_(payload.blockingCastId || '', 180);
  assert_(blockingCastId, 'Blocking cast assignment was not specified.', 'MISSING_CAST');

  var cast = listRecords_('BlockingCast', function (row) {
    return String(row.ProductionID || '') === String(productionId)
      && String(row.BlockingCastID || '') === String(blockingCastId)
      && String(row.Status || 'Active') !== 'Archived';
  })[0];

  assert_(cast, 'Blocking cast assignment was not found.', 'NOT_FOUND');

  var userId = String(cast.UserID || '').trim();
  if (!userId) {
    return { hasPhoto: false, reason: 'NO_USER', blockingCastId: blockingCastId };
  }

  var profiles = blockingPhotoProfileCandidates_(userId);
  for (var i = 0; i < profiles.length; i++) {
    var photo = blockingReadProfilePhoto_(context, profiles[i]);
    if (photo) {
      photo.blockingCastId = blockingCastId;
      photo.userId = userId;
      return photo;
    }
  }

  return {
    hasPhoto: false,
    reason: profiles.length ? 'PHOTO_UNREADABLE' : 'NO_PROFILE',
    blockingCastId: blockingCastId,
    userId: userId
  };
}

/**
 * Run manually from Apps Script if a specific cast face still does not appear.
 * It does not alter data. It checks the complete BlockingCast -> Profile -> Drive
 * chain and returns a compact report in the execution result / log.
 */
function diagnoseBlockingCastPhotosV32() {
  var productionId = getActiveProductionId_();
  var castRows = listRecords_('BlockingCast', function (row) {
    return String(row.ProductionID || '') === String(productionId)
      && String(row.Status || 'Active') !== 'Archived';
  });
  var characters = {};
  listRecords_('BlockingCharacters', function (row) {
    return !row.ProductionID || String(row.ProductionID) === String(productionId);
  }).forEach(function (row) { characters[String(row.CharacterID || '')] = row; });

  var report = castRows.map(function (cast) {
    var profiles = blockingPhotoProfileCandidates_(cast.UserID);
    var ids = [];
    profiles.forEach(function (p) {
      blockingProfilePhotoCandidateIds_(p).forEach(function (id) {
        if (ids.indexOf(id) < 0) ids.push(id);
      });
    });
    var readable = false;
    var mimeType = '';
    var byteLength = 0;
    var chosenId = '';
    for (var i = 0; i < ids.length; i++) {
      try {
        var file = DriveApp.getFileById(ids[i]);
        if (file.isTrashed()) continue;
        var blob = file.getBlob();
        var mime = String(blob.getContentType() || file.getMimeType() || '').toLowerCase();
        if (mime.indexOf('image/') !== 0) continue;
        readable = true;
        chosenId = ids[i];
        mimeType = mime;
        byteLength = blob.getBytes().length;
        break;
      } catch (error) {}
    }
    return {
      BlockingCastID: cast.BlockingCastID || '',
      Character: (characters[String(cast.CharacterID || '')] || {}).CharacterName || cast.DisplayLabel || '',
      UserID: cast.UserID || '',
      ProfileRows: profiles.length,
      CandidatePhotoIds: ids.length,
      ReadableDriveImage: readable,
      ChosenFileID: chosenId,
      MimeType: mimeType,
      Bytes: byteLength
    };
  });

  var ok = report.filter(function (r) { return r.ReadableDriveImage; }).length;
  Logger.log(JSON.stringify({ total: report.length, readable: ok, report: report }, null, 2));
  return { total: report.length, readable: ok, report: report };
}

function blockingPeople_() {
  var productionId = getActiveProductionId_();
  var users = listRecords_('Users', function (record) {
    return String(record.Status) === 'Active';
  });
  var profiles = listRecords_('Profiles');
  var profileRowsByUser = {};
  profiles.forEach(function(p){
    var key = String(p.UserID || '');
    if (!key) return;
    if (!profileRowsByUser[key]) profileRowsByUser[key] = [];
    profileRowsByUser[key].push(p);
  });
  var profileByUser = {};
  Object.keys(profileRowsByUser).forEach(function(key){
    profileByUser[key] = blockingChooseProfile_(profileRowsByUser[key]);
  });
  var departments = listRecords_('Departments');
  var depById = {};
  departments.forEach(function(d){depById[String(d.DepartmentID)] = d;});
  var memberships = listRecords_('UserDepartments', function(record){
    return String(record.ProductionID) === String(productionId) && String(record.Status || 'Active') === 'Active';
  });
  var depsByUser = {};
  memberships.forEach(function(m){
    var d=depById[String(m.DepartmentID)];
    if(!d)return;
    if(!depsByUser[String(m.UserID)])depsByUser[String(m.UserID)]=[];
    depsByUser[String(m.UserID)].push({DepartmentID:d.DepartmentID,Name:d.Name,Slug:d.Slug,RoleLabel:m.RoleLabel||'Member'});
  });

  return users.map(function(user){
    var p=profileByUser[String(user.UserID)] || {};
    var photoUrl = String(p.PhotoURL || '').trim();
    var photoFileId = String(p.PhotoFileID || '').trim() || blockingExtractProfilePhotoFileId_(photoUrl);
    if (photoFileId && (!photoUrl || /drive\.google\.com|googleusercontent\.com/i.test(photoUrl))) photoUrl = 'drivefile:' + photoFileId;
    return {
      UserID:user.UserID,
      Username:user.Username,
      DisplayName:p.DisplayName || [p.FirstName,p.LastName].filter(Boolean).join(' ') || user.Username,
      PhotoURL:photoUrl,
      PhotoFileID:photoFileId,
      HasPhoto:!!(photoFileId || photoUrl),
      Departments:depsByUser[String(user.UserID)] || []
    };
  }).sort(function(a,b){return String(a.DisplayName).localeCompare(String(b.DisplayName));});
}

function getBlockingHub_(context, payload) {
  ensureBlockingSheets_();
  var productionId = getActiveProductionId_();
  var includeArchived = bool_(payload.includeArchived);
  function active(sheet) {
    return listRecords_(sheet,function(record){
      return String(record.ProductionID)===String(productionId)
        && (includeArchived || String(record.Status || 'Active') !== 'Archived');
    });
  }

  var sections = active('BlockingSections').sort(function(a,b){return number_(a.SortOrder,0)-number_(b.SortOrder,0);});
  var cues = active('BlockingCues').sort(function(a,b){return number_(a.SortOrder,0)-number_(b.SortOrder,0);});
  var characters = active('BlockingCharacters').sort(function(a,b){return number_(a.SortOrder,0)-number_(b.SortOrder,0);});
  var groups = active('BlockingGroups').sort(function(a,b){return number_(a.SortOrder,0)-number_(b.SortOrder,0);});
  var cast = active('BlockingCast').sort(function(a,b){return number_(a.SortOrder,0)-number_(b.SortOrder,0);});
  var anchors = active('BlockingScriptAnchors').sort(function(a,b){return number_(a.SortOrder,0)-number_(b.SortOrder,0);});
  var backgrounds = active('BlockingBackgrounds').sort(function(a,b){return String(a.Title).localeCompare(String(b.Title));});
  var snapshots = active('BlockingSnapshots').sort(function(a,b){
    return number_(a.SceneNumber,0)-number_(b.SceneNumber,0)
      || number_(a.SortOrder,0)-number_(b.SortOrder,0)
      || String(a.Title).localeCompare(String(b.Title));
  });

  var charactersById={}; characters.forEach(function(c){charactersById[String(c.CharacterID)]=c;});
  var people=blockingPeople_(); var peopleById={}; people.forEach(function(p){peopleById[String(p.UserID)]=p;});

  var castView = cast.map(function(item){
    var character=charactersById[String(item.CharacterID)] || {};
    var person=peopleById[String(item.UserID)] || {};
    return Object.assign({},safeJsonForClient_(item),{
      CharacterName:character.CharacterName || item.DisplayLabel || 'Unassigned',
      CharacterKey:character.CharacterKey || '',
      World:character.World || '',
      PersonName:person.DisplayName || '',
      PhotoURL:person.PhotoURL || '',
      PhotoFileID:person.PhotoFileID || '',
      HasPhoto:!!person.HasPhoto,
      HeightFeet:number_(item.HeightFeet,number_(person.HeightFeet,number_(person.Height,5.7))),
      AvatarType:sanitizeText_(item.AvatarType||person.AvatarType||person.Gender||'Neutral',20),
      TokenBackgroundColor:blockingSafeColor_(item.TokenBackgroundColor,'#5e000f'),
      TokenInitialColor:blockingSafeColor_(item.TokenInitialColor,'#ffffff'),
      TokenOutlineColor:blockingSafeColor_(item.TokenOutlineColor,'#f8b918')
    });
  });

  return {
    build:BLOCKING_BUILD,
    permissions:{
      canView:true,
      canEdit:blockingCanEdit_(context),
      canManage:blockingCanManage_(context),
      canAudit:blockingCanAudit_(context),
      isAdmin:isFullAdmin_(context)
    },
    production:safeJsonForClient_(getActiveProduction_()),
    sections:safeJsonForClient_(sections),
    cues:safeJsonForClient_(cues),
    characters:safeJsonForClient_(characters),
    groups:safeJsonForClient_(groups),
    cast:safeJsonForClient_(castView),
    people:blockingCanManage_(context) ? safeJsonForClient_(people) : [],
    anchors:safeJsonForClient_(anchors),
    backgrounds:safeJsonForClient_(backgrounds),
    snapshots:safeJsonForClient_(snapshots),
    activity:blockingCanAudit_(context) ? safeJsonForClient_(
      active('BlockingActivity').sort(function(a,b){return String(b.CreatedAt).localeCompare(String(a.CreatedAt));}).slice(0,100)
    ) : []
  };
}

function getBlockingViewer_(context) {
  var hub = getBlockingHub_(context, { includeArchived: false });
  var productionId = getActiveProductionId_();
  var placementsBySnapshot = {};
  var objectsBySnapshot = {};
  var timelineByContext = {};

  function addToGroup(groups, key, value) {
    if (!groups[key]) groups[key] = [];
    groups[key].push(value);
  }

  function timelineKey(record) {
    return String(number_(record.SceneNumber, 0)) + '::' + String(record.CueNumber || '');
  }

  listRecords_('BlockingPlacements', function (record) {
    return String(record.ProductionID) === String(productionId);
  }).forEach(function (record) {
    addToGroup(placementsBySnapshot, String(record.SnapshotID), record);
  });

  listRecords_('BlockingObjects', function (record) {
    return String(record.ProductionID) === String(productionId)
      && String(record.Status || 'Active') !== 'Archived';
  }).forEach(function (record) {
    addToGroup(objectsBySnapshot, String(record.SnapshotID), record);
  });

  [
    ['BlockingTimelineMedia', 'Media'],
    ['BlockingTimelineMarkers', 'Markers'],
    ['BlockingTimelineKeyframes', 'Keyframes'],
    ['BlockingTimelineMotions', 'Motions']
  ].forEach(function (config) {
    listRecords_(config[0], function (record) {
      return String(record.ProductionID) === String(productionId)
        && String(record.Status || 'Active') !== 'Archived';
    }).forEach(function (record) {
      var key = timelineKey(record);
      if (!timelineByContext[key]) {
        timelineByContext[key] = { Media: null, Markers: [], Keyframes: [], Motions: [] };
      }
      if (config[1] === 'Media') timelineByContext[key].Media = record;
      else timelineByContext[key][config[1]].push(record);
    });
  });

  hub.snapshots = (hub.snapshots || []).map(function (snapshot) {
    var key = String(snapshot.SnapshotID);
    var timeline = timelineByContext[timelineKey(snapshot)]
      || { Media: null, Markers: [], Keyframes: [], Motions: [] };
    return Object.assign({}, snapshot, {
      Placements: safeJsonForClient_(placementsBySnapshot[key] || []),
      Objects: safeJsonForClient_(objectsBySnapshot[key] || []),
      Timeline: safeJsonForClient_(timeline)
    });
  });

  // The student viewer never needs management-only data.
  hub.people = [];
  hub.activity = [];
  return hub;
}

function getBlockingSnapshot_(context,payload) {
  ensureBlockingSheets_();
  var snapshot = listRecords_('BlockingSnapshots',function(record){
    return String(record.ProductionID)===String(getActiveProductionId_())
      && String(record.SnapshotID)===String(payload.snapshotId);
  })[0];
  assert_(snapshot,'Blocking snapshot not found.','NOT_FOUND');
  return {
    snapshot:safeJsonForClient_(snapshot),
    placements:safeJsonForClient_(listRecords_('BlockingPlacements',function(record){return String(record.SnapshotID)===String(snapshot.SnapshotID); })),
    objects:safeJsonForClient_(listRecords_('BlockingObjects',function(record){return String(record.SnapshotID)===String(snapshot.SnapshotID) && String(record.Status||'Active')!=='Archived';})),
    movements:safeJsonForClient_(listRecords_('BlockingMovements',function(record){return String(record.ToSnapshotID)===String(snapshot.SnapshotID) && String(record.Status||'Active')!=='Archived';}))
  };
}

function snapshotStateForVersion_(snapshotId) {
  var snapshot = listRecords_('BlockingSnapshots',function(record){return String(record.SnapshotID)===String(snapshotId);})[0];
  if(!snapshot)return null;
  return {
    snapshot:safeJsonForClient_(snapshot),
    placements:safeJsonForClient_(listRecords_('BlockingPlacements',function(record){return String(record.SnapshotID)===String(snapshotId);})),
    objects:safeJsonForClient_(listRecords_('BlockingObjects',function(record){return String(record.SnapshotID)===String(snapshotId);})),
    movements:safeJsonForClient_(listRecords_('BlockingMovements',function(record){return String(record.ToSnapshotID)===String(snapshotId);}))
  };
}

function createBlockingVersion_(context,snapshotId) {
  var state=snapshotStateForVersion_(snapshotId);
  if(!state)return;
  var current=state.snapshot;
  appendRecord_('BlockingSnapshotVersions',{
    VersionID:uuid_('BVER'),
    ProductionID:getActiveProductionId_(),
    SnapshotID:snapshotId,
    VersionNumber:number_(current.VersionNumber,1),
    StateJSON:jsonStringify_(state),
    CreatedBy:context.userId,
    CreatedAt:nowIso_()
  });
}

function blockingNormalizeRestoredCanvasV26_(state) {
  if(!state || !state.snapshot)return state;
  var version=String(state.snapshot.CanvasVersion||'');
  if(version==='v26-auditorium')return state;

  // Very old v24 square states first become v25-floor coordinates.
  if(version!=='v25-floor'){
    (state.placements||[]).forEach(function(p){
      p.YPercent=Math.max(0,Math.min(50,number_(p.YPercent,50)*0.5));
    });
    (state.objects||[]).forEach(function(o){
      o.YPercent=Math.max(0,Math.min(50,number_(o.YPercent,50)*0.5));
      o.HeightPercent=Math.max(0.5,Math.min(50,number_(o.HeightPercent,8)*0.5));
    });
  }

  // v25 square/floor coordinates -> portrait auditorium coordinates.
  (state.placements||[]).forEach(function(p){
    p.YPercent=Math.max(0,Math.min(100,blockingV25YToV26_(p.YPercent)));
  });
  (state.objects||[]).forEach(function(o){
    o.YPercent=Math.max(0,Math.min(100,blockingV25YToV26_(o.YPercent)));
    o.HeightPercent=Math.max(0.25,Math.min(100,number_(o.HeightPercent,8)*(1000/1800)));
  });
  state.snapshot.CanvasVersion='v26-auditorium';
  return state;
}

function blockingSafeColor_(value,fallback) {
  var v=String(value||'').trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

function blockingSaveLock_() {
  var lock=LockService.getScriptLock();
  assert_(lock.tryLock(25000),'Another Blocking Studio save is finishing. Please try again in a moment.','SAVE_BUSY');
  return lock;
}

function blockingNearlyEqual_(a,b) {
  return Math.abs(number_(a,0)-number_(b,0)) < 0.0001;
}

function blockingVerifySnapshotWrite_(saved, values, placements, objects) {
  assert_(saved && saved.snapshot,'The snapshot record did not verify after saving.','SAVE_VERIFY_FAILED');
  assert_(String(saved.snapshot.SnapshotID)===String(values.SnapshotID||saved.snapshot.SnapshotID),'The snapshot ID did not verify after saving.','SAVE_VERIFY_FAILED');
  assert_(String(saved.snapshot.Title||'')===String(values.Title||''),'The snapshot title did not verify after saving.','SAVE_VERIFY_FAILED');
  assert_(number_(saved.snapshot.SceneNumber,0)===number_(values.SceneNumber,0),'The snapshot scene did not verify after saving.','SAVE_VERIFY_FAILED');
  assert_(String(saved.snapshot.CueNumber||'')===String(values.CueNumber||''),'The snapshot cue did not verify after saving.','SAVE_VERIFY_FAILED');

  var wantedPlacements=placements||[], actualPlacements=saved.placements||[];
  assert_(actualPlacements.length===wantedPlacements.length,'The performer placement count did not verify after saving.','SAVE_VERIFY_FAILED');
  wantedPlacements.forEach(function(p,index){
    var a=actualPlacements[index]||{};
    assert_(String(a.BlockingCastID||'')===String(p.BlockingCastID||''),'A performer assignment did not verify after saving.','SAVE_VERIFY_FAILED');
    assert_(blockingNearlyEqual_(a.XPercent,Math.max(0,Math.min(100,number_(p.XPercent,50)))),'A performer X position did not verify after saving.','SAVE_VERIFY_FAILED');
    assert_(blockingNearlyEqual_(a.YPercent,Math.max(0,Math.min(100,number_(p.YPercent,50)))),'A performer Y position did not verify after saving.','SAVE_VERIFY_FAILED');
    assert_(blockingNearlyEqual_(a.Scale,Math.max(0.25,Math.min(4,number_(p.Scale,1)))),'A performer scale did not verify after saving.','SAVE_VERIFY_FAILED');
  });

  var wantedObjects=objects||[], actualObjects=saved.objects||[];
  assert_(actualObjects.length===wantedObjects.length,'The stage object count did not verify after saving.','SAVE_VERIFY_FAILED');
  wantedObjects.forEach(function(o,index){
    var a=actualObjects[index]||{};
    assert_(String(a.TimelineKey||'')===String(o.TimelineKey||''),'A stage object identity did not verify after saving.','SAVE_VERIFY_FAILED');
    assert_(blockingNearlyEqual_(a.XPercent,Math.max(0,Math.min(100,number_(o.XPercent,50)))),'A stage object X position did not verify after saving.','SAVE_VERIFY_FAILED');
    assert_(blockingNearlyEqual_(a.YPercent,Math.max(0,Math.min(100,number_(o.YPercent,25)))),'A stage object Y position did not verify after saving.','SAVE_VERIFY_FAILED');
    assert_(blockingNearlyEqual_(a.WidthPercent,Math.max(0.5,Math.min(100,number_(o.WidthPercent,12)))),'A stage object width did not verify after saving.','SAVE_VERIFY_FAILED');
    assert_(blockingNearlyEqual_(a.HeightPercent,Math.max(0.5,Math.min(100,number_(o.HeightPercent,8)))),'A stage object height did not verify after saving.','SAVE_VERIFY_FAILED');
  });
  return true;
}

function replaceBlockingSnapshotChildren_(context,snapshotId,placements,objects) {
  var productionId=getActiveProductionId_();
  deleteRowsWhere_('BlockingPlacements',function(r){return String(r.SnapshotID)===String(snapshotId);});
  deleteRowsWhere_('BlockingObjects',function(r){return String(r.SnapshotID)===String(snapshotId);});

  (placements||[]).forEach(function(p,index){
    appendRecord_('BlockingPlacements',{
      PlacementID:uuid_('BPLC'),ProductionID:productionId,SnapshotID:snapshotId,
      BlockingCastID:p.BlockingCastID||'',CharacterID:p.CharacterID||'',UserID:p.UserID||'',
      XPercent:Math.max(0,Math.min(100,number_(p.XPercent,50))),
      YPercent:Math.max(0,Math.min(100,number_(p.YPercent,50))),
      Facing:sanitizeText_(p.Facing||'Front',40),Level:sanitizeText_(p.Level||'Standing',40),
      Scale:Math.max(0.25,Math.min(4,number_(p.Scale,1))),Visible:p.Visible===false?false:true,
      Locked:bool_(p.Locked),LabelOverride:sanitizeText_(p.LabelOverride||'',120),
      MovementNote:sanitizeText_(p.MovementNote||'',500),Counts:sanitizeText_(p.Counts||'',100),UpdatedAt:nowIso_()
    });
  });

  (objects||[]).forEach(function(o,index){
    appendRecord_('BlockingObjects',{
      ObjectID:uuid_('BOBJ'),ProductionID:productionId,SnapshotID:snapshotId,TimelineKey:sanitizeText_(o.TimelineKey||uuid_('BTENT'),120),
      ObjectType:sanitizeText_(o.ObjectType||'Set Piece',60),ShapeType:sanitizeText_(o.ShapeType||'Rectangle',40),Label:sanitizeText_(o.Label||'Object',120),
      XPercent:Math.max(0,Math.min(100,number_(o.XPercent,50))),YPercent:Math.max(0,Math.min(100,number_(o.YPercent,25))),
      WidthPercent:Math.max(0.5,Math.min(100,number_(o.WidthPercent,12))),HeightPercent:Math.max(0.5,Math.min(100,number_(o.HeightPercent,8))),
      Rotation:number_(o.Rotation,0),PointsJSON:sanitizeText_(o.PointsJSON||'',6000),
      FillColor:blockingSafeColor_(o.FillColor,'#5e000f'),FillOpacity:Math.max(0,Math.min(1,number_(o.FillOpacity,0.72))),
      EdgeColorsJSON:sanitizeText_(o.EdgeColorsJSON||'',2000),StrokeWidth:Math.max(0,Math.min(20,number_(o.StrokeWidth,3))),
      ZIndex:Math.max(-100,Math.min(100,number_(o.ZIndex,0))),TextColor:blockingSafeColor_(o.TextColor,'#ffffff'),TextSize:Math.max(8,Math.min(48,number_(o.TextSize,14))),
      TextBold:o.TextBold===false?false:true,LabelVisible:o.LabelVisible===false?false:true,LabelBackground:bool_(o.LabelBackground),LabelPosition:sanitizeText_(o.LabelPosition||'Center',20),
      Notes:sanitizeText_(o.Notes||'',500),Status:'Active',UpdatedAt:nowIso_()
    });
  });
}

function saveBlockingSnapshot_(context,payload) {
  requireBlockingEdit_(context); ensureBlockingSheets_();
  var lock=blockingSaveLock_();
  try {
    var productionId=getActiveProductionId_();
    var existing=null;
    if(payload.snapshotId){
      existing=listRecords_('BlockingSnapshots',function(r){return String(r.ProductionID)===String(productionId)&&String(r.SnapshotID)===String(payload.snapshotId);})[0];
      assert_(existing,'Snapshot not found.','NOT_FOUND');
      if(String(existing.LockState)==='Locked' && !blockingCanManage_(context)) throw codedError_('This blocking snapshot is locked.','SNAPSHOT_LOCKED');
    }

    var saveMode=normalize_(payload.saveMode||'manual')==='autosave'?'autosave':'manual';
    var previousState=existing ? getBlockingSnapshot_(context,{snapshotId:existing.SnapshotID}) : null;
    if(existing && saveMode!=='autosave') createBlockingVersion_(context,existing.SnapshotID);

    var id=existing ? existing.SnapshotID : uuid_('BSNP');
    var nextVersion=existing ? (saveMode==='autosave'?number_(existing.VersionNumber,1):number_(existing.VersionNumber,1)+1) : 1;
    var values={
      ProductionID:productionId,SceneNumber:number_(payload.sceneNumber,0),CueNumber:payload.cueNumber||'',AnchorID:payload.anchorId||'',
      Title:sanitizeText_(payload.title||'Blocking Snapshot',160),SnapshotType:sanitizeText_(payload.snapshotType||'Actor Blocking',80),
      BackgroundID:payload.backgroundId||'',Status:sanitizeText_(payload.status||'Draft',30),
      LockState:sanitizeText_(payload.lockState||'Unlocked',30),Notes:sanitizeText_(payload.notes||'',1200),
      SortOrder:number_(payload.sortOrder,Date.now()),VersionNumber:nextVersion,CanvasVersion:'v26-auditorium',UpdatedBy:context.userId,UpdatedAt:nowIso_()
    };

    try {
      if(existing) updateRecordByRow_('BlockingSnapshots',existing._row,values);
      else { values.SnapshotID=id;values.CreatedBy=context.userId;values.CreatedAt=nowIso_();appendRecord_('BlockingSnapshots',values); }
      replaceBlockingSnapshotChildren_(context,id,payload.placements||[],payload.objects||[]);
      if(saveMode==='autosave') {
        var lightSnapshot=Object.assign({},existing||{},values,{SnapshotID:id});
        return {snapshot:safeJsonForClient_(lightSnapshot),placements:[],objects:[],movements:[],saveVerification:{verified:true,verificationMode:'write-complete',saveMode:saveMode,placements:(payload.placements||[]).length,objects:(payload.objects||[]).length,savedAt:values.UpdatedAt}};
      }
      var saved=getBlockingSnapshot_(context,{snapshotId:id});
      var verifyValues={SnapshotID:id,Title:values.Title,SceneNumber:values.SceneNumber,CueNumber:values.CueNumber};
      blockingVerifySnapshotWrite_(saved,verifyValues,payload.placements||[],payload.objects||[]);
      blockingActivity_(context,existing?'UPDATE_SNAPSHOT':'CREATE_SNAPSHOT','BlockingSnapshot',id,{sceneNumber:values.SceneNumber,title:values.Title,placements:(payload.placements||[]).length,objects:(payload.objects||[]).length,verified:true});
      saved.saveVerification={verified:true,verificationMode:'read-back',saveMode:saveMode,placements:(saved.placements||[]).length,objects:(saved.objects||[]).length,savedAt:values.UpdatedAt};
      return saved;
    } catch(saveError) {
      try {
        if(previousState && existing){
          var s=previousState.snapshot;
          updateRecordByRow_('BlockingSnapshots',existing._row,{SceneNumber:s.SceneNumber,CueNumber:s.CueNumber,AnchorID:s.AnchorID,Title:s.Title,SnapshotType:s.SnapshotType,BackgroundID:s.BackgroundID,Status:s.Status,LockState:s.LockState,Notes:s.Notes,SortOrder:s.SortOrder,VersionNumber:s.VersionNumber,CanvasVersion:s.CanvasVersion||'v26-auditorium',UpdatedBy:s.UpdatedBy||context.userId,UpdatedAt:s.UpdatedAt||nowIso_()});
          replaceBlockingSnapshotChildren_(context,id,previousState.placements||[],previousState.objects||[]);
        } else if(!existing) {
          deleteRowsWhere_('BlockingPlacements',function(r){return String(r.SnapshotID)===String(id);});
          deleteRowsWhere_('BlockingObjects',function(r){return String(r.SnapshotID)===String(id);});
          deleteRowsWhere_('BlockingSnapshots',function(r){return String(r.SnapshotID)===String(id);});
        }
      } catch(rollbackError) { Logger.log('Blocking snapshot rollback warning: '+String(rollbackError)); }
      throw saveError;
    }
  } finally { try{lock.releaseLock();}catch(_error){} }
}

function duplicateBlockingSnapshot_(context,payload) {
  requireBlockingEdit_(context);
  var original=getBlockingSnapshot_(context,payload);
  return saveBlockingSnapshot_(context,{
    sceneNumber:original.snapshot.SceneNumber,cueNumber:original.snapshot.CueNumber,anchorId:original.snapshot.AnchorID,
    title:(original.snapshot.Title||'Snapshot')+' — Copy',snapshotType:original.snapshot.SnapshotType,
    backgroundId:original.snapshot.BackgroundID,status:'Draft',lockState:'Unlocked',notes:original.snapshot.Notes,
    sortOrder:number_(original.snapshot.SortOrder,0)+1,placements:original.placements,objects:original.objects
  });
}

function setBlockingSnapshotStatus_(context,payload) {
  requireBlockingManage_(context);
  var snapshot=listRecords_('BlockingSnapshots',function(r){return String(r.ProductionID)===String(getActiveProductionId_())&&String(r.SnapshotID)===String(payload.snapshotId);})[0];
  assert_(snapshot,'Snapshot not found.','NOT_FOUND');
  updateRecordByRow_('BlockingSnapshots',snapshot._row,{
    Status:sanitizeText_(payload.status||snapshot.Status,30),LockState:sanitizeText_(payload.lockState||snapshot.LockState,30),UpdatedBy:context.userId,UpdatedAt:nowIso_()
  });
  blockingActivity_(context,'SET_SNAPSHOT_STATUS','BlockingSnapshot',snapshot.SnapshotID,{status:payload.status,lockState:payload.lockState});
  return {saved:true};
}

function deleteBlockingSnapshotPermanently_(context,payload) {
  assert_(isFullAdmin_(context),'Only a Full Administrator can permanently delete blocking snapshots.','FORBIDDEN');
  assert_(String(payload.confirmation)==='DELETE','Type DELETE to permanently delete the snapshot.','CONFIRMATION_FAILED');
  var id=payload.snapshotId;
  deleteRowsWhere_('BlockingPlacements',function(r){return String(r.SnapshotID)===String(id);});
  deleteRowsWhere_('BlockingObjects',function(r){return String(r.SnapshotID)===String(id);});
  deleteRowsWhere_('BlockingMovements',function(r){return String(r.FromSnapshotID)===String(id)||String(r.ToSnapshotID)===String(id);});
  deleteRowsWhere_('BlockingSnapshotVersions',function(r){return String(r.SnapshotID)===String(id);});
  deleteRowsWhere_('BlockingSnapshots',function(r){return String(r.SnapshotID)===String(id);});
  blockingActivity_(context,'DELETE_SNAPSHOT','BlockingSnapshot',id,{});
  return {deleted:true};
}

function getBlockingSnapshotVersions_(context,payload) {
  assert_(blockingCanAudit_(context),'Blocking history permission is required.','FORBIDDEN');
  return {versions:safeJsonForClient_(listRecords_('BlockingSnapshotVersions',function(r){return String(r.SnapshotID)===String(payload.snapshotId);}).sort(function(a,b){return number_(b.VersionNumber,0)-number_(a.VersionNumber,0);} ))};
}

function restoreBlockingSnapshotVersion_(context,payload) {
  requireBlockingManage_(context);
  var version=listRecords_('BlockingSnapshotVersions',function(r){return String(r.VersionID)===String(payload.versionId);})[0];
  assert_(version,'Version not found.','NOT_FOUND');
  var state=jsonParse_(version.StateJSON,null); assert_(state && state.snapshot,'Stored version is invalid.','INVALID_VERSION'); state=blockingNormalizeRestoredCanvasV26_(state);
  var current=listRecords_('BlockingSnapshots',function(r){return String(r.SnapshotID)===String(version.SnapshotID);})[0];
  assert_(current,'Snapshot not found.','NOT_FOUND');
  createBlockingVersion_(context,current.SnapshotID);
  var s=state.snapshot;
  updateRecordByRow_('BlockingSnapshots',current._row,{
    SceneNumber:s.SceneNumber,CueNumber:s.CueNumber,AnchorID:s.AnchorID,Title:s.Title,SnapshotType:s.SnapshotType,BackgroundID:s.BackgroundID,
    Status:s.Status,LockState:s.LockState,Notes:s.Notes,SortOrder:s.SortOrder,VersionNumber:number_(current.VersionNumber,1)+1,CanvasVersion:'v26-auditorium',UpdatedBy:context.userId,UpdatedAt:nowIso_()
  });
  replaceBlockingSnapshotChildren_(context,current.SnapshotID,state.placements||[],state.objects||[]);
  blockingActivity_(context,'RESTORE_VERSION','BlockingSnapshot',current.SnapshotID,{versionId:version.VersionID,versionNumber:version.VersionNumber});
  return getBlockingSnapshot_(context,{snapshotId:current.SnapshotID});
}

function saveBlockingAnchor_(context,payload) {
  requireBlockingEdit_(context); ensureBlockingSheets_();
  var productionId=getActiveProductionId_();
  var existing=payload.anchorId ? listRecords_('BlockingScriptAnchors',function(r){return String(r.ProductionID)===String(productionId)&&String(r.AnchorID)===String(payload.anchorId);})[0] : null;
  var values={
    ProductionID:productionId,SceneNumber:number_(payload.sceneNumber,0),CueNumber:payload.cueNumber||'',AnchorType:sanitizeText_(payload.anchorType||'Dialogue',50),
    Speaker:sanitizeText_(payload.speaker||'',120),TextSnippet:sanitizeText_(payload.textSnippet||'',500),BookPage:payload.bookPage||'',Measure:sanitizeText_(payload.measure||'',50),
    CountLabel:sanitizeText_(payload.countLabel||'',80),CueWord:sanitizeText_(payload.cueWord||'',100),SortOrder:number_(payload.sortOrder,Date.now()),
    VerificationStatus:sanitizeText_(payload.verificationStatus||'Draft',30),Notes:sanitizeText_(payload.notes||'',500),UpdatedBy:context.userId,UpdatedAt:nowIso_()
  };
  var id;
  if(existing){id=existing.AnchorID; updateRecordByRow_('BlockingScriptAnchors',existing._row,values);}else{ id=uuid_('BANC'); values.AnchorID=id;values.CreatedBy=context.userId;values.CreatedAt=nowIso_();appendRecord_('BlockingScriptAnchors',values);}
  blockingActivity_(context,existing?'UPDATE_ANCHOR':'CREATE_ANCHOR','BlockingScriptAnchor',id,{sceneNumber:values.SceneNumber,cueNumber:values.CueNumber,type:values.AnchorType});
  return {saved:true,anchorId:id};
}

function deleteBlockingAnchor_(context,payload) {
  requireBlockingManage_(context);
  var anchor=listRecords_('BlockingScriptAnchors',function(r){return String(r.AnchorID)===String(payload.anchorId);})[0];
  assert_(anchor,'Anchor not found.','NOT_FOUND');
  var linked=listRecords_('BlockingSnapshots',function(r){return String(r.AnchorID)===String(anchor.AnchorID)&&String(r.Status)!=='Archived';});
  assert_(!linked.length,'This anchor is used by blocking snapshots. Reassign them before deleting it.','ANCHOR_IN_USE');
  deleteRowsWhere_('BlockingScriptAnchors',function(r){return String(r.AnchorID)===String(anchor.AnchorID);});
  blockingActivity_(context,'DELETE_ANCHOR','BlockingScriptAnchor',anchor.AnchorID,{});
  return {deleted:true};
}

function saveBlockingCast_(context,payload) {
  requireBlockingManage_(context); ensureBlockingSheets_();
  var productionId=getActiveProductionId_();
  assert_(payload.characterId,'Choose a character.','MISSING_CHARACTER');
  var existing=payload.blockingCastId ? listRecords_('BlockingCast',function(r){return String(r.BlockingCastID)===String(payload.blockingCastId);})[0] : null;
  var character=listRecords_('BlockingCharacters',function(r){return String(r.ProductionID)===String(productionId)&&String(r.CharacterID)===String(payload.characterId)&&String(r.Status||'Active')!=='Archived';})[0];
  assert_(character,'Choose an active character.','INVALID_CHARACTER');
  var characterKey=String(character.CharacterKey||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  var characterNameKey=String(character.CharacterName||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  var isDoubleCast=characterKey==='mal'||characterKey==='evie'||characterKey==='carlos'||characterNameKey==='mal'||characterNameKey==='evie'||characterNameKey==='carlos';
  var requestedGroup=String(payload.castGroup||existing&&existing.CastGroup||'').toUpperCase().replace(/[^AB]/g,'');
  var castGroup=isDoubleCast?(requestedGroup==='B'?'B':'A'):'Single';
  var duplicate=listRecords_('BlockingCast',function(r){
    if(String(r.ProductionID)!==String(productionId)||String(r.CharacterID)!==String(payload.characterId)||String(r.Status||'Active')==='Archived')return false;
    if(existing&&String(r.BlockingCastID)===String(existing.BlockingCastID))return false;
    if(!isDoubleCast)return true;
    return String(r.CastGroup||'A').toUpperCase()===castGroup;
  })[0];
  assert_(!duplicate,isDoubleCast?(character.CharacterName+' already has a Cast '+castGroup+' performer.'):(character.CharacterName+' is single-cast and already has a performer.'),'CAST_SLOT_TAKEN');
  var values={
    ProductionID:productionId,UserID:payload.userId||'',CharacterID:payload.characterId,
    DisplayLabel:sanitizeText_(payload.displayLabel||'',120),RoleLabel:sanitizeText_(payload.roleLabel||'',120),CastGroup:castGroup,
    HeightFeet:Math.max(3,Math.min(8,number_(payload.heightFeet,existing&&existing.HeightFeet||5.7))),
    AvatarType:['Male','Female','Neutral'].indexOf(sanitizeText_(payload.avatarType||existing&&existing.AvatarType||'Neutral',20))>=0?sanitizeText_(payload.avatarType||existing&&existing.AvatarType||'Neutral',20):'Neutral',
    TokenBackgroundColor:blockingSafeColor_(payload.tokenBackgroundColor||(existing&&existing.TokenBackgroundColor),'#5e000f'),
    TokenInitialColor:blockingSafeColor_(payload.tokenInitialColor||(existing&&existing.TokenInitialColor),'#ffffff'),
    TokenOutlineColor:blockingSafeColor_(payload.tokenOutlineColor||(existing&&existing.TokenOutlineColor),'#f8b918'),
    Status:sanitizeText_(payload.status||'Active',30),
    SortOrder:number_(payload.sortOrder,1000),AssignedBy:existing?(existing.AssignedBy||context.userId):context.userId,AssignedAt:existing?existing.AssignedAt||nowIso_():nowIso_(),UpdatedAt:nowIso_()
  };
  var id;
  if(existing){id=existing.BlockingCastID;updateRecordByRow_('BlockingCast',existing._row,values);}else{id=uuid_('BCAST');values.BlockingCastID=id;appendRecord_('BlockingCast',values);}
  blockingActivity_(context,existing?'UPDATE_CAST':'ASSIGN_CAST','BlockingCast',id,{userId:values.UserID,characterId:values.CharacterID,castGroup:values.CastGroup});
  return {saved:true,blockingCastId:id};
}


function blockingEnsembleRoleKey_(group, roleName) {
  var raw = [group && (group.GroupKey || group.GroupName), roleName || 'ENSEMBLE'].filter(Boolean).join('_').toUpperCase();
  raw = raw.replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').substring(0,72);
  return 'ENS_' + (raw || 'ENSEMBLE');
}

function saveBlockingEnsembleRoster_(context,payload) {
  requireBlockingManage_(context); ensureBlockingSheets_();
  var productionId=getActiveProductionId_();
  var group=listRecords_('BlockingGroups',function(r){return String(r.ProductionID)===String(productionId)&&String(r.GroupID)===String(payload.groupId)&&String(r.Status||'Active')!=='Archived';})[0];
  assert_(group,'Choose an ensemble/group.','MISSING_GROUP');
  var roleName=sanitizeText_(payload.roleName||group.GroupName||'Ensemble',120);
  assert_(roleName,'Enter an individual ensemble role name.','MISSING_ROLE_NAME');
  var roleLabel=sanitizeText_(payload.roleLabel||'Ensemble',120);
  var userIds=Array.isArray(payload.userIds)?payload.userIds.map(function(v){return String(v||'').trim();}).filter(Boolean):[];
  assert_(userIds.length,'Choose at least one student.','MISSING_USERS');
  assert_(userIds.length<=150,'Choose no more than 150 students at once.','TOO_MANY_USERS');

  var validPeople={}; blockingPeople_().forEach(function(p){validPeople[String(p.UserID)]=p;});
  userIds=userIds.filter(function(id,index,list){return !!validPeople[id]&&list.indexOf(id)===index;});
  assert_(userIds.length,'None of the selected users are active production accounts.','INVALID_USERS');

  var roleKey=blockingEnsembleRoleKey_(group,roleName);
  var character=listRecords_('BlockingCharacters',function(r){return String(r.ProductionID)===String(productionId)&&String(r.CharacterKey)===String(roleKey);})[0];
  if(!character){
    character={
      CharacterID:uuid_('BCHR'),ProductionID:productionId,CharacterKey:roleKey,CharacterName:roleName,
      World:sanitizeText_(group.GroupName||'',80),CharacterType:'Ensemble Individual',
      Description:'Individual blocking identity used for '+sanitizeText_(group.GroupName||roleName,120)+' roster members.',
      SortOrder:number_(group.SortOrder,9000)+0.25,Status:'Active',UpdatedAt:nowIso_()
    };
    appendRecord_('BlockingCharacters',character);
  } else {
    updateRecordByRow_('BlockingCharacters',character._row,{CharacterName:roleName,CharacterType:'Ensemble Individual',World:sanitizeText_(group.GroupName||character.World||'',80),Status:'Active',UpdatedAt:nowIso_()});
  }

  var memberKeys=String(group.MemberCharacterKeys||'').split(',').map(function(v){return String(v||'').trim();}).filter(Boolean);
  if(memberKeys.indexOf(roleKey)===-1){memberKeys.push(roleKey);updateRecordByRow_('BlockingGroups',group._row,{MemberCharacterKeys:memberKeys.join(','),UpdatedAt:nowIso_()});}

  var created=0,reactivated=0,existingCount=0,castIds=[];
  userIds.forEach(function(userId,index){
    var exact=listRecords_('BlockingCast',function(r){return String(r.ProductionID)===String(productionId)&&String(r.UserID)===String(userId)&&String(r.CharacterID)===String(character.CharacterID);})[0];
    if(exact){
      var patch={DisplayLabel:'',RoleLabel:roleLabel,Status:'Active',UpdatedAt:nowIso_()};
      if(!/^#[0-9a-f]{6}$/i.test(String(exact.TokenBackgroundColor||'')))patch.TokenBackgroundColor='#5e000f';
      if(!/^#[0-9a-f]{6}$/i.test(String(exact.TokenInitialColor||'')))patch.TokenInitialColor='#ffffff';
      if(!/^#[0-9a-f]{6}$/i.test(String(exact.TokenOutlineColor||'')))patch.TokenOutlineColor='#f8b918';
      updateRecordByRow_('BlockingCast',exact._row,patch);castIds.push(exact.BlockingCastID);
      if(String(exact.Status||'Active')==='Archived')reactivated++; else existingCount++;
      return;
    }
    var id=uuid_('BCAST');
    appendRecord_('BlockingCast',{
      BlockingCastID:id,ProductionID:productionId,UserID:userId,CharacterID:character.CharacterID,DisplayLabel:'',RoleLabel:roleLabel,
      TokenBackgroundColor:'#5e000f',TokenInitialColor:'#ffffff',TokenOutlineColor:'#f8b918',Status:'Active',SortOrder:number_(group.SortOrder,1000)*100+index,
      AssignedBy:context.userId,AssignedAt:nowIso_(),UpdatedAt:nowIso_()
    });
    castIds.push(id);created++;
  });
  blockingActivity_(context,'SAVE_ENSEMBLE_ROSTER','BlockingGroup',group.GroupID,{groupName:group.GroupName,roleName:roleName,characterKey:roleKey,selected:userIds.length,created:created,reactivated:reactivated,existing:existingCount});
  return {saved:true,groupId:group.GroupID,characterId:character.CharacterID,characterKey:roleKey,roleName:roleName,created:created,reactivated:reactivated,existing:existingCount,blockingCastIds:castIds};
}

function deleteBlockingCast_(context,payload) {
  requireBlockingManage_(context);
  var id=payload.blockingCastId;
  var used=listRecords_('BlockingPlacements',function(r){return String(r.BlockingCastID)===String(id);});
  assert_(!used.length,'This cast assignment appears in blocking snapshots. Archive it instead of deleting it.','CAST_IN_USE');
  deleteRowsWhere_('BlockingCast',function(r){return String(r.BlockingCastID)===String(id);});
  blockingActivity_(context,'DELETE_CAST','BlockingCast',id,{});
  return {deleted:true};
}

function uploadBlockingBackground_(context,payload) {
  requireBlockingManage_(context);
  var folders=ensureBlockingFolders_();
  var saved=saveDriveFile_(folders.backgroundsFolderId,sanitizeText_(payload.filename||'stage-background.jpg',180),payload.dataUrl,4*1024*1024,false);
  var id=uuid_('BBG');
  appendRecord_('BlockingBackgrounds',{
    BackgroundID:id,ProductionID:getActiveProductionId_(),SceneNumber:number_(payload.sceneNumber,0),Title:sanitizeText_(payload.title||payload.filename||'Stage Background',160),
    FileID:saved.fileId,PhotoRef:'drivefile:'+saved.fileId,MimeType:saved.mimeType,Status:'Active',CreatedBy:context.userId,CreatedAt:nowIso_(),UpdatedAt:nowIso_()
  });
  blockingActivity_(context,'UPLOAD_BACKGROUND','BlockingBackground',id,{sceneNumber:payload.sceneNumber,fileId:saved.fileId});
  return {saved:true,backgroundId:id,fileId:saved.fileId};
}

function getBlockingBackgroundData_(context,payload) {
  var bg=listRecords_('BlockingBackgrounds',function(r){return String(r.ProductionID)===String(getActiveProductionId_())&&String(r.BackgroundID)===String(payload.backgroundId)&&String(r.Status)!=='Archived';})[0];
  assert_(bg,'Background not found.','NOT_FOUND');
  var file=DriveApp.getFileById(bg.FileID); var blob=file.getBlob(); var mime=blob.getContentType()||file.getMimeType();
  return {backgroundId:bg.BackgroundID,mimeType:mime,dataUrl:'data:'+mime+';base64,'+Utilities.base64Encode(blob.getBytes())};
}

function archiveBlockingBackground_(context,payload) {
  requireBlockingManage_(context);
  var bg=listRecords_('BlockingBackgrounds',function(r){return String(r.BackgroundID)===String(payload.backgroundId);})[0];
  assert_(bg,'Background not found.','NOT_FOUND');
  updateRecordByRow_('BlockingBackgrounds',bg._row,{Status:'Archived',UpdatedAt:nowIso_()});
  blockingActivity_(context,'ARCHIVE_BACKGROUND','BlockingBackground',bg.BackgroundID,{});
  return {saved:true};
}



function blockingTimelineContextMatch_(record, productionId, sceneNumber, cueNumber) {
  return String(record.ProductionID)===String(productionId)
    && number_(record.SceneNumber,0)===number_(sceneNumber,0)
    && String(record.CueNumber||'')===String(cueNumber||'');
}


function getBlockingTimelineMediaIndex_(context,payload) {
  ensureBlockingSheets_();
  var productionId=getActiveProductionId_();
  var rows=listRecords_('BlockingTimelineMedia',function(r){
    return String(r.ProductionID)===String(productionId) && String(r.Status||'Active')!=='Archived';
  }).map(function(r){return {
    SceneNumber:number_(r.SceneNumber,0),CueNumber:String(r.CueNumber||''),MediaSource:String(r.MediaSource||''),TrackID:String(r.TrackID||''),TrackTitle:String(r.TrackTitle||''),FileID:String(r.FileID||''),RecordingID:String(r.RecordingID||''),DurationSeconds:number_(r.DurationSeconds,0),UpdatedAt:String(r.UpdatedAt||'')
  };});
  return {media:safeJsonForClient_(rows)};
}

function getBlockingTimeline_(context,payload) {
  ensureBlockingSheets_();
  var productionId=getActiveProductionId_();
  var sceneNumber=number_(payload.sceneNumber,0);
  var cueNumber=payload.cueNumber||'';
  var media=listRecords_('BlockingTimelineMedia',function(r){return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber)&&String(r.Status||'Active')!=='Archived';})[0]||null;
  var markers=listRecords_('BlockingTimelineMarkers',function(r){return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber)&&String(r.Status||'Active')!=='Archived';}).sort(function(a,b){return number_(a.TimeSeconds,0)-number_(b.TimeSeconds,0);});
  var keyframes=listRecords_('BlockingTimelineKeyframes',function(r){return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber)&&String(r.Status||'Active')!=='Archived';}).sort(function(a,b){return number_(a.TimeSeconds,0)-number_(b.TimeSeconds,0);});
  var motions=listRecords_('BlockingTimelineMotions',function(r){return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber)&&String(r.Status||'Active')!=='Archived';}).sort(function(a,b){return number_(a.StartSeconds,0)-number_(b.StartSeconds,0);});
  var musicRow=listRecords_('BlockingMusicMaps',function(r){return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber)&&String(r.Status||'Active')!=='Archived';})[0]||null;
  var referenceMedia=listRecords_('BlockingReferenceMedia',function(r){return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber)&&String(r.Status||'Active')!=='Archived';})[0]||null;
  var musicMap={};try{musicMap=musicRow?JSON.parse(String(musicRow.MapJSON||'{}')):{}}catch(_error){musicMap={};}
  return {media:safeJsonForClient_(media),markers:safeJsonForClient_(markers),keyframes:safeJsonForClient_(keyframes),motions:safeJsonForClient_(motions),musicMap:safeJsonForClient_(musicMap),referenceMedia:safeJsonForClient_(referenceMedia)};
}

function blockingWriteTimelineState_(context,sceneNumber,cueNumber,state) {
  var productionId=getActiveProductionId_();
  function same(r){return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber);}
  deleteRowsWhere_('BlockingTimelineMedia',same);
  deleteRowsWhere_('BlockingTimelineMarkers',same);
  deleteRowsWhere_('BlockingTimelineKeyframes',same);
  deleteRowsWhere_('BlockingTimelineMotions',same);
  deleteRowsWhere_('BlockingMusicMaps',same);
  deleteRowsWhere_('BlockingReferenceMedia',same);

  var media=state.media||null;
  if(media && (media.TrackID || media.FileID)){
    var mediaSource=sanitizeText_(media.MediaSource || (media.TrackID ? 'GuideTrack' : 'SceneRecording'),40);
    appendRecord_('BlockingTimelineMedia',{TimelineMediaID:uuid_('BTMED'),ProductionID:productionId,SceneNumber:sceneNumber,CueNumber:cueNumber,MediaSource:mediaSource,TrackID:sanitizeText_(media.TrackID||'',160),TrackTitle:sanitizeText_(media.TrackTitle||'',220),TrackType:sanitizeText_(media.TrackType||'',80),FileID:sanitizeText_(media.FileID||'',180),MimeType:sanitizeText_(media.MimeType||'',100),DurationSeconds:Math.max(0,number_(media.DurationSeconds,0)),RecordingTitle:sanitizeText_(media.RecordingTitle||'',220),RecordingID:sanitizeText_(media.RecordingID||'',180),SourceType:sanitizeText_(media.SourceType||'',40),OriginalFilename:sanitizeText_(media.OriginalFilename||'',240),RecordedAt:sanitizeText_(media.RecordedAt||'',80),Status:'Active',UpdatedBy:context.userId,UpdatedAt:nowIso_()});
  }
  (state.markers||[]).slice(0,300).forEach(function(m,index){appendRecord_('BlockingTimelineMarkers',{TimelineMarkerID:uuid_('BTMRK'),ProductionID:productionId,SceneNumber:sceneNumber,CueNumber:cueNumber,TimeSeconds:Math.max(0,number_(m.TimeSeconds,0)),Label:sanitizeText_(m.Label||'Marker',180),MarkerType:sanitizeText_(m.MarkerType||'Blocking',60),Speaker:sanitizeText_(m.Speaker||'',120),DialogueText:sanitizeText_(m.DialogueText||'',700),Measure:sanitizeText_(m.Measure||'',50),CountLabel:sanitizeText_(m.CountLabel||'',80),Notes:sanitizeText_(m.Notes||'',500),SortOrder:index+1,Status:'Active',UpdatedBy:context.userId,UpdatedAt:nowIso_()});});
  (state.keyframes||[]).slice(0,400).forEach(function(k){appendRecord_('BlockingTimelineKeyframes',{TimelineKeyframeID:uuid_('BTKEY'),ProductionID:productionId,SceneNumber:sceneNumber,CueNumber:cueNumber,TimeSeconds:Math.max(0,number_(k.TimeSeconds,0)),Title:sanitizeText_(k.Title||'Formation',180),StateJSON:sanitizeText_(k.StateJSON||jsonStringify_(k.state||k._state||{}),48000),Status:'Active',UpdatedBy:context.userId,UpdatedAt:nowIso_()});});
  (state.motions||[]).slice(0,800).forEach(function(m){appendRecord_('BlockingTimelineMotions',{TimelineMotionID:uuid_('BTMOT'),ProductionID:productionId,SceneNumber:sceneNumber,CueNumber:cueNumber,EntityType:sanitizeText_(m.EntityType||'Cast',30),EntityKey:sanitizeText_(m.EntityKey||'',160),Label:sanitizeText_(m.Label||'',180),MotionType:sanitizeText_(m.MotionType||'Trace',40),StartSeconds:Math.max(0,number_(m.StartSeconds,0)),EndSeconds:Math.max(0,number_(m.EndSeconds,0)),PathJSON:sanitizeText_(m.PathJSON||jsonStringify_(m.path||m._path||[]),48000),Easing:sanitizeText_(m.Easing||'linear',30),Status:'Active',UpdatedBy:context.userId,UpdatedAt:nowIso_()});});
  if(state.musicMap)appendRecord_('BlockingMusicMaps',{MusicMapID:uuid_('BTMAP'),ProductionID:productionId,SceneNumber:sceneNumber,CueNumber:cueNumber,MapJSON:sanitizeText_(jsonStringify_(state.musicMap),48000),VersionNumber:1,Status:'Active',UpdatedBy:context.userId,UpdatedAt:nowIso_()});
  var ref=state.referenceMedia||null;if(ref&&ref.FileID)appendRecord_('BlockingReferenceMedia',{ReferenceMediaID:uuid_('BTREF'),ProductionID:productionId,SceneNumber:sceneNumber,CueNumber:cueNumber,Title:sanitizeText_(ref.Title||'Reference video',220),FileID:sanitizeText_(ref.FileID||'',180),MimeType:sanitizeText_(ref.MimeType||'video/mp4',100),DurationSeconds:Math.max(0,number_(ref.DurationSeconds,0)),OffsetSeconds:number_(ref.OffsetSeconds,0),Status:'Active',UpdatedBy:context.userId,UpdatedAt:nowIso_()});
}

function saveBlockingTimeline_(context,payload) {
  requireBlockingEdit_(context); ensureBlockingSheets_();
  var lock=blockingSaveLock_();
  try {
    var sceneNumber=number_(payload.sceneNumber,0),cueNumber=payload.cueNumber||'';
    var saveMode=normalize_(payload.saveMode||'manual')==='autosave'?'autosave':'manual';
    var previous=getBlockingTimeline_(context,{sceneNumber:sceneNumber,cueNumber:cueNumber});
    try {
      blockingWriteTimelineState_(context,sceneNumber,cueNumber,payload);
      if(saveMode==='autosave') {
        return {media:safeJsonForClient_(payload.media||null),markers:safeJsonForClient_((payload.markers||[]).slice(0,300)),keyframes:safeJsonForClient_((payload.keyframes||[]).slice(0,400)),motions:safeJsonForClient_((payload.motions||[]).slice(0,800)),saveVerification:{verified:true,verificationMode:'write-complete',saveMode:saveMode,markers:Math.min(300,(payload.markers||[]).length),keyframes:Math.min(400,(payload.keyframes||[]).length),motions:Math.min(800,(payload.motions||[]).length),mediaLinked:!!(payload.media&&(payload.media.TrackID||payload.media.FileID)),savedAt:nowIso_()}};
      }
      var saved=getBlockingTimeline_(context,{sceneNumber:sceneNumber,cueNumber:cueNumber});
      assert_((saved.markers||[]).length===Math.min(300,(payload.markers||[]).length),'Timeline markers did not verify after saving.','SAVE_VERIFY_FAILED');
      assert_((saved.keyframes||[]).length===Math.min(400,(payload.keyframes||[]).length),'Timeline formations did not verify after saving.','SAVE_VERIFY_FAILED');
      assert_((saved.motions||[]).length===Math.min(800,(payload.motions||[]).length),'Timeline paths did not verify after saving.','SAVE_VERIFY_FAILED');
      if(payload.media && (payload.media.TrackID||payload.media.FileID)) {
        assert_(!!saved.media,'Timeline audio link did not verify after saving.','SAVE_VERIFY_FAILED');
        if(payload.media.TrackID) assert_(String(saved.media.TrackID||'')===String(payload.media.TrackID),'The Guide Vocal link did not verify after saving.','SAVE_VERIFY_FAILED');
        if(payload.media.FileID) assert_(String(saved.media.FileID||'')===String(payload.media.FileID),'The scene audio link did not verify after saving.','SAVE_VERIFY_FAILED');
      } else {
        assert_(!saved.media,'The timeline audio unlink did not verify after saving.','SAVE_VERIFY_FAILED');
      }
      if(saveMode!=='autosave') blockingActivity_(context,'SAVE_TIMELINE','BlockingTimeline',String(sceneNumber)+':'+String(cueNumber),{markers:(payload.markers||[]).length,keyframes:(payload.keyframes||[]).length,motions:(payload.motions||[]).length,trackId:payload.media&&payload.media.TrackID||'',verified:true});
      saved.saveVerification={verified:true,verificationMode:'read-back',saveMode:saveMode,markers:(saved.markers||[]).length,keyframes:(saved.keyframes||[]).length,motions:(saved.motions||[]).length,mediaLinked:!!saved.media,savedAt:nowIso_()};
      return saved;
    } catch(saveError) {
      try { blockingWriteTimelineState_(context,sceneNumber,cueNumber,previous||{}); }
      catch(rollbackError){ Logger.log('Blocking timeline rollback warning: '+String(rollbackError)); }
      throw saveError;
    }
  } finally { try{lock.releaseLock();}catch(_error){} }
}


function blockingTimelineMediaForContext_(sceneNumber,cueNumber) {
  var productionId=getActiveProductionId_();
  return listRecords_('BlockingTimelineMedia',function(r){
    return blockingTimelineContextMatch_(r,productionId,sceneNumber,cueNumber)
      && String(r.Status||'Active')!=='Archived';
  })[0]||null;
}

function blockingAudioDataParts_(dataUrl) {
  var value=String(dataUrl||'');
  var match=value.match(/^data:(audio\/[a-zA-Z0-9.+-]+)(?:;[^,]*)?;base64,(.+)$/);
  assert_(match,'The scene audio was not valid audio data.','INVALID_AUDIO');
  var mime=String(match[1]||'').toLowerCase();
  var allowed=[
    'audio/mpeg','audio/mp3',
    'audio/mp4','audio/x-m4a','audio/m4a',
    'audio/wav','audio/x-wav','audio/wave',
    'audio/aac','audio/webm','audio/ogg'
  ];
  assert_(allowed.indexOf(mime)>=0,'Use MP3, M4A, WAV, AAC, WebM, or OGG audio.','INVALID_AUDIO_TYPE');
  return {mimeType:mime,base64:match[2]};
}

function blockingAudioExtension_(mimeType, originalFilename) {
  var mime=String(mimeType||'').toLowerCase();
  if(mime==='audio/mpeg'||mime==='audio/mp3')return 'mp3';
  if(mime==='audio/mp4'||mime==='audio/x-m4a'||mime==='audio/m4a')return 'm4a';
  if(mime==='audio/wav'||mime==='audio/x-wav'||mime==='audio/wave')return 'wav';
  if(mime==='audio/aac')return 'aac';
  if(mime==='audio/ogg')return 'ogg';
  if(mime==='audio/webm')return 'webm';
  var original=String(originalFilename||''),match=original.toLowerCase().match(/\.([a-z0-9]{2,5})$/),ext=match?match[1]:'';
  if(['mp3','m4a','wav','aac','webm','ogg'].indexOf(ext)>=0)return ext;
  return 'webm';
}

function blockingSceneRecordingById_(recordingId) {
  var productionId=getActiveProductionId_();
  return listRecords_('BlockingSceneRecordings',function(r){
    return String(r.ProductionID)===String(productionId)
      && String(r.RecordingID)===String(recordingId)
      && String(r.Status||'Active')!=='Archived';
  })[0]||null;
}

function blockingSceneRecordingByFileId_(fileId) {
  var productionId=getActiveProductionId_();
  return listRecords_('BlockingSceneRecordings',function(r){
    return String(r.ProductionID)===String(productionId)
      && String(r.FileID||'')===String(fileId)
      && String(r.Status||'Active')!=='Archived';
  })[0]||null;
}

function blockingSetActiveSceneRecording_(context, recording) {
  assert_(recording,'Scene recording not found.','NOT_FOUND');
  var productionId=getActiveProductionId_();
  var sceneNumber=number_(recording.SceneNumber,0);
  deleteRowsWhere_('BlockingTimelineMedia',function(r){
    return blockingTimelineContextMatch_(r,productionId,sceneNumber,'');
  });
  appendRecord_('BlockingTimelineMedia',{
    TimelineMediaID:uuid_('BTMED'),ProductionID:productionId,SceneNumber:sceneNumber,CueNumber:'',
    MediaSource:'SceneRecording',TrackID:'',TrackTitle:'',TrackType:'Scene Rehearsal Audio',
    FileID:recording.FileID,MimeType:recording.MimeType,
    DurationSeconds:Math.max(0,number_(recording.DurationSeconds,0)),
    RecordingTitle:recording.Title,RecordingID:recording.RecordingID,
    SourceType:recording.SourceType||'Recorded',OriginalFilename:recording.OriginalFilename||'',
    RecordedAt:recording.CreatedAt||nowIso_(),
    Status:'Active',UpdatedBy:context.userId,UpdatedAt:nowIso_()
  });
  return blockingTimelineMediaForContext_(sceneNumber,'');
}

function getBlockingSceneRecordings_(context,payload) {
  ensureBlockingSheets_();
  var sceneNumber=number_(payload.sceneNumber,0);
  assert_(sceneNumber>0,'Choose a scene first.','INVALID_SCENE');
  var productionId=getActiveProductionId_();
  var rows=listRecords_('BlockingSceneRecordings',function(r){
    return String(r.ProductionID)===String(productionId)
      && number_(r.SceneNumber,0)===sceneNumber
      && String(r.Status||'Active')!=='Archived';
  }).sort(function(a,b){
    return String(b.CreatedAt||'').localeCompare(String(a.CreatedAt||''));
  });
  return {recordings:safeJsonForClient_(rows)};
}

function useBlockingSceneRecording_(context,payload) {
  requireBlockingEdit_(context); ensureBlockingSheets_();
  var recording=blockingSceneRecordingById_(sanitizeText_(payload.recordingId||'',180));
  assert_(recording,'Scene recording not found.','NOT_FOUND');
  if(payload.sceneNumber){
    assert_(number_(recording.SceneNumber,0)===number_(payload.sceneNumber,0),'That recording belongs to a different scene.','INVALID_SCENE');
  }
  var media=blockingSetActiveSceneRecording_(context,recording);
  blockingActivity_(context,'USE_SCENE_AUDIO','BlockingSceneRecording',recording.RecordingID,{
    sceneNumber:recording.SceneNumber,fileId:recording.FileID,title:recording.Title
  });
  return {saved:true,media:safeJsonForClient_(media)};
}

function saveBlockingSceneRecording_(context,payload) {
  requireBlockingEdit_(context); ensureBlockingSheets_();
  var sceneNumber=number_(payload.sceneNumber,0), cueNumber=String(payload.cueNumber||'');
  assert_(sceneNumber>0,'Choose a scene first.','INVALID_SCENE');
  assert_(!cueNumber,'Scene rehearsal audio attaches to the Scene / dialogue timeline, not a song cue.','INVALID_CONTEXT');

  var parts=blockingAudioDataParts_(payload.dataUrl);
  var bytes=Utilities.base64Decode(parts.base64);
  assert_(bytes.length<=24*1024*1024,'The prepared scene audio is larger than 24 MB. Turn on Smart Optimize or split the recording.','FILE_TOO_LARGE');

  var folders=ensureBlockingFolders_();
  var sourceType=sanitizeText_(payload.sourceType||'Recorded',40);
  sourceType=normalize_(sourceType)==='upload'?'Upload':'Recorded';
  var storedFilename=sanitizeText_(payload.filename||'',240);
  var originalFilename=sanitizeText_(payload.originalFilename||storedFilename,240);
  var originalMimeType=sanitizeText_(payload.originalMimeType||parts.mimeType,100);
  var originalByteLength=Math.max(bytes.length,number_(payload.originalByteLength,bytes.length));
  var optimized=bool_(payload.optimizedForBlocking);
  var optimizationNote=sanitizeText_(payload.optimizationNote||'',220);
  var ext=blockingAudioExtension_(parts.mimeType,storedFilename);
  var title=sanitizeText_(payload.title||('Scene '+sceneNumber+' rehearsal audio'),180);
  var stamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'America/Regina','yyyyMMdd-HHmmss');
  var safeName=title.replace(/[\\/:*?\"<>|]+/g,'-').substring(0,120)+'-'+stamp+'.'+ext;
  var blob=Utilities.newBlob(bytes,parts.mimeType,safeName);
  var file=DriveApp.getFolderById(folders.sceneRecordingsFolderId).createFile(blob);
  var storedByteLength=number_(file.getSize(),bytes.length);
  assert_(storedByteLength===bytes.length,'The Drive audio file did not verify after upload.','UPLOAD_VERIFY_FAILED');

  var productionId=getActiveProductionId_();
  var recording={
    RecordingID:uuid_('BREC'),ProductionID:productionId,SceneNumber:sceneNumber,
    Title:title,FileID:file.getId(),MimeType:parts.mimeType,
    DurationSeconds:Math.max(0,number_(payload.durationSeconds,0)),
    SourceType:sourceType,OriginalFilename:originalFilename,OriginalMimeType:originalMimeType,
    OriginalByteLength:originalByteLength,StoredByteLength:storedByteLength,
    OptimizedForBlocking:optimized,OptimizationNote:optimizationNote,
    CreatedBy:context.userId,CreatedAt:nowIso_(),Status:'Active',UpdatedAt:nowIso_()
  };
  appendRecord_('BlockingSceneRecordings',recording);
  var verified=blockingSceneRecordingById_(recording.RecordingID);
  assert_(verified && String(verified.FileID||'')===String(file.getId()),'The scene recording catalog did not verify after upload.','UPLOAD_VERIFY_FAILED');
  var media=blockingSetActiveSceneRecording_(context,recording);
  assert_(media && String(media.FileID||'')===String(file.getId()),'The scene recording could not be linked back to the scene.','UPLOAD_VERIFY_FAILED');

  blockingActivity_(context,sourceType==='Upload'?'UPLOAD_SCENE_AUDIO':'RECORD_SCENE_AUDIO','BlockingSceneRecording',recording.RecordingID,{
    sceneNumber:sceneNumber,durationSeconds:number_(payload.durationSeconds,0),mimeType:parts.mimeType,
    fileId:file.getId(),originalFilename:originalFilename,originalByteLength:originalByteLength,
    storedByteLength:storedByteLength,optimizedForBlocking:optimized
  });
  return {saved:true,verified:true,recording:safeJsonForClient_(recording),media:safeJsonForClient_(media),storage:{fileId:file.getId(),storedByteLength:storedByteLength,driveVerified:true}};
}

function blockingSceneAudioAccessRecord_(fileId) {
  var catalog=blockingSceneRecordingByFileId_(fileId);
  if(catalog)return catalog;
  var productionId=getActiveProductionId_();
  return listRecords_('BlockingTimelineMedia',function(r){
    return String(r.ProductionID)===String(productionId)
      && String(r.FileID||'')===String(fileId)
      && String(r.Status||'Active')!=='Archived';
  })[0]||null;
}

function getBlockingSceneAudioInfo_(context,payload) {
  ensureBlockingSheets_();
  var fileId=sanitizeText_(payload.fileId||'',180);
  var access=blockingSceneAudioAccessRecord_(fileId);
  assert_(access,'Scene recording not found.','NOT_FOUND');
  var file=DriveApp.getFileById(fileId),blob=file.getBlob(),bytes=blob.getBytes();
  var chunkSize=384*1024;
  return {
    fileId:fileId,
    mimeType:access.MimeType||blob.getContentType()||'audio/webm',
    byteLength:bytes.length,chunkSize:chunkSize,chunkCount:Math.ceil(bytes.length/chunkSize),
    durationSeconds:number_(access.DurationSeconds,0),updatedAt:access.UpdatedAt||access.CreatedAt||''
  };
}

function getBlockingSceneAudioChunk_(context,payload) {
  ensureBlockingSheets_();
  var fileId=sanitizeText_(payload.fileId||'',180),index=Math.max(0,Math.floor(number_(payload.chunkIndex,0)));
  var access=blockingSceneAudioAccessRecord_(fileId);
  assert_(access,'Scene recording not found.','NOT_FOUND');
  var bytes=DriveApp.getFileById(fileId).getBlob().getBytes(),chunkSize=384*1024,start=index*chunkSize;
  assert_(start<bytes.length || (start===0&&bytes.length===0),'Audio chunk is out of range.','INVALID_CHUNK');
  var end=Math.min(bytes.length,start+chunkSize),part=[];
  for(var i=start;i<end;i++)part.push(bytes[i]);
  return {fileId:fileId,chunkIndex:index,base64:Utilities.base64Encode(part)};
}

function migrateBlockingSceneRecordingsV30_() {
  ensureBlockingSheets_();
  var productionId=getActiveProductionId_(),migrated=0;
  listRecords_('BlockingTimelineMedia',function(r){
    return String(r.ProductionID)===String(productionId)
      && String(r.MediaSource||'')==='SceneRecording'
      && !!String(r.FileID||'')
      && String(r.Status||'Active')!=='Archived';
  }).forEach(function(media){
    var existing=blockingSceneRecordingByFileId_(media.FileID);
    if(existing)return;
    appendRecord_('BlockingSceneRecordings',{
      RecordingID:media.RecordingID||uuid_('BREC'),ProductionID:productionId,SceneNumber:number_(media.SceneNumber,0),
      Title:media.RecordingTitle||('Scene '+media.SceneNumber+' rehearsal audio'),
      FileID:media.FileID,MimeType:media.MimeType||'audio/webm',
      DurationSeconds:number_(media.DurationSeconds,0),
      SourceType:media.SourceType||'Recorded',OriginalFilename:media.OriginalFilename||'',
      CreatedBy:media.UpdatedBy||'',CreatedAt:media.RecordedAt||media.UpdatedAt||nowIso_(),
      Status:'Active',UpdatedAt:media.UpdatedAt||nowIso_()
    });
    migrated++;
  });
  return migrated;
}

function upgradeBlockingStudioV30SceneAudioLibrary() {
  ensureBlockingSheets_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  var migrated=migrateBlockingSceneRecordingsV30_();
  Logger.log('Blocking & Staging Studio v30 scene audio library upgraded. Migrated '+migrated+' active recording(s).');
  return {
    success:true,build:BLOCKING_BUILD,sceneAudio:true,record:true,upload:true,savedRecordings:true,
    migratedRecordings:migrated,recordingsFolderUrl:folders.sceneRecordingsFolderUrl
  };
}

function installBlockingAndStagingHubV30() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  seedBlockingStructureV24_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  var v25=migrateBlockingCanvasToV25_();
  var v26=migrateBlockingCanvasToV26_();
  var recordings=migrateBlockingSceneRecordingsV30_();
  return {
    success:true,build:BLOCKING_BUILD,v25:v25,v26:v26,timeline:true,
    sceneAudio:true,record:true,upload:true,savedRecordings:true,
    migratedRecordings:recordings,folderUrl:folders.folderUrl
  };
}

function upgradeBlockingStudioV29ResponsiveSceneAudio() {
  ensureBlockingSheets_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  Logger.log('Blocking & Staging Studio v29 responsive workspace + scene audio upgraded.');
  return {success:true,build:BLOCKING_BUILD,sceneAudio:true,responsiveDirectorLayout:true,recordingsFolderUrl:folders.sceneRecordingsFolderUrl};
}

function installBlockingAndStagingHubV29() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  seedBlockingStructureV24_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  var v25=migrateBlockingCanvasToV25_();
  var v26=migrateBlockingCanvasToV26_();
  return {success:true,build:BLOCKING_BUILD,v25:v25,v26:v26,timeline:true,sceneAudio:true,responsiveDirectorLayout:true,folderUrl:folders.folderUrl};
}

function upgradeBlockingStudioV28TimelineMotion() {
  ensureBlockingSheets_();
  installBlockingHubValidationsV24_();
  Logger.log('Blocking & Staging Studio v28 timeline/motion upgraded.');
  return {success:true,build:BLOCKING_BUILD,timeline:true,objectTimelineKeys:true};
}

function installBlockingAndStagingHubV28() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  seedBlockingStructureV24_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  var v25=migrateBlockingCanvasToV25_();
  var v26=migrateBlockingCanvasToV26_();
  return {success:true,build:BLOCKING_BUILD,v25:v25,v26:v26,timeline:true,folderUrl:folders.folderUrl};
}

function upgradeBlockingStudioV27ObjectEditor() {
  ensureBlockingSheets_();
  installBlockingHubValidationsV24_();
  Logger.log('Blocking & Staging Studio v27 object/scenic editor upgraded.');
  return {success:true,build:BLOCKING_BUILD,objectColumns:true};
}

function installBlockingAndStagingHubV27() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  seedBlockingStructureV24_();
  installBlockingHubValidationsV24_();
  var folders=ensureBlockingFolders_();
  var v25=migrateBlockingCanvasToV25_();
  var v26=migrateBlockingCanvasToV26_();
  return {success:true,build:BLOCKING_BUILD,v25:v25,v26:v26,objectColumns:true,folderUrl:folders.folderUrl};
}


/** v31.1 emergency-safe repair: restores the v30 API surface and only improves
 * photo field selection plus the frontend zoom controls. No sheet migration. */
function upgradeBlockingStudioV31_1SafeProfileZoom() {
  ensureBlockingSheets_();
  Logger.log('Blocking & Staging Studio v31.1 safe profile/zoom repair ready.');
  return {success:true, build:BLOCKING_BUILD};
}


/** v32: isolated cast-photo resolver. No sheet migration and no global API changes. */
function upgradeBlockingStudioV32CastPhotoResolver() {
  ensureBlockingSheets_();
  var health;
  try {
    health = diagnoseBlockingCastPhotosV32();
  } catch (error) {
    health = { total: 0, readable: 0, warning: String(error && error.message || error) };
  }
  Logger.log('Blocking & Staging Studio v32 cast photo resolver ready.');
  return { success: true, build: BLOCKING_BUILD, photoHealth: health };
}


/** v33: direct canvas face renderer + persistent per-cast token colours. */
function upgradeBlockingStudioV33FaceRendererAndTokenStyles() {
  ensureBlockingSheets_();
  var productionId = getActiveProductionId_();
  var changed = 0;
  listRecords_('BlockingCast', function (row) {
    return String(row.ProductionID || '') === String(productionId)
      && String(row.Status || 'Active') !== 'Archived';
  }).forEach(function (row) {
    var patch = {};
    if (!/^#[0-9a-f]{6}$/i.test(String(row.TokenBackgroundColor || ''))) patch.TokenBackgroundColor = '#5e000f';
    if (!/^#[0-9a-f]{6}$/i.test(String(row.TokenInitialColor || ''))) patch.TokenInitialColor = '#ffffff';
    if (!/^#[0-9a-f]{6}$/i.test(String(row.TokenOutlineColor || ''))) patch.TokenOutlineColor = '#f8b918';
    if (Object.keys(patch).length) {
      patch.UpdatedAt = nowIso_();
      updateRecordByRow_('BlockingCast', row._row, patch);
      changed++;
    }
  });
  var health;
  try { health = diagnoseBlockingCastPhotosV32(); }
  catch (error) { health = { total:0, readable:0, warning:String(error && error.message || error) }; }
  Logger.log('Blocking Studio v33 direct face renderer + token styles ready.');
  return { success:true, build:BLOCKING_BUILD, tokenStylesInitialized:changed, photoHealth:health };
}


/** v38: selective ensemble rosters + multi-select token scaling. */
function upgradeBlockingStudioV38EnsembleMultiSelectScale() {
  ensureBlockingSheets_();
  Logger.log('Blocking Studio v38 ensemble roster + multi-select scale ready.');
  return {success:true,build:BLOCKING_BUILD,ensembleRoster:true,multiSelectScale:true};
}

/** v39.1: rehearsal-first controls, fullscreen-safe tools, and Stage Management cast management. */
function upgradeBlockingStudioV39_1RehearsalControls() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  Logger.log('Blocking Studio v39.1 rehearsal controls + Stage Management cast management ready.');
  return {
    success:true,
    build:BLOCKING_BUILD,
    stageManagementCanManageCast:true,
    fullscreenTools:true,
    persistentPanelRestore:true,
    mainFormationButton:true
  };
}


/** v40: verified save queue + autosave persistence audit. */
function diagnoseBlockingPersistenceV40() {
  ensureBlockingSheets_();
  var productionId=getActiveProductionId_();
  var folders=ensureBlockingFolders_();
  function rows(sheet){return listRecords_(sheet,function(r){return !r.ProductionID||String(r.ProductionID)===String(productionId);});}
  function count(sheet){return rows(sheet).length;}
  var stageGroup=listRecords_('PermissionGroups',function(r){return normalize_(r.GroupName)===normalize_('Stage Management Lead');})[0]||null;
  var managerPermission=listRecords_('Permissions',function(r){return String(r.PermissionKey)==='blocking.manage';})[0]||null;
  var stageCanManage=false;
  if(stageGroup&&managerPermission){stageCanManage=!!listRecords_('GroupPermissions',function(r){return String(r.PermissionGroupID)===String(stageGroup.PermissionGroupID)&&String(r.PermissionID)===String(managerPermission.PermissionID)&&bool_(r.Allowed);})[0];}

  var snapshots=rows('BlockingSnapshots'), placements=rows('BlockingPlacements'), cast=rows('BlockingCast');
  var snapshotIds={},castIds={};snapshots.forEach(function(r){snapshotIds[String(r.SnapshotID)]=true;});cast.forEach(function(r){castIds[String(r.BlockingCastID)]=true;});
  var orphanPlacements=placements.filter(function(r){return !snapshotIds[String(r.SnapshotID)]||!castIds[String(r.BlockingCastID)];});

  var recordingRows=rows('BlockingSceneRecordings'), readableRecordings=0, missingRecordingFiles=[];
  recordingRows.slice(0,250).forEach(function(r){
    if(!r.FileID)return;
    try{var f=DriveApp.getFileById(String(r.FileID));f.getName();readableRecordings++;}
    catch(error){missingRecordingFiles.push({recordingId:r.RecordingID||'',fileId:r.FileID||'',title:r.Title||''});}
  });

  var timelineMedia=rows('BlockingTimelineMedia'), brokenSceneMedia=[];
  timelineMedia.filter(function(r){return !!r.FileID;}).slice(0,250).forEach(function(r){
    try{var f=DriveApp.getFileById(String(r.FileID));f.getName();}
    catch(error){brokenSceneMedia.push({sceneNumber:r.SceneNumber,cueNumber:r.CueNumber||'',fileId:r.FileID||'',recordingTitle:r.RecordingTitle||''});}
  });

  var result={
    success:orphanPlacements.length===0&&missingRecordingFiles.length===0&&brokenSceneMedia.length===0&&stageCanManage,
    build:BLOCKING_BUILD,
    productionId:productionId,
    sheets:{
      snapshots:snapshots.length,
      placements:placements.length,
      objects:count('BlockingObjects'),
      timelineMedia:timelineMedia.length,
      markers:count('BlockingTimelineMarkers'),
      formations:count('BlockingTimelineKeyframes'),
      motions:count('BlockingTimelineMotions'),
      sceneRecordings:recordingRows.length,
      castAssignments:cast.length
    },
    drive:{
      blockingFolderUrl:folders.folderUrl,
      backgroundsFolderUrl:folders.backgroundsFolderUrl,
      sceneRecordingsFolderUrl:folders.sceneRecordingsFolderUrl,
      sceneRecordingFilesChecked:Math.min(250,recordingRows.length),
      sceneRecordingFilesReadable:readableRecordings,
      missingRecordingFiles:missingRecordingFiles,
      brokenTimelineAudioLinks:brokenSceneMedia
    },
    integrity:{orphanPlacements:orphanPlacements.length},
    permissions:{stageManagementCanManageCast:stageCanManage},
    limits:{tokenScaleMinPercent:25,tokenScaleMaxPercent:400,sceneAudioStoredUploadBytes:24*1024*1024,sceneAudioSourceBrowserBytes:150*1024*1024},
    note:'This diagnostic reads existing records/files only. v41 also verifies each stored scene-audio Drive file and scene link after upload.'
  };
  Logger.log(JSON.stringify(result,null,2));return result;
}

function upgradeBlockingStudioV40SaveAssurance() {
  ensureBlockingSheets_();installBlockingPermissionsV24_();var folders=ensureBlockingFolders_();
  Logger.log('Blocking Studio v40 save assurance ready.');
  return {success:true,build:BLOCKING_BUILD,autosave:true,queuedTimelineSaves:true,verifiedServerWrites:true,stageManagementCanManageCast:true,tokenScalePercent:'25-400',blockingFolderUrl:folders.folderUrl,sceneRecordingsFolderUrl:folders.sceneRecordingsFolderUrl};
}


/** v41: smart local dialogue-audio preparation + verified private Drive storage. */
function diagnoseBlockingSceneAudioV41() {
  ensureBlockingSheets_();
  var productionId=getActiveProductionId_(),folders=ensureBlockingFolders_();
  var rows=listRecords_('BlockingSceneRecordings',function(r){return String(r.ProductionID)===String(productionId)&&String(r.Status||'Active')!=='Archived';});
  var checked=0,readable=0,totalStored=0,totalOriginal=0,optimized=0,problems=[];
  rows.slice(0,250).forEach(function(r){
    if(bool_(r.OptimizedForBlocking))optimized++;
    totalStored+=number_(r.StoredByteLength,0);totalOriginal+=number_(r.OriginalByteLength,number_(r.StoredByteLength,0));
    if(!r.FileID){problems.push({recordingId:r.RecordingID||'',title:r.Title||'',problem:'Missing FileID'});return;}
    checked++;
    try{
      var f=DriveApp.getFileById(String(r.FileID)),size=number_(f.getSize(),0);f.getName();readable++;
      if(r.StoredByteLength&&size!==number_(r.StoredByteLength,0))problems.push({recordingId:r.RecordingID||'',title:r.Title||'',problem:'Stored byte count does not match Drive',sheetBytes:number_(r.StoredByteLength,0),driveBytes:size});
    } catch(error){problems.push({recordingId:r.RecordingID||'',title:r.Title||'',problem:'Drive file unreadable',fileId:r.FileID||''});}
  });
  var result={success:problems.length===0,build:BLOCKING_BUILD,productionId:productionId,recordings:rows.length,checked:checked,readable:readable,optimized:optimized,totalOriginalBytes:totalOriginal,totalStoredBytes:totalStored,estimatedBytesSaved:Math.max(0,totalOriginal-totalStored),problems:problems,sceneRecordingsFolderUrl:folders.sceneRecordingsFolderUrl,limits:{browserSourceMaxMB:150,targetPreparedMB:18,serverStoredMaxMB:24,microphoneBitrateKbps:48}};
  Logger.log(JSON.stringify(result,null,2));return result;
}

function upgradeBlockingStudioV41SceneAudio() {
  ensureBlockingSheets_();installBlockingPermissionsV24_();var folders=ensureBlockingFolders_();
  Logger.log('Blocking Studio v41 smart scene audio ready.');
  return {success:true,build:BLOCKING_BUILD,sourceUploadMaxMB:150,smartOptimizeTargetMB:18,storedFileHardMaxMB:24,microphoneBitrateKbps:48,persistentSceneLinks:true,driveUploadVerification:true,sceneRecordingsFolderUrl:folders.sceneRecordingsFolderUrl};
}


function upgradeBlockingStudioV41_2FastLoadSaveCache() {
  ensureBlockingSheets_();
  return {success:true,build:'blocking-hub-v41-2-fast-load-save-cache-20260813',message:'Fast cache, lightweight autosave acknowledgement, and linked-media index are ready. Redeploy the Web App after saving.'};
}

function diagnoseBlockingStudioV41_2Performance() {
  ensureBlockingSheets_();
  var productionId=getActiveProductionId_();
  var media=getBlockingTimelineMediaIndex_({userId:'diagnostic'},{}).media||[];
  return {
    success:true,
    build:'blocking-hub-v41-2-fast-load-save-cache-20260813',
    productionId:productionId,
    snapshots:listRecords_('BlockingSnapshots',function(r){return String(r.ProductionID)===String(productionId)&&String(r.Status||'Active')!=='Archived';}).length,
    cast:listRecords_('BlockingCast',function(r){return String(r.ProductionID)===String(productionId)&&String(r.Status||'Active')!=='Archived';}).length,
    linkedGuideVocals:media.filter(function(r){return !!r.TrackID;}).length,
    linkedSceneAudio:media.filter(function(r){return !!r.FileID;}).length,
    autosaveMode:'write-complete fast acknowledgement',
    manualSaveMode:'full read-back verification'
  };
}

/** v42: additive schema migration. Safe to run more than once. */
function upgradeBlockingStudioV42PersistentCreativeData() {
  ensureBlockingSheets_();
  installBlockingPermissionsV24_();
  var result={
    success:true,
    build:BLOCKING_BUILD,
    addedCastColumns:['HeightFeet','AvatarType'],
    addedSheets:['BlockingMusicMaps','BlockingReferenceMedia'],
    existingDataPreserved:true,
    nextStep:'Deploy a new Web App version using the existing deployment.'
  };
  Logger.log(JSON.stringify(result,null,2));
  return result;
}
