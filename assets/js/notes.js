window.BRM = window.BRM || {};
(function (BRM) {
  BRM.renderNotesPanel = async function ({ pageKey, relatedId = '', departmentId = '', title = 'Page Notes' }) {
    const host = document.querySelector('[data-notes-panel]');
    if (!host) return;
    host.innerHTML = `<section class="panel notes-panel"><div class="section-heading"><div><span class="eyebrow">Accountable discussion</span><h2>${BRM.escape(title)}</h2><p>Posts show the author’s account. Students cannot delete posts.</p></div></div><div data-notes-list></div><form class="note-compose" data-note-form><textarea name="content" rows="3" maxlength="3000" placeholder="Add a useful update, question, or observation…" required></textarea><div class="form-actions"><span class="field-hint">Your name and time will be recorded automatically.</span><button class="button button-primary" type="submit">Post note</button></div></form></section>`;
    const list = host.querySelector('[data-notes-list]');
    const load = async () => {
      BRM.loading(list, 'Loading notes…');
      try {
        const result = await BRM.api('pageNotes', { pageKey, relatedId, departmentId });
        const notes = result.data || result;
        list.innerHTML = notes.length ? `<div class="notes-list">${notes.map(note => `
          <article class="note ${note.Status === 'Deleted' ? 'note-deleted' : ''}">
            ${BRM.avatar(note.AuthorName, note.AuthorPhotoURL, 'small')}
            <div class="note-body"><div class="note-meta"><strong>${BRM.escape(note.AuthorName)}</strong><span>${BRM.formatDateTime(note.CreatedAt)}</span>${note.UpdatedAt !== note.CreatedAt ? '<span>edited</span>' : ''}</div><p>${BRM.escape(note.Content)}</p></div>
            ${BRM.isAdmin() ? `<button class="icon-button danger" data-delete-note="${note.NoteID}" title="Delete note">×</button>` : ''}
          </article>`).join('')}</div>` : BRM.empty('No notes yet', 'Start the discussion with a useful production update.', '✎');
        list.querySelectorAll('[data-delete-note]').forEach(btn => btn.addEventListener('click', async () => {
          const reason = prompt('Reason for deleting this post:');
          if (reason === null) return;
          try { await BRM.api('deletePageNote', { noteId: btn.dataset.deleteNote, reason }); BRM.toast('Post removed and retained in the audit history.'); load(); }
          catch (error) { BRM.toast(error.message, 'error'); }
        }));
      } catch (error) { list.innerHTML = `<div class="alert alert-error">${BRM.escape(error.message)}</div>`; }
    };
    host.querySelector('[data-note-form]').addEventListener('submit', async event => {
      event.preventDefault();
      const content = new FormData(event.currentTarget).get('content');
      try { await BRM.api('createPageNote', { pageKey, relatedId, departmentId, content, visibility: departmentId ? 'Department' : 'Production' }); event.currentTarget.reset(); BRM.toast('Note posted.'); load(); }
      catch (error) { BRM.toast(error.message, 'error'); }
    });
    await load();
  };
})(window.BRM);
