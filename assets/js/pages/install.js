document.addEventListener('DOMContentLoaded', () => {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const initial = ios ? 'ios' : android ? 'android' : 'web';
  const activate = id => {
    document.querySelectorAll('[data-install-tab]').forEach(button => {
      const selected = button.dataset.installTab === id;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('[data-install-panel]').forEach(panel => panel.hidden = panel.dataset.installPanel !== id);
    history.replaceState(null, '', `#${id}`);
  };
  document.querySelectorAll('[data-install-tab]').forEach(button => button.addEventListener('click', () => activate(button.dataset.installTab)));
  const requested = location.hash.slice(1);
  activate(['ios', 'android', 'web'].includes(requested) ? requested : initial);

  const installed = localStorage.getItem('brmAppInstall');
  const installedNotice = document.querySelector('[data-installed]');
  if (installed && installedNotice) installedNotice.hidden = false;
  const note = document.querySelector('[data-device-note]');
  if (note) note.textContent = ios ? 'We detected an Apple mobile device and opened the iPhone & iPad steps.' : android ? 'We detected Android and opened the APK steps.' : 'We opened browser instructions. Choose another device above if you are preparing a phone or tablet.';

  document.querySelector('[data-install-complete]')?.addEventListener('click', () => {
    localStorage.setItem('brmAppInstallAcknowledged', 'true');
    localStorage.removeItem('brmInstallRemindAfter');
    location.href = localStorage.getItem('brmToken') ? 'dashboard.html' : 'login.html';
  });
  document.querySelector('[data-install-later]')?.addEventListener('click', () => {
    localStorage.setItem('brmInstallRemindAfter', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    location.href = localStorage.getItem('brmToken') ? 'dashboard.html' : 'login.html';
  });
});
