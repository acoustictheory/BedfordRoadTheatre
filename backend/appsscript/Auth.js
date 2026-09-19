function createPasswordFields_(password) {
  assert_(String(password || '').length >= 8, 'Password must be at least 8 characters.', 'WEAK_PASSWORD');
  var salt = Utilities.getUuid();
  return { PasswordSalt: salt, PasswordHash: hashPassword_(password, salt) };
}

function preferredDevice_(value) {
  var normalized = String(value || '').toLowerCase();
  return ['iphone','ipad','android-phone','android-tablet','none'].indexOf(normalized) >= 0 ? normalized : '';
}

function createUser_(input) {
  var username = normalizeLower_(input.username);
  assert_(/^[a-z0-9._-]{3,40}$/.test(username), 'Username must use 3–40 letters, numbers, periods, underscores, or hyphens.', 'INVALID_USERNAME');
  assert_(!listRecords_('Users', function (r) { return normalizeLower_(r.Username) === username; }).length, 'That username is already in use.', 'USERNAME_EXISTS');

  var passwordFields = createPasswordFields_(input.password);
  var userId = input.userId || uuid_('USR');
  appendRecord_('Users', {
    UserID: userId,
    Username: username,
    Email: normalizeLower_(input.email),
    PasswordHash: passwordFields.PasswordHash,
    PasswordSalt: passwordFields.PasswordSalt,
    Status: 'Active',
    IsFullAdmin: input.isFullAdmin ? 'TRUE' : 'FALSE',
    MustChangePassword: input.mustChangePassword ? 'TRUE' : 'FALSE',
    CreatedAt: nowIso_(),
    UpdatedAt: nowIso_(),
    LastLoginAt: ''
  });

  ensureSheetColumn_('Profiles', 'PreferredDevice');
  appendRecord_('Profiles', {
    ProfileID: uuid_('PROF'),
    UserID: userId,
    FirstName: sanitizeText_(input.firstName, 80),
    LastName: sanitizeText_(input.lastName, 80),
    DisplayName: sanitizeText_(input.displayName || (input.firstName + ' ' + input.lastName), 120),
    Pronouns: '',
    Grade: '',
    Bio: '',
    Phone: '',
    EmergencyContact: '',
    PreferredDevice: preferredDevice_(input.preferredDevice),
    PhotoFileID: '',
    PhotoURL: '',
    Theme: getActiveProduction_().DefaultTheme || 'bedford-dark',
    Visibility: 'Production',
    CreatedAt: nowIso_(),
    UpdatedAt: nowIso_()
  });

  return userId;
}

function sessionContextCacheKey_(token) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(token || ''),
    Utilities.Charset.UTF_8
  );

  var hash = digest.map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');

  return 'BRM_SESSION_CONTEXT_' + getSiteDataRevision_() + '_' + hash.slice(0, 40);
}

function cacheSessionContext_(token, context, expiresAt) {
  if (!token || !context) return;

  var secondsRemaining = Math.floor(
    (new Date(expiresAt || Date.now() + 10 * 60 * 1000).getTime() - Date.now()) / 1000
  );

  var ttl = Math.max(60, Math.min(600, secondsRemaining));

  try {
    CacheService.getScriptCache().put(
      sessionContextCacheKey_(token),
      JSON.stringify({
        context: safeJsonForClient_(context),
        expiresAt: expiresAt || ''
      }),
      ttl
    );
  } catch (error) {}
}

function clearSessionContextCache_(token) {
  if (!token) return;
  try {
    CacheService.getScriptCache().remove(sessionContextCacheKey_(token));
  } catch (error) {}
}

function login_(payload) {
  var username = normalizeLower_(payload.username);
  var users = listRecords_('Users', function (r) { return normalizeLower_(r.Username) === username; });
  assert_(users.length, 'Incorrect username or password.', 'LOGIN_FAILED');
  var user = users[0];
  assert_(String(user.Status) === 'Active', 'This account is not active.', 'ACCOUNT_DISABLED');
  var passwordMatches = hashPassword_(payload.password || '', user.PasswordSalt) === user.PasswordHash;
  if (!passwordMatches) passwordMatches = verifyFirebasePassword_(user, payload.password);
  assert_(passwordMatches, 'Incorrect username or password.', 'LOGIN_FAILED');

  var token = randomToken_();
  var tokenHash = hashPassword_(token, user.UserID);
  var expires = new Date();
  var sessionDays = bool_(payload.trustedDevice) ? 90 : 1;
  expires.setDate(expires.getDate() + sessionDays);
  appendRecord_('Sessions', {
    SessionID: uuid_('SES'),
    UserID: user.UserID,
    TokenHash: tokenHash,
    ExpiresAt: expires.toISOString(),
    CreatedAt: nowIso_(),
    LastSeenAt: nowIso_(),
    RevokedAt: ''
  });
  updateRecordByRow_('Users', user._row, { LastLoginAt: nowIso_(), UpdatedAt: nowIso_() });
  var context = buildUserContext_(user.UserID);
  cacheSessionContext_(token, context, expires.toISOString());
  audit_(user.UserID, 'LOGIN', 'Session', '', {});
  return { token: token, user: safeJsonForClient_(context) };
}

function register_(payload) {
  var requestId = sanitizeText_(payload.registrationRequestId, 100);
  assert_(/^[A-Za-z0-9-]{20,100}$/.test(requestId), 'Please refresh the registration page and try again.', 'INVALID_REGISTRATION_REQUEST');
  var resultKey = 'BRM_REGISTRATION_RESULT_' + requestId;
  var lock = LockService.getScriptLock();
  lock.waitLock(45000);
  try {
  var previousResult = PropertiesService.getScriptProperties().getProperty(resultKey);
  if (previousResult) return JSON.parse(previousResult);
  var code = normalize_(payload.registrationCode).toUpperCase();
  var codes = listRecords_('RegistrationCodes', function (r) {
    return normalize_(r.Code).toUpperCase() === code && String(r.Status) === 'Active';
  });
  assert_(codes.length, 'That registration code is not valid.', 'INVALID_CODE');
  var registration = codes[0];
  if (registration.ExpiresAt) assert_(new Date(registration.ExpiresAt).getTime() > Date.now(), 'That registration code has expired.', 'EXPIRED_CODE');
  assert_(number_(registration.Uses, 0) < number_(registration.MaxUses, 999999), 'That registration code has reached its limit.', 'CODE_LIMIT');

  var userId = createUser_({
    firstName: payload.firstName,
    lastName: payload.lastName,
    displayName: payload.displayName,
    username: payload.username,
    email: payload.email,
    password: payload.password,
    isFullAdmin: false,
    mustChangePassword: false,
    preferredDevice: payload.preferredDevice
  });

  var group = listRecords_('PermissionGroups', function (r) { return String(r.GroupName) === String(registration.PermissionGroupName); })[0];
  if (group) appendRecord_('UserPermissionGroups', {
    UserPermissionGroupID: uuid_('UPG'), UserID: userId, PermissionGroupID: group.PermissionGroupID,
    ProductionID: getActiveProductionId_(), DepartmentID: '', Status: 'Active', AssignedBy: 'REGISTRATION', AssignedAt: nowIso_()
  });

  if (registration.DepartmentName) {
    var department = listRecords_('Departments', function (r) { return String(r.Name) === String(registration.DepartmentName); })[0];
    if (department) appendRecord_('UserDepartments', {
      UserDepartmentID: uuid_('UDEP'), UserID: userId, ProductionID: getActiveProductionId_(),
      DepartmentID: department.DepartmentID, RoleLabel: 'Member', Status: 'Active', AssignedBy: 'REGISTRATION', AssignedAt: nowIso_()
    });
  }

  var directlyAssignedDepartmentIds = [];

  if (registration.DepartmentName) {
    var directlyAssignedDepartment = listRecords_('Departments', function (record) {
      return String(record.Name) === String(registration.DepartmentName);
    })[0];

    if (directlyAssignedDepartment) {
      directlyAssignedDepartmentIds.push(String(directlyAssignedDepartment.DepartmentID));
    }
  }

  var requestedDepartmentIds = (payload.requestedDepartmentIds || [])
    .map(String)
    .filter(function (departmentId) {
      return directlyAssignedDepartmentIds.indexOf(departmentId) < 0;
    });

  var createdRequests = createDepartmentRequestsForUser_(
    userId,
    requestedDepartmentIds,
    payload.departmentRequestNote || '',
    ''
  );

  updateRecordByRow_('RegistrationCodes', registration._row, {
    Uses: number_(registration.Uses, 0) + 1,
    UpdatedAt: nowIso_()
  });

  audit_(
    userId,
    'REGISTER',
    'User',
    userId,
    { requestedDepartmentCount: createdRequests.length }
  );

  var result = {
    success: true,
    userId: userId,
    requestedDepartmentCount: createdRequests.length,
    message: createdRequests.length
      ? 'Your account has been created and your production-area requests were sent for administrator approval.'
      : 'Your account has been created. You can request production areas from your profile after signing in.'
  };
  PropertiesService.getScriptProperties().setProperty(resultKey, JSON.stringify(result));
  return result;
  } finally {
    lock.releaseLock();
  }
}

function registrationStatus_(payload) {
  var requestId = sanitizeText_(payload.registrationRequestId, 100);
  if (!/^[A-Za-z0-9-]{20,100}$/.test(requestId)) return { success:true, completed:false };
  var value = PropertiesService.getScriptProperties().getProperty('BRM_REGISTRATION_RESULT_' + requestId);
  return value ? JSON.parse(value) : { success:true, completed:false };
}

function firebaseMirrorSignature_(token) {
  return Utilities.computeHmacSha256Signature(String(token), FIREBASE_SYNC_SHARED_SECRET).map(function (byte) {
    var value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function completeFirebaseRegistration_(payload) {
  var token = String(payload.mirrorToken || '');
  var signature = String(payload.mirrorSignature || '').toLowerCase();
  assert_(token && signature && firebaseMirrorSignature_(token) === signature, 'Registration verification failed.', 'REGISTRATION_VERIFICATION_FAILED');
  var padded = token.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  var registration = JSON.parse(Utilities.newBlob(Utilities.base64Decode(padded)).getDataAsString());
  // Reserve this user briefly under the global lock, then let different
  // students finish in parallel rather than serializing all spreadsheet work.
  var lock = LockService.getScriptLock();
  assert_(lock.tryLock(10000), 'Registration is still finishing. Retry with the same username.', 'REGISTRATION_BUSY');
  var properties = PropertiesService.getScriptProperties();
  var pendingKey = 'BRM_MIRROR_PENDING_' + registration.userId;
  try {
    var pendingAt = Number(properties.getProperty(pendingKey) || 0);
    assert_(!pendingAt || Date.now() - pendingAt > 6 * 60 * 1000, 'Registration is still finishing. Retry with the same username.', 'REGISTRATION_BUSY');
    properties.setProperty(pendingKey, String(Date.now()));
  } finally { lock.releaseLock(); }
  try {
  resetRequestDataCache_();
  var existing = listRecords_('Users', function (row) { return String(row.UserID) === String(registration.userId); })[0];
  if (!existing) {
    var unusable = createPasswordFields_(randomToken_() + randomToken_());
    appendRecord_('Users',{UserID:registration.userId,Username:registration.username,Email:registration.email,PasswordHash:unusable.PasswordHash,PasswordSalt:unusable.PasswordSalt,Status:'Active',IsFullAdmin:'FALSE',MustChangePassword:'FALSE',CreatedAt:registration.createdAt,UpdatedAt:registration.createdAt,LastLoginAt:''});
  }
  if (!listRecords_('Profiles', function (row) { return String(row.UserID) === String(registration.userId); }).length) {
    ensureSheetColumn_('Profiles', 'PreferredDevice');
    appendRecord_('Profiles',{ProfileID:registration.profileId,UserID:registration.userId,FirstName:registration.firstName,LastName:registration.lastName,DisplayName:registration.displayName,Pronouns:'',Grade:'',Bio:'',Phone:'',EmergencyContact:'',PreferredDevice:preferredDevice_(registration.preferredDevice),PhotoFileID:'',PhotoURL:'',Theme:getActiveProduction_().DefaultTheme||'bedford-dark',Visibility:'Production',CreatedAt:registration.createdAt,UpdatedAt:registration.createdAt});
  }
    var code = listRecords_('RegistrationCodes',function(row){return normalize_(row.Code).toUpperCase()===registration.registrationCode;})[0];
    var group = code && listRecords_('PermissionGroups',function(row){return String(row.GroupName)===String(code.PermissionGroupName);})[0];
    if(group && !getUserGroups_(registration.userId, registration.productionId).some(function (membership) { return String(membership.PermissionGroupID) === String(group.PermissionGroupID); }))appendRecord_('UserPermissionGroups',{UserPermissionGroupID:uuid_('UPG'),UserID:registration.userId,PermissionGroupID:group.PermissionGroupID,ProductionID:registration.productionId,DepartmentID:'',Status:'Active',AssignedBy:'FIREBASE_REGISTRATION',AssignedAt:registration.createdAt});
    createDepartmentRequestsForUser_(registration.userId,registration.requestedDepartmentIds||[],registration.departmentRequestNote||'','');
    if(code && !existing)updateRecordByRow_('RegistrationCodes',code._row,{Uses:number_(code.Uses,0)+1,UpdatedAt:nowIso_()});
    audit_(registration.userId,'REGISTER_FIREBASE','User',registration.userId,{requestedDepartmentCount:(registration.requestedDepartmentIds||[]).length});
  var sessionToken=randomToken_(),expires=new Date();expires.setDate(expires.getDate()+Number(INSTALL_CONFIG.sessionDays||14));
  appendRecord_('Sessions',{SessionID:uuid_('SES'),UserID:registration.userId,TokenHash:hashPassword_(sessionToken,registration.userId),ExpiresAt:expires.toISOString(),CreatedAt:nowIso_(),LastSeenAt:nowIso_(),RevokedAt:''});
  var context=buildUserContext_(registration.userId);cacheSessionContext_(sessionToken,context,expires.toISOString());
  return {success:true,token:sessionToken,user:safeJsonForClient_(context),message:'Your account is ready.'};
  } finally { properties.deleteProperty(pendingKey); }
}

function requireSession_(token) {
  assert_(token, 'Please log in.', 'AUTH_REQUIRED');

  var cacheKey = sessionContextCacheKey_(token);
  var cached = null;

  try {
    cached = CacheService.getScriptCache().get(cacheKey);
  } catch (error) {}

  if (cached) {
    try {
      var parsed = JSON.parse(cached);
      if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() > Date.now()) {
        return parsed.context;
      }
    } catch (error) {}
  }

  var users = listRecords_('Users');
  var sessions = listRecords_('Sessions', function (record) {
    if (record.RevokedAt || new Date(record.ExpiresAt).getTime() <= Date.now()) {
      return false;
    }

    var user = users.filter(function (candidate) {
      return String(candidate.UserID) === String(record.UserID);
    })[0];

    return user && hashPassword_(token, user.UserID) === record.TokenHash;
  });

  assert_(sessions.length, 'Your session has expired. Please log in again.', 'SESSION_EXPIRED');

  var session = sessions[0];
  var lastSeen = session.LastSeenAt ? new Date(session.LastSeenAt).getTime() : 0;

  // Avoid a spreadsheet write for every page and every audio chunk request.
  if (!lastSeen || Date.now() - lastSeen > 15 * 60 * 1000) {
    updateRecordByRow_('Sessions', session._row, {
      LastSeenAt: nowIso_()
    });
  }

  var context = buildUserContext_(session.UserID);
  cacheSessionContext_(token, context, session.ExpiresAt);
  return context;
}

function buildUserContext_(userId) {
  var user = listRecords_('Users', function (r) { return String(r.UserID) === String(userId); })[0];
  assert_(user && String(user.Status) === 'Active', 'Account unavailable.', 'ACCOUNT_DISABLED');
  var profile = listRecords_('Profiles', function (r) { return String(r.UserID) === String(userId); })[0] || {};
  var production = getActiveProduction_();
  var permissions = getPermissionsForUser_(userId, production.ProductionID);
  var departmentIds = getUserDepartmentIds_(userId, production.ProductionID);
  if (bool_(user.IsFullAdmin) || permissions.indexOf('department.view.all') >= 0) {
    departmentIds = listRecords_('Departments', function (r) { return String(r.Status) === 'Active'; }).map(function (r) { return String(r.DepartmentID); });
  }
  var departments = listRecords_('Departments', function (r) { return departmentIds.indexOf(String(r.DepartmentID)) >= 0; });
  return {
    userId: user.UserID,
    username: user.Username,
    email: user.Email,
    status: user.Status,
    mustChangePassword: bool_(user.MustChangePassword),
    profile: safeJsonForClient_(profile),
    production: safeJsonForClient_(production),
    departmentIds: departmentIds,
    departments: safeJsonForClient_(departments),
    permissions: permissions,
    isAdmin: bool_(user.IsFullAdmin)
  };
}

function logout_(token) {
  var context = requireSession_(token);
  clearSessionContextCache_(token);
  var sessions = listRecords_('Sessions', function (r) {
    return String(r.UserID) === String(context.userId) && !r.RevokedAt && hashPassword_(token, context.userId) === r.TokenHash;
  });
  sessions.forEach(function (s) { updateRecordByRow_('Sessions', s._row, { RevokedAt: nowIso_() }); });
  audit_(context.userId, 'LOGOUT', 'Session', '', {});
  return { success: true };
}

function changePassword_(context, payload) {
  var user = listRecords_('Users', function (r) { return String(r.UserID) === String(context.userId); })[0];
  assert_(hashPassword_(payload.currentPassword || '', user.PasswordSalt) === user.PasswordHash, 'Current password is incorrect.', 'LOGIN_FAILED');
  var fields = createPasswordFields_(payload.newPassword);
  updateRecordByRow_('Users', user._row, {
    PasswordHash: fields.PasswordHash, PasswordSalt: fields.PasswordSalt,
    MustChangePassword: 'FALSE', UpdatedAt: nowIso_()
  });
  deleteRowsWhere_('Sessions', function (r) { return String(r.UserID) === String(context.userId); });
  audit_(context.userId, 'CHANGE_PASSWORD', 'User', context.userId, {});
  return { success: true, message: 'Password changed. Please log in again.' };
}
