window.BRM_PROPS_BUILD = 'collaborative-props-v21-20260722';

document.addEventListener('DOMContentLoaded', () => {
  BRM.initPrivatePage(initPropsHub);
});

const PropsBoundElements = new WeakSet();

function bindPropsOnce(element, eventName, handler) {
  if (!element || PropsBoundElements.has(element)) return;
  PropsBoundElements.add(element);
  element.addEventListener(eventName, handler);
}

const PropsState = {
  data: null,
  view: 'inventory',
  detailTab: 'overview',
  selectedPropId: '',
  includeArchived: false,
  filters: {
    query: '',
    scene: '',
    type: '',
    status: '',
    priority: ''
  },
  imageUrls: new Map(),
  imageLoads: new Map()
};

async function initPropsHub() {
  const main = document.querySelector('#app-main');
  BRM.loading(main, 'Opening the collaborative Props Hub…');

  try {
    await loadPropsHub();
    renderPropsHub();
  } catch (error) {
    main.innerHTML = `
      <div class="alert alert-error">
        <strong>The Props Hub could not open.</strong>
        <p>${BRM.escape(error.message)}</p>
      </div>
    `;
  }
}

async function loadPropsHub() {
  PropsState.data = await BRM.api(
    'propsHub',
    { includeArchived: PropsState.includeArchived },
    { noCache: true, forceNetwork: true }
  );

  if (
    PropsState.selectedPropId
    && !PropsState.data.inventory.some(
      item => String(item.PropID) === String(PropsState.selectedPropId)
    )
  ) {
    PropsState.selectedPropId = '';
  }

  if (!PropsState.selectedPropId && PropsState.data.inventory.length) {
    PropsState.selectedPropId = PropsState.data.inventory[0].PropID;
  }
}

function propsMain() {
  return document.querySelector('#app-main');
}

function propsPermission(key) {
  return Boolean(PropsState.data?.permissions?.[key]);
}

function renderPropsHub() {
  const data = PropsState.data;
  const main = propsMain();

  main.innerHTML = `
    <div class="props-hub">
      ${renderPropsHero(data)}
      ${renderPropsAnnouncements(data.announcements || [])}
      ${renderPropsTabs()}
      <div data-props-view>
        ${renderActivePropsView()}
      </div>
      ${renderPropsTeam(data.team || [])}
    </div>
  `;

  bindPropsHubEvents();
  hydratePropsImages(main);
  renderSelectedPropDiscussion();
}

function renderPropsHero(data) {
  const stats = data.stats || {};

  return `
    <section class="props-hero">
      <div class="props-hero-grid">
        <div>
          <span class="eyebrow">Props Department · Collaborative Production Hub</span>
          <h1>Descendants Props</h1>
          <p>
            Build, source, assign, preset, photograph, discuss, and safely track
            every production prop from first concept through final reset.
          </p>
          <div class="props-hero-actions">
            <a class="button button-secondary" href="${BRM.escape(data.folderUrl || '#')}" target="_blank" rel="noopener">
              Open Props Drive
            </a>
            ${propsPermission('canManage')
              ? '<button class="button button-primary" data-add-prop>+ Add prop</button>'
              : ''}
            ${propsPermission('canContribute')
              ? '<button class="button button-secondary" data-suggest-prop>Suggest a prop</button>'
              : ''}
            ${propsPermission('canManage')
              ? '<span class="props-manager-ribbon">◆ Props management controls enabled</span>'
              : ''}
          </div>
        </div>

        <div class="props-kpis">
          ${propsKpi(stats.total, 'Active props')}
          ${propsKpi(stats.needed, 'Still needed')}
          ${propsKpi(stats.criticalOpen, 'Critical open')}
          ${propsKpi(stats.ready, 'Ready / complete')}
          ${propsKpi(stats.openTasks, 'Open tasks')}
          ${propsKpi(stats.presetNotChecked, 'Presets unchecked')}
        </div>
      </div>
    </section>
  `;
}

function propsKpi(value, label) {
  return `
    <div class="props-kpi">
      <strong>${Number(value || 0)}</strong>
      <span>${BRM.escape(label)}</span>
    </div>
  `;
}

function renderPropsAnnouncements(items) {
  if (!items.length) return '';

  return `
    <section class="props-alert-stack">
      ${items.slice(0, 4).map(item => `
        <article class="alert ${item.Priority === 'Urgent' ? 'alert-error' : 'alert-info'} props-announcement">
          <strong>${BRM.escape(item.Title)}</strong>
          <p style="margin:5px 0 0">${BRM.escape(item.Body || '')}</p>
        </article>
      `).join('')}
    </section>
  `;
}

function renderPropsTabs() {
  const tabs = [
    ['inventory', 'Inventory'],
    ['presets', 'Preset Run'],
    ['deadlines', 'Deadlines'],
    ['suggestions', `Suggestions${pendingSuggestionCount() ? ` (${pendingSuggestionCount()})` : ''}`],
    ['activity', 'Activity']
  ];

  return `
    <nav class="props-tabs" aria-label="Props Hub sections">
      ${tabs.map(([id, label]) => `
        <button class="props-tab ${PropsState.view === id ? 'active' : ''}" data-props-tab="${id}">
          ${BRM.escape(label)}
        </button>
      `).join('')}
    </nav>
  `;
}

function pendingSuggestionCount() {
  return (PropsState.data?.suggestions || [])
    .filter(item => item.Status === 'Pending').length;
}

function renderActivePropsView() {
  switch (PropsState.view) {
    case 'presets':
      return renderPresetRun();
    case 'deadlines':
      return renderDeadlines();
    case 'suggestions':
      return renderSuggestions();
    case 'activity':
      return renderActivity();
    default:
      return renderInventory();
  }
}

function renderInventory() {
  const data = PropsState.data;
  const inventory = filteredPropsInventory();
  const scenes = uniqueValues(data.inventory, 'Scene');
  const types = uniqueValues(data.inventory, 'PropType');
  const statuses = uniqueValues(data.inventory, 'Status');
  const priorities = ['Critical', 'High', 'Medium', 'Low'];

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Searchable production inventory</span>
          <h2>Props inventory</h2>
          <p>${inventory.length} of ${data.inventory.length} records shown.</p>
        </div>
        <div class="page-actions">
          ${propsPermission('canArchive')
            ? `
              <label class="checkbox-row">
                <input type="checkbox" data-show-archived ${PropsState.includeArchived ? 'checked' : ''}>
                Show archived
              </label>
            `
            : ''}
        </div>
      </div>

      <div class="props-toolbar">
        <input data-filter="query" value="${BRM.escape(PropsState.filters.query)}" placeholder="Search prop, scene, character, notes…">
        ${filterSelect('scene', 'All scenes', scenes)}
        ${filterSelect('type', 'All types', types)}
        ${filterSelect('status', 'All statuses', statuses)}
        ${filterSelect('priority', 'All priorities', priorities)}
      </div>

      <div class="props-inventory-layout">
        <aside class="props-list-panel">
          <div class="props-list">
            ${inventory.length
              ? inventory.map(renderPropsListItem).join('')
              : BRM.empty('No matching props', 'Change the filters or create a new prop.', '◇')}
          </div>
        </aside>

        <div class="props-detail-panel">
          ${renderSelectedProp()}
        </div>
      </div>
    </section>
  `;
}

function filterSelect(key, placeholder, values) {
  return `
    <select data-filter="${key}">
      <option value="">${BRM.escape(placeholder)}</option>
      ${values.map(value => `
        <option value="${BRM.escape(value)}" ${PropsState.filters[key] === value ? 'selected' : ''}>
          ${BRM.escape(value)}
        </option>
      `).join('')}
    </select>
  `;
}

function uniqueValues(items, key) {
  return [...new Set(items.map(item => String(item[key] || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function filteredPropsInventory() {
  const query = PropsState.filters.query.trim().toLowerCase();

  return [...PropsState.data.inventory]
    .filter(item => {
      if (PropsState.filters.scene && item.Scene !== PropsState.filters.scene) return false;
      if (PropsState.filters.type && item.PropType !== PropsState.filters.type) return false;
      if (PropsState.filters.status && item.Status !== PropsState.filters.status) return false;
      if (PropsState.filters.priority && item.Priority !== PropsState.filters.priority) return false;

      if (query) {
        const haystack = [
          item.PropName, item.UsedBy, item.Scene, item.Song, item.PropType,
          item.Description, item.Source, item.Status, item.StorageLocation,
          item.PresetLocation, item.ExitLocation, item.ResetNotes,
          item.SafetyNotes, item.Priority, item.Notes
        ].join(' ').toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const priorityRank = { Critical: 1, High: 2, Medium: 3, Low: 4 };
      return (priorityRank[a.Priority] || 9) - (priorityRank[b.Priority] || 9)
        || String(a.Scene || '').localeCompare(String(b.Scene || ''), undefined, { numeric: true })
        || String(a.PropName).localeCompare(String(b.PropName));
    });
}

function renderPropsListItem(item) {
  const image = primaryImageForProp(item.PropID);

  return `
    <button
      class="props-list-button ${String(item.PropID) === String(PropsState.selectedPropId) ? 'active' : ''}"
      data-select-prop="${BRM.escape(item.PropID)}"
    >
      <span class="props-thumb">
        ${image
          ? `<span>◇</span><img hidden data-props-image="${BRM.escape(image.DriveFileID)}" alt="">`
          : '◇'}
      </span>
      <span>
        <span class="props-list-title">
          <strong>${BRM.escape(item.PropName)}</strong>
          <span class="badge ${item.Priority === 'Critical' ? 'badge-urgent' : item.Priority === 'High' ? 'badge-important' : ''}">
            ${BRM.escape(item.Priority)}
          </span>
        </span>
        <span class="props-list-sub">
          ${BRM.escape(item.Status)} · ${BRM.escape(item.Scene || 'Scene not assigned')}
        </span>
      </span>
    </button>
  `;
}

function selectedProp() {
  return PropsState.data.inventory.find(
    item => String(item.PropID) === String(PropsState.selectedPropId)
  ) || null;
}

function primaryImageForProp(propId) {
  const item = PropsState.data.inventory.find(
    prop => String(prop.PropID) === String(propId)
  );

  const images = PropsState.data.images.filter(
    image => String(image.PropID) === String(propId)
  );

  return images.find(
    image => String(image.DriveFileID) === String(item?.PrimaryImageFileID)
  ) || images[0] || null;
}

function renderSelectedProp() {
  const item = selectedProp();

  if (!item) {
    return `
      <div class="props-detail-shell props-empty-detail">
        <div>
          <div style="font-size:3rem">◇</div>
          <h2>Select a prop</h2>
          <p>Choose an inventory record to view assignments, presets, images, tasks, notes, and history.</p>
        </div>
      </div>
    `;
  }

  const taskCount = relatedTasks(item.PropID).length;
  const presetCount = relatedPresets(item.PropID).length;
  const imageCount = relatedImages(item.PropID).length;

  return `
    <article class="props-detail-shell">
      <header class="props-detail-head">
        <div>
          <div class="item-meta">
            <span class="badge ${item.Priority === 'Critical' ? 'badge-urgent' : item.Priority === 'High' ? 'badge-important' : ''}">
              ${BRM.escape(item.Priority)}
            </span>
            <span>${BRM.escape(item.Status)}</span>
            <span>${BRM.escape(item.PropID)}</span>
          </div>
          <h2>${BRM.escape(item.PropName)}</h2>
          <p>${BRM.escape(item.Description || 'No description yet.')}</p>
        </div>

        <div class="props-detail-actions">
          ${propsPermission('canManage')
            ? `<button class="button button-primary button-small" data-edit-prop="${BRM.escape(item.PropID)}">Edit</button>`
            : ''}
          ${propsPermission('canArchive') && item.Status !== 'Archived'
            ? `<button class="button button-secondary button-small" data-archive-prop="${BRM.escape(item.PropID)}">Archive</button>`
            : ''}
          ${propsPermission('canArchive') && item.Status === 'Archived'
            ? `<button class="button button-secondary button-small" data-restore-prop="${BRM.escape(item.PropID)}">Restore</button>`
            : ''}
          ${propsPermission('canDelete')
            ? `<button class="button button-danger button-small" data-delete-prop="${BRM.escape(item.PropID)}">Delete permanently</button>`
            : ''}
        </div>
      </header>

      <nav class="props-detail-tabs">
        ${detailTabButton('overview', 'Overview')}
        ${detailTabButton('tasks', `Tasks (${taskCount})`)}
        ${detailTabButton('presets', `Presets (${presetCount})`)}
        ${detailTabButton('images', `Images (${imageCount})`)}
        ${detailTabButton('discussion', 'Discussion')}
        ${detailTabButton('history', 'History')}
      </nav>

      <div class="props-detail-body">
        ${renderSelectedPropTab(item)}
      </div>
    </article>
  `;
}

function detailTabButton(id, label) {
  return `
    <button class="props-detail-tab ${PropsState.detailTab === id ? 'active' : ''}" data-detail-tab="${id}">
      ${BRM.escape(label)}
    </button>
  `;
}

function renderSelectedPropTab(item) {
  switch (PropsState.detailTab) {
    case 'tasks':
      return renderPropTasks(item);
    case 'presets':
      return renderPropPresets(item);
    case 'images':
      return renderPropImages(item);
    case 'discussion':
      return `<div data-notes-panel></div>`;
    case 'history':
      return renderPropHistory(item);
    default:
      return renderPropOverview(item);
  }
}

function renderPropOverview(item) {
  const assigned = (item.AssignedUserIDs || [])
    .map(userId => PropsState.data.team.find(person => String(person.UserID) === String(userId)))
    .filter(Boolean);

  return `
    <div class="props-facts">
      ${fact('Used by', item.UsedBy || 'Not assigned')}
      ${fact('Scene', item.Scene || 'Not assigned')}
      ${fact('Song / sequence', item.Song || '—')}
      ${fact('Type', item.PropType || '—')}
      ${fact('Source', item.Source || '—')}
      ${fact('Storage', item.StorageLocation || 'Not assigned')}
      ${fact('Preset location', item.PresetLocation || 'See preset records')}
      ${fact('Exit / return', item.ExitLocation || 'Not assigned')}
      ${fact('Assigned crew', assigned.length
        ? assigned.map(person => BRM.escape(person.DisplayName)).join(', ')
        : 'Props department')}
    </div>

    <div class="props-section-grid">
      <div class="panel-inset ${item.SafetyNotes ? 'props-safety' : ''}">
        <span class="eyebrow">Safety and handling</span>
        <p>${BRM.escape(item.SafetyNotes || 'No special safety notes recorded.')}</p>
      </div>
      <div class="panel-inset">
        <span class="eyebrow">Reset instructions</span>
        <p>${BRM.escape(item.ResetNotes || 'No reset instructions recorded.')}</p>
      </div>
      <div class="panel-inset props-wide">
        <span class="eyebrow">Production notes</span>
        <p>${BRM.escape(item.Notes || 'No additional notes recorded.')}</p>
      </div>
    </div>
  `;
}

function fact(label, value) {
  return `
    <div class="props-fact">
      <span>${BRM.escape(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function relatedTasks(propId) {
  return PropsState.data.tasks.filter(
    task => String(task.RelatedID) === String(propId)
  );
}

function relatedPresets(propId) {
  return PropsState.data.presets.filter(
    preset => String(preset.PropID) === String(propId)
  );
}

function relatedImages(propId) {
  return PropsState.data.images
    .filter(image => String(image.PropID) === String(propId))
    .sort((a, b) => Number(a.SortOrder || 0) - Number(b.SortOrder || 0));
}

function renderPropTasks(item) {
  const tasks = relatedTasks(item.PropID);

  return `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Connected assignments</span>
        <h3>Prop tasks</h3>
      </div>
      ${propsPermission('canManage')
        ? `<button class="button button-primary button-small" data-add-task="${BRM.escape(item.PropID)}">+ Add task</button>`
        : ''}
    </div>

    <div>
      ${tasks.length
        ? tasks.map(task => `
          <article class="props-task-row">
            <span class="rating-pill">${task.Status === 'Completed' ? '✓' : task.Status === 'In Progress' ? '→' : '○'}</span>
            <div>
              <div class="item-meta">
                <span class="badge ${task.Priority === 'Urgent' ? 'badge-urgent' : task.Priority === 'Important' ? 'badge-important' : ''}">
                  ${BRM.escape(task.Priority)}
                </span>
                ${task.DueDate ? `<span>Due ${BRM.formatDate(task.DueDate + 'T12:00:00')}</span>` : ''}
              </div>
              <h3>${BRM.escape(task.Title)}</h3>
              <p>${BRM.escape(task.Description || '')}</p>
            </div>
            <select class="props-run-status" data-task-status="${BRM.escape(task.TaskID)}">
              ${['Open','In Progress','Completed'].map(status => `
                <option ${task.Status === status ? 'selected' : ''}>${status}</option>
              `).join('')}
            </select>
          </article>
        `).join('')
        : BRM.empty('No tasks for this prop', 'Managers can create assignments connected directly to this item.', '✓')}
    </div>
  `;
}

function renderPropPresets(item) {
  const presets = relatedPresets(item.PropID);

  return `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Backstage tracking</span>
        <h3>Preset records</h3>
      </div>
      ${propsPermission('canManage')
        ? `<button class="button button-primary button-small" data-add-preset="${BRM.escape(item.PropID)}">+ Add preset</button>`
        : ''}
    </div>

    <div>
      ${presets.length
        ? presets.map(renderPresetRow).join('')
        : BRM.empty('No preset record', 'Add where this prop begins, who takes it, and how it returns.', '◷')}
    </div>
  `;
}

function renderPresetRow(preset) {
  return `
    <article class="props-preset-row">
      <span class="rating-pill">${BRM.escape(preset.PresetSide || '—')}</span>
      <div>
        <div class="item-meta">
          <span class="badge">${BRM.escape(preset.PresetTable || 'Table not assigned')}</span>
          <span>${BRM.escape(preset.Scene || '')}</span>
        </div>
        <h3>${BRM.escape(preset.PropName)}</h3>
        <p>
          Picked up by ${BRM.escape(preset.PickedUpBy || '—')} ·
          returned by ${BRM.escape(preset.ReturnedBy || '—')}
        </p>
        ${preset.ResetNotes ? `<p class="field-hint">${BRM.escape(preset.ResetNotes)}</p>` : ''}
      </div>
      <select class="props-run-status" data-preset-status="${BRM.escape(preset.PresetID)}">
        ${['Not Checked','Preset','Picked Up','Returned','Reset'].map(status => `
          <option ${String(preset.RunStatus || 'Not Checked') === status ? 'selected' : ''}>
            ${status}
          </option>
        `).join('')}
      </select>
    </article>
  `;
}

function renderPropImages(item) {
  const images = relatedImages(item.PropID);

  return `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Visual progress and references</span>
        <h3>Image gallery</h3>
      </div>
      ${propsPermission('canContribute')
        ? `<button class="button button-primary button-small" data-upload-prop-image="${BRM.escape(item.PropID)}">+ Add image</button>`
        : ''}
    </div>

    <div class="props-image-grid">
      ${images.length
        ? images.map(image => `
          <article class="props-image-card">
            <div class="props-image-placeholder">Loading image…</div>
            <img hidden data-props-image="${BRM.escape(image.DriveFileID)}" alt="${BRM.escape(image.Caption || item.PropName)}">
            ${(propsPermission('canManage') || image.UploadedByUserID === BRM.context?.userId)
              ? `<button class="icon-button danger props-image-remove" data-delete-prop-image="${BRM.escape(image.PropsImageID)}" title="Remove image">×</button>`
              : ''}
            <div class="props-image-caption">${BRM.escape(image.Caption || 'Progress image')}</div>
          </article>
        `).join('')
        : BRM.empty('No images yet', 'Add progress photos, references, labels, or finished-prop images.', '▧')}
    </div>
  `;
}

function renderPropHistory(item) {
  const activity = PropsState.data.activity.filter(
    entry => String(entry.PropID) === String(item.PropID)
  );

  return activity.length
    ? activity.map(renderActivityRow).join('')
    : BRM.empty('No item history yet', 'Edits, assignments, images, presets, and status changes will be recorded here.', '◷');
}

function renderPresetRun() {
  const presets = [...PropsState.data.presets].sort((a, b) => {
    return String(a.Scene || '').localeCompare(String(b.Scene || ''), undefined, { numeric: true })
      || String(a.PresetSide || '').localeCompare(String(b.PresetSide || ''))
      || String(a.PresetTable || '').localeCompare(String(b.PresetTable || ''))
      || String(a.PropName || '').localeCompare(String(b.PropName || ''));
  });

  const byScene = groupBy(presets, item => item.Scene || 'Scene not assigned');

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Performance and rehearsal mode</span>
          <h2>Props preset run</h2>
          <p>Track each prop from preset through pickup, return, and reset.</p>
        </div>
        ${propsPermission('canManage')
          ? '<button class="button button-secondary" data-reset-preset-run>Reset full checklist</button>'
          : ''}
      </div>

      <div class="props-run-grid">
        ${Object.entries(byScene).map(([scene, rows]) => `
          <section class="props-scene-group">
            <h3>${BRM.escape(scene)}</h3>
            <div class="props-side-grid">
              ${['SL', 'SR'].map(side => {
                const sideRows = rows.filter(row => String(row.PresetSide || '').includes(side));
                return `
                  <div class="panel-inset">
                    <span class="eyebrow">${side === 'SL' ? 'Stage Left' : 'Stage Right'}</span>
                    <div style="margin-top:10px">
                      ${sideRows.length
                        ? sideRows.map(renderPresetRow).join('')
                        : '<p class="field-hint">No presets on this side.</p>'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </section>
  `;
}

function renderDeadlines() {
  const rows = [...PropsState.data.deadlines].sort((a, b) => {
    return String(a.DueDate || '9999-12-31').localeCompare(String(b.DueDate || '9999-12-31'))
      || String(a.Title).localeCompare(String(b.Title));
  });

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Milestones and safety gates</span>
          <h2>Props deadlines</h2>
          <p>Hero props, consumable tests, labels, backups, and preset rehearsals.</p>
        </div>
        ${propsPermission('canManage')
          ? '<button class="button button-primary" data-add-deadline>+ Add deadline</button>'
          : ''}
      </div>

      <div>
        ${rows.length
          ? rows.map(row => `
            <article class="props-deadline-row">
              <span class="rating-pill">${row.Priority === 'Urgent' ? '!' : '◷'}</span>
              <div>
                <div class="item-meta">
                  <span class="badge ${row.Priority === 'Urgent' ? 'badge-urgent' : 'badge-important'}">
                    ${BRM.escape(row.Priority)}
                  </span>
                  <span>${BRM.escape(row.Status)}</span>
                  ${row.DueDate ? `<span>${BRM.formatDate(row.DueDate + 'T12:00:00')}</span>` : '<span>Date not set</span>'}
                </div>
                <h3>${BRM.escape(row.Title)}</h3>
                <p>${BRM.escape(row.Notes || '')}</p>
              </div>
              ${propsPermission('canManage')
                ? `<button class="button button-secondary button-small" data-edit-deadline="${BRM.escape(row.PropsDeadlineID)}">Edit</button>`
                : ''}
            </article>
          `).join('')
          : BRM.empty('No deadlines', 'Props managers can add milestones and safety checks.', '◷')}
      </div>
    </section>
  `;
}

function renderSuggestions() {
  const rows = PropsState.data.suggestions || [];

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Student ideas and corrections</span>
          <h2>Props suggestions</h2>
          <p>Members can propose new props or corrections without changing the official inventory directly.</p>
        </div>
        ${propsPermission('canContribute')
          ? '<button class="button button-primary" data-suggest-prop>+ New suggestion</button>'
          : ''}
      </div>

      <div>
        ${rows.length
          ? rows.map(row => `
            <article class="props-suggestion-row">
              ${BRM.avatar(row.SuggestedBy?.DisplayName || 'User', row.SuggestedBy?.PhotoURL || '', 'small')}
              <div>
                <div class="item-meta">
                  <span class="badge ${row.Status === 'Pending' ? 'badge-important' : row.Status === 'Declined' ? 'badge-urgent' : ''}">
                    ${BRM.escape(row.Status)}
                  </span>
                  <span>${BRM.escape(row.Scene || 'Scene not specified')}</span>
                  <span>${BRM.formatDateTime(row.CreatedAt)}</span>
                </div>
                <h3>${BRM.escape(row.Title)}</h3>
                <p>${BRM.escape(row.Description || '')}</p>
                <p class="field-hint">Suggested by ${BRM.escape(row.SuggestedBy?.DisplayName || 'User')}</p>
                ${row.ReviewNote ? `<div class="panel-inset">${BRM.escape(row.ReviewNote)}</div>` : ''}
              </div>
              ${propsPermission('canManage') && row.Status === 'Pending'
                ? `
                  <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="button button-primary button-small" data-approve-suggestion="${BRM.escape(row.PropsSuggestionID)}">Approve</button>
                    <button class="button button-danger button-small" data-decline-suggestion="${BRM.escape(row.PropsSuggestionID)}">Decline</button>
                  </div>
                `
                : ''}
            </article>
          `).join('')
          : BRM.empty('No suggestions', 'Students’ new-prop ideas and corrections will appear here.', '✦')}
      </div>
    </section>
  `;
}

function renderActivity() {
  const rows = PropsState.data.activity || [];

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Accountable collaboration</span>
          <h2>Props activity</h2>
          <p>${propsPermission('canAudit')
            ? 'Detailed changes from the department team.'
            : 'Recent visible activity from the Props Hub.'}</p>
        </div>
      </div>

      <div>
        ${rows.length
          ? rows.map(renderActivityRow).join('')
          : BRM.empty('No activity yet', 'Edits, uploads, suggestions, and preset checks will appear here.', '◷')}
      </div>
    </section>
  `;
}

function renderActivityRow(entry) {
  return `
    <article class="props-activity-row">
      ${BRM.avatar(entry.Actor?.DisplayName || 'Production Team', entry.Actor?.PhotoURL || '', 'small')}
      <div>
        <div class="item-meta">
          <span class="badge">${BRM.escape(BRM.titleCase(String(entry.Action || '').replaceAll('_', ' ')))}</span>
          <span>${BRM.formatDateTime(entry.CreatedAt)}</span>
        </div>
        <h3>${BRM.escape(entry.Summary || '')}</h3>
        <p class="field-hint">${BRM.escape(entry.Actor?.DisplayName || 'Production Team')}</p>
      </div>
      ${entry.PropID
        ? `<button class="button button-secondary button-small" data-jump-prop="${BRM.escape(entry.PropID)}">Open prop</button>`
        : ''}
    </article>
  `;
}

function renderPropsTeam(team) {
  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Approved department members</span>
          <h2>Props team</h2>
          <p>Hover over a profile image to see the student’s name and department role.</p>
        </div>
        ${BRM.isAdmin()
          ? '<a class="button button-secondary button-small" href="admin.html#users">Manage team</a>'
          : ''}
      </div>

      <div class="props-team">
        ${team.length
          ? team.map(person => `
            <button class="props-team-person" type="button" aria-label="${BRM.escape(person.DisplayName)} — ${BRM.escape(person.RoleLabel)}">
              ${BRM.avatar(person.DisplayName, person.PhotoURL, '')}
              <span class="props-team-tip">
                <strong>${BRM.escape(person.DisplayName)}</strong><br>
                ${BRM.escape(person.RoleLabel || 'Props Member')}
              </span>
            </button>
          `).join('')
          : '<p class="field-hint">No approved Props department members yet.</p>'}
      </div>
    </section>
  `;
}

function groupBy(items, keyFunction) {
  return items.reduce((groups, item) => {
    const key = keyFunction(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function bindPropsHubEvents() {
  const main = propsMain();

  main.querySelectorAll('[data-props-tab]').forEach(button => {
    bindPropsOnce(button, 'click', () => {
      PropsState.view = button.dataset.propsTab;
      renderPropsHub();
    });
  });

  main.querySelectorAll('[data-filter]').forEach(input => {
    const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
    bindPropsOnce(input, eventName, () => {
      PropsState.filters[input.dataset.filter] = input.value;
      refreshPropsViewOnly();
    });
  });

  bindPropsOnce(main.querySelector('[data-show-archived]'), 'change', async event => {
    PropsState.includeArchived = event.target.checked;
    await loadPropsHub();
    renderPropsHub();
  });

  main.querySelectorAll('[data-select-prop]').forEach(button => {
    bindPropsOnce(button, 'click', () => {
      PropsState.selectedPropId = button.dataset.selectProp;
      PropsState.detailTab = 'overview';
      refreshPropsViewOnly();
    });
  });

  main.querySelectorAll('[data-detail-tab]').forEach(button => {
    bindPropsOnce(button, 'click', () => {
      PropsState.detailTab = button.dataset.detailTab;
      refreshPropsViewOnly();
    });
  });

  main.querySelectorAll('[data-jump-prop]').forEach(button => {
    bindPropsOnce(button, 'click', () => {
      PropsState.selectedPropId = button.dataset.jumpProp;
      PropsState.view = 'inventory';
      PropsState.detailTab = 'overview';
      renderPropsHub();
    });
  });

  main.querySelectorAll('[data-add-prop]').forEach(button => {
    bindPropsOnce(button, 'click', () => openPropModal());
  });

  main.querySelectorAll('[data-edit-prop]').forEach(button => {
    bindPropsOnce(button, 'click', () => {
      const item = PropsState.data.inventory.find(prop => String(prop.PropID) === String(button.dataset.editProp));
      openPropModal(item);
    });
  });

  main.querySelectorAll('[data-suggest-prop]').forEach(button => {
    bindPropsOnce(button, 'click', openSuggestionModal);
  });

  main.querySelectorAll('[data-archive-prop]').forEach(button => {
    bindPropsOnce(button, 'click', () => archiveProp(button.dataset.archiveProp));
  });

  main.querySelectorAll('[data-restore-prop]').forEach(button => {
    bindPropsOnce(button, 'click', () => restoreProp(button.dataset.restoreProp));
  });

  main.querySelectorAll('[data-delete-prop]').forEach(button => {
    bindPropsOnce(button, 'click', () => deletePropPermanently(button.dataset.deleteProp));
  });

  main.querySelectorAll('[data-add-task]').forEach(button => {
    bindPropsOnce(button, 'click', () => openTaskModal(button.dataset.addTask));
  });

  main.querySelectorAll('[data-task-status]').forEach(select => {
    bindPropsOnce(select, 'change', () => updateTaskStatus(select.dataset.taskStatus, select.value));
  });

  main.querySelectorAll('[data-add-preset]').forEach(button => {
    bindPropsOnce(button, 'click', () => openPresetModal(button.dataset.addPreset));
  });

  main.querySelectorAll('[data-preset-status]').forEach(select => {
    bindPropsOnce(select, 'change', () => updatePresetStatus(select.dataset.presetStatus, select.value));
  });

  bindPropsOnce(main.querySelector('[data-reset-preset-run]'), 'click', resetPresetRun);

  bindPropsOnce(main.querySelector('[data-add-deadline]'), 'click', () => openDeadlineModal());
  main.querySelectorAll('[data-edit-deadline]').forEach(button => {
    bindPropsOnce(button, 'click', () => {
      const record = PropsState.data.deadlines.find(item => String(item.PropsDeadlineID) === String(button.dataset.editDeadline));
      openDeadlineModal(record);
    });
  });

  main.querySelectorAll('[data-upload-prop-image]').forEach(button => {
    bindPropsOnce(button, 'click', () => openImageUploadModal(button.dataset.uploadPropImage));
  });

  main.querySelectorAll('[data-delete-prop-image]').forEach(button => {
    bindPropsOnce(button, 'click', () => deletePropImage(button.dataset.deletePropImage));
  });

  main.querySelectorAll('[data-approve-suggestion]').forEach(button => {
    bindPropsOnce(button, 'click', () => reviewSuggestion(button.dataset.approveSuggestion, 'Approved'));
  });

  main.querySelectorAll('[data-decline-suggestion]').forEach(button => {
    bindPropsOnce(button, 'click', () => reviewSuggestion(button.dataset.declineSuggestion, 'Declined'));
  });
}

function refreshPropsViewOnly() {
  const host = propsMain().querySelector('[data-props-view]');
  host.innerHTML = renderActivePropsView();

  propsMain().querySelectorAll('[data-props-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.propsTab === PropsState.view);
  });

  bindPropsHubEvents();
  hydratePropsImages(host);
  renderSelectedPropDiscussion();
}

async function renderSelectedPropDiscussion() {
  if (PropsState.view !== 'inventory' || PropsState.detailTab !== 'discussion') return;

  const item = selectedProp();
  if (!item) return;

  await BRM.renderNotesPanel({
    pageKey: 'props:item',
    relatedId: item.PropID,
    departmentId: PropsState.data.department.DepartmentID,
    title: `${item.PropName} Discussion`
  });
}

async function mutateProps(action, payload, successMessage) {
  try {
    await BRM.api(action, payload, { noCache: true, forceNetwork: true });
    await BRM.invalidateSiteCache?.();
    await loadPropsHub();
    BRM.toast(successMessage || 'Saved.');
    renderPropsHub();
  } catch (error) {
    BRM.toast(error.message, 'error');
    throw error;
  }
}

function openPropModal(item = null) {
  const team = PropsState.data.team || [];
  const assigned = new Set(item?.AssignedUserIDs || []);

  const modal = BRM.openModal(`
    <span class="eyebrow">Props inventory</span>
    <h2>${item ? `Edit ${BRM.escape(item.PropName)}` : 'Add a prop'}</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Prop name', 'propName', item?.PropName, true, 'span-2')}
        ${fieldInput('Used by', 'usedBy', item?.UsedBy)}
        ${fieldInput('Scene', 'scene', item?.Scene)}
        ${fieldInput('Song / sequence', 'song', item?.Song)}
        ${selectInput('Prop type', 'propType', item?.PropType, ['Hero Prop','Hand Prop','Paper Prop','Food Prop','Sports Prop','Magic Prop','Set Dressing','Consumable'])}
        ${selectInput('Source', 'source', item?.Source, ['Build','Pull','Borrow','Buy','Print','Repair','Modify'])}
        ${selectInput('Status', 'status', item?.Status || 'Needed', ['Needed','In Progress','Ready','Complete','Pulled','Built','Purchased','Missing','Damaged'])}
        ${selectInput('Priority', 'priority', item?.Priority || 'Medium', ['Critical','High','Medium','Low'])}
        ${fieldInput('Storage location', 'storageLocation', item?.StorageLocation)}
        ${fieldInput('Preset location', 'presetLocation', item?.PresetLocation)}
        ${fieldInput('Exit / return location', 'exitLocation', item?.ExitLocation)}
        ${fieldInput('Drive folder or reference link', 'folderUrl', item?.FolderURL, false, 'span-2', 'url')}
        ${textareaInput('Description', 'description', item?.Description, 'span-2')}
        ${textareaInput('Safety and handling notes', 'safetyNotes', item?.SafetyNotes)}
        ${textareaInput('Reset instructions', 'resetNotes', item?.ResetNotes)}
        ${textareaInput('Production notes', 'notes', item?.Notes, 'span-2')}

        <div class="field span-2">
          <label>Assigned Props students</label>
          <div class="props-assignee-grid">
            ${team.length
              ? team.map(person => `
                <label class="props-assignee">
                  <input type="checkbox" name="assignedUserIds" value="${BRM.escape(person.UserID)}" ${assigned.has(person.UserID) ? 'checked' : ''}>
                  ${BRM.avatar(person.DisplayName, person.PhotoURL, 'small')}
                  <span>${BRM.escape(person.DisplayName)}<small style="display:block;color:var(--muted)">${BRM.escape(person.RoleLabel || 'Member')}</small></span>
                </label>
              `).join('')
              : '<p class="field-hint">Assign approved Props members after they join the department.</p>'}
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button class="button button-primary" type="submit">${item ? 'Save changes' : 'Create prop'}</button>
      </div>
    </form>
  `, { wide: true });

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Saving…';

    try {
      const result = await BRM.api('savePropsItem', {
        propId: item?.PropID || '',
        ...Object.fromEntries(formData),
        assignedUserIds: formData.getAll('assignedUserIds')
      }, { noCache: true, forceNetwork: true });

      PropsState.selectedPropId = result.propId;
      modal.closeModal();
      await BRM.invalidateSiteCache?.();
      await loadPropsHub();
      BRM.toast(item ? 'Prop updated.' : 'Prop created.');
      renderPropsHub();
    } catch (error) {
      BRM.toast(error.message, 'error');
      button.disabled = false;
      button.textContent = item ? 'Save changes' : 'Create prop';
    }
  });
}

function fieldInput(label, name, value = '', required = false, className = '', type = 'text') {
  return `
    <div class="field ${className}">
      <label>${BRM.escape(label)}</label>
      <input type="${type}" name="${name}" value="${BRM.escape(value || '')}" ${required ? 'required' : ''}>
    </div>
  `;
}

function selectInput(label, name, value, options) {
  return `
    <div class="field">
      <label>${BRM.escape(label)}</label>
      <select name="${name}">
        ${options.map(option => `
          <option ${String(value || '') === option ? 'selected' : ''}>${BRM.escape(option)}</option>
        `).join('')}
      </select>
    </div>
  `;
}

function textareaInput(label, name, value = '', className = '') {
  return `
    <div class="field ${className}">
      <label>${BRM.escape(label)}</label>
      <textarea name="${name}">${BRM.escape(value || '')}</textarea>
    </div>
  `;
}

function openTaskModal(propId) {
  const prop = PropsState.data.inventory.find(item => String(item.PropID) === String(propId));
  const modal = BRM.openModal(`
    <span class="eyebrow">${BRM.escape(prop?.PropName || 'Props task')}</span>
    <h2>Add task</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Task title', 'title', '', true, 'span-2')}
        ${textareaInput('Description', 'description', '', 'span-2')}
        ${selectInput('Priority', 'priority', 'Normal', ['Normal','Important','Urgent'])}
        ${fieldInput('Due date', 'dueDate', '', false, '', 'date')}
        <div class="field span-2">
          <label>Assign individual students</label>
          <div class="props-assignee-grid">
            ${(PropsState.data.team || []).map(person => `
              <label class="props-assignee">
                <input type="checkbox" name="assignedUserIds" value="${BRM.escape(person.UserID)}">
                ${BRM.avatar(person.DisplayName, person.PhotoURL, 'small')}
                <span>${BRM.escape(person.DisplayName)}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <label class="checkbox-row span-2">
          <input type="checkbox" name="assignDepartment" checked>
          Also assign to the complete Props department
        </label>
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Create task</button>
      </div>
    </form>
  `, { wide: true });

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await mutateProps('savePropsTask', {
        propId,
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        dueDate: formData.get('dueDate'),
        assignedUserIds: formData.getAll('assignedUserIds'),
        assignDepartment: formData.get('assignDepartment') === 'on',
        status: 'Open'
      }, 'Task created.');
      modal.closeModal();
    } catch {}
  });
}

async function updateTaskStatus(taskId, status) {
  try {
    await BRM.api('updateTaskStatus', { taskId, status }, { noCache: true, forceNetwork: true });
    await loadPropsHub();
    BRM.toast('Task status updated.');
    refreshPropsViewOnly();
  } catch (error) {
    BRM.toast(error.message, 'error');
    await loadPropsHub();
    refreshPropsViewOnly();
  }
}

function openPresetModal(propId, preset = null) {
  const prop = PropsState.data.inventory.find(item => String(item.PropID) === String(propId));

  const modal = BRM.openModal(`
    <span class="eyebrow">Backstage preset</span>
    <h2>${preset ? 'Edit preset' : `Add preset for ${BRM.escape(prop?.PropName || 'prop')}`}</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Scene', 'scene', preset?.Scene || prop?.Scene)}
        ${selectInput('Preset side', 'presetSide', preset?.PresetSide || 'SL', ['SL','SR','SL/SR'])}
        ${fieldInput('Preset table / container', 'presetTable', preset?.PresetTable)}
        ${fieldInput('Picked up by', 'pickedUpBy', preset?.PickedUpBy || prop?.UsedBy)}
        ${fieldInput('Returned by', 'returnedBy', preset?.ReturnedBy || 'Props Crew')}
        ${textareaInput('Reset instructions', 'resetNotes', preset?.ResetNotes, 'span-2')}
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Save preset</button>
      </div>
    </form>
  `);

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();

    try {
      await mutateProps('savePropsPreset', {
        presetId: preset?.PresetID || '',
        propId,
        ...Object.fromEntries(new FormData(event.currentTarget))
      }, 'Preset saved.');
      modal.closeModal();
    } catch {}
  });
}

async function updatePresetStatus(presetId, runStatus) {
  try {
    await BRM.api('updatePropsPresetRunStatus', {
      presetId,
      runStatus
    }, { noCache: true, forceNetwork: true });

    const local = PropsState.data.presets.find(item => String(item.PresetID) === String(presetId));
    if (local) local.RunStatus = runStatus;
    BRM.toast(`Preset marked ${runStatus}.`);
  } catch (error) {
    BRM.toast(error.message, 'error');
    await loadPropsHub();
    refreshPropsViewOnly();
  }
}

async function resetPresetRun() {
  if (!confirm('Reset every Props preset check to Not Checked?')) return;
  await mutateProps('resetPropsPresetRun', {}, 'Preset checklist reset.');
}

function openDeadlineModal(record = null) {
  const modal = BRM.openModal(`
    <span class="eyebrow">Props milestone</span>
    <h2>${record ? 'Edit deadline' : 'Add deadline'}</h2>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Title', 'title', record?.Title, true, 'span-2')}
        <div class="field">
          <label>Related prop</label>
          <select name="propId">
            <option value="">General Props deadline</option>
            ${PropsState.data.inventory.map(item => `
              <option value="${BRM.escape(item.PropID)}" ${String(record?.PropID || '') === String(item.PropID) ? 'selected' : ''}>
                ${BRM.escape(item.PropName)}
              </option>
            `).join('')}
          </select>
        </div>
        ${fieldInput('Due date', 'dueDate', record?.DueDate, false, '', 'date')}
        ${selectInput('Priority', 'priority', record?.Priority || 'Important', ['Normal','Important','Urgent'])}
        ${selectInput('Status', 'status', record?.Status || 'Open', ['Open','In Progress','Complete'])}
        ${textareaInput('Notes', 'notes', record?.Notes, 'span-2')}
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Save deadline</button>
      </div>
    </form>
  `);

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await mutateProps('savePropsDeadline', {
        deadlineId: record?.PropsDeadlineID || '',
        ...Object.fromEntries(new FormData(event.currentTarget))
      }, 'Deadline saved.');
      modal.closeModal();
    } catch {}
  });
}

function openSuggestionModal() {
  const modal = BRM.openModal(`
    <span class="eyebrow">Student collaboration</span>
    <h2>Suggest a prop or correction</h2>
    <p>Your suggestion will remain pending until a Props manager approves it.</p>
    <form data-form>
      <div class="form-grid">
        ${fieldInput('Suggestion title', 'title', '', true, 'span-2')}
        ${fieldInput('Scene', 'scene')}
        ${fieldInput('Used by', 'usedBy')}
        ${selectInput('Prop type', 'propType', 'Hand Prop', ['Hero Prop','Hand Prop','Paper Prop','Food Prop','Sports Prop','Magic Prop','Set Dressing','Consumable'])}
        ${selectInput('Suggested source', 'source', 'Build', ['Build','Pull','Borrow','Buy','Print','Repair','Modify'])}
        ${selectInput('Priority', 'priority', 'Medium', ['Critical','High','Medium','Low'])}
        ${fieldInput('Reference link', 'referenceUrl', '', false, '', 'url')}
        ${textareaInput('Description or correction', 'description', '', 'span-2')}
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Send suggestion</button>
      </div>
    </form>
  `, { wide: true });

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      PropsState.view = 'suggestions';
      await mutateProps(
        'savePropsSuggestion',
        Object.fromEntries(new FormData(event.currentTarget)),
        'Suggestion sent for approval.'
      );
      modal.closeModal();
    } catch {}
  });
}

async function reviewSuggestion(suggestionId, decision) {
  const reviewNote = prompt(
    decision === 'Approved'
      ? 'Optional approval note:'
      : 'Reason for declining this suggestion:',
    ''
  );

  if (reviewNote === null) return;

  const createProp = decision === 'Approved'
    ? confirm('Approve and create a new inventory record from this suggestion?')
    : false;

  await mutateProps('reviewPropsSuggestion', {
    suggestionId,
    decision,
    reviewNote,
    createProp
  }, `Suggestion ${decision.toLowerCase()}.`);
}

async function archiveProp(propId) {
  const reason = prompt('Why is this prop being archived?', '');
  if (reason === null) return;
  await mutateProps('archivePropsItem', { propId, reason }, 'Prop archived.');
}

async function restoreProp(propId) {
  await mutateProps('restorePropsItem', { propId, status: 'Needed' }, 'Prop restored.');
}

async function deletePropPermanently(propId) {
  const confirmation = prompt(
    'This permanently removes the prop, presets, deadlines, and images. Type DELETE to continue:'
  );

  if (confirmation !== 'DELETE') {
    if (confirmation !== null) BRM.toast('Permanent deletion cancelled.', 'error');
    return;
  }

  PropsState.selectedPropId = '';
  await mutateProps(
    'deletePropsItemPermanently',
    { propId, confirmation },
    'Prop permanently deleted.'
  );
}

function openImageUploadModal(propId) {
  const prop = PropsState.data.inventory.find(item => String(item.PropID) === String(propId));

  const modal = BRM.openModal(`
    <span class="eyebrow">${BRM.escape(prop?.PropName || 'Props image')}</span>
    <h2>Add progress or reference image</h2>
    <form data-form>
      <div class="field">
        <label>Image</label>
        <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required>
        <span class="field-hint">JPG, PNG, or WebP. The image is compressed before upload.</span>
      </div>
      <div class="field" style="margin-top:14px">
        <label>Caption</label>
        <input name="caption" maxlength="500" placeholder="Build progress, finished prop, preset label…">
      </div>
      <div class="form-actions">
        <button class="button button-primary" type="submit">Upload image</button>
      </div>
    </form>
  `);

  modal.querySelector('[data-form]').addEventListener('submit', async event => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const file = formData.get('image');
    const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');

    if (!(file instanceof File) || !file.size) {
      BRM.toast('Choose an image.', 'error');
      return;
    }

    button.disabled = true;
    button.textContent = 'Compressing…';

    try {
      const prepared = await compressPropsImage(file);
      button.textContent = 'Uploading…';

      const result = await BRM.api('uploadPropsImage', {
        propId,
        filename: file.name,
        caption: formData.get('caption'),
        dataUrl: prepared.dataUrl
      }, { noCache: true, forceNetwork: true });

      await cachePropsImage(result.fileId, prepared.dataUrl);
      modal.closeModal();
      await loadPropsHub();
      BRM.toast(`Image uploaded (${Math.max(1, Math.round(prepared.sizeBytes / 1024))} KB).`);
      refreshPropsViewOnly();
    } catch (error) {
      BRM.toast(error.message, 'error');
      button.disabled = false;
      button.textContent = 'Upload image';
    }
  });
}

async function deletePropImage(imageId) {
  if (!confirm('Remove this image from the Props Hub?')) return;
  await mutateProps('deletePropsImage', { imageId }, 'Image removed.');
}

async function decodePropsImage(file) {
  if (/image\/hei[cf]/i.test(file.type || '') || /\.(heic|heif)$/i.test(file.name || '')) {
    throw new Error('HEIC images are not supported here. Export the photo as JPG or PNG first.');
  }

  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {}
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected image could not be opened.'));
    };
    image.src = url;
  });
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Image compression failed.')),
      'image/jpeg',
      quality
    );
  });
}

function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The compressed image could not be prepared.'));
    reader.readAsDataURL(blob);
  });
}

async function compressPropsImage(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose an image smaller than 25 MB.');
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type || '')) throw new Error('Use a JPG, PNG, or WebP image.');
  const image = await decodePropsImage(file);

  try {
    const width = image.width;
    const height = image.height;
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const attempts = [0.84, 0.76, 0.68, 0.60];
    let blob = null;

    for (const quality of attempts) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d', { alpha: false });
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      blob = await canvasBlob(canvas, quality);
      if (blob.size <= 1200 * 1024) break;
    }

    if (!blob || blob.size > 4 * 1024 * 1024) {
      throw new Error('The image remained too large after compression.');
    }

    return {
      dataUrl: await blobDataUrl(blob),
      sizeBytes: blob.size
    };
  } finally {
    if (typeof image.close === 'function') {
      try { image.close(); } catch {}
    }
  }
}

function propsImageCacheName() {
  return `bedford-props-images-v21-${BRM.context?.userId || 'user'}`;
}

function propsImageRequest(fileId) {
  return new Request(`${location.origin}/__brm_props_image__/${encodeURIComponent(fileId)}`);
}

async function cachePropsImage(fileId, dataUrl) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const previous = PropsState.imageUrls.get(fileId);
  if (previous) URL.revokeObjectURL(previous);

  const url = URL.createObjectURL(blob);
  PropsState.imageUrls.set(fileId, url);

  if ('caches' in window) {
    try {
      const cache = await caches.open(propsImageCacheName());
      await cache.put(
        propsImageRequest(fileId),
        new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })
      );
    } catch {}
  }

  return url;
}

async function getPropsImageUrl(fileId) {
  if (PropsState.imageUrls.has(fileId)) return PropsState.imageUrls.get(fileId);
  if (PropsState.imageLoads.has(fileId)) return PropsState.imageLoads.get(fileId);

  const promise = (async () => {
    if ('caches' in window) {
      try {
        const cache = await caches.open(propsImageCacheName());
        const cached = await cache.match(propsImageRequest(fileId));

        if (cached) {
          const blob = await cached.blob();
          const url = URL.createObjectURL(blob);
          PropsState.imageUrls.set(fileId, url);
          return url;
        }
      } catch {}
    }

    const result = await BRM.api(
      'propsImageData',
      { fileId },
      { noCache: true, forceNetwork: true }
    );

    return cachePropsImage(fileId, result.dataUrl);
  })();

  PropsState.imageLoads.set(fileId, promise);

  try {
    return await promise;
  } finally {
    PropsState.imageLoads.delete(fileId);
  }
}

function hydratePropsImages(root = document) {
  root.querySelectorAll?.('[data-props-image]').forEach(async image => {
    if (image.dataset.loading === 'true') return;
    image.dataset.loading = 'true';

    try {
      image.src = await getPropsImageUrl(image.dataset.propsImage);
      image.hidden = false;
      image.previousElementSibling?.classList?.add('props-view-hidden');
    } catch (error) {
      console.warn('Props image failed to load:', error);
    }
  });

  BRM.hydrateProfilePhotos?.(root);
}
