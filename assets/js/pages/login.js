document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('[data-auth-tab]');
  const panels = document.querySelectorAll('[data-auth-panel]');
  const departmentOptions = document.querySelector('[data-department-options]');

  const switchTab = id => {
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.authTab === id));
    panels.forEach(panel => panel.classList.toggle('hidden', panel.dataset.authPanel !== id));
  };

  tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.authTab)));

  const params = new URLSearchParams(location.search);
  if (params.get('reason')) BRM.toast(params.get('reason'), 'error');
  if (BRM.isDemo()) document.querySelector('[data-demo-notice]')?.classList.remove('hidden');

  async function loadRegistrationDepartments() {
    if (!departmentOptions) return;

    try {
      const result = await BRM.api('registrationOptions', {}, {
        public: true,
        noCache: true
      });

      const departments = result.departments || [];

      departmentOptions.innerHTML = departments.length
        ? departments.map(department => `
            <label class="checkbox-row" style="align-items:flex-start">
              <input
                type="checkbox"
                name="requestedDepartmentIds"
                value="${BRM.escape(department.DepartmentID)}"
              >
              <span>
                <strong>${BRM.escape(department.Name)}</strong>
                <small style="display:block;color:var(--muted);margin-top:3px">
                  ${BRM.escape(department.Description || '')}
                </small>
              </span>
            </label>
          `).join('')
        : '<div class="alert alert-info">No student-requestable production areas are currently available.</div>';
    } catch (error) {
      departmentOptions.innerHTML = `
        <div class="alert alert-error">
          Production areas could not be loaded. You can still create an account
          and request areas from your profile after signing in.
        </div>
      `;
    }
  }

  document.querySelector('[data-login-form]').addEventListener('submit', async event => {
    event.preventDefault();

    const button = event.submitter || event.currentTarget.querySelector('button');
    const form = Object.fromEntries(new FormData(event.currentTarget));

    button.disabled = true;
    button.textContent = 'Signing in…';

    try {
      const result = await BRM.api('login', form, { public: true });
      BRM.setSession(result.token, result.user);
      BRM.applyTheme(
        result.user.profile?.Theme
        || result.user.production?.DefaultTheme
        || window.BRM_CONFIG.DEFAULT_THEME
      );
      location.href = 'dashboard.html';
    } catch (error) {
      BRM.toast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  document.querySelector('[data-register-form]').addEventListener('submit', async event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const form = Object.fromEntries(formData);
    form.requestedDepartmentIds = formData.getAll('requestedDepartmentIds');

    if (form.password !== form.confirmPassword) {
      BRM.toast('Passwords do not match.', 'error');
      return;
    }

    const button = event.submitter || event.currentTarget.querySelector('button');
    button.disabled = true;
    button.textContent = 'Creating account…';

    try {
      const result = await BRM.api('register', form, { public: true });
      BRM.toast(result.message || 'Account created.');
      event.currentTarget.reset();
      switchTab('login');
    } catch (error) {
      BRM.toast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Create account';
    }
  });

  loadRegistrationDepartments();
});
