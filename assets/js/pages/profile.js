document.addEventListener('DOMContentLoaded', () => BRM.initPrivatePage(async () => {
  const main = document.querySelector('#app-main');
  BRM.loading(main, 'Loading your profile…');

  try {
    const result = await BRM.api('getProfile');
    let context = result.context;
    let profile = context.profile || {};
    let departmentAccess = result.departmentAccess || {
      assigned: [],
      requests: [],
      availableDepartments: [],
      pendingCount: 0
    };

    const latestRequestByDepartment = () => {
      const map = new Map();
      (departmentAccess.requests || []).forEach(request => {
        map.set(String(request.DepartmentID), request);
      });
      return map;
    };

    const renderDepartmentAccess = () => {
      if (BRM.isAdmin()) {
        return `
          <section class="panel" id="production-areas">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Production access</span>
                <h2>All departments available</h2>
                <p>Full administrators automatically receive every active production workspace.</p>
              </div>
              <span class="badge badge-urgent">Full Administrator</span>
            </div>
          </section>
        `;
      }

      const requests = latestRequestByDepartment();
      const pending = (departmentAccess.requests || [])
        .filter(request => String(request.Status) === 'Pending');
      const declined = (departmentAccess.requests || [])
        .filter(request => String(request.Status) === 'Declined');
      const assignedIds = new Set(
        (departmentAccess.assigned || []).map(department => String(department.DepartmentID))
      );

      return `
        <section class="panel" id="production-areas">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Production placement</span>
              <h2>Your production areas</h2>
              <p>Select the teams you are involved in. New selections remain pending until an administrator approves them.</p>
            </div>
            ${pending.length
              ? `<span class="badge badge-important">${pending.length} awaiting approval</span>`
              : ''}
          </div>

          ${(departmentAccess.assigned || []).length
            ? `
              <div class="panel-inset" style="margin-bottom:16px">
                <strong>Approved access</strong>
                <div class="tag-list" style="margin-top:10px">
                  ${(departmentAccess.assigned || []).map(department => `
                    <span class="tag">
                      ${BRM.escape(department.Name)}
                      ${department.RoleLabel && department.RoleLabel !== 'Member'
                        ? ` · ${BRM.escape(department.RoleLabel)}`
                        : ''}
                    </span>
                  `).join('')}
                </div>
              </div>
            `
            : `
              <div class="alert alert-info" style="margin-bottom:16px">
                You do not have an approved department yet. Select your production
                areas below and an administrator will review them.
              </div>
            `}

          <form data-department-request-form>
            <div class="grid grid-2">
              ${(departmentAccess.availableDepartments || []).map(department => {
                const request = requests.get(String(department.DepartmentID));
                const assigned = assignedIds.has(String(department.DepartmentID));
                const pendingRequest = request && String(request.Status) === 'Pending';

                return `
                  <label class="checkbox-row" style="align-items:flex-start">
                    <input
                      type="checkbox"
                      name="departmentIds"
                      value="${BRM.escape(department.DepartmentID)}"
                      ${assigned || pendingRequest ? 'checked' : ''}
                      ${assigned ? 'disabled' : ''}
                    >
                    <span>
                      <strong>${BRM.escape(department.Name)}</strong>
                      <small style="display:block;color:var(--muted);margin-top:3px">
                        ${BRM.escape(department.Description || '')}
                      </small>
                      ${assigned
                        ? '<span class="badge" style="margin-top:7px">Approved</span>'
                        : pendingRequest
                          ? '<span class="badge badge-important" style="margin-top:7px">Pending</span>'
                          : request && String(request.Status) === 'Declined'
                            ? '<span class="badge badge-urgent" style="margin-top:7px">Previously declined — may request again</span>'
                            : ''}
                    </span>
                  </label>
                `;
              }).join('')}
            </div>

            <div class="field" style="margin-top:16px">
              <label>Note for the administrator <span class="field-hint">(optional)</span></label>
              <textarea
                name="requestNote"
                maxlength="500"
                placeholder="Explain your role or anything the production team should know."
              ></textarea>
            </div>

            <div class="form-actions">
              <button class="button button-primary" type="submit">Save production-area requests</button>
            </div>
          </form>

          ${declined.length
            ? `
              <div class="alert alert-error" style="margin-top:16px">
                <strong>Previous decisions</strong>
                ${declined.map(request => `
                  <p style="margin:8px 0 0">
                    ${BRM.escape(request.Name)}
                    ${request.ReviewNote ? ` — ${BRM.escape(request.ReviewNote)}` : ''}
                  </p>
                `).join('')}
              </div>
            `
            : ''}
        </section>
      `;
    };

    const draw = () => {
      main.innerHTML = `
        <div class="page-head">
          <div>
            <span class="eyebrow">Your account identity</span>
            <h1>Your profile</h1>
            <p>Your name is automatically attached to notes, journals, updates, and accountable activity.</p>
          </div>
        </div>

        ${new URLSearchParams(location.search).get('password') === 'required'
          ? '<div class="alert alert-error"><strong>Password change required:</strong> replace your temporary administrator password before using the portal.</div>'
          : ''}

        <section class="profile-header">
          ${BRM.avatar(profile.DisplayName, profile.PhotoURL, 'large')}
          <div>
            <h1>${BRM.escape(profile.DisplayName || context.username)}</h1>
            <p style="color:var(--muted);margin-bottom:0">
              ${BRM.escape(
                (departmentAccess.assigned || []).map(department => department.Name).join(' · ')
                || (BRM.isAdmin() ? 'Full Administrator' : 'No approved departments yet')
              )}
            </p>
            <div class="photo-actions">
              <label class="button button-secondary button-small">
                Upload profile picture
                <input type="file" accept="image/*" data-photo-input hidden>
              </label>
              ${profile.PhotoURL
                ? '<button class="button button-danger button-small" data-remove-photo>Remove photo</button>'
                : ''}
            </div>
            <span class="field-hint">Choose an image up to 25 MB. It is resized and compressed before uploading.</span>
          </div>
        </section>

        ${renderDepartmentAccess()}

        <section class="panel" style="margin-top:20px">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Editable information</span>
              <h2>Profile details</h2>
            </div>
          </div>

          <form data-profile-form>
            <div class="form-grid">
              <div class="field">
                <label>First name</label>
                <input name="firstName" value="${BRM.escape(profile.FirstName || '')}" required>
              </div>
              <div class="field">
                <label>Last name</label>
                <input name="lastName" value="${BRM.escape(profile.LastName || '')}" required>
              </div>
              <div class="field">
                <label>Display name</label>
                <input name="displayName" value="${BRM.escape(profile.DisplayName || '')}" required>
              </div>
              <div class="field">
                <label>Pronouns</label>
                <input name="pronouns" value="${BRM.escape(profile.Pronouns || '')}">
              </div>
              <div class="field">
                <label>Grade or role</label>
                <input name="grade" value="${BRM.escape(profile.Grade || '')}">
              </div>
              <div class="field">
                <label>Profile visibility</label>
                <select name="visibility">
                  <option ${profile.Visibility === 'Production' ? 'selected' : ''}>Production</option>
                  <option ${profile.Visibility === 'Departments' ? 'selected' : ''}>Departments</option>
                  <option ${profile.Visibility === 'Staff' ? 'selected' : ''}>Staff</option>
                </select>
              </div>
              <div class="field span-2">
                <label>Short biography</label>
                <textarea name="bio">${BRM.escape(profile.Bio || '')}</textarea>
              </div>
              <div class="field">
                <label>Phone (staff-visible)</label>
                <input name="phone" value="${BRM.escape(profile.Phone || '')}">
              </div>
              <div class="field">
                <label>Emergency contact (staff-visible)</label>
                <input name="emergencyContact" value="${BRM.escape(profile.EmergencyContact || '')}">
              </div>
              <div class="field span-2">
                <label>Preferred theme</label>
                <select name="theme">
                  ${BRM_CONFIG.THEMES.map(theme => `
                    <option value="${theme.id}" ${profile.Theme === theme.id ? 'selected' : ''}>
                      ${BRM.escape(theme.name)}
                    </option>
                  `).join('')}
                </select>
                <button class="button button-secondary" type="button" data-profile-theme-studio>Open Theme Studio</button>
                <span class="field-hint">Build a complete personal aesthetic or start with a simple coordinated color scheme.</span>
              </div>
            </div>
            <div class="form-actions">
              <button class="button button-primary" type="submit">Save profile</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Account security</span>
              <h2>Change password</h2>
            </div>
          </div>
          <form data-password-form>
            <div class="form-grid">
              <div class="field">
                <label>Current password</label>
                <input type="password" name="currentPassword" required>
              </div>
              <div class="field">
                <label>New password</label>
                <input type="password" name="newPassword" minlength="8" required>
              </div>
            </div>
            <div class="form-actions">
              <button class="button button-secondary" type="submit">Change password</button>
            </div>
          </form>
        </section>
      `;

      bind();
    };

    const bind = () => {
      main.querySelector('[data-department-request-form]')?.addEventListener('submit', async event => {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
        const original = button.textContent;

        button.disabled = true;
        button.textContent = 'Saving requests…';

        try {
          const response = await BRM.api('saveMyDepartmentRequests', {
            departmentIds: formData.getAll('departmentIds'),
            requestNote: formData.get('requestNote')
          });

          departmentAccess = response.departmentAccess || (await BRM.api('getProfile', {}, {noCache:true,forceNetwork:true})).departmentAccess;
          BRM.toast(
            departmentAccess.pendingCount
              ? 'Your production-area requests are awaiting administrator approval.'
              : 'Your production-area requests were updated.'
          );
          draw();
        } catch (error) {
          BRM.toast(error.message, 'error');
          button.disabled = false;
          button.textContent = original;
        }
      });

      main.querySelector('[data-profile-form]').addEventListener('submit', async event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));

        try {
          const response = await BRM.api('updateProfile', data);
          profile = response.profile;
          BRM.context.profile = profile;
          localStorage.setItem('brmContext', JSON.stringify(BRM.context));
          BRM.applyTheme(data.theme);
          BRM.toast('Profile saved.');
          draw();
        } catch (error) {
          BRM.toast(error.message, 'error');
        }
      });

      main.querySelector('[data-profile-theme-studio]')?.addEventListener('click', () => BRM.openThemeStudio());

      main.querySelector('[data-photo-input]').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 25 * 1024 * 1024) {
          BRM.toast('Please choose an image smaller than 25 MB.', 'error');
          return;
        }

        try {
          BRM.toast('Preparing and compressing image…', 'info');
          const prepared = await compressProfilePhoto(file);

          BRM.toast(
            `Uploading compressed photo (${Math.max(1, Math.round(prepared.sizeBytes / 1024))} KB)…`,
            'info'
          );

          const response = await BRM.api('uploadProfilePhoto', {
            filename: file.name,
            dataUrl: prepared.dataUrl
          });

          profile.PhotoFileID = response.fileId;
          profile.PhotoURL = response.photoRef || response.url || `drivefile:${response.fileId}`;
          await BRM.firebaseUpdateProfile?.({
            photoFileId: response.fileId,
            photoFileID: response.fileId,
            photoURL: profile.PhotoURL
          });

          await BRM.cacheProfilePhoto?.(
            response.fileId,
            prepared.dataUrl
          );

          BRM.context.profile = profile;
          localStorage.setItem('brmContext', JSON.stringify(BRM.context));
          BRM.toast('Profile picture updated.');
          draw();
        } catch (error) {
          BRM.toast(error.message, 'error');
        }
      });

      main.querySelector('[data-remove-photo]')?.addEventListener('click', async () => {
        if (!confirm('Remove your profile picture?')) return;

        try {
          await BRM.api('removeProfilePhoto');
          profile.PhotoURL = '';
          profile.PhotoFileID = '';
          await BRM.firebaseUpdateProfile?.({ photoFileId: '', photoFileID: '', photoURL: '' });
          BRM.context.profile = profile;
          localStorage.setItem('brmContext', JSON.stringify(BRM.context));
          BRM.toast('Profile picture removed.');
          draw();
        } catch (error) {
          BRM.toast(error.message, 'error');
        }
      });

      main.querySelector('[data-password-form]').addEventListener('submit', async event => {
        event.preventDefault();

        try {
          const response = await BRM.api(
            'changePassword',
            Object.fromEntries(new FormData(event.currentTarget))
          );
          BRM.toast(response.message || 'Password changed.');
          setTimeout(() => {
            BRM.clearSession();
            location.href = 'login.html';
          }, 1000);
        } catch (error) {
          BRM.toast(error.message, 'error');
        }
      });
    };

    draw();

    if (location.hash === '#production-areas') {
      setTimeout(() => {
        document.querySelector('#production-areas')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    }
  } catch (error) {
    main.innerHTML = `<div class="alert alert-error">${BRM.escape(error.message)}</div>`;
  }
}));

async function decodeProfileImage(file) {
  const unsupported =
    /image\/hei[cf]/i.test(file.type || '')
    || /\.(heic|heif)$/i.test(file.name || '');

  if (unsupported) {
    throw new Error(
      'This browser cannot process HEIC/HEIF photos. On your phone, choose Most Compatible for camera photos, or save/export the picture as JPG or PNG and upload it again.'
    );
  }

  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, {
        imageOrientation: 'from-image'
      });
    } catch (error) {}
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(
        'The selected picture could not be decoded. Please use a JPG, PNG, or WebP image.'
      ));
    };

    image.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not compress this picture.'));
    }, 'image/jpeg', quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(
      new Error('The compressed picture could not be prepared for upload.')
    );
    reader.readAsDataURL(blob);
  });
}

async function compressProfilePhoto(file) {
  const image = await decodeProfileImage(file);

  try {
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    const cropSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = Math.max(0, (sourceWidth - cropSize) / 2);
    const sourceY = Math.max(0, (sourceHeight - cropSize) / 2);

    const attempts = [
      { size: 640, quality: 0.84 },
      { size: 600, quality: 0.76 },
      { size: 520, quality: 0.70 },
      { size: 440, quality: 0.64 }
    ];

    let finalBlob = null;

    for (const attempt of attempts) {
      const canvas = document.createElement('canvas');
      canvas.width = attempt.size;
      canvas.height = attempt.size;

      const context = canvas.getContext('2d', {
        alpha: false
      });

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.drawImage(
        image,
        sourceX,
        sourceY,
        cropSize,
        cropSize,
        0,
        0,
        attempt.size,
        attempt.size
      );

      finalBlob = await canvasToJpegBlob(canvas, attempt.quality);

      if (finalBlob.size <= 750 * 1024) {
        break;
      }
    }

    if (!finalBlob) {
      throw new Error('The photo could not be compressed.');
    }

    if (finalBlob.size > 2 * 1024 * 1024) {
      throw new Error(
        'The photo remained too large after compression. Try cropping it or choosing a smaller picture.'
      );
    }

    return {
      dataUrl: await blobToDataUrl(finalBlob),
      sizeBytes: finalBlob.size,
      mimeType: finalBlob.type
    };
  } finally {
    if (typeof image.close === 'function') {
      try { image.close(); } catch (error) {}
    }
  }
}
