// Firebase registrations deliberately have unusable legacy password hashes.
// Verify the password with Firebase and require the exact mirrored user ID.
function verifyFirebasePassword_(user, password) {
  if (!password) return false;
  try {
    var response = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyCj9z5BuDIWW0JcuK2k7EwiWpe8xRI4vRY', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({email: normalizeLower_(user.Username) + '@users.bedford-musical.invalid', password: String(password), returnSecureToken: true})
    });
    if (response.getResponseCode() !== 200) return false;
    var result = JSON.parse(response.getContentText());
    return String(result.localId || '') === String(user.UserID);
  } catch (error) {
    throw new Error('Sign-in could not reach the account service. Please try again.');
  }
}
