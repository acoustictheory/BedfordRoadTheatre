const ScenicState = {
  data: null,
  view: 'environments',
  selectedSetId: '',
  detailTab: 'overview',
  includeArchived: false,
  filters: {
    search: '',
    status: '',
    priority: '',
    scene: '',
    setId: ''
  }
};

function bindScenicOnce(element, eventName, handler) {
  if (!element) return;
  const key = `scenicBound${eventName}`;
  if (element.dataset[key] === 'true') return;
  element.dataset[key] = 'true';
  element.addEventListener(eventName, handler);
}

document.addEventListener('DOMContentLoaded', () => {
  BRM.initPrivatePage(initScenicHub);
});

async function initScenicHub() {
  const main = scenicMain();
  BRM.loading(main, 'Building the scenic workspace…');

  try {
    await loadScenicHub();
    renderScenicHub();
  } catch (error) {
    main.innerHTML = `
      <div class="alert alert-error">
        <strong>Sets & Scenic Design Hub could not load.</strong>
        <p>${BRM.escape(error.message)}</p>
      </div>
    `;
  }
}

async function loadScenicHub() {
  ScenicState.data = await BRM.api('scenicHub', {
    includeArchived: ScenicState.includeArchived
  }, {
    noCache: true,
    forceNetwork: true
  });

  if (
    !ScenicState.selectedSetId
    || !ScenicState.data.sets.some(item =>
      String(item.SetID) === String(ScenicState.selectedSetId)
    )
  ) {
    ScenicState.selectedSetId = ScenicState.data.sets[0]?.SetID || '';
  }
}

function scenicMain() {
  return document.querySelector('#app-main');
}

function scenicPermission(key) {
  return Boolean(ScenicState.data?.permissions?.[key]);
}

function renderScenicHub() {
  const data = ScenicState.data;
  const main = scenicMain();

  main.innerHTML = `
    <div class="scenic-hub">
      ${renderScenicHero(data)}
      ${renderScenicAnnouncements(data.announcements || [])}
      ${renderScenicTabs()}
      <div data-scenic-view>${renderActiveScenicView()}</div>
      ${renderScenicTeam(data.team || [])}
    </div>
  `;

  bindScenicHubEvents();
  hydrateScenicImages(main);
  renderSelectedScenicDiscussion();
}

function renderScenicHero(data) {
  const stats = data.stats || {};

  return `
    <section class="scenic-hero">
      <div class="scenic-hero-grid">
        <div>
          <span class="eyebrow">Sets & Construction · Collaborative design workspace</span>
          <h1>Sets & Scenic Design Hub</h1>
          <p>
            Plan the nine production environments, break each design into buildable
            elements, coordinate construction, rehearse set changes, collect visual
            research, and keep the entire scenic team accountable.
          </p>

          <div class="scenic-hero-actions">
            ${scenicPermission('manage')
              ? '<button class="button button-primary" type="button" data-add-set>＋ Add environment</button>'
              : '<button class="button button-primary" type="button" data-suggest-scenic>＋ Suggest a change</button>'}
            ${scenicPermission('contribute')
              ? '<button class="button button-secondary" type="button" data-upload-scenic-image>Upload inspiration</button>'
              : ''}
            ${data.folderUrl
              ? `<a class="button button-secondary" href="${BRM.escape(data.folderUrl)}" target="_blank" rel="noopener">Open scenic Drive folder</a>`
              : ''}
            ${scenicPermission('manage')
              ? '<span class="scenic-manager-ribbon">◆ Scenic management tools active</span>'
              : ''}
          </div>
        </div>

        <div class="scenic-kpis">
          ${scenicKpi(stats.totalSets || 0, 'Environments')}
          ${scenicKpi(`${stats.readySets || 0}/${stats.totalSets || 0}`, 'Ready')}
          ${scenicKpi(stats.activeBuilds || 0, 'Active builds')}
          ${scenicKpi(stats.openTasks || 0, 'Open tasks')}
          ${scenicKpi(stats.unplannedTransitions || 0, 'Changes to plan')}
          ${scenicKpi(stats.images || 0, 'Design images')}
        </div>
      </div>
    </section>
  `;
}

function scenicKpi(value, label) {
  return `
    <div class="scenic-kpi">
      <strong>${BRM.escape(value)}</strong>
      <span>${BRM.escape(label)}</span>
    </div>
  `;
}

function renderScenicAnnouncements(items) {
  if (!items.length) return '';

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Priority communication</span>
          <h2>Scenic updates</h2>
        </div>
        <a class="button button-secondary button-small" href="announcements.html">View all</a>
      </div>

      <div class="grid grid-2">
        ${items.slice(0, 4).map(item => `
          <article class="panel-inset scenic-announcement">
            <div class="item-meta">
              <span class="badge ${item.Priority === 'Urgent' ? 'badge-urgent' : ''}">
                ${BRM.escape(item.Priority || 'Normal')}
              </span>
              <span>${BRM.formatDateTime(item.PublishAt || item.CreatedAt)}</span>
            </div>
            <h3>${BRM.escape(item.Title || 'Scenic update')}</h3>
            <p>${BRM.escape(item.Body || '')}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderScenicTabs() {
  const pending = (ScenicState.data.suggestions || [])
    .filter(item => String(item.Status) === 'Pending').length;

  const tabs = [
    ['environments', 'Environments'],
    ['elements', 'Build elements'],
    ['tasks', 'Tasks'],
    ['transitions', 'Set changes'],
    ['deadlines', 'Deadlines'],
    ['inspiration', 'Design board'],
    ['suggestions', `Suggestions${pending ? ` (${pending})` : ''}`],
    ['activity', 'Activity']
  ];

  return `
    <nav class="scenic-tabs" aria-label="Scenic Hub sections">
      ${tabs.map(([id, label]) => `
        <button
          class="scenic-tab ${ScenicState.view === id ? 'active' : ''}"
          type="button"
          data-scenic-tab="${id}"
        >${BRM.escape(label)}</button>
      `).join('')}
    </nav>
  `;
}

function renderActiveScenicView() {
  switch (ScenicState.view) {
    case 'elements': return renderScenicElementsBoard();
    case 'tasks': return renderScenicTasksBoard();
    case 'transitions': return renderScenicTransitions();
    case 'deadlines': return renderScenicDeadlines();
    case 'inspiration': return renderScenicInspiration();
    case 'suggestions': return renderScenicSuggestions();
    case 'activity': return renderScenicActivity();
    case 'environments':
    default:
      return renderScenicEnvironments();
  }
}

function renderScenicEnvironments() {
  const sets = filteredScenicSets();

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Production environments</span>
          <h2>Scenic environments</h2>
          <p>Select an environment to open its complete design, build, image, and discussion workspace.</p>
        </div>

        <label class="checkbox-row">
          <input type="checkbox" data-show-archived ${ScenicState.includeArchived ? 'checked' : ''}>
          Show archived
        </label>
      </div>

      <div class="scenic-toolbar">
        <input
          type="search"
          placeholder="Search sets, scenes, songs or materials"
          data-filter="search"
          value="${BRM.escape(ScenicState.filters.search)}"
        >
        ${filterSelect('status', 'All statuses', uniqueValues(ScenicState.data.sets, 'Status'))}
        ${filterSelect('priority', 'All priorities', uniqueValues(ScenicState.data.sets, 'Priority'))}
        ${filterSelect('scene', 'All scene references', uniqueSceneTokens())}
        <select data-filter="setId">
          <option value="">All environments</option>
          ${ScenicState.data.sets.map(item => `
            <option value="${BRM.escape(item.SetID)}" ${ScenicState.filters.setId === item.SetID ? 'selected' : ''}>
              ${BRM.escape(item.SetName)}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="scenic-environment-layout">
        <div class="scenic-environment-list">
          ${sets.length
            ? sets.map(renderScenicSetButton).join('')
            : BRM.empty('No environments found', 'Adjust the filters or add a new scenic environment.', '◇')}
        </div>

        <div>${renderSelectedScenicSet()}</div>
      </div>
    </section>
  `;
}

function filterSelect(key, placeholder, values) {
  return `
    <select data-filter="${key}">
      <option value="">${BRM.escape(placeholder)}</option>
      ${values.map(value => `
        <option value="${BRM.escape(value)}" ${ScenicState.filters[key] === value ? 'selected' : ''}>
          ${BRM.escape(value)}
        </option>
      `).join('')}
    </select>
  `;
}

function uniqueValues(items, key) {
  return [...new Set(
    (items || [])
      .map(item => String(item[key] || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}

function uniqueSceneTokens() {
  const tokens = new Set();

  (ScenicState.data.sets || []).forEach(item => {
    String(item.ScenesUsed || '')
      .split(/[,;\n]/)
      .map(value => value.trim())
      .filter(Boolean)
      .forEach(value => tokens.add(value));
  });

  return [...tokens].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

function filteredScenicSets() {
  const filters = ScenicState.filters;
  const search = String(filters.search || '').trim().toLowerCase();

  return (ScenicState.data.sets || []).filter(item => {
    if (filters.status && String(item.Status) !== filters.status) return false;
    if (filters.priority && String(item.Priority) !== filters.priority) return false;
    if (filters.setId && String(item.SetID) !== filters.setId) return false;
    if (
      filters.scene
      && !String(item.ScenesUsed || '').split(/[,;\n]/).map(value => value.trim())
        .includes(filters.scene)
    ) {
      return false;
    }

    if (!search) return true;

    return [
      item.SetID,
      item.SetName,
      item.ShortDescription,
      item.DesignVibe,
      item.ScenesUsed,
      item.SongsUsed,
      item.RequiredSetPieces,
      item.ColourPalette,
      item.MaterialsNeeded,
      item.Notes
    ].some(value => String(value || '').toLowerCase().includes(search));
  });
}

function renderScenicSetButton(item) {
  const selected = String(item.SetID) === String(ScenicState.selectedSetId);
  const image = primaryImageForSet(item.SetID);
  const completion = Math.max(0, Math.min(100, Number(item.CompletionPercent || 0)));

  return `
    <button
      class="scenic-set-button ${selected ? 'active' : ''}"
      type="button"
      data-select-set="${BRM.escape(item.SetID)}"
    >
      <span class="scenic-set-thumb">
        ${image
          ? scenicImageMarkup(image, 'Scenic environment thumbnail')
          : '<span>▱</span>'}
      </span>

      <span>
        <span class="scenic-set-title">
          <strong>${BRM.escape(item.SetID)} · ${BRM.escape(item.SetName)}</strong>
          <span class="badge ${item.Priority === 'Critical' ? 'badge-urgent' : ''}">
            ${BRM.escape(item.Priority || 'Medium')}
          </span>
        </span>
        <span class="scenic-set-sub">
          ${BRM.escape(item.ShortDescription || item.DesignVibe || 'No description yet')}
        </span>
        <span class="scenic-progress" title="${completion}% complete">
          <span style="width:${completion}%"></span>
        </span>
      </span>
    </button>
  `;
}

function selectedScenicSet() {
  return (ScenicState.data.sets || []).find(item =>
    String(item.SetID) === String(ScenicState.selectedSetId)
  );
}

function relatedElements(setId) {
  return (ScenicState.data.elements || []).filter(item =>
    String(item.SetID) === String(setId)
  );
}

function relatedTasks(setId, elementId = '') {
  return (ScenicState.data.tasks || []).filter(task => {
    if (elementId) {
      return String(task.RelatedType) === 'ScenicElement'
        && String(task.RelatedID) === String(elementId);
    }

    return (
      String(task.RelatedType) === 'ScenicSet'
      && String(task.RelatedID) === String(setId)
    ) || (
      String(task.RelatedType) === 'ScenicElement'
      && relatedElements(setId).some(element =>
        String(element.ScenicElementID) === String(task.RelatedID)
      )
    );
  });
}

function relatedTransitions(setId) {
  return (ScenicState.data.transitions || []).filter(item =>
    String(item.SetID) === String(setId)
  );
}

function relatedImages(setId, elementId = '') {
  return (ScenicState.data.images || []).filter(item => {
    if (elementId) {
      return String(item.ScenicElementID) === String(elementId);
    }
    return String(item.SetID) === String(setId);
  });
}

function primaryImageForSet(setId) {
  const set = (ScenicState.data.sets || []).find(item =>
    String(item.SetID) === String(setId)
  );
  const images = relatedImages(setId).filter(item => !item.ScenicElementID);

  if (set?.PrimaryImageFileID) {
    return images.find(item =>
      String(item.DriveFileID) === String(set.PrimaryImageFileID)
    ) || {
      DriveFileID: set.PrimaryImageFileID,
      Caption: set.SetName,
      PhotoRef: `drivefile:${set.PrimaryImageFileID}`
    };
  }

  return images[0] || null;
}

function renderSelectedScenicSet() {
  const item = selectedScenicSet();

  if (!item) {
    return `
      <div class="scenic-detail-shell scenic-empty-detail">
        <div>
          <h2>Select an environment</h2>
          <p>Choose one of the scenic environments to open its collaborative workspace.</p>
        </div>
      </div>
    `;
  }

  return `
    <article class="scenic-detail-shell">
      <header class="scenic-detail-head">
        <div>
          <div class="item-meta">
            <span class="badge">${BRM.escape(item.SetID)}</span>
            <span class="badge ${item.Status === 'Needs Repair' ? 'badge-urgent' : ''}">
              ${BRM.escape(item.Status || 'Not Started')}
            </span>
            <span>${Number(item.CompletionPercent || 0)}% complete</span>
          </div>
          <h2>${BRM.escape(item.SetName)}</h2>
          <p>${BRM.escape(item.ShortDescription || '')}</p>
        </div>

        <div class="scenic-detail-actions">
          ${item.FolderURL
            ? `<a class="button button-secondary button-small" href="${BRM.escape(item.FolderURL)}" target="_blank" rel="noopener">Drive folder</a>`
            : ''}
          ${scenicPermission('contribute')
            ? `<button class="button button-secondary button-small" data-upload-scenic-image="${BRM.escape(item.SetID)}">Add image</button>`
            : ''}
          ${scenicPermission('manage')
            ? `<button class="button button-secondary button-small" data-add-element="${BRM.escape(item.SetID)}">Add element</button>
               <button class="button button-secondary button-small" data-add-task="${BRM.escape(item.SetID)}">Add task</button>
               <button class="button button-primary button-small" data-edit-set="${BRM.escape(item.SetID)}">Edit</button>`
            : ''}
          ${scenicPermission('archive') && item.Status !== 'Archived'
            ? `<button class="button button-danger button-small" data-archive-set="${BRM.escape(item.SetID)}">Archive</button>`
            : ''}
          ${scenicPermission('archive') && item.Status === 'Archived'
            ? `<button class="button button-secondary button-small" data-restore-set="${BRM.escape(item.SetID)}">Restore</button>`
            : ''}
          ${scenicPermission('permanentDelete') && item.Status === 'Archived'
            ? `<button class="button button-danger button-small" data-delete-set="${BRM.escape(item.SetID)}">Delete permanently</button>`
            : ''}
        </div>
      </header>

      <nav class="scenic-detail-tabs">
        ${detailTabButton('overview', 'Overview')}
        ${detailTabButton('elements', `Elements (${relatedElements(item.SetID).length})`)}
        ${detailTabButton('tasks', `Tasks (${relatedTasks(item.SetID).length})`)}
        ${detailTabButton('transitions', `Set changes (${relatedTransitions(item.SetID).length})`)}
        ${detailTabButton('images', `Images (${relatedImages(item.SetID).length})`)}
        ${detailTabButton('discussion', 'Discussion')}
        ${detailTabButton('history', 'History')}
      </nav>

      <div class="scenic-detail-body">
        ${renderSelectedScenicTab(item)}
      </div>
    </article>
  `;
}

function detailTabButton(id, label) {
  return `
    <button
      class="scenic-detail-tab ${ScenicState.detailTab === id ? 'active' : ''}"
      type="button"
      data-detail-tab="${id}"
    >${BRM.escape(label)}</button>
  `;
}

function renderSelectedScenicTab(item) {
  switch (ScenicState.detailTab) {
    case 'elements': return renderSetElements(item);
    case 'tasks': return renderSetTasks(item);
    case 'transitions': return renderSetTransitions(item);
    case 'images': return renderSetImages(item);
    case 'discussion': return '<div data-notes-panel></div>';
    case 'history': return renderSetHistory(item);
    case 'overview':
    default:
      return renderSetOverview(item);
  }
}

function renderSetOverview(item) {
  const lead = ScenicState.data.team.find(person =>
    String(person.UserID) === String(item.AssignedLeadUserID)
  );

  return `
    <div class="scenic-facts">
      ${fact('Design vibe', item.DesignVibe || 'Not defined')}
      ${fact('Scenes used', item.ScenesUsed || 'Not assigned')}
      ${fact('Priority', item.Priority || 'Medium')}
      ${fact('Assigned lead', lead?.DisplayName || 'Unassigned')}
      ${fact('Colour palette', item.ColourPalette || 'Not defined')}
      ${fact('Materials', item.MaterialsNeeded || 'Not defined')}
      ${fact('Dimensions', item.Dimensions || 'Not recorded')}
      ${fact('Storage', item.StorageLocation || 'Not recorded')}
      ${fact('Status', item.Status || 'Not Started')}
      ${fact('Songs used', item.SongsUsed || 'Not assigned', true)}
      ${fact('Required scenic pieces', item.RequiredSetPieces || 'Not defined', true)}
    </div>

    <div class="scenic-section-grid">
      <div class="panel-inset">
        <span class="eyebrow">Movement and stage mechanics</span>
        <p>${BRM.escape(item.MovementNotes || 'No movement or change notes have been entered.')}</p>
      </div>

      <div class="panel-inset scenic-safety">
        <span class="eyebrow">Safety notes</span>
        <p>${BRM.escape(item.SafetyNotes || 'No set-specific safety notes have been entered.')}</p>
      </div>

      <div class="panel-inset scenic-wide">
        <span class="eyebrow">Additional design notes</span>
        <p>${BRM.escape(item.Notes || 'No additional notes yet.')}</p>
      </div>
    </div>
  `;
}

function fact(label, value, wide = false) {
  return `
    <div class="scenic-fact ${wide ? 'scenic-wide' : ''}">
      <span>${BRM.escape(label)}</span>
      <p>${BRM.escape(value)}</p>
    </div>
  `;
}

function renderSetElements(item) {
  const elements = relatedElements(item.SetID);

  return `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Build breakdown</span>
        <h3>Scenic elements</h3>
      </div>
      ${scenicPermission('manage')
        ? `<button class="button button-primary button-small" data-add-element="${BRM.escape(item.SetID)}">Add element</button>`
        : ''}
    </div>

    <div class="scenic-card-grid">
      ${elements.length
        ? elements.map(renderScenicElementCard).join('')
        : BRM.empty('No build elements yet', 'Break this environment into individual pieces, units, treatments, or dressing.', '▱')}
    </div>
  `;
}

function renderScenicElementCard(element) {
  const assignees = (element.AssignedUserIDs || [])
    .map(id => ScenicState.data.team.find(person => String(person.UserID) === String(id)))
    .filter(Boolean);
  const image = relatedImages(element.SetID, element.ScenicElementID)[0];

  return `
    <article class="scenic-element-card">
      ${image
        ? `<div class="scenic-set-thumb" style="width:100%;height:145px">${scenicImageMarkup(image, element.ElementName)}</div>`
        : ''}
      <div class="scenic-element-meta">
        <span class="badge">${BRM.escape(element.ElementType || 'Scenic Piece')}</span>
        <span class="badge ${element.Priority === 'Critical' ? 'badge-urgent' : ''}">
          ${BRM.escape(element.Priority || 'Medium')}
        </span>
      </div>
      <h3>${BRM.escape(element.ElementName)}</h3>
      <p>${BRM.escape(element.Description || '')}</p>
      <div class="item-meta">
        <span>${BRM.escape(element.Status || 'Not Started')}</span>
        <span>Qty ${Number(element.Quantity || 1)}</span>
      </div>
      ${assignees.length
        ? `<p class="field-hint">Assigned: ${assignees.map(person => BRM.escape(person.DisplayName)).join(', ')}</p>`
        : '<p class="field-hint">No student assigned.</p>'}
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        ${scenicPermission('manage')
          ? `<button class="button button-secondary button-small" data-edit-element="${BRM.escape(element.ScenicElementID)}">Edit</button>
             <button class="button button-secondary button-small" data-add-element-task="${BRM.escape(element.ScenicElementID)}">Add task</button>`
          : ''}
        ${scenicPermission('contribute')
          ? `<button class="button button-secondary button-small" data-upload-element-image="${BRM.escape(element.ScenicElementID)}">Add image</button>`
          : ''}
        ${scenicPermission('archive') && element.Status !== 'Archived'
          ? `<button class="button button-danger button-small" data-archive-element="${BRM.escape(element.ScenicElementID)}">Archive</button>`
          : ''}
        ${scenicPermission('archive') && element.Status === 'Archived'
          ? `<button class="button button-secondary button-small" data-restore-element="${BRM.escape(element.ScenicElementID)}">Restore</button>`
          : ''}
        ${scenicPermission('permanentDelete') && element.Status === 'Archived'
          ? `<button class="button button-danger button-small" data-delete-element="${BRM.escape(element.ScenicElementID)}">Delete permanently</button>`
          : ''}
      </div>
    </article>
  `;
}

function renderSetTasks(item) {
  return renderTaskRows(relatedTasks(item.SetID), item.SetID);
}

function renderScenicTasksBoard() {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Construction project management</span>
          <h2>Scenic tasks</h2>
          <p>All Sets department tasks, including environment work and individual scenic elements.</p>
        </div>
        ${scenicPermission('manage')
          ? '<button class="button button-primary button-small" data-add-task>＋ Add task</button>'
          : ''}
      </div>
      ${renderTaskRows(ScenicState.data.tasks || [], '')}
    </section>
  `;
}

function renderTaskRows(tasks, setId) {
  const sorted = [...tasks].sort((a, b) => {
    const completeA = ['Complete', 'Completed', 'Done'].includes(String(a.Status));
    const completeB = ['Complete', 'Completed', 'Done'].includes(String(b.Status));
    if (completeA !== completeB) return completeA ? 1 : -1;
    return new Date(a.DueDate || '2999-12-31').getTime()
      - new Date(b.DueDate || '2999-12-31').getTime();
  });

  if (!sorted.length) {
    return BRM.empty('No scenic tasks', 'Add build, painting, sourcing, rigging, repair, or installation work.', '✓');
  }

  return sorted.map(task => {
    const environment = findSetForTask(task);
    return `
      <article class="scenic-row">
        <span class="scenic-status-dot" data-status="${BRM.escape(task.Status)}"></span>
        <div>
          <div class="item-meta">
            <span class="badge">${BRM.escape(task.Priority || 'Normal')}</span>
            ${environment ? `<span>${BRM.escape(environment.SetName)}</span>` : ''}
            ${task.DueDate ? `<span>Due ${BRM.escape(task.DueDate)}</span>` : ''}
          </div>
          <h3>${BRM.escape(task.Title)}</h3>
          <p>${BRM.escape(task.Description || '')}</p>
        </div>
        <select class="scenic-run-status" data-task-status="${BRM.escape(task.TaskID)}">
          ${['Open','In Progress','Paused','Complete'].map(status => `
            <option value="${status}" ${String(task.Status) === status ? 'selected' : ''}>${status}</option>
          `).join('')}
        </select>
      </article>
    `;
  }).join('');
}

function findSetForTask(task) {
  if (String(task.RelatedType) === 'ScenicSet') {
    return ScenicState.data.sets.find(set =>
      String(set.SetID) === String(task.RelatedID)
    );
  }

  if (String(task.RelatedType) === 'ScenicElement') {
    const element = ScenicState.data.elements.find(item =>
      String(item.ScenicElementID) === String(task.RelatedID)
    );
    return ScenicState.data.sets.find(set =>
      String(set.SetID) === String(element?.SetID)
    );
  }

  return null;
}

function renderSetTransitions(item) {
  const transitions = relatedTransitions(item.SetID);

  return `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Backstage movement planning</span>
        <h3>Set changes</h3>
      </div>
      ${scenicPermission('manage')
        ? `<button class="button button-primary button-small" data-add-transition="${BRM.escape(item.SetID)}">Add set change</button>`
        : ''}
    </div>
    ${renderTransitionCards(transitions)}
  `;
}

function renderScenicTransitions() {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Performance run mode</span>
          <h2>Set changes</h2>
          <p>Plan movement paths, cue points, assigned crew, safety concerns, and live run status.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${scenicPermission('manage')
            ? '<button class="button button-secondary button-small" data-reset-transition-run>Reset run checks</button><button class="button button-primary button-small" data-add-transition>＋ Add set change</button>'
            : ''}
        </div>
      </div>
      ${renderTransitionCards(ScenicState.data.transitions || [])}
    </section>
  `;
}

function renderTransitionCards(transitions) {
  if (!transitions.length) {
    return BRM.empty(
      'No set changes planned yet',
      'Add scene-to-scene movement plans before staging and technical rehearsals.',
      '⇄'
    );
  }

  return `
    <div class="scenic-transition-grid">
      ${transitions.map(transition => {
        const set = ScenicState.data.sets.find(item =>
          String(item.SetID) === String(transition.SetID)
        );

        return `
          <article class="scenic-transition-card">
            <div class="section-heading" style="margin-bottom:8px">
              <div>
                <div class="item-meta">
                  <span class="badge">${BRM.escape(transition.PlanStatus || 'Not Planned')}</span>
                  ${set ? `<span>${BRM.escape(set.SetName)}</span>` : ''}
                </div>
                <h3>${BRM.escape(transition.TransitionName)}</h3>
              </div>
              ${scenicPermission('manage')
                ? `<button class="button button-secondary button-small" data-edit-transition="${BRM.escape(transition.ScenicTransitionID)}">Edit plan</button>`
                : ''}
            </div>

            <div class="scenic-transition-route">
              <strong>${BRM.escape(transition.FromScene || 'Previous scene')}</strong>
              <span class="scenic-transition-arrow">→</span>
              <strong>${BRM.escape(transition.ToScene || 'Next scene')}</strong>
            </div>

            <div class="grid grid-2">
              <div class="panel-inset">
                <span class="eyebrow">Cue and path</span>
                <p>${BRM.escape(transition.Cue || 'No cue recorded.')}</p>
                <p>${BRM.escape(transition.MovementPath || 'No movement path recorded.')}</p>
              </div>
              <div class="panel-inset scenic-safety">
                <span class="eyebrow">Safety</span>
                <p>${BRM.escape(transition.SafetyNotes || 'No transition safety notes entered.')}</p>
              </div>
            </div>

            <div style="display:flex;justify-content:flex-end;margin-top:12px">
              <select class="scenic-run-status" data-transition-status="${BRM.escape(transition.ScenicTransitionID)}">
                ${['Not Checked','Cleared','In Motion','Complete','Reset'].map(status => `
                  <option value="${status}" ${String(transition.RunStatus) === status ? 'selected' : ''}>${status}</option>
                `).join('')}
              </select>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

function renderSetImages(item) {
  const images = relatedImages(item.SetID);

  return `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Concept, progress and final documentation</span>
        <h3>Environment images</h3>
      </div>
      ${scenicPermission('contribute')
        ? `<button class="button button-primary button-small" data-upload-scenic-image="${BRM.escape(item.SetID)}">Add image</button>`
        : ''}
    </div>
    ${renderImageGrid(images)}
  `;
}

function renderScenicInspiration() {
  const images = ScenicState.data.images || [];

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Visual research and build documentation</span>
          <h2>Scenic design board</h2>
          <p>Concept art, drafting, colour research, progress photos, paint treatments, safety references, and final images.</p>
        </div>
        ${scenicPermission('contribute')
          ? '<button class="button button-primary button-small" data-upload-scenic-image>＋ Add image</button>'
          : ''}
      </div>

      <div class="scenic-inspiration-board">
        ${images.length
          ? images.map(renderScenicImageCard).join('')
          : BRM.empty('No scenic images yet', 'Upload visual research or a build progress photo.', '▧')}
      </div>
    </section>
  `;
}

function renderImageGrid(images) {
  if (!images.length) {
    return BRM.empty('No images yet', 'Upload inspiration, plans, progress photos, or final documentation.', '▧');
  }

  return `<div class="scenic-image-grid">${images.map(renderScenicImageCard).join('')}</div>`;
}

function renderScenicImageCard(image) {
  const set = ScenicState.data.sets.find(item =>
    String(item.SetID) === String(image.SetID)
  );

  return `
    <article class="scenic-image-card">
      ${scenicImageMarkup(image, image.Caption || image.FileName)}
      ${(scenicPermission('manage')
        || String(image.UploadedByUserID) === String(ScenicState.data.context.userId))
        ? `<button class="button button-danger button-small scenic-image-remove" data-delete-scenic-image="${BRM.escape(image.ScenicImageID)}">×</button>`
        : ''}
      <div class="scenic-image-caption">
        <strong>${BRM.escape(image.Caption || image.FileName || 'Scenic image')}</strong>
        <div class="item-meta">
          <span>${BRM.escape(image.ImageType || 'Progress')}</span>
          ${set ? `<span>${BRM.escape(set.SetName)}</span>` : '<span>General design board</span>'}
        </div>
      </div>
    </article>
  `;
}

function scenicImageMarkup(image, alt) {
  return `
    <div class="scenic-image-placeholder" data-scenic-image-shell>
      <span>Loading image…</span>
      <img
        hidden
        data-scenic-image
        data-scenic-file-id="${BRM.escape(image.DriveFileID || '')}"
        alt="${BRM.escape(alt || '')}"
      >
    </div>
  `;
}

function renderScenicDeadlines() {
  const deadlines = [...(ScenicState.data.deadlines || [])].sort((a, b) =>
    new Date(a.DueDate || '2999-12-31').getTime()
    - new Date(b.DueDate || '2999-12-31').getTime()
  );

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Milestones and safety dates</span>
          <h2>Scenic deadlines</h2>
        </div>
        ${scenicPermission('manage')
          ? '<button class="button button-primary button-small" data-add-deadline>＋ Add deadline</button>'
          : ''}
      </div>

      ${deadlines.length
        ? deadlines.map(deadline => {
            const set = ScenicState.data.sets.find(item =>
              String(item.SetID) === String(deadline.SetID)
            );
            return `
              <article class="scenic-row">
                <span class="scenic-status-dot" data-status="${BRM.escape(deadline.Status)}"></span>
                <div>
                  <div class="item-meta">
                    <span class="badge ${deadline.Priority === 'Urgent' ? 'badge-urgent' : ''}">
                      ${BRM.escape(deadline.Priority || 'Normal')}
                    </span>
                    ${deadline.DueDate ? `<span>${BRM.escape(deadline.DueDate)}</span>` : ''}
                    ${set ? `<span>${BRM.escape(set.SetName)}</span>` : '<span>Whole department</span>'}
                  </div>
                  <h3>${BRM.escape(deadline.Title)}</h3>
                  <p>${BRM.escape(deadline.Notes || '')}</p>
                </div>
                ${scenicPermission('manage')
                  ? `<button class="button button-secondary button-small" data-edit-deadline="${BRM.escape(deadline.ScenicDeadlineID)}">Edit</button>`
                  : ''}
              </article>
            `;
          }).join('')
        : BRM.empty('No scenic deadlines', 'Add construction, paint, installation, rehearsal, or safety milestones.', '◷')}
    </section>
  `;
}

function renderScenicSuggestions() {
  const suggestions = ScenicState.data.suggestions || [];

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Collaborative change requests</span>
          <h2>Scenic suggestions</h2>
          <p>Members may suggest a new element, a design change, or flag a safety concern without directly altering official records.</p>
        </div>
        ${scenicPermission('contribute')
          ? '<button class="button button-primary button-small" data-suggest-scenic>＋ Submit suggestion</button>'
          : ''}
      </div>

      ${suggestions.length
        ? suggestions.map(suggestion => `
          <article class="scenic-row">
            <span class="scenic-status-dot" data-status="${BRM.escape(suggestion.Status)}"></span>
            <div>
              <div class="item-meta">
                <span class="badge ${suggestion.Priority === 'Critical' ? 'badge-urgent' : ''}">
                  ${BRM.escape(suggestion.SuggestionType || 'Change Request')}
                </span>
                <span>${BRM.escape(suggestion.Status)}</span>
                <span>${BRM.escape(suggestion.SuggestedBy?.DisplayName || '')}</span>
              </div>
              <h3>${BRM.escape(suggestion.Title)}</h3>
              <p>${BRM.escape(suggestion.Description || '')}</p>
              ${suggestion.ReviewNote
                ? `<div class="panel-inset">${BRM.escape(suggestion.ReviewNote)}</div>`
                : ''}
            </div>
            ${scenicPermission('manage') && suggestion.Status === 'Pending'
              ? `<div style="display:flex;gap:7px;flex-wrap:wrap">
                  <button class="button button-primary button-small" data-approve-suggestion="${BRM.escape(suggestion.ScenicSuggestionID)}">Approve</button>
                  <button class="button button-danger button-small" data-decline-suggestion="${BRM.escape(suggestion.ScenicSuggestionID)}">Decline</button>
                </div>`
              : ''}
          </article>
        `).join('')
        : BRM.empty('No suggestions', 'The scenic team has not submitted any requests yet.', '◇')}
    </section>
  `;
}

function renderScenicActivity() {
  const activity = ScenicState.data.activity || [];

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Accountable collaboration</span>
          <h2>Scenic activity</h2>
          <p>Important edits, uploads, status changes, approvals, archives, and run checks.</p>
        </div>
      </div>

      ${activity.length
        ? activity.map(renderScenicActivityRow).join('')
        : BRM.empty('No scenic activity yet', 'Actions will appear here as the team collaborates.', '◌')}
    </section>
  `;
}

function renderSetHistory(item) {
  const activity = (ScenicState.data.activity || []).filter(entry =>
    String(entry.SetID) === String(item.SetID)
  );

  return activity.length
    ? activity.map(renderScenicActivityRow).join('')
    : BRM.empty('No activity for this environment', 'Changes will appear here.', '◌');
}

function renderScenicActivityRow(entry) {
  return `
    <article class="scenic-row">
      ${BRM.avatar(
        entry.Actor?.DisplayName || 'Production Team',
        entry.Actor?.PhotoURL || '',
        'small'
      )}
      <div>
        <div class="item-meta">
          <span>${BRM.formatDateTime(entry.CreatedAt)}</span>
          <span>${BRM.escape(entry.Action || '')}</span>
        </div>
        <strong>${BRM.escape(entry.Summary || '')}</strong>
        <p class="field-hint">${BRM.escape(entry.Actor?.DisplayName || 'Production Team')}</p>
      </div>
      ${entry.SetID
        ? `<button class="button button-secondary button-small" data-jump-set="${BRM.escape(entry.SetID)}">Open set</button>`
        : ''}
    </article>
  `;
}

function renderScenicTeam(team) {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Approved Sets & Construction members</span>
          <h2>Scenic team</h2>
          <p>Hover over a profile image to see the student’s name and department role.</p>
        </div>
        ${BRM.isAdmin()
          ? '<a class="button button-secondary button-small" href="admin.html#users">Manage team</a>'
          : ''}
      </div>

      <div class="scenic-team">
        ${team.length
          ? team.map(person => `
            <button
              class="scenic-team-person"
              type="button"
              aria-label="${BRM.escape(person.DisplayName)} — ${BRM.escape(person.RoleLabel)}"
            >
              ${BRM.avatar(person.DisplayName, person.PhotoURL, '')}
              <span class="scenic-team-tip">
                <strong>${BRM.escape(person.DisplayName)}</strong><br>
                ${BRM.escape(person.RoleLabel || 'Scenic Member')}
              </span>
            </button>
          `).join('')
          : '<p class="field-hint">No approved Sets & Construction members yet.</p>'}
      </div>
    </section>
  `;
}

function bindScenicHubEvents() {
  const main = scenicMain();

  main.querySelectorAll('[data-scenic-tab]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      ScenicState.view = button.dataset.scenicTab;
      renderScenicHub();
    });
  });

  main.querySelectorAll('[data-filter]').forEach(input => {
    bindScenicOnce(
      input,
      input.tagName === 'INPUT' ? 'input' : 'change',
      () => {
        ScenicState.filters[input.dataset.filter] = input.value;
        refreshScenicViewOnly();
      }
    );
  });

  bindScenicOnce(main.querySelector('[data-show-archived]'), 'change', async event => {
    ScenicState.includeArchived = event.target.checked;
    await loadScenicHub();
    renderScenicHub();
  });

  main.querySelectorAll('[data-select-set]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      ScenicState.selectedSetId = button.dataset.selectSet;
      ScenicState.detailTab = 'overview';
      refreshScenicViewOnly();
    });
  });

  main.querySelectorAll('[data-detail-tab]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      ScenicState.detailTab = button.dataset.detailTab;
      refreshScenicViewOnly();
    });
  });

  main.querySelectorAll('[data-jump-set]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      ScenicState.selectedSetId = button.dataset.jumpSet;
      ScenicState.view = 'environments';
      ScenicState.detailTab = 'overview';
      renderScenicHub();
    });
  });

  main.querySelectorAll('[data-add-set]').forEach(button => {
    bindScenicOnce(button, 'click', () => openScenicSetModal());
  });

  main.querySelectorAll('[data-edit-set]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      const item = ScenicState.data.sets.find(set =>
        String(set.SetID) === String(button.dataset.editSet)
      );
      openScenicSetModal(item);
    });
  });

  main.querySelectorAll('[data-archive-set]').forEach(button => {
    bindScenicOnce(button, 'click', () => archiveScenicSet(button.dataset.archiveSet));
  });

  main.querySelectorAll('[data-restore-set]').forEach(button => {
    bindScenicOnce(button, 'click', () => restoreScenicSet(button.dataset.restoreSet));
  });

  main.querySelectorAll('[data-delete-set]').forEach(button => {
    bindScenicOnce(button, 'click', () => deleteScenicSet(button.dataset.deleteSet));
  });

  main.querySelectorAll('[data-add-element]').forEach(button => {
    bindScenicOnce(button, 'click', () => openScenicElementModal(null, button.dataset.addElement));
  });

  main.querySelectorAll('[data-edit-element]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      const item = ScenicState.data.elements.find(element =>
        String(element.ScenicElementID) === String(button.dataset.editElement)
      );
      openScenicElementModal(item, item?.SetID);
    });
  });

  main.querySelectorAll('[data-archive-element]').forEach(button => {
    bindScenicOnce(button, 'click', () => archiveScenicElement(button.dataset.archiveElement));
  });

  main.querySelectorAll('[data-restore-element]').forEach(button => {
    bindScenicOnce(button, 'click', () => restoreScenicElement(button.dataset.restoreElement));
  });

  main.querySelectorAll('[data-delete-element]').forEach(button => {
    bindScenicOnce(button, 'click', () => deleteScenicElement(button.dataset.deleteElement));
  });

  main.querySelectorAll('[data-add-task]').forEach(button => {
    bindScenicOnce(button, 'click', () => openScenicTaskModal({
      setId: button.dataset.addTask || ''
    }));
  });

  main.querySelectorAll('[data-add-element-task]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      const element = ScenicState.data.elements.find(item =>
        String(item.ScenicElementID) === String(button.dataset.addElementTask)
      );
      openScenicTaskModal({
        setId: element?.SetID || '',
        scenicElementId: element?.ScenicElementID || ''
      });
    });
  });

  main.querySelectorAll('[data-task-status]').forEach(select => {
    bindScenicOnce(select, 'change', () =>
      updateScenicTaskStatus(select.dataset.taskStatus, select.value)
    );
  });

  main.querySelectorAll('[data-add-transition]').forEach(button => {
    bindScenicOnce(button, 'click', () =>
      openScenicTransitionModal(null, button.dataset.addTransition || '')
    );
  });

  main.querySelectorAll('[data-edit-transition]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      const item = ScenicState.data.transitions.find(transition =>
        String(transition.ScenicTransitionID) === String(button.dataset.editTransition)
      );
      openScenicTransitionModal(item, item?.SetID || '');
    });
  });

  main.querySelectorAll('[data-transition-status]').forEach(select => {
    bindScenicOnce(select, 'change', () =>
      updateTransitionStatus(select.dataset.transitionStatus, select.value)
    );
  });

  bindScenicOnce(main.querySelector('[data-reset-transition-run]'), 'click', resetTransitionRun);

  bindScenicOnce(main.querySelector('[data-add-deadline]'), 'click', () =>
    openScenicDeadlineModal()
  );

  main.querySelectorAll('[data-edit-deadline]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      const item = ScenicState.data.deadlines.find(deadline =>
        String(deadline.ScenicDeadlineID) === String(button.dataset.editDeadline)
      );
      openScenicDeadlineModal(item);
    });
  });

  main.querySelectorAll('[data-upload-scenic-image]').forEach(button => {
    bindScenicOnce(button, 'click', () =>
      openScenicImageModal({
        setId: button.dataset.uploadScenicImage || ''
      })
    );
  });

  main.querySelectorAll('[data-upload-element-image]').forEach(button => {
    bindScenicOnce(button, 'click', () => {
      const element = ScenicState.data.elements.find(item =>
        String(item.ScenicElementID) === String(button.dataset.uploadElementImage)
      );
      openScenicImageModal({
        setId: element?.SetID || '',
        scenicElementId: element?.ScenicElementID || ''
      });
    });
  });

  main.querySelectorAll('[data-delete-scenic-image]').forEach(button => {
    bindScenicOnce(button, 'click', () =>
      deleteScenicImage(button.dataset.deleteScenicImage)
    );
  });

  main.querySelectorAll('[data-suggest-scenic]').forEach(button => {
    bindScenicOnce(button, 'click', openScenicSuggestionModal);
  });

  main.querySelectorAll('[data-approve-suggestion]').forEach(button => {
    bindScenicOnce(button, 'click', () =>
      reviewScenicSuggestion(button.dataset.approveSuggestion, 'Approved')
    );
  });

  main.querySelectorAll('[data-decline-suggestion]').forEach(button => {
    bindScenicOnce(button, 'click', () =>
      reviewScenicSuggestion(button.dataset.declineSuggestion, 'Declined')
    );
  });
}

function refreshScenicViewOnly() {
  const host = scenicMain().querySelector('[data-scenic-view]');
  host.innerHTML = renderActiveScenicView();

  scenicMain().querySelectorAll('[data-scenic-tab]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.scenicTab === ScenicState.view
    );
  });

  bindScenicHubEvents();
  hydrateScenicImages(host);
  renderSelectedScenicDiscussion();
}

async function renderSelectedScenicDiscussion() {
  if (
    ScenicState.view !== 'environments'
    || ScenicState.detailTab !== 'discussion'
  ) {
    return;
  }

  const item = selectedScenicSet();
  if (!item) return;

  await BRM.renderNotesPanel({
    pageKey: 'scenic:set',
    relatedId: item.SetID,
    departmentId: ScenicState.data.department.DepartmentID,
    title: `${item.SetName} Discussion`
  });
}

async function mutateScenic(action, payload, successMessage) {
  try {
    await BRM.api(action, payload, {
      noCache: true,
      forceNetwork: true
    });
    await BRM.invalidateSiteCache?.();
    await loadScenicHub();
    BRM.toast(successMessage || 'Saved.');
    renderScenicHub();
  } catch (error) {
    BRM.toast(error.message, 'error');
    throw error;
  }
}

function openScenicSetModal(item = null) {
  const modal = BRM.openModal(`
    <span class="eyebrow">${item ? 'Edit scenic environment' : 'New scenic environment'}</span>
    <h2>${item ? BRM.escape(item.SetName) : 'Add environment'}</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Set name', 'setName', item?.SetName || '', true)}
        ${fieldInput('Set ID', 'setId', item?.SetID || '', false)}
        ${selectInput('Status', 'status', item?.Status || 'Not Started', [
          'Not Started','Designing','Approved','Building','Painting','Ready',
          'In Rehearsal','Complete','Needs Repair','Archived'
        ])}
        ${selectInput('Priority', 'priority', item?.Priority || 'Medium', [
          'Low','Medium','High','Critical'
        ])}
        ${fieldInput('Completion percent', 'completionPercent', item?.CompletionPercent || 0, false, '', 'number', 'min="0" max="100"')}
        ${selectInput('Assigned lead', 'assignedLeadUserId', item?.AssignedLeadUserID || '', [
          '',
          ...(ScenicState.data.team || []).map(person => ({
            value: person.UserID,
            label: person.DisplayName
          }))
        ])}
        ${textareaInput('Short description', 'shortDescription', item?.ShortDescription || '', 'span-2')}
        ${textareaInput('Design vibe', 'designVibe', item?.DesignVibe || '')}
        ${textareaInput('Colour palette', 'colourPalette', item?.ColourPalette || '')}
        ${textareaInput('Scenes used', 'scenesUsed', item?.ScenesUsed || '')}
        ${textareaInput('Songs used', 'songsUsed', item?.SongsUsed || '')}
        ${textareaInput('Required set pieces', 'requiredSetPieces', item?.RequiredSetPieces || '')}
        ${textareaInput('Materials needed', 'materialsNeeded', item?.MaterialsNeeded || '')}
        ${fieldInput('Dimensions', 'dimensions', item?.Dimensions || '')}
        ${fieldInput('Storage location', 'storageLocation', item?.StorageLocation || '')}
        ${textareaInput('Movement notes', 'movementNotes', item?.MovementNotes || '', 'span-2')}
        ${textareaInput('Safety notes', 'safetyNotes', item?.SafetyNotes || '', 'span-2')}
        ${textareaInput('Additional notes', 'notes', item?.Notes || '', 'span-2')}
        ${fieldInput('Drive folder ID', 'folderId', item?.FolderID || '')}
        ${fieldInput('Drive folder URL', 'folderUrl', item?.FolderURL || '')}
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Save environment</button>
      </div>
    </form>
  `, { wide: true });

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await mutateScenic('saveScenicSet', values, 'Scenic environment saved.');
    modal.closeModal();
  });
}

function openScenicElementModal(item = null, setId = '') {
  const modal = BRM.openModal(`
    <span class="eyebrow">${item ? 'Edit build element' : 'New build element'}</span>
    <h2>${item ? BRM.escape(item.ElementName) : 'Add scenic element'}</h2>
    <form data-form>
      <div class="form-grid">
        ${selectInput('Environment', 'setId', item?.SetID || setId, ScenicState.data.sets.map(set => ({
          value: set.SetID,
          label: `${set.SetID} · ${set.SetName}`
        })))}
        ${fieldInput('Element name', 'elementName', item?.ElementName || '', true)}
        ${fieldInput('Element type', 'elementType', item?.ElementType || 'Scenic Piece')}
        ${fieldInput('Quantity', 'quantity', item?.Quantity || 1, false, '', 'number', 'min="1"')}
        ${selectInput('Status', 'status', item?.Status || 'Not Started', [
          'Not Started','Designing','Materials Needed','Building','Painting',
          'Ready','Installed','Complete','Needs Repair','Archived'
        ])}
        ${selectInput('Priority', 'priority', item?.Priority || 'Medium', [
          'Low','Medium','High','Critical'
        ])}
        ${selectInput('Source', 'source', item?.Source || 'Build', [
          'Build','Pull','Borrow','Buy','Rent','Modify','Paint','Print'
        ])}
        ${fieldInput('Dimensions', 'dimensions', item?.Dimensions || '')}
        ${textareaInput('Description', 'description', item?.Description || '', 'span-2')}
        ${textareaInput('Materials', 'materials', item?.Materials || '')}
        ${fieldInput('Storage location', 'storageLocation', item?.StorageLocation || '')}
        ${textareaInput('Movement notes', 'movementNotes', item?.MovementNotes || '', 'span-2')}
        ${textareaInput('Safety notes', 'safetyNotes', item?.SafetyNotes || '', 'span-2')}
        <div class="field span-2">
          <label>Assigned scenic students</label>
          <div class="scenic-assignee-grid">
            ${(ScenicState.data.team || []).map(person => `
              <label class="scenic-assignee">
                <input
                  type="checkbox"
                  name="assignedUserIds"
                  value="${BRM.escape(person.UserID)}"
                  ${(item?.AssignedUserIDs || []).includes(person.UserID) ? 'checked' : ''}
                >
                ${BRM.avatar(person.DisplayName, person.PhotoURL, 'small')}
                <span>${BRM.escape(person.DisplayName)}</span>
              </label>
            `).join('') || '<span class="field-hint">No approved scenic students yet.</span>'}
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Save element</button>
      </div>
    </form>
  `, { wide: true });

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData);
    payload.scenicElementId = item?.ScenicElementID || '';
    payload.assignedUserIds = formData.getAll('assignedUserIds');
    await mutateScenic('saveScenicElement', payload, 'Scenic element saved.');
    modal.closeModal();
  });
}

function openScenicTaskModal(options = {}) {
  const modal = BRM.openModal(`
    <span class="eyebrow">Scenic project management</span>
    <h2>Add task</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Task title', 'title', '', true, 'span-2')}
        ${selectInput('Environment', 'setId', options.setId || '', [
          { value: '', label: 'Whole scenic department' },
          ...ScenicState.data.sets.map(set => ({
            value: set.SetID,
            label: set.SetName
          }))
        ])}
        ${selectInput('Element', 'scenicElementId', options.scenicElementId || '', [
          { value: '', label: 'No specific element' },
          ...ScenicState.data.elements.map(element => ({
            value: element.ScenicElementID,
            label: element.ElementName
          }))
        ])}
        ${selectInput('Priority', 'priority', 'Normal', ['Normal','Important','Urgent'])}
        ${selectInput('Status', 'status', 'Open', ['Open','In Progress','Paused','Complete'])}
        ${fieldInput('Due date', 'dueDate', '', false, '', 'date')}
        ${textareaInput('Description', 'description', '', 'span-2')}
        <div class="field span-2">
          <label>Assigned students</label>
          <div class="scenic-assignee-grid">
            ${(ScenicState.data.team || []).map(person => `
              <label class="scenic-assignee">
                <input type="checkbox" name="assignedUserIds" value="${BRM.escape(person.UserID)}">
                ${BRM.avatar(person.DisplayName, person.PhotoURL, 'small')}
                <span>${BRM.escape(person.DisplayName)}</span>
              </label>
            `).join('') || '<span class="field-hint">No approved scenic students yet.</span>'}
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Create task</button>
      </div>
    </form>
  `, { wide: true });

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData);
    payload.assignedUserIds = formData.getAll('assignedUserIds');
    await mutateScenic('saveScenicTask', payload, 'Scenic task created.');
    modal.closeModal();
  });
}

async function updateScenicTaskStatus(taskId, status) {
  try {
    await BRM.api('updateTaskStatus', { taskId, status }, {
      noCache: true,
      forceNetwork: true
    });
    await loadScenicHub();
    BRM.toast('Task status updated.');
    renderScenicHub();
  } catch (error) {
    BRM.toast(error.message, 'error');
  }
}

function openScenicTransitionModal(item = null, setId = '') {
  const modal = BRM.openModal(`
    <span class="eyebrow">${item ? 'Edit set change' : 'New set change'}</span>
    <h2>${item ? BRM.escape(item.TransitionName) : 'Plan set change'}</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Transition name', 'transitionName', item?.TransitionName || '', true, 'span-2')}
        ${selectInput('Environment moved', 'setId', item?.SetID || setId, [
          { value: '', label: 'General / multiple environments' },
          ...ScenicState.data.sets.map(set => ({
            value: set.SetID,
            label: set.SetName
          }))
        ])}
        ${selectInput('Plan status', 'planStatus', item?.PlanStatus || 'Not Planned', [
          'Not Planned','Planning','Drafted','Rehearsed','Locked','Archived'
        ])}
        ${fieldInput('From scene', 'fromScene', item?.FromScene || '')}
        ${fieldInput('To scene', 'toScene', item?.ToScene || '')}
        ${fieldInput('Preset side', 'presetSide', item?.PresetSide || '')}
        ${fieldInput('Cue', 'cue', item?.Cue || '')}
        ${textareaInput('Movement path', 'movementPath', item?.MovementPath || '', 'span-2')}
        ${textareaInput('Safety notes', 'safetyNotes', item?.SafetyNotes || '', 'span-2')}
        ${textareaInput('Additional notes', 'notes', item?.Notes || '', 'span-2')}
        <div class="field span-2">
          <label>Assigned change crew</label>
          <div class="scenic-assignee-grid">
            ${(ScenicState.data.team || []).map(person => `
              <label class="scenic-assignee">
                <input
                  type="checkbox"
                  name="crewUserIds"
                  value="${BRM.escape(person.UserID)}"
                  ${(item?.CrewUserIDs || []).includes(person.UserID) ? 'checked' : ''}
                >
                ${BRM.avatar(person.DisplayName, person.PhotoURL, 'small')}
                <span>${BRM.escape(person.DisplayName)}</span>
              </label>
            `).join('') || '<span class="field-hint">No approved scenic students yet.</span>'}
          </div>
        </div>
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Save set change</button>
      </div>
    </form>
  `, { wide: true });

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData);
    payload.scenicTransitionId = item?.ScenicTransitionID || '';
    payload.crewUserIds = formData.getAll('crewUserIds');
    await mutateScenic('saveScenicTransition', payload, 'Set change saved.');
    modal.closeModal();
  });
}

async function updateTransitionStatus(scenicTransitionId, runStatus) {
  await mutateScenic(
    'updateScenicTransitionRunStatus',
    { scenicTransitionId, runStatus },
    'Set-change run status updated.'
  );
}

async function resetTransitionRun() {
  if (!confirm('Reset every scenic transition to Not Checked?')) return;
  await mutateScenic('resetScenicTransitionRun', {}, 'Set-change run checks reset.');
}

function openScenicDeadlineModal(item = null) {
  const modal = BRM.openModal(`
    <span class="eyebrow">${item ? 'Edit scenic deadline' : 'New scenic deadline'}</span>
    <h2>${item ? BRM.escape(item.Title) : 'Add deadline'}</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Title', 'title', item?.Title || '', true, 'span-2')}
        ${selectInput('Environment', 'setId', item?.SetID || '', [
          { value: '', label: 'Whole scenic department' },
          ...ScenicState.data.sets.map(set => ({
            value: set.SetID,
            label: set.SetName
          }))
        ])}
        ${fieldInput('Due date', 'dueDate', item?.DueDate || '', true, '', 'date')}
        ${selectInput('Priority', 'priority', item?.Priority || 'Normal', [
          'Normal','Important','Urgent'
        ])}
        ${selectInput('Status', 'status', item?.Status || 'Open', [
          'Open','In Progress','Complete','Archived'
        ])}
        ${textareaInput('Notes', 'notes', item?.Notes || '', 'span-2')}
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Save deadline</button>
      </div>
    </form>
  `);

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    payload.scenicDeadlineId = item?.ScenicDeadlineID || '';
    await mutateScenic('saveScenicDeadline', payload, 'Scenic deadline saved.');
    modal.closeModal();
  });
}

function openScenicSuggestionModal() {
  const modal = BRM.openModal(`
    <span class="eyebrow">Collaborative suggestion</span>
    <h2>Suggest a scenic change</h2>
    <form data-form>
      <div class="form-grid">
        ${selectInput('Suggestion type', 'suggestionType', 'Change Request', [
          'Change Request','New Element','New Set','Safety Concern','Repair'
        ])}
        ${selectInput('Environment', 'setId', ScenicState.selectedSetId || '', [
          { value: '', label: 'Whole scenic department / new set' },
          ...ScenicState.data.sets.map(set => ({
            value: set.SetID,
            label: set.SetName
          }))
        ])}
        ${fieldInput('Title', 'title', '', true, 'span-2')}
        ${selectInput('Priority', 'priority', 'Medium', [
          'Low','Medium','High','Critical'
        ])}
        ${fieldInput('Reference URL', 'referenceUrl', '', false, '', 'url')}
        ${textareaInput('Description', 'description', '', 'span-2')}
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Submit suggestion</button>
      </div>
    </form>
  `);

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    await mutateScenic('saveScenicSuggestion', payload, 'Suggestion submitted for review.');
    modal.closeModal();
  });
}

async function reviewScenicSuggestion(scenicSuggestionId, decision) {
  const reviewNote = prompt(
    decision === 'Approved'
      ? 'Optional approval note:'
      : 'Optional reason for declining:',
    ''
  );

  if (reviewNote === null) return;

  let createRecord = false;

  if (decision === 'Approved') {
    createRecord = confirm(
      'Create an official scenic record from this suggestion now?\n\n' +
      'New Set creates an environment. Other suggestion types create a build element.'
    );
  }

  await mutateScenic(
    'reviewScenicSuggestion',
    {
      scenicSuggestionId,
      decision,
      reviewNote,
      createRecord
    },
    `Suggestion ${decision.toLowerCase()}.`
  );
}

async function archiveScenicSet(setId) {
  const reason = prompt('Optional reason for archiving this environment:', '');
  if (reason === null) return;
  await mutateScenic('archiveScenicSet', { setId, reason }, 'Environment archived.');
}

async function restoreScenicSet(setId) {
  await mutateScenic('restoreScenicSet', { setId }, 'Environment restored.');
}

async function deleteScenicSet(setId) {
  const confirmation = prompt(
    'This permanently removes the environment and its connected scenic records.\n\nType DELETE to continue:',
    ''
  );

  if (confirmation !== 'DELETE') {
    BRM.toast('Permanent deletion cancelled.', 'error');
    return;
  }

  await mutateScenic(
    'deleteScenicSetPermanently',
    { setId, confirmation },
    'Environment permanently deleted.'
  );
}

async function archiveScenicElement(scenicElementId) {
  await mutateScenic(
    'archiveScenicElement',
    { scenicElementId },
    'Scenic element archived.'
  );
}

async function restoreScenicElement(scenicElementId) {
  await mutateScenic(
    'restoreScenicElement',
    { scenicElementId },
    'Scenic element restored.'
  );
}

async function deleteScenicElement(scenicElementId) {
  const confirmation = prompt(
    'This permanently removes the scenic element and its connected images and tasks.\n\nType DELETE to continue:',
    ''
  );

  if (confirmation !== 'DELETE') {
    BRM.toast('Permanent deletion cancelled.', 'error');
    return;
  }

  await mutateScenic(
    'deleteScenicElementPermanently',
    { scenicElementId, confirmation },
    'Scenic element permanently deleted.'
  );
}

function fieldInput(
  label,
  name,
  value = '',
  required = false,
  className = '',
  type = 'text',
  extra = ''
) {
  return `
    <div class="field ${className}">
      <label>${BRM.escape(label)}</label>
      <input
        name="${BRM.escape(name)}"
        type="${BRM.escape(type)}"
        value="${BRM.escape(value)}"
        ${required ? 'required' : ''}
        ${extra}
      >
    </div>
  `;
}

function selectInput(label, name, value, options) {
  const normalized = options.map(option =>
    typeof option === 'object'
      ? option
      : { value: option, label: option }
  );

  return `
    <div class="field">
      <label>${BRM.escape(label)}</label>
      <select name="${BRM.escape(name)}">
        ${normalized.map(option => `
          <option value="${BRM.escape(option.value)}" ${String(value) === String(option.value) ? 'selected' : ''}>
            ${BRM.escape(option.label)}
          </option>
        `).join('')}
      </select>
    </div>
  `;
}

function textareaInput(label, name, value = '', className = '') {
  return `
    <div class="field ${className}">
      <label>${BRM.escape(label)}</label>
      <textarea name="${BRM.escape(name)}">${BRM.escape(value)}</textarea>
    </div>
  `;
}

function openScenicImageModal(options = {}) {
  const modal = BRM.openModal(`
    <span class="eyebrow">Private authenticated scenic image</span>
    <h2>Add design image</h2>
    <form data-form>
      <div class="form-grid">
        ${selectInput('Environment', 'setId', options.setId || '', [
          { value: '', label: 'General design board' },
          ...ScenicState.data.sets.map(set => ({
            value: set.SetID,
            label: set.SetName
          }))
        ])}
        ${selectInput('Image type', 'imageType', 'Progress', [
          'Inspiration','Concept','Drafting','Progress','Paint Treatment',
          'Reference','Safety','Final'
        ])}
        ${fieldInput('Caption', 'caption', '', false, 'span-2')}
        <div class="field span-2">
          <label>Image file</label>
          <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp" required>
          <span class="field-hint">JPG, PNG, or WebP. The browser compresses the image before uploading.</span>
        </div>
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Upload image</button>
      </div>
    </form>
  `);

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const file = formData.get('imageFile');
    const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    const original = button.textContent;

    if (!(file instanceof File) || !file.size) {
      BRM.toast('Choose an image first.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Compressing…';

    try {
      const prepared = await compressScenicImage(file);
      button.textContent = 'Uploading…';

      await mutateScenic(
        'uploadScenicImage',
        {
          setId: formData.get('setId'),
          scenicElementId: options.scenicElementId || '',
          imageType: formData.get('imageType'),
          caption: formData.get('caption'),
          filename: file.name,
          dataUrl: prepared.dataUrl
        },
        'Scenic image uploaded.'
      );

      modal.closeModal();
    } catch (error) {
      BRM.toast(error.message, 'error');
      button.disabled = false;
      button.textContent = original;
    }
  });
}

async function deleteScenicImage(imageId) {
  if (!confirm('Remove this scenic image?')) return;
  await mutateScenic('deleteScenicImage', { imageId }, 'Scenic image removed.');
}

async function decodeScenicImage(file) {
  const unsupported =
    /image\/hei[cf]/i.test(file.type || '')
    || /\.(heic|heif)$/i.test(file.name || '');

  if (unsupported) {
    throw new Error('Please convert HEIC/HEIF images to JPG, PNG, or WebP first.');
  }

  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
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
      reject(new Error('The image could not be decoded.'));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('The image could not be compressed.'));
    }, 'image/jpeg', quality);
  });
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The image could not be prepared.'));
    reader.readAsDataURL(blob);
  });
}

async function compressScenicImage(file) {
  const image = await decodeScenicImage(file);

  try {
    const maximum = 1600;
    const scale = Math.min(1, maximum / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob = await canvasBlob(canvas, 0.82);

    if (blob.size > 2 * 1024 * 1024) {
      blob = await canvasBlob(canvas, 0.67);
    }

    if (blob.size > 4 * 1024 * 1024) {
      throw new Error('The image remains too large after compression.');
    }

    return {
      dataUrl: await blobDataUrl(blob),
      sizeBytes: blob.size
    };
  } finally {
    if (typeof image.close === 'function') {
      try { image.close(); } catch (error) {}
    }
  }
}

function scenicImageCacheName() {
  return `bedford-scenic-images-v22-${ScenicState.data?.context?.userId || 'anonymous'}`;
}

function scenicImageRequest(fileId) {
  return new Request(
    `${location.origin}/__brm_scenic_image__/${encodeURIComponent(fileId)}`
  );
}

const scenicImageObjectUrls = new Map();
const scenicImagePromises = new Map();

async function cacheScenicImage(fileId, dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const existing = scenicImageObjectUrls.get(fileId);

  if (existing) {
    try { URL.revokeObjectURL(existing); } catch (error) {}
  }

  const objectUrl = URL.createObjectURL(blob);
  scenicImageObjectUrls.set(fileId, objectUrl);

  if ('caches' in window) {
    try {
      const cache = await caches.open(scenicImageCacheName());
      await cache.put(
        scenicImageRequest(fileId),
        new Response(blob, {
          headers: { 'Content-Type': blob.type || 'image/jpeg' }
        })
      );
    } catch (error) {}
  }

  return objectUrl;
}

async function getScenicImageUrl(fileId) {
  if (scenicImageObjectUrls.has(fileId)) {
    return scenicImageObjectUrls.get(fileId);
  }

  if (scenicImagePromises.has(fileId)) {
    return scenicImagePromises.get(fileId);
  }

  const promise = (async () => {
    if ('caches' in window) {
      try {
        const cache = await caches.open(scenicImageCacheName());
        const cached = await cache.match(scenicImageRequest(fileId));

        if (cached) {
          const objectUrl = URL.createObjectURL(await cached.blob());
          scenicImageObjectUrls.set(fileId, objectUrl);
          return objectUrl;
        }
      } catch (error) {}
    }

    const result = await BRM.api(
      'scenicImageData',
      { fileId },
      { noCache: true, forceNetwork: true }
    );

    return cacheScenicImage(fileId, result.dataUrl);
  })();

  scenicImagePromises.set(fileId, promise);

  try {
    return await promise;
  } finally {
    scenicImagePromises.delete(fileId);
  }
}

function hydrateScenicImages(root = document) {
  root.querySelectorAll?.('[data-scenic-image]').forEach(async image => {
    if (image.dataset.loaded === 'true') return;

    const fileId = image.dataset.scenicFileId;
    if (!fileId) return;

    image.dataset.loaded = 'true';

    try {
      image.src = await getScenicImageUrl(fileId);
      image.hidden = false;
      const shell = image.closest('[data-scenic-image-shell]');
      shell?.querySelector('span')?.remove();
    } catch (error) {
      image.dataset.loaded = 'false';
      const shell = image.closest('[data-scenic-image-shell]');
      if (shell) {
        shell.innerHTML = '<span>Image unavailable</span>';
      }
      console.warn('Scenic image could not load:', error);
    }
  });

  BRM.hydrateProfilePhotos?.(root);
}
