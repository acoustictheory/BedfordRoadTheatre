function dashboardJournalDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'None yet';
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
    return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(d);
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'America/Regina' }).format(d);
}

document.addEventListener('DOMContentLoaded', () => BRM.initPrivatePage(async () => {
  const main = document.querySelector('#app-main');
  BRM.loading(main, 'Building your dashboard…');

  try {
    const data = await BRM.api('dashboard');
    const firstName = data.context.profile?.FirstName || data.context.profile?.DisplayName?.split(' ')[0] || 'there';
    const adminStats = data.adminStats;
    const blockingAccess = canAccessBlockingStudio();

    main.innerHTML = `
      <section class="welcome-card">
        <span class="eyebrow">${BRM.escape(data.context.production?.SchoolYear || '')} production portal</span>
        <h1>Welcome back, ${BRM.escape(firstName)}.</h1>
        <p>Your dashboard brings together only the calls, tasks, departments, notes, tracks, and reflections connected to your production role.</p>
        <div class="quick-actions">
          <a class="button button-primary" href="journal.html?new=1">✎ Write today’s reflection</a>
          <a class="button button-secondary" href="schedule.html">◷ View full schedule</a>
          ${BRM.hasPermission('announcement.manage') ? '<button class="button button-secondary" data-new-announcement>! Post an update</button>' : ''}
        </div>
      </section>

      ${renderBlockingViewerHub(data.context, data)}

      ${blockingAccess ? renderBlockingStudioLaunch(data.context) : ''}

      ${adminStats ? `<section class="stat-grid" style="margin-top:18px">
        <a class="stat-card" href="admin.html"><strong>${adminStats.activeUsers}</strong><span>Active accounts</span></a>
        <a class="stat-card" href="journal-review.html"><strong>${adminStats.journalEntries}</strong><span>Journal entries</span></a>
        <a class="stat-card" href="tasks.html"><strong>${adminStats.openTasks}</strong><span>Open tasks</span></a>
        <a class="stat-card" href="schedule.html"><strong>${adminStats.upcomingEvents}</strong><span>Upcoming events</span></a>
      </section>` : ''}

      <div class="dashboard-grid" style="margin-top:20px">
        <div class="stack">
          <section class="panel">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Priority communication</span>
                <h2>Announcements</h2>
                <p>Updates targeted to you and your departments.</p>
              </div>
              <a class="button button-ghost button-small" href="announcements.html">View all</a>
            </div>
            <div>${renderAnnouncements(data.announcements || [])}</div>
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Your production areas</span>
                <h2>Department workspaces</h2>
                <p>Your access is assembled from every department assigned to your account.</p>
              </div>
            </div>
            <div class="department-grid">${renderDepartments(data.departments || [])}</div>
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <span class="eyebrow">Action required</span>
                <h2>Your open tasks</h2>
                <p>Personal and department assignments that still need attention.</p>
              </div>
              <a class="button button-ghost button-small" href="tasks.html">Open task centre</a>
            </div>
            <div class="data-list">${renderTasks(data.tasks || [])}</div>
          </section>
        </div>

        <aside class="stack">
          <section class="panel">
            <div class="section-heading">
              <div><span class="eyebrow">Coming up</span><h2>Calls & rehearsals</h2></div>
            </div>
            <div class="timeline">${renderEvents(data.events || [])}</div>
          </section>

          <section class="panel">
            <span class="eyebrow">Private learning record</span>
            <h2>Your journal</h2>
            <p style="color:var(--muted)">Your entries are private from other students. Full administrators can review them to track growth and provide feedback.</p>
            <div class="grid grid-2">
              <div class="panel-inset"><strong style="font-size:1.7rem">${data.journal?.totalEntries || 0}</strong><span style="display:block;color:var(--muted);font-size:.78rem">Entries this production</span></div>
              <div class="panel-inset"><strong>${data.journal?.lastEntryDate ? dashboardJournalDate(data.journal.lastEntryDate) : 'None yet'}</strong><span style="display:block;color:var(--muted);font-size:.78rem">Most recent reflection</span></div>
            </div>
            <a class="button button-primary button-block" style="margin-top:16px" href="journal.html?new=1">Write a reflection</a>
          </section>

          ${data.journal?.helpReviewCount ? `<a class="panel" href="journal-review.html"><span class="eyebrow">Admin attention</span><h2>${data.journal.helpReviewCount} help request${data.journal.helpReviewCount === 1 ? '' : 's'}</h2><p style="color:var(--muted);margin:0">Students have flagged journal entries for support.</p></a>` : ''}
        </aside>
      </div>`;

    main.querySelectorAll('[data-ack]').forEach(button => button.addEventListener('click', async () => {
      try {
        await BRM.api('acknowledgeAnnouncement', { announcementId: button.dataset.ack });
        button.textContent = 'Acknowledged';
        button.disabled = true;
        BRM.toast('Acknowledgement recorded.');
      } catch (error) {
        BRM.toast(error.message, 'error');
      }
    }));

    main.querySelector('[data-new-announcement]')?.addEventListener('click', () => location.href = 'announcements.html?new=1');
  } catch (error) {
    main.innerHTML = `<div class="alert alert-error">${BRM.escape(error.message)}</div>`;
  }
}));

/**
 * Blocking Studio is intentionally surfaced only to people whose authenticated
 * context says they have a Blocking permission. Full Administrators inherit all
 * permissions through BRM.isAdmin()/admin.all.
 *
 * Stage Management Lead receives blocking.edit + blocking.audit from the
 * Blocking Studio permission installer, so Stage Management sees this card too.
 */
function canAccessBlockingStudio() {
  return Boolean(
    BRM.isAdmin() ||
    BRM.hasPermission('blocking.edit') ||
    BRM.hasPermission('blocking.manage') ||
    BRM.hasPermission('blocking.audit')
  );
}

function renderBlockingViewerHub(context, data) {
  const productionTitle = context.production?.ShortTitle || context.production?.Title || 'the production';
  const sceneCount = Number(data.blockingViewer?.sceneCount || data.blockingSceneCount || 0);
  return `
    <section class="panel dashboard-viewer-hub" aria-labelledby="blocking-viewer-title">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Rehearsal viewer</span>
          <h2 id="blocking-viewer-title">Watch saved blocking</h2>
          <p>Review ${BRM.escape(productionTitle)} staging, formations, entrances, and timed movement from any device.</p>
        </div>
        <span class="dashboard-viewer-icon" aria-hidden="true">▶</span>
      </div>
      <div class="form-actions" style="justify-content:space-between;align-items:center">
        <span class="field-hint">${sceneCount ? `${sceneCount} scene${sceneCount === 1 ? '' : 's'} available` : 'Saved scenes appear automatically'}</span>
        <a class="button button-primary" href="blocking-viewer.html">Open Blocking Viewer</a>
      </div>
    </section>`;
}

function renderBlockingStudioLaunch(context) {
  const accessLabel = BRM.isAdmin() ? 'Full Administrator' : 'Stage Management / Blocking Team';
  const productionTitle = context.production?.ShortTitle || context.production?.Title || 'Production';

  return `
    <section class="dashboard-blocking-launch" aria-labelledby="blocking-launch-title">
      <div class="dashboard-blocking-visual" aria-hidden="true">
        <span class="dashboard-blocking-stage-line"></span>
        <span class="dashboard-blocking-person p1">●</span>
        <span class="dashboard-blocking-person p2">●</span>
        <span class="dashboard-blocking-person p3">●</span>
        <span class="dashboard-blocking-person p4">●</span>
        <span class="dashboard-blocking-path path1"></span>
        <span class="dashboard-blocking-path path2"></span>
        <span class="dashboard-blocking-icon">⌖</span>
      </div>

      <div class="dashboard-blocking-copy">
        <div class="dashboard-blocking-meta">
          <span class="eyebrow">Director & Stage Management</span>
          <span class="dashboard-blocking-access">${BRM.escape(accessLabel)}</span>
        </div>
        <h2 id="blocking-launch-title">Blocking & Staging Studio</h2>
        <p>Build and save ${BRM.escape(productionTitle)} blocking directly on the Bedford auditorium map. Arrange individual performers and ensemble subsets, create formations and movement paths, sync blocking to songs or dialogue audio, manage scenic objects, and export blocking pictures for rehearsal.</p>

        <div class="dashboard-blocking-features" aria-label="Blocking Studio features">
          <span>Cast faces</span>
          <span>Scene & song timelines</span>
          <span>Formations</span>
          <span>Movement paths</span>
          <span>Props & scenery</span>
          <span>PNG snapshots</span>
        </div>

        <div class="dashboard-blocking-actions">
          <a class="button button-primary" href="blocking.html">⌖ Open Blocking Studio</a>
          <span class="dashboard-blocking-note">Private production workspace</span>
        </div>
      </div>
    </section>`;
}

function renderAnnouncements(items) {
  if (!items.length) return BRM.empty('No current announcements', 'New production updates will appear here.', '!');
  return items.slice(0, 5).map(item => `<article class="announcement-card ${String(item.Priority).toLowerCase()}">
    <div class="announcement-meta"><span class="badge ${item.Priority === 'Urgent' ? 'badge-urgent' : item.Priority === 'Important' ? 'badge-important' : ''}">${BRM.escape(item.Priority)}</span>${item.Pinned === 'TRUE' ? '<span class="badge">Pinned</span>' : ''}<span>${BRM.formatDateTime(item.CreatedAt)}</span></div>
    <h3 style="margin:10px 0 7px">${BRM.escape(item.Title)}</h3><p style="color:var(--muted);white-space:pre-wrap">${BRM.escape(item.Body)}</p>
    <div class="announcement-meta"><span>Posted by ${BRM.escape(item.AuthorName || 'Production Team')}</span></div>
    ${item.AcknowledgementRequired === 'TRUE' ? `<button class="button button-secondary button-small" style="margin-top:12px" data-ack="${item.AnnouncementID}">Acknowledge</button>` : ''}
  </article>`).join('');
}

function renderDepartments(items) {
  if (!items.length) return BRM.empty('No departments assigned', 'An administrator can assign production departments to your profile.', '◇');
  return items.map(dep => `<a class="department-card" href="${BRM.escape(dep.Slug)}.html"><span class="department-icon">${BRM.departmentIcon(dep.Slug)}</span><h3>${BRM.escape(dep.Name)}</h3><p>${BRM.escape(dep.Description || '')}</p><span class="eyebrow" style="margin:0">Open workspace →</span></a>`).join('');
}

function renderTasks(items) {
  if (!items.length) return BRM.empty('You are caught up', 'No open tasks are currently assigned to you.', '✓');
  return items.slice(0, 6).map(task => `<article class="data-card"><span class="rating-pill">${task.Status === 'In Progress' ? '→' : '○'}</span><div class="data-card-main"><div class="item-meta"><span class="badge ${task.Priority === 'Urgent' ? 'badge-urgent' : task.Priority === 'Important' ? 'badge-important' : ''}">${BRM.escape(task.Priority)}</span>${task.DueDate ? `<span>Due ${dashboardJournalDate(task.DueDate)}</span>` : ''}</div><h3>${BRM.escape(task.Title)}</h3><p>${BRM.escape(task.Description || '')}</p></div></article>`).join('');
}

function renderEvents(items) {
  if (!items.length) return BRM.empty('No upcoming calls', 'Events targeted to you will appear here.', '◷');
  return items.slice(0, 7).map(event => {
    const date = new Date(event.StartAt);
    const time = new Intl.DateTimeFormat('en-CA', { hour:'numeric', minute:'2-digit', timeZone:'America/Regina' }).format(date);
    return `<div class="timeline-item"><div class="timeline-time">${time}</div><div class="timeline-rail"></div><div class="timeline-content"><strong>${BRM.escape(event.Title)}</strong><span>${BRM.formatDate(event.StartAt)}${event.Location ? ` · ${BRM.escape(event.Location)}` : ''}</span></div></div>`;
  }).join('');
}
