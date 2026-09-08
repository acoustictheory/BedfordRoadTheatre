const CostumeState = {
  data: null,
  view: 'characters',
  selectedCharacterId: '',
  detailTab: 'overview',
  includeArchived: false,
  filters: {
    search: '',
    world: '',
    track: '',
    status: '',
    quick: ''
  }
};

const COSTUME_BUILD = 'costume-hub-v23-20260723';
const costumeImageUrls = new Map();
const costumeImageLoads = new Map();

document.addEventListener('DOMContentLoaded', () =>
  BRM.initPrivatePage(async () => {
    const main = costumeMain();
    BRM.loading(main, 'Loading the Costume Design Hub…');

    try {
      await loadCostumeHub();
      renderCostumeHub();
    } catch (error) {
      main.innerHTML = `<div class="alert alert-error">${BRM.escape(error.message)}</div>`;
    }
  })
);

function costumeMain() {
  return document.querySelector('#app-main');
}

async function loadCostumeHub() {
  const firebaseMap = { characters:'costumeCharacters', changes:'costumeChanges', pieces:'costumePieces', fittings:'costumeFittings', deadlines:'costumeDeadlines', images:'costumeImages' };
  const cacheKey = `costumeHub:${CostumeState.includeArchived}`;
  const cached = !CostumeState.includeArchived && BRM.readFastCache?.(cacheKey);
  if (cached) {
    CostumeState.data = cached;
    window.setTimeout(async () => {
      try {
        const fresh = await BRM.firebaseWorkspaceOverlay(CostumeState.data, firebaseMap, false);
        CostumeState.data = fresh;
        BRM.writeFastCache?.(cacheKey, fresh);
        renderCostumeHub();
      } catch (error) { console.warn('Costume refresh failed; cached workspace retained.', error); }
    }, 50);
  } else {
  const baseRequest = BRM.api(
    'costumeHub',
    { includeArchived: CostumeState.includeArchived },
    { noCache: true, forceNetwork: true }
  );
    const firebaseRequest = BRM.firebaseWorkspaceOverlay({}, firebaseMap, CostumeState.includeArchived);
    const base = await baseRequest;
    CostumeState.data = await firebaseRequest.then(fresh => ({ ...base, ...fresh })).catch(() => base);
    if (!CostumeState.includeArchived) BRM.writeFastCache?.(cacheKey, CostumeState.data);
  }

  const available = filteredCostumeCharacters();
  const selectedStillExists = available.some(character =>
    String(character.CharacterID) === String(CostumeState.selectedCharacterId)
  );

  if (!selectedStillExists) {
    CostumeState.selectedCharacterId = available[0]?.CharacterID || '';
  }
}

function filteredCostumeCharacters() {
  const data = CostumeState.data;
  if (!data) return [];

  const search = String(CostumeState.filters.search || '').toLowerCase();

  return (data.characters || []).filter(character => {
    const haystack = [
      character.CharacterName,
      character.ActorName,
      character.World,
      character.Track,
      character.Alignment,
      character.RoleType,
      character.CostumeNotes,
      character.ColorPalette,
      character.Textures
    ].join(' ').toLowerCase();

    return (!search || haystack.includes(search))
      && (!CostumeState.filters.world || character.World === CostumeState.filters.world)
      && (!CostumeState.filters.track || character.Track === CostumeState.filters.track)
      && (!CostumeState.filters.status || character.OverallStatus === CostumeState.filters.status)
      && (
        !CostumeState.filters.quick
        || String(Boolean(character.HasQuickChange)) === CostumeState.filters.quick
      );
  }).sort((a, b) =>
    String(a.CharacterName).localeCompare(String(b.CharacterName))
  );
}

function selectedCostumeCharacter() {
  return (CostumeState.data?.characters || []).find(character =>
    String(character.CharacterID) === String(CostumeState.selectedCharacterId)
  );
}

function characterChanges(characterId) {
  return (CostumeState.data?.changes || [])
    .filter(change => String(change.CharacterID) === String(characterId))
    .sort((a, b) =>
      Number(a.ChangeOrder || 0) - Number(b.ChangeOrder || 0)
      || String(a.LookName).localeCompare(String(b.LookName))
    );
}

function characterPieces(characterId) {
  return (CostumeState.data?.pieces || [])
    .filter(piece => String(piece.CharacterID) === String(characterId))
    .sort((a, b) =>
      String(a.LookName || '').localeCompare(String(b.LookName || ''))
      || String(a.ItemName).localeCompare(String(b.ItemName))
    );
}

function characterMeasurementsList(characterId) { return (CostumeState.data?.measurements || []).filter(measurement => String(measurement.CharacterID) === String(characterId)); }
function characterMeasurements(characterId,actorUserId='') { return characterMeasurementsList(characterId).find(measurement => !actorUserId || String(measurement.ActorUserID) === String(actorUserId)); }
function costumeCastAssignments(character) {
  const key=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const wanted=[key(character?.CharacterCode),key(character?.CharacterName)].filter(Boolean);
  return (CostumeState.data?.castAssignments||[]).filter(item=>wanted.includes(key(item.CharacterKey))||wanted.includes(key(item.CharacterName))).sort((a,b)=>String(a.CastGroup||'Single').localeCompare(String(b.CastGroup||'Single')));
}

function characterFittings(characterId) {
  return (CostumeState.data?.fittings || [])
    .filter(fitting => String(fitting.CharacterID) === String(characterId))
    .sort((a, b) =>
      new Date(a.ScheduledAt || 0).getTime() - new Date(b.ScheduledAt || 0).getTime()
    );
}

function characterTasks(characterId) {
  const changes = new Set(characterChanges(characterId).map(item => String(item.CostumeChangeID)));
  const pieces = new Set(characterPieces(characterId).map(item => String(item.CostumePieceID)));

  return (CostumeState.data?.tasks || []).filter(task =>
    (task.RelatedType === 'CostumeCharacter' && String(task.RelatedID) === String(characterId))
    || (task.RelatedType === 'CostumeChange' && changes.has(String(task.RelatedID)))
    || (task.RelatedType === 'CostumePiece' && pieces.has(String(task.RelatedID)))
  );
}

function characterDeadlines(characterId) {
  return (CostumeState.data?.deadlines || []).filter(deadline =>
    !deadline.CharacterID || String(deadline.CharacterID) === String(characterId)
  );
}

function characterImages(characterId) {
  return (CostumeState.data?.images || []).filter(image =>
    String(image.CharacterID) === String(characterId)
  );
}

function characterActivity(characterId) {
  return (CostumeState.data?.activity || []).filter(entry =>
    String(entry.CharacterID) === String(characterId)
  );
}

function renderCostumeHub() {
  const main = costumeMain();
  const data = CostumeState.data;
  const stats = data.stats || {};
  const permissions = data.permissions || {};

  main.innerHTML = `
    <div class="costume-hub" data-costume-build="${COSTUME_BUILD}">
      <section class="costume-hero">
        <div class="costume-hero-grid">
          <div>
            <span class="eyebrow">Costume Department · Descendants</span>
            <h1>Costume Design Hub</h1>
            <p>
              Develop character silhouettes, coordinate looks and pieces, protect
              private measurements, schedule fittings, rehearse quick changes,
              manage laundry and resets, and document the complete costume journey.
            </p>
            <div class="costume-actions">
              ${permissions.manage
                ? '<button class="button button-primary" data-add-character>＋ Add character</button>'
                : '<button class="button button-primary" data-suggest-costume>＋ Suggest costume need</button>'}
              ${permissions.manage
                ? '<button class="button button-secondary" data-add-task>＋ Add task</button>'
                : ''}
              <a class="button button-secondary" href="${BRM.escape(data.folderUrl || '#')}" target="_blank" rel="noopener">Open Costumes Drive</a>
              ${permissions.measurements
                ? '<span class="costume-manager-ribbon">🔒 Private fitting access enabled</span>'
                : ''}
            </div>
          </div>

          <div class="costume-kpis">
            ${costumeKpi(stats.totalCharacters, 'Characters')}
            ${costumeKpi(stats.quickChanges, 'Quick changes')}
            ${costumeKpi(stats.piecesNeeded, 'Pieces still needed')}
            ${costumeKpi(stats.fittingsDue, 'Fittings open')}
          </div>
        </div>
      </section>

      ${renderCostumeAnnouncements(data.announcements || [])}

      <nav class="costume-tabs" aria-label="Costume Hub sections">
        ${costumeTab('characters', 'Design')}
        ${costumeTab('pieces', 'Build & Fit')}
        ${costumeTab('quick', 'Wardrobe Run')}
        ${costumeTab('gallery', 'Gallery')}
      </nav>

      <div data-costume-view>
        ${renderActiveCostumeView()}
      </div>

      ${renderCostumeTeam(data.team || [])}
    </div>
  `;

  bindCostumeEvents();
  hydrateCostumeImages(main);
  renderSelectedCostumeDiscussion();
}

function costumeKpi(value, label) {
  return `<div class="costume-kpi"><strong>${Number(value || 0)}</strong><span>${BRM.escape(label)}</span></div>`;
}

function costumeTab(id, label) {
  return `<button class="costume-tab ${CostumeState.view === id ? 'active' : ''}" data-costume-tab="${id}">${BRM.escape(label)}</button>`;
}

function renderCostumeAnnouncements(announcements) {
  if (!announcements.length) return '';

  return `
    <section class="panel costume-announcement">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Costume communication</span>
          <h2>Department announcements</h2>
        </div>
        <a class="button button-secondary button-small" href="announcements.html">View all</a>
      </div>
      <div class="data-list">
        ${announcements.slice(0, 3).map(item => `
          <article class="data-card">
            <div class="data-card-main">
              <div class="item-meta"><span>${BRM.formatDateTime(item.PublishAt || item.CreatedAt)}</span></div>
              <h3>${BRM.escape(item.Title || '')}</h3>
              <p>${BRM.escape(item.BodyText || item.Body || '')}</p>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderActiveCostumeView() {
  switch (CostumeState.view) {
    case 'quick': return `${renderQuickChangeBoard()}${renderCostumeTasksAndDeadlines()}`;
    case 'pieces': return `${renderAllCostumePieces()}${renderAllCostumeFittings()}`;
    case 'fittings': return renderAllCostumeFittings();
    case 'deadlines': return renderCostumeTasksAndDeadlines();
    case 'gallery': return renderCostumeGallery();
    case 'suggestions': return renderCostumeSuggestions();
    case 'activity': return renderCostumeActivity();
    default: return renderCostumeCharacters();
  }
}

function uniqueValues(records, field) {
  return [...new Set(records.map(item => item[field]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
}

function renderCostumeCharacters() {
  const data = CostumeState.data;
  const characters = filteredCostumeCharacters();
  const selected = selectedCostumeCharacter();

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Design by role</span>
          <h2>Characters and costume tracks</h2>
          <p>Select a character to open design direction, looks, pieces, fittings, tasks, images, discussion, and history.</p>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" data-show-archived ${CostumeState.includeArchived ? 'checked' : ''}>
          Show archived
        </label>
      </div>

      <div class="costume-toolbar">
        <input data-filter="search" value="${BRM.escape(CostumeState.filters.search)}" placeholder="Search character, actor, notes…">
        ${filterSelect('world', 'All worlds', uniqueValues(data.characters, 'World'))}
        ${filterSelect('track', 'All tracks', uniqueValues(data.characters, 'Track'))}
        ${filterSelect('status', 'All statuses', uniqueValues(data.characters, 'OverallStatus'))}
        ${filterSelect('quick', 'All change types', [
          { value: 'true', label: 'Has quick change' },
          { value: 'false', label: 'No quick change' }
        ])}
      </div>

      <div class="costume-character-layout">
        <div class="costume-character-list">
          ${characters.length
            ? characters.map(renderCostumeCharacterButton).join('')
            : BRM.empty('No matching characters', 'Change the filters or add a character.', '◇')}
        </div>
        <div class="costume-detail">
          ${selected ? renderCostumeCharacterDetail(selected) : `
            <div class="costume-empty-detail">
              <div>
                <h2>Select a character</h2>
                <p>Open a character’s complete costume workspace.</p>
              </div>
            </div>
          `}
        </div>
      </div>
    </section>
  `;
}

function filterSelect(field, blank, options) {
  const current = CostumeState.filters[field] || '';

  return `
    <select data-filter="${field}">
      <option value="">${BRM.escape(blank)}</option>
      ${options.map(option => {
        const value = typeof option === 'object' ? option.value : option;
        const label = typeof option === 'object' ? option.label : option;
        return `<option value="${BRM.escape(value)}" ${String(value) === String(current) ? 'selected' : ''}>${BRM.escape(label)}</option>`;
      }).join('')}
    </select>
  `;
}

function renderCostumeCharacterButton(character) {
  const changes = characterChanges(character.CharacterID);
  const pieces = characterPieces(character.CharacterID);
  const ready = pieces.filter(piece =>
    ['Ready', 'In Use', 'Complete'].includes(piece.Status)
  ).length;
  const progress = pieces.length ? Math.round(ready / pieces.length * 100) : 0;
  const primaryImage = character.PrimaryImageFileID;

  return `
    <button class="costume-character-button ${String(character.CharacterID) === String(CostumeState.selectedCharacterId) ? 'active' : ''}" data-select-character="${BRM.escape(character.CharacterID)}">
      <span class="costume-thumb">
        ${primaryImage
          ? `<img hidden data-costume-image="${BRM.escape(primaryImage)}" alt="">`
          : '✦'}
      </span>
      <span>
        <span class="costume-character-title">
          <strong>${BRM.escape(character.CharacterName)}</strong>
          ${character.HasQuickChange ? '<span class="badge badge-important">Quick</span>' : ''}
        </span>
        <span class="costume-character-sub">${BRM.escape(character.ActorName || 'Actor not assigned')} · ${BRM.escape(character.Track || 'No track')}</span>
        <span class="costume-character-sub">${changes.length} looks · ${pieces.length} pieces</span>
        <span class="costume-progress"><span style="width:${progress}%"></span></span>
      </span>
    </button>
  `;
}

function renderCostumeCharacterDetail(character) {
  const data = CostumeState.data;
  const permissions = data.permissions;
  const changes = characterChanges(character.CharacterID);
  const pieces = characterPieces(character.CharacterID);

  return `
    <header class="costume-detail-head">
      <div>
        <div class="item-meta">
          <span class="badge">${BRM.escape(character.OverallStatus || 'Not Started')}</span>
          ${character.Complexity ? `<span class="tag">${BRM.escape(character.Complexity)}</span>` : ''}
          ${character.HasQuickChange ? '<span class="badge badge-important">Quick-change track</span>' : ''}
        </div>
        <h2>${BRM.escape(character.CharacterName)}</h2>
        <p>${BRM.escape(character.ActorName || 'Actor not yet assigned')} · ${BRM.escape(character.World || 'World not set')} · ${BRM.escape(character.Track || 'Track not set')}</p>
      </div>
      <div class="costume-detail-actions">
        ${character.FolderURL ? `<a class="button button-secondary button-small" href="${BRM.escape(character.FolderURL)}" target="_blank" rel="noopener">Open folder</a>` : ''}
        ${permissions.manage ? `<button class="button button-secondary button-small" data-edit-character="${BRM.escape(character.CharacterID)}">Edit</button>` : ''}
        ${permissions.archive && character.OverallStatus !== 'Archived'
          ? `<button class="button button-danger button-small" data-archive-character="${BRM.escape(character.CharacterID)}">Archive</button>`
          : ''}
        ${permissions.archive && character.OverallStatus === 'Archived'
          ? `<button class="button button-secondary button-small" data-restore-character="${BRM.escape(character.CharacterID)}">Restore</button>`
          : ''}
        ${permissions.permanentDelete && character.OverallStatus === 'Archived'
          ? `<button class="button button-danger button-small" data-delete-character="${BRM.escape(character.CharacterID)}">Delete permanently</button>`
          : ''}
      </div>
    </header>

    <nav class="costume-detail-tabs">
      ${detailTab('overview', 'Overview')}
      ${detailTab('looks', `Looks (${changes.length})`)}
      ${detailTab('pieces', `Pieces (${pieces.length})`)}
      ${detailTab('fittings', 'Fittings & Measurements')}
      ${detailTab('tasks', 'Tasks')}
      ${detailTab('gallery', 'Gallery')}
      ${detailTab('discussion', 'Discussion')}
      ${detailTab('history', 'History')}
    </nav>

    <div class="costume-detail-body">
      ${renderCostumeDetailTab(character)}
    </div>
  `;
}

function detailTab(id, label) {
  return `<button class="costume-detail-tab ${CostumeState.detailTab === id ? 'active' : ''}" data-detail-tab="${id}">${BRM.escape(label)}</button>`;
}

function renderCostumeDetailTab(character) {
  switch (CostumeState.detailTab) {
    case 'looks': return renderCharacterLooks(character);
    case 'pieces': return renderCharacterPieces(character);
    case 'fittings': return renderCharacterFittings(character);
    case 'tasks': return renderCharacterTasks(character);
    case 'gallery': return renderCharacterGallery(character);
    case 'discussion': return '<div data-notes-panel></div>';
    case 'history': return renderCharacterHistory(character);
    default: return renderCharacterOverview(character);
  }
}

function renderCharacterOverview(character) {
  return `
    <div class="costume-facts">
      ${fact('Actor', character.ActorName || 'Not assigned')}
      ${fact('World', character.World || '—')}
      ${fact('Track', character.Track || '—')}
      ${fact('Alignment', character.Alignment || '—')}
      ${fact('Role type', character.RoleType || '—')}
      ${fact('Status', character.OverallStatus || 'Not Started')}
      ${fact('Silhouette', character.Silhouette || '—', true)}
      ${fact('Colour palette', character.ColorPalette || '—', true)}
      ${fact('Textures', character.Textures || '—', true)}
      ${fact('Layers', character.Layers || '—', true)}
      ${fact('Accessories', character.Accessories || '—', true)}
      ${fact('Footwear', character.Footwear || '—', true)}
      ${fact('Hair / wig', character.HairWig || '—', true)}
      ${fact('Makeup', character.Makeup || '—', true)}
      ${fact('Design notes', character.CostumeNotes || '—', true, 'costume-wide')}
    </div>
  `;
}

function fact(label, value, paragraph = false, extra = '') {
  return `<div class="costume-fact ${extra}"><span>${BRM.escape(label)}</span>${paragraph ? `<p>${BRM.escape(value)}</p>` : `<strong>${BRM.escape(value)}</strong>`}</div>`;
}

function renderCharacterLooks(character) {
  const permissions = CostumeState.data.permissions;
  const changes = characterChanges(character.CharacterID);

  return `
    <div class="section-heading">
      <div><h3>Looks and changes</h3><p>Track the visual arc, pieces, preset, location, laundry and run readiness.</p></div>
      ${permissions.manage ? `<button class="button button-primary button-small" data-add-change="${BRM.escape(character.CharacterID)}">＋ Add look</button>` : ''}
    </div>
    <div class="costume-card-grid">
      ${changes.length
        ? changes.map(renderCostumeChangeCard).join('')
        : BRM.empty('No costume looks yet', 'Add the first look or costume change.', '◇')}
    </div>
  `;
}

function renderCostumeChangeCard(change) {
  const p = CostumeState.data.permissions;

  return `
    <article class="costume-change-card ${change.IsQuickChange ? 'costume-quick' : ''}">
      <div class="item-meta">
        <span class="badge">${BRM.escape(change.Status || 'Not Started')}</span>
        ${change.IsQuickChange ? '<span class="badge badge-important">Quick change</span>' : ''}
        <span>${BRM.escape(change.Act || '')}</span>
        <span>Order ${Number(change.ChangeOrder || 0)}</span>
      </div>
      <h3>${BRM.escape(change.LookName)}</h3>
      <p>${BRM.escape(change.SceneSong || '')}</p>
      <div class="costume-change-route">
        <span>${BRM.escape(change.FromLook || 'Start')}</span>
        <span class="costume-change-arrow">→</span>
        <strong>${BRM.escape(change.ToLook || change.LookName)}</strong>
      </div>
      <div class="costume-facts">
        ${fact('Type', change.ChangeType || '—')}
        ${fact('Time', change.TimeAvailable || '—')}
        ${fact('Location', change.ChangeLocation || '—')}
        ${fact('Preset', change.PresetLocation || '—', true)}
        ${fact('Pieces needed', change.PiecesNeeded || '—', true)}
        ${fact('Laundry / reset', change.LaundryResetNotes || '—', true)}
      </div>
      <div class="costume-run-controls">
        ${runSelect(change, 'runStatus', 'Run', ['Not Checked','Ready','In Progress','Complete','Issue'])}
        ${runSelect(change, 'presetStatus', 'Preset', ['Not Set','Set','Used','Returned','Reset'])}
        ${runSelect(change, 'laundryStatus', 'Laundry', ['Clean','Needs Laundry','In Laundry','Drying','Ready'])}
      </div>
      <div class="costume-inline-actions">
        ${p.manage ? `<button class="button button-secondary button-small" data-edit-change="${BRM.escape(change.CostumeChangeID)}">Edit</button>` : ''}
        ${p.manage ? `<button class="button button-secondary button-small" data-add-piece="${BRM.escape(change.CharacterID)}" data-change-id="${BRM.escape(change.CostumeChangeID)}">Add piece</button>` : ''}
        ${p.contribute ? `<button class="button button-secondary button-small" data-upload-image data-character-id="${BRM.escape(change.CharacterID)}" data-change-id="${BRM.escape(change.CostumeChangeID)}">Add image</button>` : ''}
      </div>
    </article>
  `;
}

function runSelect(change, field, label, options) {
  if (!CostumeState.data.permissions.contribute) {
    return `<div class="costume-fact"><span>${label}</span><strong>${BRM.escape(change[field[0].toUpperCase() + field.slice(1)] || '—')}</strong></div>`;
  }

  const dataKey = field === 'runStatus'
    ? 'RunStatus'
    : field === 'presetStatus'
      ? 'PresetStatus'
      : 'LaundryStatus';

  return `
    <label class="field">
      <span>${BRM.escape(label)}</span>
      <select data-change-run="${BRM.escape(change.CostumeChangeID)}" data-run-field="${field}">
        ${options.map(option => `<option ${String(change[dataKey]) === option ? 'selected' : ''}>${BRM.escape(option)}</option>`).join('')}
      </select>
    </label>
  `;
}

function renderCharacterPieces(character) {
  const pieces = characterPieces(character.CharacterID);
  const p = CostumeState.data.permissions;

  return `
    <div class="section-heading">
      <div><h3>Costume pieces</h3><p>Source, build, assign, fit, store and maintain every component.</p></div>
      ${p.manage ? `<button class="button button-primary button-small" data-add-piece="${BRM.escape(character.CharacterID)}">＋ Add piece</button>` : ''}
    </div>
    <div class="costume-card-grid">
      ${pieces.length ? pieces.map(renderCostumePieceCard).join('') : BRM.empty('No costume pieces', 'Add pieces for this character.', '◇')}
    </div>
  `;
}

function renderCostumePieceCard(piece) {
  const p = CostumeState.data.permissions;
  const image = piece.PrimaryImageFileID;

  return `
    <article class="costume-card">
      ${image ? `<div class="costume-image-card"><img hidden data-costume-image="${BRM.escape(image)}" alt=""></div>` : ''}
      <div class="costume-meta">
        <span class="badge">${BRM.escape(piece.Status || 'Not Started')}</span>
        <span class="tag">${BRM.escape(piece.ItemType || 'Piece')}</span>
        <span class="tag">${BRM.escape(piece.Source || 'TBD')}</span>
      </div>
      <h3>${BRM.escape(piece.ItemName)}</h3>
      <p>${BRM.escape(piece.LookName || '')}</p>
      <div class="costume-facts">
        ${fact('Size', piece.Size || '—')}
        ${fact('Colour', piece.Colour || '—')}
        ${fact('Storage', piece.StorageLocation || '—')}
      </div>
      <div class="costume-inline-actions">
        ${p.manage ? `<button class="button button-secondary button-small" data-edit-piece="${BRM.escape(piece.CostumePieceID)}">Edit</button>` : ''}
        ${p.contribute ? `<button class="button button-secondary button-small" data-upload-image data-character-id="${BRM.escape(piece.CharacterID)}" data-piece-id="${BRM.escape(piece.CostumePieceID)}">Add image</button>` : ''}
        ${p.archive && piece.Status !== 'Archived' ? `<button class="button button-danger button-small" data-archive-piece="${BRM.escape(piece.CostumePieceID)}">Archive</button>` : ''}
        ${p.archive && piece.Status === 'Archived' ? `<button class="button button-secondary button-small" data-restore-piece="${BRM.escape(piece.CostumePieceID)}">Restore</button>` : ''}
        ${p.permanentDelete && piece.Status === 'Archived' ? `<button class="button button-danger button-small" data-delete-piece="${BRM.escape(piece.CostumePieceID)}">Delete</button>` : ''}
      </div>
    </article>
  `;
}

function renderCharacterFittings(character) {
  const p = CostumeState.data.permissions;
  const measurements = characterMeasurementsList(character.CharacterID);
  const fittings = characterFittings(character.CharacterID);

  return `
    <div class="section-heading">
      <div>
        <h3>Fittings and measurements</h3>
        <p>Fitting schedules are visible to the costume team. Detailed measurements and sensitivities are restricted.</p>
      </div>
      <div class="costume-inline-actions">
        ${p.manage ? `<button class="button button-secondary button-small" data-add-fitting="${BRM.escape(character.CharacterID)}">＋ Schedule fitting</button>` : ''}
        ${p.measurements ? `<button class="button button-primary button-small" data-edit-measurements="${BRM.escape(character.CharacterID)}">${measurements.length ? 'Manage measurements' : 'Add measurements'}</button>` : ''}
      </div>
    </div>

    ${measurements.length
      ? measurements.map(renderMeasurementPanel).join('')
      : p.measurements
        ? '<div class="alert alert-info">No measurements have been entered for this actor.</div>'
        : '<div class="alert alert-info">Private measurements are available only to the actor, authorized costume managers, and Full Administrators.</div>'}

    <div class="section-heading" style="margin-top:22px"><div><h3>Fitting schedule</h3></div></div>
    <div class="data-list">
      ${fittings.length ? fittings.map(renderFittingRow).join('') : BRM.empty('No fittings scheduled', 'Schedule fittings as actors and pieces become ready.', '◷')}
    </div>
  `;
}

function renderMeasurementPanel(m) {
  const values = [
    ['Height',m.Height],['Chest / Bust',m.ChestBust],['Waist',m.Waist],['Hips',m.Hips],
    ['Shoulder',m.ShoulderWidth],['Neck',m.Neck],['Sleeve',m.SleeveLength],['Arm',m.ArmLength],
    ['Wrist',m.Wrist],['Inseam',m.Inseam],['Outseam',m.Outseam],['Thigh',m.Thigh],
    ['Calf',m.Calf],['Ankle',m.Ankle],['Shoe',m.ShoeSize],['Head',m.HeadCircumference],
    ['Hat',m.HatSize],['Glove',m.GloveSize]
  ];

  return `
    <section class="panel-inset costume-private">
      <div class="item-meta"><span class="badge">Private fitting record</span><span>${m.DateMeasured ? `Measured ${BRM.formatDate(m.DateMeasured)}` : 'Measurement date not entered'}</span></div>
      <div class="costume-measure-grid" style="margin-top:14px">
        ${values.map(([label,value]) => `<div class="costume-measure"><span>${BRM.escape(label)}</span><strong>${BRM.escape(value || '—')}</strong></div>`).join('')}
      </div>
      <div class="costume-design-grid">
        ${fact('Fit notes',m.FitNotes || '—',true)}
        ${fact('Mobility notes',m.MobilityNotes || '—',true)}
        ${fact('Allergies / sensitivities',m.AllergiesSensitivities || '—',true,'costume-warning')}
      </div>
    </section>
  `;
}

function renderFittingRow(fitting) {
  return `
    <article class="costume-row">
      <span class="badge">${BRM.escape(fitting.Status || 'Scheduled')}</span>
      <div>
        <strong>${BRM.escape(fitting.FittingType || 'General Fitting')}</strong>
        <p>${fitting.ScheduledAt ? BRM.formatDateTime(fitting.ScheduledAt) : 'Date not set'} · ${BRM.escape(fitting.Location || 'Location not set')}</p>
        ${fitting.Notes ? `<p>${BRM.escape(fitting.Notes)}</p>` : ''}
        ${fitting.PrivateNotes ? `<div class="alert alert-info">${BRM.escape(fitting.PrivateNotes)}</div>` : ''}
      </div>
      ${CostumeState.data.permissions.manage ? `<button class="button button-secondary button-small" data-edit-fitting="${BRM.escape(fitting.FittingID)}">Edit</button>` : ''}
    </article>
  `;
}

function renderCharacterTasks(character) {
  const tasks = characterTasks(character.CharacterID);
  const deadlines = characterDeadlines(character.CharacterID);

  return `
    <div class="section-heading">
      <div><h3>Tasks and deadlines</h3><p>Character-specific and department-wide work.</p></div>
      ${CostumeState.data.permissions.manage ? `<div class="costume-inline-actions"><button class="button button-primary button-small" data-add-task data-character-id="${BRM.escape(character.CharacterID)}">＋ Task</button><button class="button button-secondary button-small" data-add-deadline data-character-id="${BRM.escape(character.CharacterID)}">＋ Deadline</button></div>` : ''}
    </div>
    <div class="data-list">
      ${tasks.length ? tasks.map(renderCostumeTaskRow).join('') : BRM.empty('No tasks for this character', 'Add a task or assign a department-wide task.', '✓')}
    </div>
    <div class="section-heading" style="margin-top:22px"><div><h3>Deadlines</h3></div></div>
    <div class="data-list">
      ${deadlines.length ? deadlines.map(renderCostumeDeadlineRow).join('') : BRM.empty('No deadlines', 'Add a fitting, parade, sourcing, or quick-change deadline.', '◷')}
    </div>
  `;
}

function renderCostumeTaskRow(task) {
  return `
    <article class="costume-row">
      <span class="badge ${task.Priority === 'Urgent' ? 'badge-urgent' : ''}">${BRM.escape(task.Priority || 'Normal')}</span>
      <div>
        <strong>${BRM.escape(task.Title || '')}</strong>
        <p>${BRM.escape(task.Description || '')}</p>
        <div class="item-meta"><span>${task.DueDate ? BRM.formatDate(task.DueDate) : 'No due date'}</span><span>${BRM.escape(task.Status || 'Open')}</span></div>
      </div>
      ${CostumeState.data.permissions.manage ? `<button class="button button-secondary button-small" data-edit-task="${BRM.escape(task.TaskID)}">Edit</button>` : ''}
    </article>
  `;
}

function renderCostumeDeadlineRow(deadline) {
  return `
    <article class="costume-row">
      <span class="badge ${deadline.Priority === 'Urgent' || deadline.Priority === 'High' ? 'badge-urgent' : ''}">${BRM.escape(deadline.Priority || 'Medium')}</span>
      <div>
        <strong>${BRM.escape(deadline.Title)}</strong>
        <p>${BRM.escape(deadline.Notes || '')}</p>
        <div class="item-meta"><span>${deadline.DueDate ? BRM.formatDate(deadline.DueDate) : 'Date not set'}</span><span>${BRM.escape(deadline.Status || 'Not Started')}</span></div>
      </div>
      ${CostumeState.data.permissions.manage ? `<button class="button button-secondary button-small" data-edit-deadline="${BRM.escape(deadline.CostumeDeadlineID)}">Edit</button>` : ''}
    </article>
  `;
}

function renderCharacterGallery(character) {
  const images = characterImages(character.CharacterID);

  return `
    <div class="section-heading">
      <div><h3>Character design gallery</h3><p>Reference, fitting, progress, finished-look, and quick-change documentation.</p></div>
      ${CostumeState.data.permissions.contribute ? `<button class="button button-primary button-small" data-upload-image data-character-id="${BRM.escape(character.CharacterID)}">＋ Add image</button>` : ''}
    </div>
    <div class="costume-image-grid">
      ${images.length ? images.map(renderCostumeImageCard).join('') : BRM.empty('No images yet', 'Upload reference or progress photos.', '▧')}
    </div>
  `;
}

function renderCostumeImageCard(image) {
  return `
    <article class="costume-image-card">
      <div class="costume-image-placeholder">Loading image…</div>
      <img hidden data-costume-image="${BRM.escape(image.DriveFileID)}" alt="${BRM.escape(image.Caption || '')}">
      ${(CostumeState.data.permissions.manage || String(image.UploadedByUserID) === String(CostumeState.data.context.userId))
        ? `<button class="button button-danger button-small costume-image-remove" data-delete-image="${BRM.escape(image.CostumeImageID)}">×</button>`
        : ''}
      <div class="costume-image-caption">
        <strong>${BRM.escape(image.ImageType || 'Progress')}</strong>
        <p>${BRM.escape(image.Caption || image.FileName || '')}</p>
      </div>
    </article>
  `;
}

function renderCharacterHistory(character) {
  const activity = characterActivity(character.CharacterID);
  return activity.length
    ? activity.map(renderCostumeActivityRow).join('')
    : BRM.empty('No character activity yet', 'Changes will appear here.', '◌');
}

function renderQuickChangeBoard() {
  const p = CostumeState.data.permissions;
  const changes = (CostumeState.data.changes || [])
    .filter(change => Boolean(change.IsQuickChange))
    .sort((a,b) => String(a.Act).localeCompare(String(b.Act)) || Number(a.ChangeOrder)-Number(b.ChangeOrder));

  return `
    <section class="panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Backstage operations</span>
          <h2>Quick-change and preset board</h2>
          <p>Use this during rehearsals and performances to coordinate locations, assistants, presets, resets, and laundry status.</p>
        </div>
        ${p.manage ? '<button class="button button-secondary button-small" data-reset-run>Reset run checks</button>' : ''}
      </div>
      <div class="costume-card-grid">
        ${changes.length ? changes.map(change => {
          const character = CostumeState.data.characters.find(item => String(item.CharacterID) === String(change.CharacterID));
          return `<div>${renderCostumeChangeCard(change)}<button class="button button-secondary button-small" data-jump-character="${BRM.escape(change.CharacterID)}">${BRM.escape(character?.CharacterName || 'Open character')}</button></div>`;
        }).join('') : BRM.empty('No quick changes', 'Mark a costume change as quick to add it to this board.', '⇄')}
      </div>
    </section>
  `;
}

function renderAllCostumePieces() {
  const pieces = CostumeState.data.pieces || [];
  return `
    <section class="panel">
      <div class="section-heading">
        <div><span class="eyebrow">Inventory and sourcing</span><h2>All costume pieces</h2><p>Every garment, shoe, accessory, wig, makeup element, and specialty piece.</p></div>
        ${CostumeState.data.permissions.manage ? '<button class="button button-primary button-small" data-add-piece>＋ Add piece</button>' : ''}
      </div>
      <div class="costume-card-grid">${pieces.length ? pieces.map(renderCostumePieceCard).join('') : BRM.empty('No pieces', 'Add costume pieces from a character or this inventory.', '◇')}</div>
    </section>
  `;
}

function renderAllCostumeFittings() {
  const fittings = CostumeState.data.fittings || [];
  return `
    <section class="panel">
      <div class="section-heading">
        <div><span class="eyebrow">Fittings calendar</span><h2>All fittings</h2><p>Coordinate actor appointments, dressers, locations, follow-ups, and private fit notes.</p></div>
        ${CostumeState.data.permissions.manage ? '<button class="button button-primary button-small" data-add-fitting>＋ Schedule fitting</button>' : ''}
      </div>
      <div class="data-list">${fittings.length ? fittings.map(fitting => {
        const c=CostumeState.data.characters.find(item=>String(item.CharacterID)===String(fitting.CharacterID));
        return `<div><div class="item-meta"><span>${BRM.escape(c?.CharacterName || '')}</span></div>${renderFittingRow(fitting)}</div>`;
      }).join('') : BRM.empty('No fittings scheduled', 'Schedule the first fitting from a character or this page.', '◷')}</div>
    </section>
  `;
}

function renderCostumeTasksAndDeadlines() {
  return `
    <section class="panel">
      <div class="section-heading">
        <div><span class="eyebrow">Production workflow</span><h2>Tasks and deadlines</h2><p>Department-wide work, sourcing, fittings, quick-change tests, repairs, laundry, and costume parade milestones.</p></div>
        ${CostumeState.data.permissions.manage ? '<div class="costume-inline-actions"><button class="button button-primary button-small" data-add-task>＋ Task</button><button class="button button-secondary button-small" data-add-deadline>＋ Deadline</button></div>' : ''}
      </div>
      <div class="data-list">${(CostumeState.data.tasks || []).map(renderCostumeTaskRow).join('') || BRM.empty('No costume tasks','Add a task.','✓')}</div>
      <div class="section-heading" style="margin-top:25px"><div><h2>Costume deadlines</h2></div></div>
      <div class="data-list">${(CostumeState.data.deadlines || []).map(renderCostumeDeadlineRow).join('') || BRM.empty('No deadlines','Add a deadline.','◷')}</div>
    </section>
  `;
}

function renderCostumeGallery() {
  const images = CostumeState.data.images || [];
  return `
    <section class="panel">
      <div class="section-heading">
        <div><span class="eyebrow">Visual research and documentation</span><h2>Costume design board</h2><p>Reference images, sketches, fittings, progress photos, finished looks, and repair documentation.</p></div>
        ${CostumeState.data.permissions.contribute ? '<button class="button button-primary button-small" data-upload-image>＋ Add image</button>' : ''}
      </div>
      <div class="costume-board">${images.length ? images.map(renderCostumeImageCard).join('') : BRM.empty('No costume images','Upload inspiration or progress photos.','▧')}</div>
    </section>
  `;
}

function renderCostumeSuggestions() {
  const suggestions = CostumeState.data.suggestions || [];
  const p = CostumeState.data.permissions;

  return `
    <section class="panel">
      <div class="section-heading">
        <div><span class="eyebrow">Collaborative ideas</span><h2>Suggestions and requests</h2><p>Students can suggest a missing piece, repair, look, fitting need, safety concern, or new character requirement.</p></div>
        ${p.contribute ? '<button class="button button-primary button-small" data-suggest-costume>＋ New suggestion</button>' : ''}
      </div>
      <div class="data-list">
        ${suggestions.length ? suggestions.map(item => `
          <article class="costume-row">
            ${BRM.avatar(item.SuggestedBy?.DisplayName || 'Student', item.SuggestedBy?.PhotoURL || '', 'small')}
            <div>
              <div class="item-meta"><span class="badge ${item.Status === 'Pending' ? 'badge-important' : ''}">${BRM.escape(item.Status)}</span><span>${BRM.escape(item.SuggestionType)}</span><span>${BRM.escape(item.Priority)}</span></div>
              <strong>${BRM.escape(item.Title)}</strong>
              <p>${BRM.escape(item.Description || '')}</p>
              <span class="field-hint">${BRM.escape(item.SuggestedBy?.DisplayName || '')} · ${BRM.formatDateTime(item.CreatedAt)}</span>
            </div>
            ${p.manage && item.Status === 'Pending' ? `<div class="costume-inline-actions"><button class="button button-primary button-small" data-approve-suggestion="${BRM.escape(item.CostumeSuggestionID)}">Approve</button><button class="button button-danger button-small" data-decline-suggestion="${BRM.escape(item.CostumeSuggestionID)}">Decline</button></div>` : ''}
          </article>
        `).join('') : BRM.empty('No suggestions','New student ideas will appear here.','✦')}
      </div>
    </section>
  `;
}

function renderCostumeActivity() {
  return `
    <section class="panel">
      <div class="section-heading"><div><span class="eyebrow">Accountable collaboration</span><h2>Costume activity history</h2><p>Who changed what and when.</p></div></div>
      <div class="data-list">${(CostumeState.data.activity || []).map(renderCostumeActivityRow).join('') || BRM.empty('No activity','Costume changes will appear here.','◌')}</div>
    </section>
  `;
}

function renderCostumeActivityRow(entry) {
  return `
    <article class="costume-row">
      ${BRM.avatar(entry.Actor?.DisplayName || 'Production Team', entry.Actor?.PhotoURL || '', 'small')}
      <div>
        <div class="item-meta"><span>${BRM.formatDateTime(entry.CreatedAt)}</span><span>${BRM.escape(entry.Action || '')}</span></div>
        <strong>${BRM.escape(entry.Summary || '')}</strong>
        <p class="field-hint">${BRM.escape(entry.Actor?.DisplayName || 'Production Team')}</p>
      </div>
      ${entry.CharacterID ? `<button class="button button-secondary button-small" data-jump-character="${BRM.escape(entry.CharacterID)}">Open</button>` : ''}
    </article>
  `;
}

function renderCostumeTeam(team) {
  return `
    <section class="panel">
      <div class="section-heading">
        <div><span class="eyebrow">Approved Costumes members</span><h2>Costume team</h2><p>Hover over a profile image to see the student’s name and role.</p></div>
        ${BRM.isAdmin() ? '<a class="button button-secondary button-small" href="admin.html#users">Manage team</a>' : ''}
      </div>
      <div class="costume-team">
        ${team.length ? team.map(person => `
          <button class="costume-team-person" type="button" aria-label="${BRM.escape(person.DisplayName)} — ${BRM.escape(person.RoleLabel)}">
            ${BRM.avatar(person.DisplayName, person.PhotoURL, '')}
            <span class="costume-team-tip"><strong>${BRM.escape(person.DisplayName)}</strong><br>${BRM.escape(person.RoleLabel || 'Costume Member')}</span>
          </button>
        `).join('') : '<p class="field-hint">No approved Costume members yet.</p>'}
      </div>
    </section>
  `;
}

function bindOnce(element, event, handler) {
  if (!element || element.dataset.costumeBound === 'true') return;
  element.dataset.costumeBound = 'true';
  element.addEventListener(event, handler);
}

function bindCostumeEvents() {
  const main = costumeMain();

  main.querySelectorAll('[data-costume-tab]').forEach(button => bindOnce(button, 'click', () => {
    CostumeState.view = button.dataset.costumeTab;
    renderCostumeHub();
  }));

  main.querySelectorAll('[data-filter]').forEach(input => bindOnce(input, input.tagName === 'INPUT' ? 'input' : 'change', () => {
    CostumeState.filters[input.dataset.filter] = input.value;
    refreshCostumeViewOnly();
  }));

  bindOnce(main.querySelector('[data-show-archived]'), 'change', async event => {
    CostumeState.includeArchived = event.target.checked;
    await loadCostumeHub();
    renderCostumeHub();
  });

  main.querySelectorAll('[data-select-character]').forEach(button => bindOnce(button, 'click', () => {
    CostumeState.selectedCharacterId = button.dataset.selectCharacter;
    CostumeState.detailTab = 'overview';
    refreshCostumeViewOnly();
  }));

  main.querySelectorAll('[data-detail-tab]').forEach(button => bindOnce(button, 'click', () => {
    CostumeState.detailTab = button.dataset.detailTab;
    refreshCostumeViewOnly();
  }));

  main.querySelectorAll('[data-jump-character]').forEach(button => bindOnce(button, 'click', () => {
    CostumeState.selectedCharacterId = button.dataset.jumpCharacter;
    CostumeState.view = 'characters';
    CostumeState.detailTab = 'overview';
    renderCostumeHub();
  }));

  main.querySelectorAll('[data-add-character]').forEach(button => bindOnce(button,'click',()=>openCharacterModal()));
  main.querySelectorAll('[data-edit-character]').forEach(button => bindOnce(button,'click',()=>openCharacterModal(CostumeState.data.characters.find(x=>String(x.CharacterID)===String(button.dataset.editCharacter)))));
  main.querySelectorAll('[data-archive-character]').forEach(button => bindOnce(button,'click',()=>archiveCharacter(button.dataset.archiveCharacter)));
  main.querySelectorAll('[data-restore-character]').forEach(button => bindOnce(button,'click',()=>restoreCharacter(button.dataset.restoreCharacter)));
  main.querySelectorAll('[data-delete-character]').forEach(button => bindOnce(button,'click',()=>deleteCharacter(button.dataset.deleteCharacter)));

  main.querySelectorAll('[data-add-change]').forEach(button => bindOnce(button,'click',()=>openChangeModal(null,button.dataset.addChange)));
  main.querySelectorAll('[data-edit-change]').forEach(button => bindOnce(button,'click',()=>openChangeModal(CostumeState.data.changes.find(x=>String(x.CostumeChangeID)===String(button.dataset.editChange)))));

  main.querySelectorAll('[data-change-run]').forEach(select => bindOnce(select,'change',()=>updateChangeRun(select)));

  main.querySelectorAll('[data-add-piece]').forEach(button => bindOnce(button,'click',()=>openPieceModal(null,button.dataset.addPiece||'',button.dataset.changeId||'')));
  main.querySelectorAll('[data-edit-piece]').forEach(button => bindOnce(button,'click',()=>openPieceModal(CostumeState.data.pieces.find(x=>String(x.CostumePieceID)===String(button.dataset.editPiece)))));
  main.querySelectorAll('[data-archive-piece]').forEach(button => bindOnce(button,'click',()=>archivePiece(button.dataset.archivePiece)));
  main.querySelectorAll('[data-restore-piece]').forEach(button => bindOnce(button,'click',()=>restorePiece(button.dataset.restorePiece)));
  main.querySelectorAll('[data-delete-piece]').forEach(button => bindOnce(button,'click',()=>deletePiece(button.dataset.deletePiece)));

  main.querySelectorAll('[data-edit-measurements]').forEach(button => bindOnce(button,'click',()=>openMeasurementModal(button.dataset.editMeasurements)));
  main.querySelectorAll('[data-add-fitting]').forEach(button => bindOnce(button,'click',()=>openFittingModal(null,button.dataset.addFitting||'')));
  main.querySelectorAll('[data-edit-fitting]').forEach(button => bindOnce(button,'click',()=>openFittingModal(CostumeState.data.fittings.find(x=>String(x.FittingID)===String(button.dataset.editFitting)))));

  main.querySelectorAll('[data-add-task]').forEach(button => bindOnce(button,'click',()=>openTaskModal(null,button.dataset.characterId||'')));
  main.querySelectorAll('[data-edit-task]').forEach(button => bindOnce(button,'click',()=>openTaskModal(CostumeState.data.tasks.find(x=>String(x.TaskID)===String(button.dataset.editTask)))));
  main.querySelectorAll('[data-add-deadline]').forEach(button => bindOnce(button,'click',()=>openDeadlineModal(null,button.dataset.characterId||'')));
  main.querySelectorAll('[data-edit-deadline]').forEach(button => bindOnce(button,'click',()=>openDeadlineModal(CostumeState.data.deadlines.find(x=>String(x.CostumeDeadlineID)===String(button.dataset.editDeadline)))));

  main.querySelectorAll('[data-upload-image]').forEach(button => bindOnce(button,'click',()=>openImageModal({
    characterId:button.dataset.characterId||'',
    costumeChangeId:button.dataset.changeId||'',
    costumePieceId:button.dataset.pieceId||''
  })));
  main.querySelectorAll('[data-delete-image]').forEach(button => bindOnce(button,'click',()=>deleteCostumeImage(button.dataset.deleteImage)));

  main.querySelectorAll('[data-suggest-costume]').forEach(button => bindOnce(button,'click',openSuggestionModal));
  main.querySelectorAll('[data-approve-suggestion]').forEach(button => bindOnce(button,'click',()=>reviewSuggestion(button.dataset.approveSuggestion,'Approved')));
  main.querySelectorAll('[data-decline-suggestion]').forEach(button => bindOnce(button,'click',()=>reviewSuggestion(button.dataset.declineSuggestion,'Declined')));

  bindOnce(main.querySelector('[data-reset-run]'),'click',resetCostumeRun);
}

function refreshCostumeViewOnly() {
  const host = costumeMain().querySelector('[data-costume-view]');
  host.innerHTML = renderActiveCostumeView();

  costumeMain().querySelectorAll('[data-costume-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.costumeTab === CostumeState.view);
  });

  bindCostumeEvents();
  hydrateCostumeImages(host);
  renderSelectedCostumeDiscussion();
}

async function renderSelectedCostumeDiscussion() {
  if (CostumeState.view !== 'characters' || CostumeState.detailTab !== 'discussion') return;
  const character = selectedCostumeCharacter();
  if (!character) return;

  await BRM.renderNotesPanel({
    pageKey: 'costume:character',
    relatedId: character.CharacterID,
    departmentId: CostumeState.data.department.DepartmentID,
    title: `${character.CharacterName} Costume Discussion`
  });
}

async function mutateCostume(action, payload, message) {
  try {
    await BRM.api(action,payload,{noCache:true,forceNetwork:true});
    await BRM.invalidateSiteCache?.();
    await loadCostumeHub();
    BRM.toast(message || 'Saved.');
    renderCostumeHub();
  } catch (error) {
    BRM.toast(error.message,'error');
    throw error;
  }
}

function field(label,name,value='',required=false,type='text',extra='') {
  return `<div class="field"><label>${BRM.escape(label)}</label><input name="${name}" type="${type}" value="${BRM.escape(value ?? '')}" ${required?'required':''} ${extra}></div>`;
}
function area(label,name,value='',cls='') {
  return `<div class="field ${cls}"><label>${BRM.escape(label)}</label><textarea name="${name}">${BRM.escape(value ?? '')}</textarea></div>`;
}
function selectField(label,name,value,options,cls='') {
  return `<div class="field ${cls}"><label>${BRM.escape(label)}</label><select name="${name}">${options.map(option=>{
    const v=typeof option==='object'?option.value:option;
    const l=typeof option==='object'?option.label:option;
    return `<option value="${BRM.escape(v)}" ${String(v)===String(value??'')?'selected':''}>${BRM.escape(l)}</option>`;
  }).join('')}</select></div>`;
}
function checkField(label,name,checked) {
  return `<label class="checkbox-row"><input name="${name}" type="checkbox" ${checked?'checked':''}> ${BRM.escape(label)}</label>`;
}
function formSubmit(modal, action, payloadBuilder, success) {
  const form=modal.querySelector('[data-form]');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=event.submitter||form.querySelector('button[type="submit"]');
    const original=button.textContent;
    button.disabled=true;button.textContent='Saving…';
    try{
      await mutateCostume(action,payloadBuilder(new FormData(form)),success);
      modal.closeModal();
    }catch(error){button.disabled=false;button.textContent=original;}
  });
}

function teamOptions(includeBlank=true) {
  const options=(CostumeState.data.team||[]).map(person=>({value:person.UserID,label:person.DisplayName}));
  return includeBlank?[{value:'',label:'Not assigned'},...options]:options;
}
function characterOptions(includeBlank=true) {
  const options=(CostumeState.data.characters||[]).map(c=>({value:c.CharacterID,label:c.CharacterName}));
  return includeBlank?[{value:'',label:'Select character'},...options]:options;
}
function changeOptions(characterId,includeBlank=true) {
  const options=characterChanges(characterId).map(c=>({value:c.CostumeChangeID,label:c.LookName}));
  return includeBlank?[{value:'',label:'No specific look'},...options]:options;
}

function openCharacterModal(item=null) {
  const modal=BRM.openModal(`
    <span class="eyebrow">${item?'Edit character':'New character'}</span>
    <h2>${BRM.escape(item?.CharacterName||'Add character')}</h2>
    <form data-form>
      <div class="form-grid">
        ${field('Character name','characterName',item?.CharacterName||'',true)}
        ${field('Character code','characterCode',item?.CharacterCode||item?.CharacterID||'')}
        ${selectField('Actor account','actorUserId',item?.ActorUserID||'',teamOptions())}
        ${field('Actor name','actorName',item?.ActorName||'')}
        ${field('World','world',item?.World||'')}
        ${field('Track','track',item?.Track||'')}
        ${field('Alignment','alignment',item?.Alignment||'')}
        ${field('Role type','roleType',item?.RoleType||'')}
        ${selectField('Status','overallStatus',item?.OverallStatus||'Not Started',['Not Started','Researching','Designing','Approved','Sourcing','Building','Fitting','Alterations','Ready','In Rehearsal','Complete','Needs Repair','Archived'])}
        ${field('Complexity','complexity',item?.Complexity||'Standard')}
        ${checkField('Has a quick change','hasQuickChange',Boolean(item?.HasQuickChange))}
        ${field('Drive folder ID','folderId',item?.FolderID||'')}
        ${field('Drive folder URL','folderUrl',item?.FolderURL||'')}
        ${area('Silhouette','silhouette',item?.Silhouette||'')}
        ${area('Colour palette','colorPalette',item?.ColorPalette||'')}
        ${area('Textures','textures',item?.Textures||'')}
        ${area('Layers','layers',item?.Layers||'')}
        ${area('Accessories','accessories',item?.Accessories||'')}
        ${area('Footwear','footwear',item?.Footwear||'')}
        ${area('Hair / wig','hairWig',item?.HairWig||'')}
        ${area('Makeup','makeup',item?.Makeup||'')}
        ${area('Costume notes','costumeNotes',item?.CostumeNotes||'','span-2')}
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Save character</button></div>
    </form>`,{wide:true});

  formSubmit(modal,'saveCostumeCharacter',fd=>({
    characterId:item?.CharacterID||'',
    ...Object.fromEntries(fd),
    hasQuickChange:fd.get('hasQuickChange')==='on'
  }),'Character saved.');
}

function openChangeModal(item=null,characterId='') {
  const selectedId=item?.CharacterID||characterId||CostumeState.selectedCharacterId;
  const modal=BRM.openModal(`
    <span class="eyebrow">${item?'Edit look / change':'New look / change'}</span>
    <h2>${BRM.escape(item?.LookName||'Add costume look')}</h2>
    <form data-form>
      <div class="form-grid">
        ${selectField('Character','characterId',selectedId,characterOptions(false))}
        ${field('Look name','lookName',item?.LookName||'',true)}
        ${field('Scene / song','sceneSong',item?.SceneSong||'')}
        ${field('Act','act',item?.Act||'')}
        ${field('Change order','changeOrder',item?.ChangeOrder||0,false,'number','min="0"')}
        ${field('Change type','changeType',item?.ChangeType||'Full Look')}
        ${field('From look','fromLook',item?.FromLook||'')}
        ${field('To look','toLook',item?.ToLook||'')}
        ${checkField('Quick change','isQuickChange',Boolean(item?.IsQuickChange))}
        ${field('Time available','timeAvailable',item?.TimeAvailable||'')}
        ${field('Change location','changeLocation',item?.ChangeLocation||'')}
        ${field('Preset location','presetLocation',item?.PresetLocation||'')}
        ${selectField('Status','status',item?.Status||'Not Started',['Not Started','Planned','Pieces Needed','Ready to Test','Rehearsing','Locked','Complete','Needs Revision','Archived'])}
        ${selectField('Preset status','presetStatus',item?.PresetStatus||'Not Set',['Not Set','Set','Used','Returned','Reset'])}
        ${selectField('Run status','runStatus',item?.RunStatus||'Not Checked',['Not Checked','Ready','In Progress','Complete','Issue'])}
        ${selectField('Laundry status','laundryStatus',item?.LaundryStatus||'Clean',['Clean','Needs Laundry','In Laundry','Drying','Ready'])}
        ${area('Pieces needed','piecesNeeded',item?.PiecesNeeded||'','span-2')}
        ${area('Laundry / reset notes','laundryResetNotes',item?.LaundryResetNotes||'','span-2')}
        ${area('Notes','notes',item?.Notes||'','span-2')}
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Save look</button></div>
    </form>`,{wide:true});
  formSubmit(modal,'saveCostumeChange',fd=>({costumeChangeId:item?.CostumeChangeID||'',...Object.fromEntries(fd),isQuickChange:fd.get('isQuickChange')==='on'}),'Costume look saved.');
}

function openPieceModal(item=null,characterId='',changeId='') {
  let selectedCharacter=item?.CharacterID||characterId||CostumeState.selectedCharacterId||'';
  const modal=BRM.openModal(`
    <span class="eyebrow">${item?'Edit costume piece':'New costume piece'}</span>
    <h2>${BRM.escape(item?.ItemName||'Add costume piece')}</h2>
    <form data-form>
      <div class="form-grid">
        ${selectField('Character','characterId',selectedCharacter,characterOptions(false))}
        ${selectField('Look / change','costumeChangeId',item?.CostumeChangeID||changeId,changeOptions(selectedCharacter))}
        ${field('Look name','lookName',item?.LookName||'')}
        ${field('Item name','itemName',item?.ItemName||'',true)}
        ${field('Item type','itemType',item?.ItemType||'Costume Piece')}
        ${field('Source','source',item?.Source||'TBD')}
        ${selectField('Status','status',item?.Status||'Not Started',['Not Started','Researching','To Purchase','Ordered','Pulled','Building','Alterations','Ready for Fitting','Ready','In Use','Needs Repair','Complete','Archived'])}
        ${field('Due date','dueDate',String(item?.DueDate||'').slice(0,10),false,'date')}
        ${field('Size','size',item?.Size||'')}
        ${field('Colour','colour',item?.Colour||'')}
        ${field('Storage location','storageLocation',item?.StorageLocation||'')}
        ${area('Notes','notes',item?.Notes||'','span-2')}
        <div class="field span-2"><label>Assigned costume students</label><div class="costume-assignees">${(CostumeState.data.team||[]).map(person=>`<label class="costume-assignee"><input type="checkbox" name="assignedUserIds" value="${BRM.escape(person.UserID)}" ${(item?.AssignedUserIDs||[]).includes(person.UserID)?'checked':''}>${BRM.avatar(person.DisplayName,person.PhotoURL,'small')}<span>${BRM.escape(person.DisplayName)}</span></label>`).join('')}</div></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Save piece</button></div>
    </form>`,{wide:true});
  const charSelect=modal.querySelector('[name="characterId"]');
  charSelect?.addEventListener('change',()=>{ /* reopen avoids stale look list */ });
  formSubmit(modal,'saveCostumePiece',fd=>({costumePieceId:item?.CostumePieceID||'',...Object.fromEntries(fd),assignedUserIds:fd.getAll('assignedUserIds')}),'Costume piece saved.');
}

function openMeasurementModal(characterId,actorUserId='') {
  const character=CostumeState.data.characters.find(x=>String(x.CharacterID)===String(characterId));
  const assignments=costumeCastAssignments(character);
  if(!actorUserId&&assignments.length>1){
    const chooser=BRM.openModal(`<span class="eyebrow">Double-cast measurements</span><h2>${BRM.escape(character?.CharacterName||'Choose performer')}</h2><p>Costume designs and pieces stay shared. Measurements and fittings remain private and separate for each performer.</p><div class="data-list">${assignments.map(a=>`<button class="data-card" data-measure-actor="${BRM.escape(a.UserID)}"><div class="data-card-main"><strong>${BRM.escape(a.PersonName||'Assigned performer')}</strong><p>Cast ${BRM.escape(a.CastGroup||'A')}</p></div></button>`).join('')}</div>`);
    chooser.querySelectorAll('[data-measure-actor]').forEach(button=>button.onclick=()=>{chooser.closeModal();openMeasurementModal(characterId,button.dataset.measureActor);});return;
  }
  const assignment=assignments.find(a=>String(a.UserID)===String(actorUserId))||assignments[0];
  const m=characterMeasurements(characterId,actorUserId||assignment?.UserID)||{};
  const measurementFields=[
    ['Height','height','Height'],['Chest / Bust','chestBust','ChestBust'],['Waist','waist','Waist'],['Hips','hips','Hips'],
    ['Shoulder width','shoulderWidth','ShoulderWidth'],['Neck','neck','Neck'],['Sleeve length','sleeveLength','SleeveLength'],['Arm length','armLength','ArmLength'],
    ['Wrist','wrist','Wrist'],['Inseam','inseam','Inseam'],['Outseam','outseam','Outseam'],['Thigh','thigh','Thigh'],['Calf','calf','Calf'],['Ankle','ankle','Ankle'],
    ['Shoe size','shoeSize','ShoeSize'],['Head circumference','headCircumference','HeadCircumference'],['Hat size','hatSize','HatSize'],['Glove size','gloveSize','GloveSize']
  ];
  const modal=BRM.openModal(`
    <span class="eyebrow">Restricted fitting information</span><h2>${BRM.escape(character?.CharacterName||'Measurements')}</h2>
    <div class="alert alert-info">Only authorized costume managers, Full Administrators, and the linked actor can view this record.</div>
    <form data-form><div class="form-grid">
      ${field('Actor name','actorName',m.ActorName||assignment?.PersonName||character?.ActorName||'')}
      ${selectField('Actor account','actorUserId',m.ActorUserID||assignment?.UserID||character?.ActorUserID||'',teamOptions())}
      <input type="hidden" name="castGroup" value="${BRM.escape(m.CastGroup||assignment?.CastGroup||'Single')}">
      ${field('Date measured','dateMeasured',String(m.DateMeasured||'').slice(0,10),false,'date')}
      ${measurementFields.map(([label,name,key])=>field(label,name,m[key]||'')).join('')}
      ${area('Fit notes','fitNotes',m.FitNotes||'','span-2')}
      ${area('Mobility notes','mobilityNotes',m.MobilityNotes||'','span-2')}
      ${area('Allergies / sensitivities','allergiesSensitivities',m.AllergiesSensitivities||'','span-2')}
    </div><div class="form-actions"><button class="button button-primary" type="submit">Save private measurements</button></div></form>
  `,{wide:true});
  formSubmit(modal,'saveCostumeMeasurement',fd=>({measurementId:m.MeasurementID||'',characterId,...Object.fromEntries(fd)}),'Measurements saved.');
}

function openFittingModal(item=null,characterId='') {
  const selected=item?.CharacterID||characterId||CostumeState.selectedCharacterId||'';
  const fittingCharacter=(CostumeState.data.characters||[]).find(character=>String(character.CharacterID)===String(selected));
  const fittingAssignments=costumeCastAssignments(fittingCharacter);
  const fittingAssignment=fittingAssignments.find(assignment=>String(assignment.UserID)===String(item?.ActorUserID))||fittingAssignments[0];
  const modal=BRM.openModal(`
    <span class="eyebrow">${item?'Edit fitting':'Schedule fitting'}</span><h2>${BRM.escape(item?.FittingType||'Costume fitting')}</h2>
    <form data-form><div class="form-grid">
      ${selectField('Character','characterId',selected,characterOptions(false))}
      ${selectField('Actor / cast','actorUserId',item?.ActorUserID||fittingAssignment?.UserID||'',fittingAssignments.length?fittingAssignments.map(assignment=>({value:assignment.UserID,label:`${assignment.PersonName} · ${assignment.CastGroup==='Single'?'Single cast':`Cast ${assignment.CastGroup}`}`})):teamOptions())}
      <input type="hidden" name="castGroup" value="${BRM.escape(item?.CastGroup||fittingAssignment?.CastGroup||'Single')}">
      ${field('Date and time','scheduledAt',item?.ScheduledAt?String(item.ScheduledAt).slice(0,16):'',false,'datetime-local')}
      ${field('Location','location',item?.Location||'Costume Room')}
      ${field('Fitting type','fittingType',item?.FittingType||'General Fitting')}
      ${selectField('Status','status',item?.Status||'Scheduled',['Not Scheduled','Scheduled','Confirmed','Complete','Needs Follow-up','Cancelled','Archived'])}
      ${area('Team-visible notes','notes',item?.Notes||'','span-2')}
      ${CostumeState.data.permissions.measurements?area('Private fitting notes','privateNotes',item?.PrivateNotes||'','span-2'):''}
      <div class="field span-2"><label>Assigned dressers</label><div class="costume-assignees">${(CostumeState.data.team||[]).map(person=>`<label class="costume-assignee"><input type="checkbox" name="assignedDresserUserIds" value="${BRM.escape(person.UserID)}" ${(item?.AssignedDresserUserIDs||[]).includes(person.UserID)?'checked':''}>${BRM.avatar(person.DisplayName,person.PhotoURL,'small')}<span>${BRM.escape(person.DisplayName)}</span></label>`).join('')}</div></div>
    </div><div class="form-actions"><button class="button button-primary" type="submit">Save fitting</button></div></form>
  `,{wide:true});
  formSubmit(modal,'saveCostumeFitting',fd=>({fittingId:item?.FittingID||'',...Object.fromEntries(fd),assignedDresserUserIds:fd.getAll('assignedDresserUserIds')}),'Fitting saved.');
}

function openTaskModal(item=null,characterId='') {
  const modal=BRM.openModal(`
    <span class="eyebrow">${item?'Edit costume task':'New costume task'}</span><h2>${BRM.escape(item?.Title||'Add task')}</h2>
    <form data-form><div class="form-grid">
      ${selectField('Character','characterId',characterId||((item?.RelatedType==='CostumeCharacter')?item.RelatedID:''),characterOptions())}
      ${field('Task title','title',item?.Title||'',true)}
      ${selectField('Priority','priority',item?.Priority||'Normal',['Normal','Important','Urgent'])}
      ${selectField('Status','status',item?.Status||'Open',['Open','In Progress','Blocked','Complete'])}
      ${field('Due date','dueDate',String(item?.DueDate||'').slice(0,10),false,'date')}
      ${area('Description','description',item?.Description||'','span-2')}
      <div class="field span-2"><label>Assigned students</label><div class="costume-assignees">${(CostumeState.data.team||[]).map(person=>`<label class="costume-assignee"><input type="checkbox" name="assignedUserIds" value="${BRM.escape(person.UserID)}" ${(item?.AssignedUserIDs||[]).includes(person.UserID)?'checked':''}>${BRM.avatar(person.DisplayName,person.PhotoURL,'small')}<span>${BRM.escape(person.DisplayName)}</span></label>`).join('')}</div></div>
    </div><div class="form-actions"><button class="button button-primary" type="submit">Save task</button></div></form>
  `,{wide:true});
  formSubmit(modal,'saveCostumeTask',fd=>({taskId:item?.TaskID||'',...Object.fromEntries(fd),assignedUserIds:fd.getAll('assignedUserIds'),assignDepartment:true}),'Task saved.');
}

function openDeadlineModal(item=null,characterId='') {
  const modal=BRM.openModal(`
    <span class="eyebrow">${item?'Edit deadline':'New costume deadline'}</span><h2>${BRM.escape(item?.Title||'Add deadline')}</h2>
    <form data-form><div class="form-grid">
      ${selectField('Character','characterId',item?.CharacterID||characterId,characterOptions())}
      ${field('Title','title',item?.Title||'',true)}
      ${field('Due date','dueDate',String(item?.DueDate||'').slice(0,10),false,'date')}
      ${selectField('Priority','priority',item?.Priority||'Medium',['Low','Medium','High','Urgent'])}
      ${selectField('Status','status',item?.Status||'Not Started',['Not Started','In Progress','Complete','Archived'])}
      ${area('Notes','notes',item?.Notes||'','span-2')}
    </div><div class="form-actions"><button class="button button-primary" type="submit">Save deadline</button></div></form>
  `);
  formSubmit(modal,'saveCostumeDeadline',fd=>({costumeDeadlineId:item?.CostumeDeadlineID||'',...Object.fromEntries(fd)}),'Deadline saved.');
}

function openSuggestionModal() {
  const modal=BRM.openModal(`
    <span class="eyebrow">Collaborative costume request</span><h2>Submit suggestion</h2>
    <form data-form><div class="form-grid">
      ${selectField('Character','characterId',CostumeState.selectedCharacterId,characterOptions())}
      ${selectField('Suggestion type','suggestionType','Missing Piece',['Missing Piece','Repair','Design Idea','Fitting Need','Safety Concern','Laundry / Reset','New Character','Other'])}
      ${field('Title','title','',true)}
      ${selectField('Priority','priority','Medium',['Low','Medium','High','Urgent'])}
      ${field('Reference URL','referenceUrl','')}
      ${area('Description','description','','span-2')}
    </div><div class="form-actions"><button class="button button-primary" type="submit">Submit suggestion</button></div></form>
  `);
  formSubmit(modal,'saveCostumeSuggestion',fd=>Object.fromEntries(fd),'Suggestion submitted.');
}

async function reviewSuggestion(id,decision) {
  const note=prompt(`Optional review note for ${decision.toLowerCase()}:`,'');
  if(note===null)return;
  await mutateCostume('reviewCostumeSuggestion',{costumeSuggestionId:id,decision,reviewNote:note,createRecord:false},`Suggestion ${decision.toLowerCase()}.`);
}

function openImageModal(target={}) {
  const modal=BRM.openModal(`
    <span class="eyebrow">Authenticated costume image</span><h2>Add image</h2>
    <form data-form><div class="form-grid">
      ${selectField('Character','characterId',target.characterId||CostumeState.selectedCharacterId,characterOptions())}
      ${selectField('Image type','imageType','Progress',['Inspiration','Sketch','Progress','Fitting','Finished Look','Quick Change','Repair','Laundry / Reset'])}
      ${field('Image file','imageFile','',true,'file','accept="image/jpeg,image/png,image/webp"')}
      ${area('Caption','caption','','span-2')}
    </div><div class="form-actions"><button class="button button-primary" type="submit">Upload image</button></div></form>
  `);

  const form=modal.querySelector('[data-form]');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=event.submitter||form.querySelector('button[type="submit"]');
    const fd=new FormData(form);
    const file=fd.get('imageFile');
    if(!(file instanceof File)||!file.size){BRM.toast('Choose an image.','error');return;}
    button.disabled=true;button.textContent='Compressing…';
    try{
      const prepared=await compressCostumeImage(file);
      button.textContent='Uploading…';
      await mutateCostume('uploadCostumeImage',{
        characterId:fd.get('characterId'),
        costumeChangeId:target.costumeChangeId||'',
        costumePieceId:target.costumePieceId||'',
        imageType:fd.get('imageType'),
        caption:fd.get('caption'),
        filename:file.name,
        dataUrl:prepared.dataUrl
      },'Costume image uploaded.');
      modal.closeModal();
    }catch(error){BRM.toast(error.message,'error');button.disabled=false;button.textContent='Upload image';}
  });
}

async function updateChangeRun(select) {
  const field=select.dataset.runField;
  await mutateCostume('updateCostumeChangeRunStatus',{
    costumeChangeId:select.dataset.changeRun,
    [field]:select.value
  },'Run status updated.');
}

async function archiveCharacter(id){if(confirm('Archive this character?'))await mutateCostume('archiveCostumeCharacter',{characterId:id},'Character archived.');}
async function restoreCharacter(id){await mutateCostume('restoreCostumeCharacter',{characterId:id,status:'Not Started'},'Character restored.');}
async function deleteCharacter(id){const c=prompt('Type DELETE to permanently remove this character and connected costume data:','');if(c==='DELETE')await mutateCostume('deleteCostumeCharacterPermanently',{characterId:id,confirmation:c},'Character permanently deleted.');}
async function archivePiece(id){if(confirm('Archive this costume piece?'))await mutateCostume('archiveCostumePiece',{costumePieceId:id},'Piece archived.');}
async function restorePiece(id){await mutateCostume('restoreCostumePiece',{costumePieceId:id,status:'Not Started'},'Piece restored.');}
async function deletePiece(id){const c=prompt('Type DELETE to permanently remove this piece:','');if(c==='DELETE')await mutateCostume('deleteCostumePiecePermanently',{costumePieceId:id,confirmation:c},'Piece deleted.');}
async function resetCostumeRun(){if(confirm('Reset every costume preset and quick-change run check?'))await mutateCostume('resetCostumeChangeRun',{},'Run checks reset.');}
async function deleteCostumeImage(id){if(confirm('Remove this image?'))await mutateCostume('deleteCostumeImage',{imageId:id},'Image removed.');}

function costumeImageCacheName() {
  return `bedford-costume-images-v23-${CostumeState.data?.context?.userId || 'user'}`;
}
function costumeImageRequest(fileId){return new Request(`${location.origin}/__costume_image__/${encodeURIComponent(fileId)}`);}
async function cacheCostumeImage(fileId,dataUrl){
  const blob=await (await fetch(dataUrl)).blob();
  const url=URL.createObjectURL(blob);
  costumeImageUrls.set(fileId,url);
  if('caches'in window){
    try{const cache=await caches.open(costumeImageCacheName());await cache.put(costumeImageRequest(fileId),new Response(blob,{headers:{'Content-Type':blob.type||'image/jpeg'}}));}catch(error){}
  }
  return url;
}
async function costumeImageUrl(fileId){
  if(costumeImageUrls.has(fileId))return costumeImageUrls.get(fileId);
  if(costumeImageLoads.has(fileId))return costumeImageLoads.get(fileId);
  const request=(async()=>{
    if('caches'in window){
      try{const cache=await caches.open(costumeImageCacheName());const cached=await cache.match(costumeImageRequest(fileId));if(cached){const url=URL.createObjectURL(await cached.blob());costumeImageUrls.set(fileId,url);return url;}}catch(error){}
    }
    const result=await BRM.api('costumeImageData',{fileId},{noCache:true,forceNetwork:true});
    return cacheCostumeImage(fileId,result.dataUrl);
  })();
  costumeImageLoads.set(fileId,request);
  try{return await request;}finally{costumeImageLoads.delete(fileId);}
}
function hydrateCostumeImages(root=document){
  const load=async image=>{
    if(image.dataset.loaded==='true')return;
    image.dataset.loaded='true';
    try{
      image.src=await costumeImageUrl(image.dataset.costumeImage);
      image.hidden=false;
      image.parentElement?.querySelector('.costume-image-placeholder')?.remove();
    }catch(error){
      console.warn('Costume image failed:',error);
      image.hidden=true;
    }
  };
  const images=[...(root.querySelectorAll?.('[data-costume-image]')||[])];
  if(!('IntersectionObserver'in window))images.forEach(load);
  else{const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;observer.unobserve(entry.target);load(entry.target);}),{rootMargin:'180px 0px'});images.forEach(image=>observer.observe(image));}
}

async function compressCostumeImage(file){
  if(file.size>25*1024*1024)throw new Error('Choose an image smaller than 25 MB.');
  if(!/^image\/(?:jpeg|png|webp)$/i.test(file.type||''))throw new Error('Use a JPG, PNG, or WebP image.');
  if(/image\/hei[cf]/i.test(file.type||'')||/\.(heic|heif)$/i.test(file.name||''))throw new Error('Please convert HEIC/HEIF photos to JPG, PNG, or WebP first.');
  const image=await createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>null);
  if(!image)throw new Error('The picture could not be read. Use JPG, PNG, or WebP.');
  try{
    const max=1400;
    const scale=Math.min(1,max/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.width*scale));
    canvas.height=Math.max(1,Math.round(image.height*scale));
    canvas.getContext('2d',{alpha:false}).drawImage(image,0,0,canvas.width,canvas.height);
    let quality=.82,blob=null;
    for(let i=0;i<4;i+=1){
      blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Compression failed.')),'image/jpeg',quality));
      if(blob.size<=1500*1024)break;
      quality-=.12;
    }
    const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(blob);});
    return {dataUrl,sizeBytes:blob.size};
  }finally{image.close?.();}
}
