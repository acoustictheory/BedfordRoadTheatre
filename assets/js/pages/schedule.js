document.addEventListener('DOMContentLoaded', () => BRM.initPrivatePage(async () => {
  const main = document.querySelector('#app-main');
  main.innerHTML = `<div class="page-head"><div><span class="eyebrow">Personalized production calendar</span><h1>Schedule & calls</h1><p>You see events assigned to you, your departments, or the full company.</p></div><div class="page-actions">${BRM.hasPermission('event.manage') ? '<button class="button button-primary" data-new-event>+ Add event</button>' : ''}</div></div><section class="panel"><div class="toolbar"><div class="search-wrap"><input class="search-input" data-event-search placeholder="Search calls, locations, or details"></div><div class="toolbar-group"><select class="search-input" data-event-type><option value="">All event types</option><option>Rehearsal</option><option>Music</option><option>Costume</option><option>Work Session</option><option>Performance</option><option>Deadline</option></select></div></div><div data-schedule-list></div></section><div data-notes-panel></div>`;
  let events = [];
  const list = main.querySelector('[data-schedule-list]');
  const load = async () => {
    BRM.loading(list, 'Loading your schedule…');
    try { const result = await BRM.api('schedule'); events = result.data || []; render(); }
    catch (error) { list.innerHTML = `<div class="alert alert-error">${BRM.escape(error.message)}</div>`; }
  };
  const render = () => {
    const q = main.querySelector('[data-event-search]').value.toLowerCase();
    const type = main.querySelector('[data-event-type]').value;
    const filtered = events.filter(e => (!q || `${e.Title} ${e.Location} ${e.Description}`.toLowerCase().includes(q)) && (!type || e.EventType === type));
    if (!filtered.length) { list.innerHTML = BRM.empty('No events found', 'Try a different search or check back after the schedule is updated.', '◷'); return; }
    const groups = {};
    filtered.forEach(e => { const day = String(e.StartAt).slice(0,10); (groups[day] ||= []).push(e); });
    list.innerHTML = Object.keys(groups).sort().map(day => `<div style="margin-bottom:28px"><div class="section-heading"><div><span class="eyebrow">${new Intl.DateTimeFormat('en-CA',{weekday:'long',timeZone:'America/Regina'}).format(new Date(day+'T12:00:00'))}</span><h2>${BRM.formatDate(day+'T12:00:00')}</h2></div></div><div class="data-list">${groups[day].map(e => `<article class="data-card"><span class="rating-pill">${new Intl.DateTimeFormat('en-CA',{hour:'numeric',timeZone:'America/Regina'}).format(new Date(e.StartAt)).replace(/\s/g,'')}</span><div class="data-card-main"><div class="item-meta"><span class="badge">${BRM.escape(e.EventType)}</span><span>${BRM.formatDateTime(e.StartAt)} – ${new Intl.DateTimeFormat('en-CA',{timeStyle:'short',timeZone:'America/Regina'}).format(new Date(e.EndAt))}</span></div><h3>${BRM.escape(e.Title)}</h3><p>${BRM.escape(e.Description || '')}</p><div class="item-meta">${e.Location ? `<span>⌖ ${BRM.escape(e.Location)}</span>` : ''}${e.WhatToBring ? `<span>Bring: ${BRM.escape(e.WhatToBring)}</span>` : ''}</div></div></article>`).join('')}</div></div>`).join('');
  };
  main.querySelector('[data-event-search]').addEventListener('input', render);
  main.querySelector('[data-event-type]').addEventListener('change', render);
  main.querySelector('[data-new-event]')?.addEventListener('click', () => openEventModal(load));
  await load();
  await BRM.renderNotesPanel({ pageKey:'schedule', title:'Schedule Notes' });
}));

function openEventModal(onSaved) {
  const modal = BRM.openModal(`<span class="eyebrow">Stage-management tool</span><h2>Add a production event</h2><form data-event-form><div class="form-grid"><div class="field span-2"><label>Title</label><input name="title" required></div><div class="field"><label>Event type</label><select name="eventType"><option>Rehearsal</option><option>Music</option><option>Costume</option><option>Work Session</option><option>Performance</option><option>Deadline</option></select></div><div class="field"><label>Location</label><input name="location"></div><div class="field"><label>Start</label><input name="startAt" type="datetime-local" required></div><div class="field"><label>End</label><input name="endAt" type="datetime-local" required></div><div class="field span-2"><label>Description</label><textarea name="description"></textarea></div><div class="field span-2"><label>What to bring</label><input name="whatToBring"></div></div><div class="form-actions"><button class="button button-primary" type="submit">Publish event</button></div></form>`);
  modal.querySelector('[data-event-form]').addEventListener('submit', async event => {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    try { await BRM.api('saveEvent', { ...data, startAt:new Date(data.startAt).toISOString(), endAt:new Date(data.endAt).toISOString(), audienceUserIds:[], audienceDepartmentIds:[] }); BRM.toast('Event published.'); modal.closeModal(); onSaved(); }
    catch (error) { BRM.toast(error.message, 'error'); }
  });
}
