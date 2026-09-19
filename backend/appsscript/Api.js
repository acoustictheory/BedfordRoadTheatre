function doGet(e) {
  resetRequestDataCache_();

  var action = (e && e.parameter && e.parameter.action) || 'health';

  if (action === 'health') {
    return jsonResponse_({
      success: true,
      app: INSTALL_CONFIG.platformName,
      version: APP_VERSION,
      installed: !!PropertiesService.getScriptProperties().getProperty(DB_PROPERTY),
      revision: getSiteDataRevision_()
    });
  }

  return jsonResponse_({
    success: false,
    error: 'Use POST requests for this API.',
    code: 'POST_REQUIRED'
  });
}

function doPost(e) {
  resetRequestDataCache_();

  try {
    var payload = {};

    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    var action = payload.action || '';
    var result;

    if (action === 'login') {
      result = login_(payload);
    } else if (action === 'registrationOptions') {
      result = getRegistrationOptions_();
    } else if (action === 'register') {
      result = register_(payload);
    } else if (action === 'registrationStatus') {
      result = registrationStatus_(payload);
    } else if (action === 'completeFirebaseRegistration') {
      result = completeFirebaseRegistration_(payload);
    } else if (action === 'publicRecruitmentConfig') {
      requirePermission_(requireSession_(payload.token), 'admin.all');
      result = getPublicRecruitmentConfig_();
    } else if (action === 'submitAuditionBooking') {
      requirePermission_(requireSession_(payload.token), 'admin.all');
      result = submitAuditionBooking_(payload);
    } else if (action === 'submitMusicalInterest') {
      requirePermission_(requireSession_(payload.token), 'admin.all');
      result = submitMusicalInterest_(payload);
    } else {
      var context = requireSession_(payload.token);

      switch (action) {
        case 'bootstrap': result = getSiteSnapshot_(context); break;
        case 'validateSession': result = { context: safeJsonForClient_(context) }; break;
        case 'logout': result = logout_(payload.token); break;
        case 'changePassword': result = changePassword_(context, payload); break;

        case 'dashboard': result = getDashboard_(context); break;

        case 'getProfile': result = getMyProfile_(context); break;
        case 'updateProfile': result = updateMyProfile_(context, payload); break;
        case 'uploadProfilePhoto': result = uploadProfilePhoto_(context, payload); break;
        case 'profilePhotoData': result = getProfilePhotoData_(context, payload); break;
        case 'removeProfilePhoto': result = removeProfilePhoto_(context); break;
        case 'directory': result = getDirectory_(context); break;
        case 'myDepartmentRequests': result = {
          departmentAccess: getMyDepartmentRequestSummary_(context)
        }; break;
        case 'saveMyDepartmentRequests': result = saveMyDepartmentRequests_(context, payload); break;

        case 'announcements': result = getAnnouncements_(context, bool_(payload.includeArchived)); break;
        case 'saveAnnouncement': result = saveAnnouncement_(context, payload); break;
        case 'archiveAnnouncement': result = archiveAnnouncement_(context, payload); break;
        case 'deleteAnnouncement': result = deleteAnnouncement_(context, payload); break;
        case 'acknowledgeAnnouncement': result = acknowledgeAnnouncement_(context, payload); break;
        case 'markAnnouncementRead': result = markAnnouncementRead_(context, payload); break;
        case 'announcementDeliveryReport': result = getAnnouncementDeliveryReport_(context, payload); break;

        case 'pageNotes': result = getPageNotes_(context, payload); break;
        case 'createPageNote': result = createPageNote_(context, payload); break;
        case 'editPageNote': result = editPageNote_(context, payload); break;
        case 'deletePageNote': result = deletePageNote_(context, payload); break;

        case 'myJournal': result = getMyJournal_(context); break;
        case 'saveJournalEntry': result = saveJournalEntry_(context, payload); break;
        case 'journalReview': result = getJournalReview_(context, payload); break;
        case 'saveJournalFeedback': result = saveJournalFeedback_(context, payload); break;

        case 'schedule': result = getSchedule_(context, payload); break;
        case 'saveEvent': result = saveEvent_(context, payload); break;
        case 'deleteEvent': result = deleteEvent_(context, payload); break;
        case 'importCalendarEvents': result = importCalendarEvents_(context, payload); break;

        case 'departments': result = getDepartments_(context); break;
        case 'propsHub': result = getPropsHub_(context, payload); break;
        case 'savePropsItem': result = savePropsItem_(context, payload); break;
        case 'archivePropsItem': result = archivePropsItem_(context, payload); break;
        case 'restorePropsItem': result = restorePropsItem_(context, payload); break;
        case 'deletePropsItemPermanently': result = deletePropsItemPermanently_(context, payload); break;
        case 'savePropsPreset': result = savePropsPreset_(context, payload); break;
        case 'updatePropsPresetRunStatus': result = updatePropsPresetRunStatus_(context, payload); break;
        case 'resetPropsPresetRun': result = resetPropsPresetRun_(context); break;
        case 'savePropsDeadline': result = savePropsDeadline_(context, payload); break;
        case 'savePropsSuggestion': result = savePropsSuggestion_(context, payload); break;
        case 'reviewPropsSuggestion': result = reviewPropsSuggestion_(context, payload); break;
        case 'savePropsTask': result = savePropsTask_(context, payload); break;
        case 'uploadPropsImage': result = uploadPropsImage_(context, payload); break;
        case 'propsImageData': result = getPropsImageData_(context, payload); break;
        case 'deletePropsImage': result = deletePropsImage_(context, payload); break;
        case 'scenicHub': result = getScenicHub_(context, payload); break;
        case 'saveScenicSet': result = saveScenicSet_(context, payload); break;
        case 'archiveScenicSet': result = archiveScenicSet_(context, payload); break;
        case 'restoreScenicSet': result = restoreScenicSet_(context, payload); break;
        case 'deleteScenicSetPermanently': result = deleteScenicSetPermanently_(context, payload); break;
        case 'saveScenicElement': result = saveScenicElement_(context, payload); break;
        case 'archiveScenicElement': result = archiveScenicElement_(context, payload); break;
        case 'restoreScenicElement': result = restoreScenicElement_(context, payload); break;
        case 'deleteScenicElementPermanently': result = deleteScenicElementPermanently_(context, payload); break;
        case 'saveScenicTransition': result = saveScenicTransition_(context, payload); break;
        case 'updateScenicTransitionRunStatus': result = updateScenicTransitionRunStatus_(context, payload); break;
        case 'resetScenicTransitionRun': result = resetScenicTransitionRun_(context); break;
        case 'saveScenicDeadline': result = saveScenicDeadline_(context, payload); break;
        case 'saveScenicSuggestion': result = saveScenicSuggestion_(context, payload); break;
        case 'reviewScenicSuggestion': result = reviewScenicSuggestion_(context, payload); break;
        case 'saveScenicTask': result = saveScenicTask_(context, payload); break;
        case 'uploadScenicImage': result = uploadScenicImage_(context, payload); break;
        case 'scenicImageData': result = getScenicImageData_(context, payload); break;
        case 'deleteScenicImage': result = deleteScenicImage_(context, payload); break;
        case 'blockingHub': result = getBlockingHub_(context, payload); break;
        case 'blockingViewer': result = getBlockingViewer_(context); break;
        case 'blockingCastPhotoData': result = getBlockingCastPhotoData_(context, payload); break;
        case 'blockingTimeline': result = getBlockingTimeline_(context, payload); break;
        case 'blockingTimelineMediaIndex': result = getBlockingTimelineMediaIndex_(context, payload); break;
        case 'saveBlockingTimeline': result = saveBlockingTimeline_(context, payload); break;
        case 'saveBlockingSceneRecording': result = saveBlockingSceneRecording_(context, payload); break;
        case 'blockingSceneRecordings': result = getBlockingSceneRecordings_(context, payload); break;
        case 'useBlockingSceneRecording': result = useBlockingSceneRecording_(context, payload); break;
        case 'blockingSceneAudioInfo': result = getBlockingSceneAudioInfo_(context, payload); break;
        case 'blockingSceneAudioChunk': result = getBlockingSceneAudioChunk_(context, payload); break;
        case 'blockingSnapshot': result = getBlockingSnapshot_(context, payload); break;
        case 'saveBlockingSnapshot': result = saveBlockingSnapshot_(context, payload); break;
        case 'duplicateBlockingSnapshot': result = duplicateBlockingSnapshot_(context, payload); break;
        case 'setBlockingSnapshotStatus': result = setBlockingSnapshotStatus_(context, payload); break;
        case 'deleteBlockingSnapshotPermanently': result = deleteBlockingSnapshotPermanently_(context, payload); break;
        case 'blockingSnapshotVersions': result = getBlockingSnapshotVersions_(context, payload); break;
        case 'restoreBlockingSnapshotVersion': result = restoreBlockingSnapshotVersion_(context, payload); break;
        case 'saveBlockingAnchor': result = saveBlockingAnchor_(context, payload); break;
        case 'deleteBlockingAnchor': result = deleteBlockingAnchor_(context, payload); break;
        case 'saveBlockingCast': result = saveBlockingCast_(context, payload); break;
        case 'saveBlockingEnsembleRoster': result = saveBlockingEnsembleRoster_(context, payload); break;
        case 'deleteBlockingCast': result = deleteBlockingCast_(context, payload); break;
        case 'uploadBlockingBackground': result = uploadBlockingBackground_(context, payload); break;
        case 'blockingBackgroundData': result = getBlockingBackgroundData_(context, payload); break;
        case 'archiveBlockingBackground': result = archiveBlockingBackground_(context, payload); break;
        case 'costumeHub': result = getCostumeHub_(context, payload); break;
        case 'saveCostumeCharacter': result = saveCostumeCharacter_(context, payload); break;
        case 'archiveCostumeCharacter': result = archiveCostumeCharacter_(context, payload); break;
        case 'restoreCostumeCharacter': result = restoreCostumeCharacter_(context, payload); break;
        case 'deleteCostumeCharacterPermanently': result = deleteCostumeCharacterPermanently_(context, payload); break;
        case 'saveCostumeChange': result = saveCostumeChange_(context, payload); break;
        case 'updateCostumeChangeRunStatus': result = updateCostumeChangeRunStatus_(context, payload); break;
        case 'resetCostumeChangeRun': result = resetCostumeChangeRun_(context); break;
        case 'saveCostumePiece': result = saveCostumePiece_(context, payload); break;
        case 'archiveCostumePiece': result = archiveCostumePiece_(context, payload); break;
        case 'restoreCostumePiece': result = restoreCostumePiece_(context, payload); break;
        case 'deleteCostumePiecePermanently': result = deleteCostumePiecePermanently_(context, payload); break;
        case 'saveCostumeMeasurement': result = saveCostumeMeasurement_(context, payload); break;
        case 'saveCostumeFitting': result = saveCostumeFitting_(context, payload); break;
        case 'saveCostumeDeadline': result = saveCostumeDeadline_(context, payload); break;
        case 'saveCostumeTask': result = saveCostumeTask_(context, payload); break;
        case 'saveCostumeSuggestion': result = saveCostumeSuggestion_(context, payload); break;
        case 'reviewCostumeSuggestion': result = reviewCostumeSuggestion_(context, payload); break;
        case 'uploadCostumeImage': result = uploadCostumeImage_(context, payload); break;
        case 'costumeImageData': result = getCostumeImageData_(context, payload); break;
        case 'deleteCostumeImage': result = deleteCostumeImage_(context, payload); break;
        case 'departmentWorkspace': result = getDepartmentWorkspace_(context, payload); break;
        case 'saveDepartmentItem': result = saveDepartmentItem_(context, payload); break;
        case 'saveTask': result = saveTask_(context, payload); break;
        case 'myTasks': result = getMyTasks_(context, payload); break;
        case 'updateTaskStatus': result = updateMyTaskStatus_(context, payload); break;

        case 'resources': result = getResources_(context); break;
        case 'saveResource': result = saveResource_(context, payload); break;

        case 'tracks': result = getTracks_(context); break;
        case 'trackAudioInfo': result = getTrackAudioInfo_(context, payload); break;
        case 'trackAudioChunk': result = getTrackAudioChunk_(context, payload); break;

        case 'uploadDepartmentImage': result = uploadDepartmentImage_(context, payload); break;

        case 'adminData': result = getAdminData_(context); break;
        case 'recruitmentAdminData': result = getRecruitmentAdminData_(context); break;
        case 'reviewRecruitmentSubmission': result = reviewRecruitmentSubmission_(context, payload); break;
        case 'deleteRecruitmentSubmission': result = deleteRecruitmentSubmission_(context, payload); break;
        case 'saveAuditionSlot': result = saveAuditionSlot_(context, payload); break;
        case 'deleteAuditionSlot': result = deleteAuditionSlot_(context, payload); break;
        case 'saveUserAccess': result = saveUserAccess_(context, payload); break;
        case 'createManagedUser': result = createManagedUser_(context, payload); break;
        case 'saveManagedUser': result = saveManagedUser_(context, payload); break;
        case 'deleteManagedUser': result = deleteManagedUser_(context, payload); break;
        case 'reviewDepartmentRequest': result = reviewDepartmentRequest_(context, payload); break;
        case 'createRegistrationCode': result = createRegistrationCode_(context, payload); break;
        case 'startNewProduction': result = startNewProduction_(context, payload); break;
        case 'requestProductionDeletion': result = requestProductionDeletion_(context, payload); break;
        case 'approveProductionDeletion': result = approveProductionDeletion_(context, payload); break;

        default:
          throw new Error('Unknown action: ' + action);
      }
    }

    var revision = getSiteDataRevision_();

    if (isSnapshotMutationAction_(action)) {
      revision = bumpSiteDataRevision_();
      queueFirebaseSyncForAction_(action);
      // Community identity and membership must be visible as soon as the
      // administrator receives a successful save response. Other content can
      // continue to use the short deferred queue.
      if (isImmediateCommunitySyncAction_(action)) flushFirebaseSyncQueue_();
    }

    if (Array.isArray(result)) {
      return jsonResponse_({
        success: true,
        data: result,
        revision: revision
      });
    }

    return jsonResponse_(Object.assign(
      {
        success: true,
        revision: revision
      },
      result || {}
    ));
  } catch (error) {
    return jsonResponse_({
      success: false,
      error: error.message || String(error),
      code: error.code || 'SERVER_ERROR'
    });
  }
}

function jsonResponse_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
