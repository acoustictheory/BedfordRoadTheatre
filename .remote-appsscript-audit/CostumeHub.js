/**
 * BEDFORD ROAD MUSICAL — COLLABORATIVE COSTUME DESIGN HUB v23
 *
 * Character design, looks, costume pieces, quick-change operations, fittings,
 * restricted measurements, private authenticated images, tasks, deadlines,
 * suggestions, activity history, archive/restore controls, and team roster.
 */

var COSTUME_HUB_V23_VERSION = '23.0';

var COSTUME_HUB_SCHEMAS = {
  CostumeCharacters: [
    'CharacterID','ProductionID','CharacterCode','CharacterName','ActorUserID',
    'ActorName','World','Track','Alignment','RoleType','FolderID','FolderURL',
    'Silhouette','ColorPalette','Textures','Layers','Accessories','Footwear',
    'HairWig','Makeup','CostumeNotes','OverallStatus','Complexity',
    'HasQuickChange','PrimaryImageFileID','CreatedByUserID','CreatedAt',
    'UpdatedByUserID','UpdatedAt','ArchivedAt','ArchivedByUserID',
    'DeletedAt','DeletedByUserID'
  ],
  CostumeChanges: [
    'CostumeChangeID','ProductionID','CharacterID','LookName','SceneSong','Act',
    'ChangeOrder','ChangeType','FromLook','ToLook','IsQuickChange',
    'TimeAvailable','ChangeLocation','AssistedByUserIDsJSON','PiecesNeeded',
    'PresetLocation','LaundryResetNotes','Status','PresetStatus','RunStatus',
    'LaundryStatus','Notes','LastCheckedByUserID','LastCheckedAt',
    'CreatedByUserID','CreatedAt','UpdatedByUserID','UpdatedAt',
    'ArchivedAt','ArchivedByUserID'
  ],
  CostumeMeasurements: [
    'MeasurementID','ProductionID','CharacterID','ActorUserID','ActorName','CastGroup',
    'DateMeasured','MeasuredByUserID','Height','ChestBust','Waist','Hips',
    'ShoulderWidth','Neck','SleeveLength','ArmLength','Wrist','Inseam','Outseam',
    'Thigh','Calf','Ankle','ShoeSize','HeadCircumference','HatSize','GloveSize',
    'FitNotes','MobilityNotes','AllergiesSensitivities','UpdatedByUserID','UpdatedAt'
  ],
  CostumeFittings: [
    'FittingID','ProductionID','CharacterID','ActorUserID','CastGroup','ScheduledAt',
    'Location','FittingType','Status','AssignedDresserUserIDsJSON','Notes',
    'PrivateNotes','CreatedByUserID','CreatedAt','UpdatedByUserID','UpdatedAt',
    'ArchivedAt','ArchivedByUserID'
  ],
  CostumePieces: [
    'CostumePieceID','ProductionID','CharacterID','CostumeChangeID','LookName',
    'ItemName','ItemType','Source','Status','AssignedUserIDsJSON','DueDate',
    'Size','Colour','StorageLocation','Notes','PrimaryImageFileID',
    'CreatedByUserID','CreatedAt','UpdatedByUserID','UpdatedAt',
    'ArchivedAt','ArchivedByUserID','DeletedAt','DeletedByUserID'
  ],
  CostumeDeadlines: [
    'CostumeDeadlineID','ProductionID','CharacterID','Title','DueDate','Priority',
    'Status','Notes','CreatedByUserID','CreatedAt','UpdatedByUserID','UpdatedAt',
    'ArchivedAt','ArchivedByUserID'
  ],
  CostumeImages: [
    'CostumeImageID','ProductionID','CharacterID','CostumeChangeID',
    'CostumePieceID','DriveFileID','FileName','MimeType','Caption','ImageType',
    'SortOrder','Status','UploadedByUserID','CreatedAt','DeletedAt',
    'DeletedByUserID'
  ],
  CostumeSuggestions: [
    'CostumeSuggestionID','ProductionID','CharacterID','CostumeChangeID',
    'CostumePieceID','SuggestedByUserID','SuggestionType','Title','Description',
    'Priority','ReferenceURL','Status','ReviewedByUserID','ReviewedAt',
    'ReviewNote','CreatedAt','UpdatedAt'
  ],
  CostumeActivity: [
    'CostumeActivityID','ProductionID','CharacterID','CostumeChangeID',
    'CostumePieceID','ActorUserID','Action','Summary','DetailsJSON','CreatedAt'
  ]
};

var COSTUME_CHARACTER_STATUSES = [
  'Not Started','Researching','Designing','Approved','Sourcing','Building',
  'Fitting','Alterations','Ready','In Rehearsal','Complete','Needs Repair','Archived'
];

var COSTUME_CHANGE_STATUSES = [
  'Not Started','Planned','Pieces Needed','Ready to Test','Rehearsing',
  'Locked','Complete','Needs Revision','Archived'
];

var COSTUME_PIECE_STATUSES = [
  'Not Started','Researching','To Purchase','Ordered','Pulled','Building',
  'Alterations','Ready for Fitting','Ready','In Use','Needs Repair',
  'Complete','Archived'
];

var COSTUME_PRIORITIES = ['Low','Medium','High','Urgent'];
var COSTUME_RUN_STATUSES = ['Not Checked','Ready','In Progress','Complete','Issue'];
var COSTUME_PRESET_STATUSES = ['Not Set','Set','Used','Returned','Reset'];
var COSTUME_LAUNDRY_STATUSES = ['Clean','Needs Laundry','In Laundry','Drying','Ready'];
var COSTUME_FITTING_STATUSES = [
  'Not Scheduled','Scheduled','Confirmed','Complete','Needs Follow-up','Cancelled','Archived'
];

function ensureCostumeHubSheet_(name, schema) {
  var spreadsheet = getDb_();
  var sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.getRange(1, 1, 1, schema.length).setValues([schema]);
    sheet.setFrozenRows(1);
  } else {
    var existing = headers_(sheet);
    var missing = schema.filter(function (header) {
      return existing.indexOf(header) < 0;
    });

    if (missing.length) {
      sheet.getRange(1, existing.length + 1, 1, missing.length)
        .setValues([missing]);
    }
  }

  var finalHeaders = headers_(sheet);
  sheet.getRange(1, 1, 1, finalHeaders.length)
    .setFontWeight('bold')
    .setBackground('#6b2b63')
    .setFontColor('#ffffff');

  return sheet;
}

function ensureCostumeHubSheets_() {
  Object.keys(COSTUME_HUB_SCHEMAS).forEach(function (name) {
    ensureCostumeHubSheet_(name, COSTUME_HUB_SCHEMAS[name]);
  });
}

function costumeDepartment_() {
  var department = listRecords_('Departments', function (record) {
    return String(record.Slug) === 'costumes';
  })[0];

  assert_(
    department,
    'The Costumes department was not found.',
    'COSTUME_DEPARTMENT_MISSING'
  );

  return department;
}

function costumeDepartmentId_() {
  return String(costumeDepartment_().DepartmentID);
}

function costumeHasPermission_(context, permissionKey) {
  return isFullAdmin_(context) || hasPermission_(context, permissionKey);
}

function costumeHasDepartmentAccess_(context) {
  return isFullAdmin_(context)
    || canAccessDepartment_(context, costumeDepartmentId_())
    || hasPermission_(context, 'costumes.manage')
    || hasPermission_(context, 'costumes.measurements');
}

function costumeOwnCharacterIds_(context) {
  var productionId = getActiveProductionId_();

  return listRecords_('CostumeCharacters', function (record) {
    return String(record.ProductionID || productionId) === String(productionId)
      && String(record.ActorUserID) === String(context.userId)
      && !record.DeletedAt;
  }).map(function (record) {
    return String(record.CharacterID);
  });
}

function costumeCanView_(context) {
  if (costumeHasDepartmentAccess_(context)) return true;

  try {
    return costumeOwnCharacterIds_(context).length > 0;
  } catch (error) {
    return false;
  }
}

function costumeCanContribute_(context) {
  return costumeCanView_(context)
    || costumeHasPermission_(context, 'costumes.contribute');
}

function costumeCanManage_(context) {
  return isFullAdmin_(context)
    || hasPermission_(context, 'costumes.manage')
    || (
      hasPermission_(context, 'department.manage')
      && canAccessDepartment_(context, costumeDepartmentId_())
    );
}

function costumeCanArchive_(context) {
  return isFullAdmin_(context) || hasPermission_(context, 'costumes.archive');
}

function costumeCanAudit_(context) {
  return isFullAdmin_(context) || hasPermission_(context, 'costumes.audit');
}

function costumeCanManageMeasurements_(context) {
  return isFullAdmin_(context)
    || hasPermission_(context, 'costumes.measurements');
}

function requireCostumeView_(context) {
  assert_(
    costumeCanView_(context),
    'You do not have access to the Costume Design Hub.',
    'FORBIDDEN'
  );
}

function requireCostumeContribution_(context) {
  assert_(
    costumeCanContribute_(context),
    'Costume department access is required.',
    'FORBIDDEN'
  );
}

function requireCostumeManage_(context) {
  assert_(
    costumeCanManage_(context),
    'Costume manager access is required.',
    'FORBIDDEN'
  );
}

function requireCostumeArchive_(context) {
  assert_(
    costumeCanArchive_(context),
    'Costume archive permission is required.',
    'FORBIDDEN'
  );
}

function requireCostumeMeasurements_(context) {
  assert_(
    costumeCanManageMeasurements_(context),
    'Costume measurement permission is required.',
    'FORBIDDEN'
  );
}

function ensureCostumePermission_(permissionKey, description) {
  var existing = listRecords_('Permissions', function (record) {
    return String(record.PermissionKey) === String(permissionKey);
  })[0];

  if (existing) return existing.PermissionID;

  var id = uuid_('PERM');
  appendRecord_('Permissions', {
    PermissionID: id,
    PermissionKey: permissionKey,
    Category: 'Costumes',
    Description: description
  });

  return id;
}

function ensureCostumePermissionGroup_(groupName, description, permissionKeys) {
  var group = listRecords_('PermissionGroups', function (record) {
    return String(record.GroupName) === String(groupName);
  })[0];

  if (!group) {
    group = {
      PermissionGroupID: uuid_('PGRP'),
      GroupName: groupName,
      Description: description,
      Status: 'Active'
    };
    appendRecord_('PermissionGroups', group);
  } else {
    updateRecordByRow_('PermissionGroups', group._row, {
      Description: description,
      Status: 'Active'
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
        GroupPermissionID: uuid_('GP'),
        PermissionGroupID: group.PermissionGroupID,
        PermissionID: permission.PermissionID,
        Allowed: true
      });
    } else if (!bool_(link.Allowed)) {
      updateRecordByRow_('GroupPermissions', link._row, { Allowed: true });
    }
  });

  return group.PermissionGroupID;
}

function installCostumeHubPermissions_() {
  ensureCostumePermission_(
    'costumes.contribute',
    'Submit costume suggestions, images, discussion notes, and operational updates.'
  );
  ensureCostumePermission_(
    'costumes.manage',
    'Create and edit costume characters, looks, pieces, fittings, deadlines, assignments, and tasks.'
  );
  ensureCostumePermission_(
    'costumes.archive',
    'Archive and restore costume records.'
  );
  ensureCostumePermission_(
    'costumes.audit',
    'View detailed Costume Hub activity history.'
  );
  ensureCostumePermission_(
    'costumes.measurements',
    'View and edit private actor measurements, fit notes, mobility notes, and sensitivities.'
  );

  ensureCostumePermissionGroup_(
    'Costume Department Lead',
    'Operational costume leadership without private measurements, archive, or permanent deletion.',
    ['notes.post','costumes.contribute','costumes.manage']
  );

  ensureCostumePermissionGroup_(
    'Costume Department Manager',
    'Complete costume management including measurements, archives, and activity review.',
    [
      'notes.post','costumes.contribute','costumes.manage',
      'costumes.archive','costumes.audit','costumes.measurements'
    ]
  );

  ensureCostumePermissionGroup_(
    'Costume Measurements & Fittings',
    'Restricted access to actor measurements, fitting notes, mobility needs, and sensitivities.',
    ['costumes.measurements']
  );
}

function costumeFolderSettingKey_(suffix) {
  return 'COSTUME_HUB_' + String(suffix) + '_' + getActiveProductionId_();
}

function ensureCostumeHubFolders_() {
  var rootId = getScriptSetting_(costumeFolderSettingKey_('FOLDER_ID'), '');
  var imagesId = getScriptSetting_(costumeFolderSettingKey_('IMAGES_FOLDER_ID'), '');
  var root = null;
  var images = null;

  if (!rootId) {
    try {
      root = DriveApp.getFolderById('1hhyc9veyHlhIY5VA8Bo5VDoUfDN3DCK0');
      rootId = root.getId();
      setScriptSetting_(costumeFolderSettingKey_('FOLDER_ID'), rootId);
    } catch (error) {}
  }

  if (rootId) {
    try { root = DriveApp.getFolderById(rootId); } catch (error) {}
  }

  if (!root) {
    var production = getActiveProduction_();
    var parentId = getScriptSetting_('PRODUCTION_FILES_FOLDER_ID', '');
    var parent = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
    root = parent.createFolder(
      String(production.Title || 'Bedford Musical') + ' - Costume Hub'
    );
    setScriptSetting_(costumeFolderSettingKey_('FOLDER_ID'), root.getId());
  }

  if (imagesId) {
    try { images = DriveApp.getFolderById(imagesId); } catch (error) {}
  }

  if (!images) {
    images = root.createFolder('Costume Images');
    setScriptSetting_(costumeFolderSettingKey_('IMAGES_FOLDER_ID'), images.getId());
  }

  return {
    folderId: root.getId(),
    folderUrl: root.getUrl(),
    imagesFolderId: images.getId(),
    imagesFolderUrl: images.getUrl()
  };
}

function installCostumeHubValidations_() {
  var spreadsheet = getDb_();

  function listRule(values) {
    return SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(true)
      .build();
  }

  var configurations = [
    ['CostumeCharacters','OverallStatus',COSTUME_CHARACTER_STATUSES],
    ['CostumeChanges','Status',COSTUME_CHANGE_STATUSES],
    ['CostumeChanges','PresetStatus',COSTUME_PRESET_STATUSES],
    ['CostumeChanges','RunStatus',COSTUME_RUN_STATUSES],
    ['CostumeChanges','LaundryStatus',COSTUME_LAUNDRY_STATUSES],
    ['CostumeFittings','Status',COSTUME_FITTING_STATUSES],
    ['CostumePieces','Status',COSTUME_PIECE_STATUSES],
    ['CostumeDeadlines','Priority',COSTUME_PRIORITIES],
    ['CostumeSuggestions','Priority',COSTUME_PRIORITIES]
  ];

  configurations.forEach(function (config) {
    var sheet = spreadsheet.getSheetByName(config[0]);
    if (!sheet) return;

    var headers = headers_(sheet);
    var index = headers.indexOf(config[1]);
    if (index < 0) return;

    sheet.getRange(2, index + 1, Math.max(1, sheet.getMaxRows() - 1), 1)
      .setDataValidation(listRule(config[2]));
  });
}

function installCollaborativeCostumeHubV23() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    ensureCostumeHubSheets_();
    installCostumeHubPermissions_();
    var folders = ensureCostumeHubFolders_();
    var imported = importCostumeHubSeedV23_();
    installCostumeHubValidations_();

    if (typeof bumpSiteDataRevision_ === 'function') {
      bumpSiteDataRevision_();
    }

    var result = {
      success: true,
      version: COSTUME_HUB_V23_VERSION,
      imported: imported,
      costumeFolderUrl: folders.folderUrl,
      imagesFolderUrl: folders.imagesFolderUrl,
      spreadsheetUrl: getDb_().getUrl()
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function costumeActiveRows_(sheetName, includeArchived) {
  var productionId = getActiveProductionId_();

  return listRecords_(sheetName, function (record) {
    if (
      record.ProductionID
      && String(record.ProductionID) !== String(productionId)
    ) {
      return false;
    }

    if (record.DeletedAt || String(record.Status) === 'Deleted') return false;
    if (!includeArchived && String(record.Status) === 'Archived') return false;
    return true;
  });
}

function costumeProfileMaps_() {
  var profiles = {};
  var users = {};

  listRecords_('Profiles').forEach(function (profile) {
    profiles[String(profile.UserID)] = profile;
  });

  listRecords_('Users').forEach(function (user) {
    users[String(user.UserID)] = user;
  });

  return { profiles: profiles, users: users };
}

function costumePersonSummary_(userId, maps) {
  var profile = maps.profiles[String(userId)] || {};
  var user = maps.users[String(userId)] || {};

  return {
    UserID: userId || '',
    DisplayName: profile.DisplayName || user.Username || 'Production Team',
    Username: user.Username || '',
    PhotoURL: profile.PhotoURL || '',
    PhotoFileID: profile.PhotoFileID || ''
  };
}

function getCostumeTeam_(context) {
  var productionId = getActiveProductionId_();
  var departmentId = costumeDepartmentId_();
  var maps = costumeProfileMaps_();

  var rows = listRecords_('UserDepartments', function (record) {
    return String(record.ProductionID) === String(productionId)
      && String(record.DepartmentID) === String(departmentId)
      && String(record.Status || 'Active') === 'Active';
  });

  return safeJsonForClient_(rows.map(function (membership) {
    var person = costumePersonSummary_(membership.UserID, maps);
    person.RoleLabel = membership.RoleLabel || 'Costume Member';
    return person;
  }).sort(function (a, b) {
    return String(a.DisplayName).localeCompare(String(b.DisplayName));
  }));
}

function costumeActivity_(context, characterId, changeId, pieceId, action, summary, details) {
  appendRecord_('CostumeActivity', {
    CostumeActivityID: uuid_('CACT'),
    ProductionID: getActiveProductionId_(),
    CharacterID: characterId || '',
    CostumeChangeID: changeId || '',
    CostumePieceID: pieceId || '',
    ActorUserID: context ? context.userId : '',
    Action: action,
    Summary: sanitizeText_(summary, 600),
    DetailsJSON: jsonStringify_(details || {}),
    CreatedAt: nowIso_()
  });
}

function getCostumeActivity_(context, limit) {
  var maps = costumeProfileMaps_();

  return safeJsonForClient_(
    costumeActiveRows_('CostumeActivity', true)
      .sort(function (a, b) {
        return new Date(b.CreatedAt || 0).getTime()
          - new Date(a.CreatedAt || 0).getTime();
      })
      .slice(0, limit || 100)
      .map(function (record) {
        record.Actor = costumePersonSummary_(record.ActorUserID, maps);
        record.Details = jsonParse_(record.DetailsJSON, {});
        return record;
      })
  );
}

function getCostumeAnnouncements_(context) {
  var productionId = getActiveProductionId_();
  var departmentId = costumeDepartmentId_();
  var audienceRows = listRecords_('AnnouncementAudiences', function (record) {
    return String(record.AudienceType) === 'Department'
      && String(record.AudienceID) === String(departmentId);
  });

  var ids = audienceRows.map(function (row) {
    return String(row.AnnouncementID);
  });

  return safeJsonForClient_(
    listRecords_('Announcements', function (record) {
      return String(record.ProductionID) === String(productionId)
        && String(record.Status) === 'Published'
        && !record.DeletedAt
        && (
          ids.indexOf(String(record.AnnouncementID)) >= 0
          || bool_(record.Pinned)
        );
    }).sort(function (a, b) {
      return new Date(b.PublishAt || b.CreatedAt || 0).getTime()
        - new Date(a.PublishAt || a.CreatedAt || 0).getTime();
    }).slice(0, 8)
  );
}

function costumeTasks_(context) {
  var productionId = getActiveProductionId_();
  var departmentId = costumeDepartmentId_();

  return listRecords_('Tasks', function (record) {
    return String(record.ProductionID) === String(productionId)
      && !record.DeletedAt
      && String(record.Status) !== 'Deleted'
      && (
        String(record.DepartmentID) === String(departmentId)
        || jsonParse_(record.AssignedDepartmentIDsJSON, [])
          .map(String)
          .indexOf(String(departmentId)) >= 0
        || ['CostumeCharacter','CostumeChange','CostumePiece','CostumeHub']
          .indexOf(String(record.RelatedType)) >= 0
      );
  }).map(function (record) {
    record.AssignedUserIDs = jsonParse_(record.AssignedUserIDsJSON, []);
    return record;
  });
}

function costumeCharacterById_(characterId) {
  return listRecords_('CostumeCharacters', function (record) {
    return String(record.CharacterID) === String(characterId)
      && !record.DeletedAt;
  })[0];
}

function costumeCanViewMeasurementRow_(context, measurement, character) {
  if (costumeCanManageMeasurements_(context)) return true;

  if (
    measurement.ActorUserID
    && String(measurement.ActorUserID) === String(context.userId)
  ) {
    return true;
  }

  if (
    character
    && character.ActorUserID
    && String(character.ActorUserID) === String(context.userId)
  ) {
    return true;
  }

  return false;
}

function costumeVisibleMeasurements_(context, measurements, characters) {
  var characterMap = {};

  characters.forEach(function (character) {
    characterMap[String(character.CharacterID)] = character;
  });

  return measurements.filter(function (measurement) {
    return costumeCanViewMeasurementRow_(
      context,
      measurement,
      characterMap[String(measurement.CharacterID)]
    );
  });
}

function getCostumeStats_(characters, changes, pieces, fittings, deadlines, tasks, images) {
  var now = Date.now();

  return {
    totalCharacters: characters.filter(function (record) {
      return String(record.OverallStatus) !== 'Archived';
    }).length,
    readyCharacters: characters.filter(function (record) {
      return ['Ready','Complete'].indexOf(String(record.OverallStatus)) >= 0;
    }).length,
    quickChanges: changes.filter(function (record) {
      return bool_(record.IsQuickChange);
    }).length,
    untestedQuickChanges: changes.filter(function (record) {
      return bool_(record.IsQuickChange)
        && ['Locked','Complete'].indexOf(String(record.Status)) < 0;
    }).length,
    piecesNeeded: pieces.filter(function (record) {
      return ['Ready','In Use','Complete'].indexOf(String(record.Status)) < 0
        && String(record.Status) !== 'Archived';
    }).length,
    fittingsDue: fittings.filter(function (record) {
      return ['Complete','Cancelled','Archived'].indexOf(String(record.Status)) < 0;
    }).length,
    openTasks: tasks.filter(function (record) {
      return ['Complete','Completed','Done','Deleted'].indexOf(String(record.Status)) < 0;
    }).length,
    overdueDeadlines: deadlines.filter(function (record) {
      return record.DueDate
        && new Date(record.DueDate).getTime() < now
        && String(record.Status) !== 'Complete'
        && String(record.Status) !== 'Archived';
    }).length,
    laundryNeeded: changes.filter(function (record) {
      return ['Needs Laundry','In Laundry','Drying'].indexOf(String(record.LaundryStatus)) >= 0;
    }).length,
    images: images.length
  };
}

function getCostumeHub_(context, payload) {
  requireCostumeView_(context);

  var includeArchived = bool_(payload && payload.includeArchived);
  var maps = costumeProfileMaps_();
  var characters = costumeActiveRows_('CostumeCharacters', includeArchived);
  var changes = costumeActiveRows_('CostumeChanges', includeArchived);
  var pieces = costumeActiveRows_('CostumePieces', includeArchived);
  var allMeasurements = costumeActiveRows_('CostumeMeasurements', true);
  var fittings = costumeActiveRows_('CostumeFittings', includeArchived);
  var deadlines = costumeActiveRows_('CostumeDeadlines', includeArchived);
  var images = costumeActiveRows_('CostumeImages', false);
  var tasks = costumeTasks_(context);
  ensureBlockingSheets_();
  var blockingCharacters = listRecords_('BlockingCharacters', function (record) {
    return String(record.ProductionID) === String(getActiveProductionId_()) && String(record.Status || 'Active') !== 'Archived';
  });
  var blockingCharacterMap = {};
  blockingCharacters.forEach(function (record) { blockingCharacterMap[String(record.CharacterID)] = record; });
  var castAssignments = listRecords_('BlockingCast', function (record) {
    return String(record.ProductionID) === String(getActiveProductionId_()) && String(record.Status || 'Active') !== 'Archived';
  }).map(function (record) {
    var blockingCharacter = blockingCharacterMap[String(record.CharacterID)] || {};
    return {
      BlockingCastID: record.BlockingCastID,
      UserID: record.UserID,
      PersonName: costumePersonSummary_(record.UserID, maps).DisplayName || record.DisplayLabel || '',
      CharacterName: blockingCharacter.CharacterName || '',
      CharacterKey: blockingCharacter.CharacterKey || '',
      CastGroup: record.CastGroup || 'Single'
    };
  });

  if (!costumeHasDepartmentAccess_(context)) {
    var ownCharacterIds = costumeOwnCharacterIds_(context);
    castAssignments = castAssignments.filter(function (record) { return String(record.UserID) === String(context.userId); });

    characters = characters.filter(function (record) {
      return ownCharacterIds.indexOf(String(record.CharacterID)) >= 0;
    });

    changes = changes.filter(function (record) {
      return ownCharacterIds.indexOf(String(record.CharacterID)) >= 0;
    });

    pieces = pieces.filter(function (record) {
      return ownCharacterIds.indexOf(String(record.CharacterID)) >= 0;
    });

    fittings = fittings.filter(function (record) {
      return ownCharacterIds.indexOf(String(record.CharacterID)) >= 0;
    });

    deadlines = deadlines.filter(function (record) {
      return !record.CharacterID
        || ownCharacterIds.indexOf(String(record.CharacterID)) >= 0;
    });

    images = images.filter(function (record) {
      return ownCharacterIds.indexOf(String(record.CharacterID)) >= 0;
    });

    tasks = tasks.filter(function (record) {
      return ownCharacterIds.indexOf(String(record.RelatedID)) >= 0;
    });
  }

  var measurements = costumeVisibleMeasurements_(context, allMeasurements, characters);
  var suggestions = costumeActiveRows_('CostumeSuggestions', true).filter(function (record) {
    return costumeCanManage_(context)
      || String(record.SuggestedByUserID) === String(context.userId);
  });

  changes.forEach(function (record) {
    record.AssistedByUserIDs = jsonParse_(record.AssistedByUserIDsJSON, []);
  });

  pieces.forEach(function (record) {
    record.AssignedUserIDs = jsonParse_(record.AssignedUserIDsJSON, []);
  });

  fittings.forEach(function (record) {
    record.AssignedDresserUserIDs = jsonParse_(
      record.AssignedDresserUserIDsJSON,
      []
    );

    if (!costumeCanManageMeasurements_(context)) {
      record.PrivateNotes = '';
    }
  });

  images.forEach(function (record) {
    record.Uploader = costumePersonSummary_(record.UploadedByUserID, maps);
    record.PhotoRef = 'drivefile:' + record.DriveFileID;
  });

  suggestions.forEach(function (record) {
    record.SuggestedBy = costumePersonSummary_(record.SuggestedByUserID, maps);
  });

  return {
    success: true,
    version: COSTUME_HUB_V23_VERSION,
    context: safeJsonForClient_(context),
    department: safeJsonForClient_(costumeDepartment_()),
    permissions: {
      view: costumeCanView_(context),
      contribute: costumeCanContribute_(context),
      manage: costumeCanManage_(context),
      archive: costumeCanArchive_(context),
      audit: costumeCanAudit_(context),
      measurements: costumeCanManageMeasurements_(context),
      permanentDelete: isFullAdmin_(context)
    },
    characters: safeJsonForClient_(characters),
    castAssignments: safeJsonForClient_(castAssignments),
    changes: safeJsonForClient_(changes),
    pieces: safeJsonForClient_(pieces),
    measurements: safeJsonForClient_(measurements),
    fittings: safeJsonForClient_(fittings),
    deadlines: safeJsonForClient_(deadlines),
    tasks: safeJsonForClient_(tasks),
    images: safeJsonForClient_(images),
    suggestions: safeJsonForClient_(suggestions),
    announcements: getCostumeAnnouncements_(context),
    team: getCostumeTeam_(context),
    activity: getCostumeActivity_(
      context,
      costumeCanAudit_(context) ? 300 : 45
    ),
    stats: getCostumeStats_(
      characters,
      changes,
      pieces,
      fittings,
      deadlines,
      tasks,
      images
    ),
    folderUrl: ensureCostumeHubFolders_().folderUrl
  };
}

function updateCostumeRecordById_(sheetName, idColumn, id, patch) {
  var record = listRecords_(sheetName, function (row) {
    return String(row[idColumn]) === String(id);
  })[0];

  assert_(record, 'Record not found.', 'NOT_FOUND');
  updateRecordByRow_(sheetName, record._row, patch);
  return Object.assign({}, record, patch);
}

function costumeBoolean_(value) {
  return value === true
    || String(value || '').toLowerCase() === 'true'
    || String(value || '').toLowerCase() === 'yes'
    || String(value || '') === '1';
}

function saveCostumeCharacter_(context, payload) {
  requireCostumeManage_(context);

  var id = sanitizeText_(payload.characterId, 100) || uuid_('CCHAR');
  var existing = listRecords_('CostumeCharacters', function (record) {
    return String(record.CharacterID) === String(id);
  })[0];

  var patch = {
    ProductionID: getActiveProductionId_(),
    CharacterCode: sanitizeText_(payload.characterCode || id, 80),
    CharacterName: sanitizeText_(payload.characterName, 180),
    ActorUserID: sanitizeText_(payload.actorUserId, 100),
    ActorName: sanitizeText_(payload.actorName, 180),
    World: sanitizeText_(payload.world, 120),
    Track: sanitizeText_(payload.track, 120),
    Alignment: sanitizeText_(payload.alignment, 120),
    RoleType: sanitizeText_(payload.roleType, 120),
    FolderID: sanitizeText_(payload.folderId, 200),
    FolderURL: sanitizeText_(payload.folderUrl, 1000),
    Silhouette: sanitizeText_(payload.silhouette, 1000),
    ColorPalette: sanitizeText_(payload.colorPalette, 1000),
    Textures: sanitizeText_(payload.textures, 1000),
    Layers: sanitizeText_(payload.layers, 1000),
    Accessories: sanitizeText_(payload.accessories, 1000),
    Footwear: sanitizeText_(payload.footwear, 1000),
    HairWig: sanitizeText_(payload.hairWig, 1000),
    Makeup: sanitizeText_(payload.makeup, 1000),
    CostumeNotes: sanitizeText_(payload.costumeNotes, 4000),
    OverallStatus: COSTUME_CHARACTER_STATUSES.indexOf(String(payload.overallStatus)) >= 0
      ? String(payload.overallStatus)
      : 'Not Started',
    Complexity: sanitizeText_(payload.complexity || 'Standard', 120),
    HasQuickChange: costumeBoolean_(payload.hasQuickChange),
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  assert_(patch.CharacterName, 'Character name is required.', 'NAME_REQUIRED');

  if (existing) {
    updateRecordByRow_('CostumeCharacters', existing._row, patch);
  } else {
    patch.CharacterID = id;
    patch.PrimaryImageFileID = '';
    patch.CreatedByUserID = context.userId;
    patch.CreatedAt = nowIso_();
    patch.ArchivedAt = '';
    patch.ArchivedByUserID = '';
    patch.DeletedAt = '';
    patch.DeletedByUserID = '';
    appendRecord_('CostumeCharacters', patch);
  }

  var measurement = listRecords_('CostumeMeasurements', function (record) {
    return String(record.CharacterID) === String(id);
  })[0];

  if (measurement) {
    updateRecordByRow_('CostumeMeasurements', measurement._row, {
      ActorUserID: patch.ActorUserID,
      ActorName: patch.ActorName,
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    });
  }

  costumeActivity_(
    context,
    id,
    '',
    '',
    existing ? 'UPDATE_CHARACTER' : 'CREATE_CHARACTER',
    (existing ? 'Updated ' : 'Created ') + patch.CharacterName + '.',
    { status: patch.OverallStatus, actorName: patch.ActorName }
  );

  audit_(
    context.userId,
    existing ? 'UPDATE_COSTUME_CHARACTER' : 'CREATE_COSTUME_CHARACTER',
    'CostumeCharacter',
    id,
    { status: patch.OverallStatus, actorUserId: patch.ActorUserID }
  );

  return { saved: true, characterId: id };
}

function archiveCostumeCharacter_(context, payload) {
  requireCostumeArchive_(context);

  var item = updateCostumeRecordById_(
    'CostumeCharacters',
    'CharacterID',
    payload.characterId,
    {
      OverallStatus: 'Archived',
      ArchivedAt: nowIso_(),
      ArchivedByUserID: context.userId,
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    }
  );

  costumeActivity_(
    context,
    item.CharacterID,
    '',
    '',
    'ARCHIVE_CHARACTER',
    'Archived ' + item.CharacterName + '.',
    {}
  );

  return { archived: true };
}

function restoreCostumeCharacter_(context, payload) {
  requireCostumeArchive_(context);

  var item = updateCostumeRecordById_(
    'CostumeCharacters',
    'CharacterID',
    payload.characterId,
    {
      OverallStatus: sanitizeText_(payload.status || 'Not Started', 80),
      ArchivedAt: '',
      ArchivedByUserID: '',
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    }
  );

  costumeActivity_(
    context,
    item.CharacterID,
    '',
    '',
    'RESTORE_CHARACTER',
    'Restored ' + item.CharacterName + '.',
    {}
  );

  return { restored: true };
}

function deleteCostumeCharacterPermanently_(context, payload) {
  assert_(
    isFullAdmin_(context),
    'Only a Full Administrator can permanently delete a character.',
    'FORBIDDEN'
  );

  assert_(
    String(payload.confirmation) === 'DELETE',
    'Type DELETE to confirm permanent deletion.',
    'CONFIRMATION_REQUIRED'
  );

  var item = costumeCharacterById_(payload.characterId);
  assert_(item, 'Character not found.', 'NOT_FOUND');

  listRecords_('CostumeImages', function (record) {
    return String(record.CharacterID) === String(payload.characterId);
  }).forEach(function (image) {
    try { DriveApp.getFileById(image.DriveFileID).setTrashed(true); } catch (error) {}
  });

  [
    'CostumeCharacters','CostumeChanges','CostumeMeasurements','CostumeFittings',
    'CostumePieces','CostumeDeadlines','CostumeImages','CostumeSuggestions'
  ].forEach(function (sheetName) {
    deleteRowsWhere_(sheetName, function (record) {
      return String(record.CharacterID) === String(payload.characterId);
    });
  });

  listRecords_('Tasks', function (record) {
    return ['CostumeCharacter','CostumeChange','CostumePiece'].indexOf(String(record.RelatedType)) >= 0
      && String(record.RelatedID) === String(payload.characterId);
  }).forEach(function (task) {
    updateRecordByRow_('Tasks', task._row, {
      Status: 'Deleted',
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    });
  });

  costumeActivity_(
    context,
    payload.characterId,
    '',
    '',
    'DELETE_CHARACTER',
    'Permanently deleted ' + String(item.CharacterName || payload.characterId) + '.',
    { confirmation: 'DELETE' }
  );

  audit_(
    context.userId,
    'DELETE_COSTUME_CHARACTER_PERMANENTLY',
    'CostumeCharacter',
    payload.characterId,
    { characterName: item.CharacterName }
  );

  return { deleted: true };
}

function saveCostumeChange_(context, payload) {
  requireCostumeManage_(context);

  var id = sanitizeText_(payload.costumeChangeId, 100) || uuid_('CCHG');
  var existing = listRecords_('CostumeChanges', function (record) {
    return String(record.CostumeChangeID) === String(id);
  })[0];

  var character = costumeCharacterById_(payload.characterId);
  assert_(character, 'Select a valid character.', 'CHARACTER_REQUIRED');

  var patch = {
    ProductionID: getActiveProductionId_(),
    CharacterID: String(payload.characterId),
    LookName: sanitizeText_(payload.lookName, 180),
    SceneSong: sanitizeText_(payload.sceneSong, 1200),
    Act: sanitizeText_(payload.act, 80),
    ChangeOrder: Math.max(0, number_(payload.changeOrder, 0)),
    ChangeType: sanitizeText_(payload.changeType || 'Full Look', 120),
    FromLook: sanitizeText_(payload.fromLook, 180),
    ToLook: sanitizeText_(payload.toLook || payload.lookName, 180),
    IsQuickChange: costumeBoolean_(payload.isQuickChange),
    TimeAvailable: sanitizeText_(payload.timeAvailable, 300),
    ChangeLocation: sanitizeText_(payload.changeLocation, 300),
    AssistedByUserIDsJSON: jsonStringify_(payload.assistedByUserIds || []),
    PiecesNeeded: sanitizeText_(payload.piecesNeeded, 2500),
    PresetLocation: sanitizeText_(payload.presetLocation, 500),
    LaundryResetNotes: sanitizeText_(payload.laundryResetNotes, 2000),
    Status: COSTUME_CHANGE_STATUSES.indexOf(String(payload.status)) >= 0
      ? String(payload.status)
      : 'Not Started',
    PresetStatus: COSTUME_PRESET_STATUSES.indexOf(String(payload.presetStatus)) >= 0
      ? String(payload.presetStatus)
      : 'Not Set',
    RunStatus: COSTUME_RUN_STATUSES.indexOf(String(payload.runStatus)) >= 0
      ? String(payload.runStatus)
      : 'Not Checked',
    LaundryStatus: COSTUME_LAUNDRY_STATUSES.indexOf(String(payload.laundryStatus)) >= 0
      ? String(payload.laundryStatus)
      : 'Clean',
    Notes: sanitizeText_(payload.notes, 2500),
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  assert_(patch.LookName, 'Look name is required.', 'NAME_REQUIRED');

  if (existing) {
    updateRecordByRow_('CostumeChanges', existing._row, patch);
  } else {
    patch.CostumeChangeID = id;
    patch.LastCheckedByUserID = '';
    patch.LastCheckedAt = '';
    patch.CreatedByUserID = context.userId;
    patch.CreatedAt = nowIso_();
    patch.ArchivedAt = '';
    patch.ArchivedByUserID = '';
    appendRecord_('CostumeChanges', patch);
  }

  costumeActivity_(
    context,
    patch.CharacterID,
    id,
    '',
    existing ? 'UPDATE_CHANGE' : 'CREATE_CHANGE',
    (existing ? 'Updated look/change: ' : 'Created look/change: ') + patch.LookName,
    { quickChange: patch.IsQuickChange, status: patch.Status }
  );

  return { saved: true, costumeChangeId: id };
}

function updateCostumeChangeRunStatus_(context, payload) {
  requireCostumeContribution_(context);

  var change = listRecords_('CostumeChanges', function (record) {
    return String(record.CostumeChangeID) === String(payload.costumeChangeId);
  })[0];

  assert_(change, 'Costume change not found.', 'NOT_FOUND');

  var patch = {
    LastCheckedByUserID: context.userId,
    LastCheckedAt: nowIso_(),
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  if (COSTUME_RUN_STATUSES.indexOf(String(payload.runStatus)) >= 0) {
    patch.RunStatus = String(payload.runStatus);
  }

  if (COSTUME_PRESET_STATUSES.indexOf(String(payload.presetStatus)) >= 0) {
    patch.PresetStatus = String(payload.presetStatus);
  }

  if (COSTUME_LAUNDRY_STATUSES.indexOf(String(payload.laundryStatus)) >= 0) {
    patch.LaundryStatus = String(payload.laundryStatus);
  }

  updateRecordByRow_('CostumeChanges', change._row, patch);

  costumeActivity_(
    context,
    change.CharacterID,
    change.CostumeChangeID,
    '',
    'UPDATE_RUN_STATUS',
    'Updated run status for ' + change.LookName + '.',
    patch
  );

  return { saved: true };
}

function resetCostumeChangeRun_(context) {
  requireCostumeManage_(context);

  costumeActiveRows_('CostumeChanges', false).forEach(function (record) {
    updateRecordByRow_('CostumeChanges', record._row, {
      PresetStatus: 'Not Set',
      RunStatus: 'Not Checked',
      LastCheckedByUserID: '',
      LastCheckedAt: '',
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    });
  });

  costumeActivity_(
    context,
    '',
    '',
    '',
    'RESET_RUN',
    'Reset all costume preset and quick-change run checks.',
    {}
  );

  return { saved: true };
}

function saveCostumePiece_(context, payload) {
  requireCostumeManage_(context);

  var id = sanitizeText_(payload.costumePieceId, 100) || uuid_('CPCS');
  var existing = listRecords_('CostumePieces', function (record) {
    return String(record.CostumePieceID) === String(id);
  })[0];

  var character = costumeCharacterById_(payload.characterId);
  assert_(character, 'Select a valid character.', 'CHARACTER_REQUIRED');

  var patch = {
    ProductionID: getActiveProductionId_(),
    CharacterID: String(payload.characterId),
    CostumeChangeID: sanitizeText_(payload.costumeChangeId, 100),
    LookName: sanitizeText_(payload.lookName, 180),
    ItemName: sanitizeText_(payload.itemName, 180),
    ItemType: sanitizeText_(payload.itemType || 'Costume Piece', 120),
    Source: sanitizeText_(payload.source || 'TBD', 120),
    Status: COSTUME_PIECE_STATUSES.indexOf(String(payload.status)) >= 0
      ? String(payload.status)
      : 'Not Started',
    AssignedUserIDsJSON: jsonStringify_(payload.assignedUserIds || []),
    DueDate: payload.dueDate || '',
    Size: sanitizeText_(payload.size, 120),
    Colour: sanitizeText_(payload.colour, 300),
    StorageLocation: sanitizeText_(payload.storageLocation, 500),
    Notes: sanitizeText_(payload.notes, 2500),
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  assert_(patch.ItemName, 'Costume piece name is required.', 'NAME_REQUIRED');

  if (existing) {
    updateRecordByRow_('CostumePieces', existing._row, patch);
  } else {
    patch.CostumePieceID = id;
    patch.PrimaryImageFileID = '';
    patch.CreatedByUserID = context.userId;
    patch.CreatedAt = nowIso_();
    patch.ArchivedAt = '';
    patch.ArchivedByUserID = '';
    patch.DeletedAt = '';
    patch.DeletedByUserID = '';
    appendRecord_('CostumePieces', patch);
  }

  costumeActivity_(
    context,
    patch.CharacterID,
    patch.CostumeChangeID,
    id,
    existing ? 'UPDATE_PIECE' : 'CREATE_PIECE',
    (existing ? 'Updated piece: ' : 'Created piece: ') + patch.ItemName,
    { status: patch.Status, source: patch.Source }
  );

  return { saved: true, costumePieceId: id };
}

function archiveCostumePiece_(context, payload) {
  requireCostumeArchive_(context);

  var item = updateCostumeRecordById_(
    'CostumePieces',
    'CostumePieceID',
    payload.costumePieceId,
    {
      Status: 'Archived',
      ArchivedAt: nowIso_(),
      ArchivedByUserID: context.userId,
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    }
  );

  costumeActivity_(
    context,
    item.CharacterID,
    item.CostumeChangeID,
    item.CostumePieceID,
    'ARCHIVE_PIECE',
    'Archived costume piece ' + item.ItemName + '.',
    {}
  );

  return { archived: true };
}

function restoreCostumePiece_(context, payload) {
  requireCostumeArchive_(context);

  var item = updateCostumeRecordById_(
    'CostumePieces',
    'CostumePieceID',
    payload.costumePieceId,
    {
      Status: sanitizeText_(payload.status || 'Not Started', 80),
      ArchivedAt: '',
      ArchivedByUserID: '',
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    }
  );

  costumeActivity_(
    context,
    item.CharacterID,
    item.CostumeChangeID,
    item.CostumePieceID,
    'RESTORE_PIECE',
    'Restored costume piece ' + item.ItemName + '.',
    {}
  );

  return { restored: true };
}

function deleteCostumePiecePermanently_(context, payload) {
  assert_(
    isFullAdmin_(context),
    'Only a Full Administrator can permanently delete a costume piece.',
    'FORBIDDEN'
  );

  assert_(
    String(payload.confirmation) === 'DELETE',
    'Type DELETE to confirm permanent deletion.',
    'CONFIRMATION_REQUIRED'
  );

  var item = listRecords_('CostumePieces', function (record) {
    return String(record.CostumePieceID) === String(payload.costumePieceId);
  })[0];

  assert_(item, 'Costume piece not found.', 'NOT_FOUND');

  deleteRowsWhere_('CostumePieces', function (record) {
    return String(record.CostumePieceID) === String(payload.costumePieceId);
  });

  costumeActivity_(
    context,
    item.CharacterID,
    item.CostumeChangeID,
    item.CostumePieceID,
    'DELETE_PIECE',
    'Permanently deleted costume piece ' + item.ItemName + '.',
    {}
  );

  return { deleted: true };
}

function saveCostumeMeasurement_(context, payload) {
  requireCostumeMeasurements_(context);

  var id = sanitizeText_(payload.measurementId, 100) || uuid_('CMEAS');
  var existing = listRecords_('CostumeMeasurements', function (record) {
    return String(record.MeasurementID) === String(id);
  })[0];

  var requestedActorUserId = sanitizeText_(payload.actorUserId, 100);
  if (!existing && payload.characterId) {
    existing = listRecords_('CostumeMeasurements', function (record) {
      return String(record.CharacterID) === String(payload.characterId)
        && (!requestedActorUserId || String(record.ActorUserID) === String(requestedActorUserId));
    })[0];

    if (existing) id = existing.MeasurementID;
  }

  var character = costumeCharacterById_(payload.characterId);
  assert_(character, 'Select a valid character.', 'CHARACTER_REQUIRED');

  var fields = [
    'height','chestBust','waist','hips','shoulderWidth','neck','sleeveLength',
    'armLength','wrist','inseam','outseam','thigh','calf','ankle','shoeSize',
    'headCircumference','hatSize','gloveSize'
  ];

  var patch = {
    ProductionID: getActiveProductionId_(),
    CharacterID: String(payload.characterId),
    ActorUserID: sanitizeText_(payload.actorUserId || character.ActorUserID, 100),
    ActorName: sanitizeText_(payload.actorName || character.ActorName, 180),
    CastGroup: ['A','B'].indexOf(String(payload.castGroup || '').toUpperCase()) >= 0 ? String(payload.castGroup).toUpperCase() : 'Single',
    DateMeasured: payload.dateMeasured || '',
    MeasuredByUserID: sanitizeText_(payload.measuredByUserId || context.userId, 100),
    FitNotes: sanitizeText_(payload.fitNotes, 2500),
    MobilityNotes: sanitizeText_(payload.mobilityNotes, 2500),
    AllergiesSensitivities: sanitizeText_(payload.allergiesSensitivities, 2500),
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  var fieldMap = {
    height: 'Height',
    chestBust: 'ChestBust',
    waist: 'Waist',
    hips: 'Hips',
    shoulderWidth: 'ShoulderWidth',
    neck: 'Neck',
    sleeveLength: 'SleeveLength',
    armLength: 'ArmLength',
    wrist: 'Wrist',
    inseam: 'Inseam',
    outseam: 'Outseam',
    thigh: 'Thigh',
    calf: 'Calf',
    ankle: 'Ankle',
    shoeSize: 'ShoeSize',
    headCircumference: 'HeadCircumference',
    hatSize: 'HatSize',
    gloveSize: 'GloveSize'
  };

  fields.forEach(function (field) {
    patch[fieldMap[field]] = sanitizeText_(payload[field], 120);
  });

  if (existing) {
    updateRecordByRow_('CostumeMeasurements', existing._row, patch);
  } else {
    patch.MeasurementID = id;
    appendRecord_('CostumeMeasurements', patch);
  }

  costumeActivity_(
    context,
    patch.CharacterID,
    '',
    '',
    existing ? 'UPDATE_MEASUREMENTS' : 'CREATE_MEASUREMENTS',
    'Updated private measurements for ' + character.CharacterName + '.',
    { actorUserId: patch.ActorUserID }
  );

  audit_(
    context.userId,
    'SAVE_COSTUME_MEASUREMENTS',
    'CostumeMeasurement',
    id,
    { characterId: patch.CharacterID }
  );

  return { saved: true, measurementId: id };
}

function saveCostumeFitting_(context, payload) {
  requireCostumeManage_(context);

  var id = sanitizeText_(payload.fittingId, 100) || uuid_('CFIT');
  var existing = listRecords_('CostumeFittings', function (record) {
    return String(record.FittingID) === String(id);
  })[0];

  var character = costumeCharacterById_(payload.characterId);
  assert_(character, 'Select a valid character.', 'CHARACTER_REQUIRED');

  var patch = {
    ProductionID: getActiveProductionId_(),
    CharacterID: String(payload.characterId),
    ActorUserID: sanitizeText_(payload.actorUserId || character.ActorUserID, 100),
    CastGroup: ['A','B'].indexOf(String(payload.castGroup || '').toUpperCase()) >= 0 ? String(payload.castGroup).toUpperCase() : 'Single',
    ScheduledAt: payload.scheduledAt || '',
    Location: sanitizeText_(payload.location, 300),
    FittingType: sanitizeText_(payload.fittingType || 'General Fitting', 120),
    Status: COSTUME_FITTING_STATUSES.indexOf(String(payload.status)) >= 0
      ? String(payload.status)
      : 'Scheduled',
    AssignedDresserUserIDsJSON: jsonStringify_(payload.assignedDresserUserIds || []),
    Notes: sanitizeText_(payload.notes, 2500),
    PrivateNotes: costumeCanManageMeasurements_(context)
      ? sanitizeText_(payload.privateNotes, 2500)
      : (existing ? existing.PrivateNotes : ''),
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  if (existing) {
    updateRecordByRow_('CostumeFittings', existing._row, patch);
  } else {
    patch.FittingID = id;
    patch.CreatedByUserID = context.userId;
    patch.CreatedAt = nowIso_();
    patch.ArchivedAt = '';
    patch.ArchivedByUserID = '';
    appendRecord_('CostumeFittings', patch);
  }

  costumeActivity_(
    context,
    patch.CharacterID,
    '',
    '',
    existing ? 'UPDATE_FITTING' : 'CREATE_FITTING',
    (existing ? 'Updated fitting for ' : 'Scheduled fitting for ')
      + character.CharacterName + '.',
    { status: patch.Status, scheduledAt: patch.ScheduledAt }
  );

  return { saved: true, fittingId: id };
}

function saveCostumeDeadline_(context, payload) {
  requireCostumeManage_(context);

  var id = sanitizeText_(payload.costumeDeadlineId, 100) || uuid_('CDL');
  var existing = listRecords_('CostumeDeadlines', function (record) {
    return String(record.CostumeDeadlineID) === String(id);
  })[0];

  var patch = {
    ProductionID: getActiveProductionId_(),
    CharacterID: sanitizeText_(payload.characterId, 100),
    Title: sanitizeText_(payload.title, 180),
    DueDate: payload.dueDate || '',
    Priority: COSTUME_PRIORITIES.indexOf(String(payload.priority)) >= 0
      ? String(payload.priority)
      : 'Medium',
    Status: sanitizeText_(payload.status || 'Not Started', 80),
    Notes: sanitizeText_(payload.notes, 2000),
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  assert_(patch.Title, 'Deadline title is required.', 'TITLE_REQUIRED');

  if (existing) {
    updateRecordByRow_('CostumeDeadlines', existing._row, patch);
  } else {
    patch.CostumeDeadlineID = id;
    patch.CreatedByUserID = context.userId;
    patch.CreatedAt = nowIso_();
    patch.ArchivedAt = '';
    patch.ArchivedByUserID = '';
    appendRecord_('CostumeDeadlines', patch);
  }

  costumeActivity_(
    context,
    patch.CharacterID,
    '',
    '',
    existing ? 'UPDATE_DEADLINE' : 'CREATE_DEADLINE',
    (existing ? 'Updated deadline: ' : 'Created deadline: ') + patch.Title,
    { dueDate: patch.DueDate, priority: patch.Priority }
  );

  return { saved: true, costumeDeadlineId: id };
}

function saveCostumeTask_(context, payload) {
  requireCostumeManage_(context);

  var id = payload.taskId || uuid_('TASK');
  var existing = listRecords_('Tasks', function (record) {
    return String(record.TaskID) === String(id);
  })[0];

  var relatedType = payload.costumePieceId
    ? 'CostumePiece'
    : (
      payload.costumeChangeId
        ? 'CostumeChange'
        : (payload.characterId ? 'CostumeCharacter' : 'CostumeHub')
    );

  var relatedId = payload.costumePieceId
    || payload.costumeChangeId
    || payload.characterId
    || '';

  var patch = {
    ProductionID: getActiveProductionId_(),
    DepartmentID: costumeDepartmentId_(),
    Title: sanitizeText_(payload.title, 180),
    Description: sanitizeText_(payload.description, 3000),
    AssignedUserIDsJSON: jsonStringify_(payload.assignedUserIds || []),
    AssignedDepartmentIDsJSON: jsonStringify_(
      bool_(payload.assignDepartment === false)
        ? []
        : [costumeDepartmentId_()]
    ),
    Priority: ['Normal','Important','Urgent'].indexOf(String(payload.priority)) >= 0
      ? String(payload.priority)
      : 'Normal',
    DueDate: payload.dueDate || '',
    Status: sanitizeText_(payload.status || 'Open', 60),
    RelatedType: relatedType,
    RelatedID: relatedId,
    UpdatedByUserID: context.userId,
    UpdatedAt: nowIso_()
  };

  assert_(patch.Title, 'Task title is required.', 'TITLE_REQUIRED');

  if (existing) {
    updateRecordByRow_('Tasks', existing._row, patch);
  } else {
    patch.TaskID = id;
    patch.CreatedByUserID = context.userId;
    patch.CreatedAt = nowIso_();
    appendRecord_('Tasks', patch);
  }

  costumeActivity_(
    context,
    payload.characterId,
    payload.costumeChangeId,
    payload.costumePieceId,
    existing ? 'UPDATE_TASK' : 'CREATE_TASK',
    (existing ? 'Updated task: ' : 'Created task: ') + patch.Title,
    { taskId: id }
  );

  return { saved: true, taskId: id };
}

function saveCostumeSuggestion_(context, payload) {
  requireCostumeContribution_(context);

  var id = uuid_('CSUG');

  appendRecord_('CostumeSuggestions', {
    CostumeSuggestionID: id,
    ProductionID: getActiveProductionId_(),
    CharacterID: sanitizeText_(payload.characterId, 100),
    CostumeChangeID: sanitizeText_(payload.costumeChangeId, 100),
    CostumePieceID: sanitizeText_(payload.costumePieceId, 100),
    SuggestedByUserID: context.userId,
    SuggestionType: sanitizeText_(payload.suggestionType || 'Idea', 120),
    Title: sanitizeText_(payload.title, 180),
    Description: sanitizeText_(payload.description, 3000),
    Priority: COSTUME_PRIORITIES.indexOf(String(payload.priority)) >= 0
      ? String(payload.priority)
      : 'Medium',
    ReferenceURL: sanitizeText_(payload.referenceUrl, 1000),
    Status: 'Pending',
    ReviewedByUserID: '',
    ReviewedAt: '',
    ReviewNote: '',
    CreatedAt: nowIso_(),
    UpdatedAt: nowIso_()
  });

  costumeActivity_(
    context,
    payload.characterId,
    payload.costumeChangeId,
    payload.costumePieceId,
    'CREATE_SUGGESTION',
    'Submitted costume suggestion: ' + sanitizeText_(payload.title, 180),
    { suggestionId: id }
  );

  return { saved: true, costumeSuggestionId: id };
}

function reviewCostumeSuggestion_(context, payload) {
  requireCostumeManage_(context);

  var suggestion = listRecords_('CostumeSuggestions', function (record) {
    return String(record.CostumeSuggestionID) === String(payload.costumeSuggestionId);
  })[0];

  assert_(suggestion, 'Suggestion not found.', 'NOT_FOUND');
  assert_(String(suggestion.Status) === 'Pending', 'This suggestion has already been reviewed.', 'ALREADY_REVIEWED');

  var decision = String(payload.decision);
  assert_(
    decision === 'Approved' || decision === 'Declined',
    'Decision must be Approved or Declined.',
    'INVALID_DECISION'
  );

  var createdRecordId = '';

  if (decision === 'Approved' && bool_(payload.createRecord)) {
    if (String(suggestion.SuggestionType) === 'New Character') {
      var characterResult = saveCostumeCharacter_(context, {
        characterName: suggestion.Title,
        costumeNotes: suggestion.Description,
        overallStatus: 'Not Started'
      });
      createdRecordId = characterResult.characterId;
    } else {
      var pieceResult = saveCostumePiece_(context, {
        characterId: suggestion.CharacterID,
        costumeChangeId: suggestion.CostumeChangeID,
        itemName: suggestion.Title,
        notes: suggestion.Description,
        status: 'Not Started',
        source: 'TBD'
      });
      createdRecordId = pieceResult.costumePieceId;
    }
  }

  updateRecordByRow_('CostumeSuggestions', suggestion._row, {
    Status: decision,
    ReviewedByUserID: context.userId,
    ReviewedAt: nowIso_(),
    ReviewNote: sanitizeText_(payload.reviewNote, 1000),
    UpdatedAt: nowIso_()
  });

  costumeActivity_(
    context,
    suggestion.CharacterID,
    suggestion.CostumeChangeID,
    suggestion.CostumePieceID,
    'REVIEW_SUGGESTION',
    decision + ' suggestion: ' + suggestion.Title,
    {
      suggestionId: suggestion.CostumeSuggestionID,
      createdRecordId: createdRecordId
    }
  );

  return {
    saved: true,
    decision: decision,
    createdRecordId: createdRecordId
  };
}

function uploadCostumeImage_(context, payload) {
  requireCostumeContribution_(context);

  var characterId = sanitizeText_(payload.characterId, 100);
  var changeId = sanitizeText_(payload.costumeChangeId, 100);
  var pieceId = sanitizeText_(payload.costumePieceId, 100);
  var character = characterId ? costumeCharacterById_(characterId) : null;

  assert_(character || !characterId, 'Character not found.', 'NOT_FOUND');

  var folders = ensureCostumeHubFolders_();
  var targetFolderId = folders.imagesFolderId;

  if (character && character.FolderID) {
    try {
      DriveApp.getFolderById(character.FolderID);
      targetFolderId = character.FolderID;
    } catch (error) {}
  }

  var saved = saveDriveFile_(
    targetFolderId,
    sanitizeText_(payload.filename || 'costume-image.jpg', 180),
    payload.dataUrl,
    INSTALL_CONFIG.maxImageUploadBytes,
    false
  );

  var imageId = uuid_('CIMG');
  var existingImages = listRecords_('CostumeImages', function (record) {
    return String(record.CharacterID) === String(characterId)
      && String(record.Status) === 'Active';
  });

  appendRecord_('CostumeImages', {
    CostumeImageID: imageId,
    ProductionID: getActiveProductionId_(),
    CharacterID: characterId,
    CostumeChangeID: changeId,
    CostumePieceID: pieceId,
    DriveFileID: saved.fileId,
    FileName: saved.fileName,
    MimeType: saved.mimeType,
    Caption: sanitizeText_(payload.caption, 500),
    ImageType: sanitizeText_(payload.imageType || 'Progress', 100),
    SortOrder: existingImages.length + 1,
    Status: 'Active',
    UploadedByUserID: context.userId,
    CreatedAt: nowIso_(),
    DeletedAt: '',
    DeletedByUserID: ''
  });

  appendRecord_('Files', {
    FileRecordID: uuid_('FILE'),
    ProductionID: getActiveProductionId_(),
    OwnerUserID: context.userId,
    DepartmentID: costumeDepartmentId_(),
    RelatedType: pieceId
      ? 'CostumePiece'
      : (changeId ? 'CostumeChange' : (characterId ? 'CostumeCharacter' : 'CostumeHub')),
    RelatedID: pieceId || changeId || characterId || '',
    DriveFileID: saved.fileId,
    FileName: saved.fileName,
    MimeType: saved.mimeType,
    URL: 'drivefile:' + saved.fileId,
    Visibility: 'Department',
    CreatedAt: nowIso_(),
    DeletedAt: ''
  });

  if (character && !character.PrimaryImageFileID && !changeId && !pieceId) {
    updateRecordByRow_('CostumeCharacters', character._row, {
      PrimaryImageFileID: saved.fileId,
      UpdatedByUserID: context.userId,
      UpdatedAt: nowIso_()
    });
  }

  if (pieceId) {
    var piece = listRecords_('CostumePieces', function (record) {
      return String(record.CostumePieceID) === String(pieceId);
    })[0];

    if (piece && !piece.PrimaryImageFileID) {
      updateRecordByRow_('CostumePieces', piece._row, {
        PrimaryImageFileID: saved.fileId,
        UpdatedByUserID: context.userId,
        UpdatedAt: nowIso_()
      });
    }
  }

  costumeActivity_(
    context,
    characterId,
    changeId,
    pieceId,
    'UPLOAD_IMAGE',
    'Added a costume ' + String(payload.imageType || 'progress').toLowerCase() + ' image.',
    { imageId: imageId, fileId: saved.fileId }
  );

  return {
    saved: true,
    imageId: imageId,
    fileId: saved.fileId,
    photoRef: 'drivefile:' + saved.fileId
  };
}

function getCostumeImageData_(context, payload) {
  requireCostumeView_(context);

  var fileId = sanitizeText_(payload.fileId, 180);
  var image = listRecords_('CostumeImages', function (record) {
    return String(record.DriveFileID) === String(fileId)
      && String(record.Status) === 'Active';
  })[0];

  assert_(image, 'Costume image not found.', 'NOT_FOUND');

  var file;

  try {
    file = DriveApp.getFileById(fileId);
  } catch (error) {
    throw codedError_(
      'The costume image could not be found in Google Drive.',
      'NOT_FOUND'
    );
  }

  assert_(!file.isTrashed(), 'The costume image has been removed.', 'NOT_FOUND');

  var blob = file.getBlob();
  var mimeType = String(blob.getContentType() || file.getMimeType() || '');

  assert_(
    mimeType.indexOf('image/') === 0,
    'The stored file is not an image.',
    'INVALID_IMAGE'
  );

  var bytes = blob.getBytes();

  assert_(
    bytes.length <= Number(INSTALL_CONFIG.maxImageUploadBytes || 4194304),
    'The stored image is too large to display.',
    'FILE_TOO_LARGE'
  );

  return {
    fileId: fileId,
    mimeType: mimeType,
    dataUrl: 'data:' + mimeType + ';base64,' + Utilities.base64Encode(bytes)
  };
}

function deleteCostumeImage_(context, payload) {
  var image = listRecords_('CostumeImages', function (record) {
    return String(record.CostumeImageID) === String(payload.imageId);
  })[0];

  assert_(image, 'Image not found.', 'NOT_FOUND');

  var isOwner = String(image.UploadedByUserID) === String(context.userId);
  var withinWindow = Date.now() - new Date(image.CreatedAt || 0).getTime()
    <= 30 * 60 * 1000;

  assert_(
    costumeCanManage_(context) || (isOwner && withinWindow),
    'Only a costume manager, or the uploader within 30 minutes, can remove this image.',
    'FORBIDDEN'
  );

  updateRecordByRow_('CostumeImages', image._row, {
    Status: 'Deleted',
    DeletedAt: nowIso_(),
    DeletedByUserID: context.userId
  });

  try { DriveApp.getFileById(image.DriveFileID).setTrashed(true); } catch (error) {}

  listRecords_('Files', function (record) {
    return String(record.DriveFileID) === String(image.DriveFileID);
  }).forEach(function (record) {
    updateRecordByRow_('Files', record._row, { DeletedAt: nowIso_() });
  });

  costumeActivity_(
    context,
    image.CharacterID,
    image.CostumeChangeID,
    image.CostumePieceID,
    'DELETE_IMAGE',
    'Removed a costume image.',
    { imageId: image.CostumeImageID }
  );

  return { deleted: true };
}
