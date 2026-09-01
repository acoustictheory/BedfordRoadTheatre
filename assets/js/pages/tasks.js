document.addEventListener('DOMContentLoaded', () => BRM.initPrivatePage(async () => {
  const main = document.querySelector('#app-main');
  const isAdmin = BRM.isAdmin();
  let tasks = [];

  main.innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">${isAdmin ? 'Production oversight' : 'Your assignments'}</span>
        <h1>${isAdmin ? 'All tasks' : 'My tasks'}</h1>
        <p>${isAdmin ? 'Review current production assignments and update their progress.' : 'Keep track of the production work assigned to you and your departments.'}</p>
      </div>
    </div>
    <section class="panel">
      <div class="toolbar">
        <div class="search-wrap"><input class="search-input" data-task-search placeholder="Search tasks"></div>
        <div class="toolbar-group">
          <select class="search-input" data-task-status>
            <option value="">All statuses</option><option>Open</option><option>In Progress</option><option>Blocked</option><option>Completed</option>
          </select>
          <select class="search-input" data-task-priority>
            <option value="">All priorities</option><option>Urgent</option><option>Important</option><option>Normal</option>
          </select>
        </div>
      </div>
      <div data-task-list></div>
    </section>
    <div data-notes-panel></div>`;

  const list = main.querySelector('[data-task-list]');
  const search = main.querySelector('[data-task-search]');
  const status = main.querySelector('[data-task-status]');
  const priority = main.querySelector('[data-task-priority]');

  function render() {
    const query = search.value.trim().toLowerCase();
    const visible = tasks.filter(task => {
      const haystack = `${task.Title || ''} ${task.Description || ''} ${task.DepartmentName || ''}`.toLowerCase();
      return (!query || haystack.includes(query))
        && (!status.value || String(task.Status) === status.value)
        && (!priority.value || String(task.Priority) === priority.value);
    });

    list.innerHTML = visible.length ? `<div class="data-list">${visible.map(task => `
      <article class="data-card">
        <div class="data-card-main">
          <div class="item-meta"><span class="badge ${task.Priority === 'Urgent' ? 'badge-urgent' : task.Priority === 'Important' ? 'badge-important' : ''}">${BRM.escape(task.Priority || 'Normal')}</span><span class="badge">${BRM.escape(task.Status || 'Open')}</span></div>
          <h3>${BRM.escape(task.Title || 'Untitled task')}</h3>
          <p>${BRM.escape(task.Description || '')}</p>
          <small class="field-hint">${BRM.escape(task.DepartmentName || task.Department || '')}${task.DueDate ? ` · Due ${BRM.formatDate(task.DueDate)}` : ''}</small>
        </div>
        <div class="card-actions">
          <select class="search-input" data-task-update="${BRM.escape(task.TaskID)}" aria-label="Update ${BRM.escape(task.Title || 'task')} status">
            ${['Open', 'In Progress', 'Blocked', 'Completed'].map(value => `<option ${String(task.Status) === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
      </article>`).join('')}</div>` : BRM.empty('No tasks found', 'No assignments match the current filters.', '✓');

    list.querySelectorAll('[data-task-update]').forEach(select => select.addEventListener('change', async event => {
      const previous = tasks.find(task => String(task.TaskID) === event.currentTarget.dataset.taskUpdate)?.Status || 'Open';
      event.currentTarget.disabled = true;
      try {
        await BRM.api('updateTaskStatus', { taskId: event.currentTarget.dataset.taskUpdate, status: event.currentTarget.value }, { noCache: true });
        const task = tasks.find(item => String(item.TaskID) === event.currentTarget.dataset.taskUpdate);
        if (task) task.Status = event.currentTarget.value;
        BRM.toast('Task status updated.');
        render();
      } catch (error) {
        event.currentTarget.value = previous;
        event.currentTarget.disabled = false;
        BRM.toast(error.message || 'The task could not be updated.', 'error');
      }
    }));
  }

  [search, status, priority].forEach(control => control.addEventListener(control === search ? 'input' : 'change', render));
  BRM.loading(list, 'Loading tasks…');
  try {
    const result = await BRM.api('myTasks', { includeCompleted: true });
    tasks = result.data || [];
    render();
    await BRM.renderNotesPanel?.({ pageKey: 'tasks', title: isAdmin ? 'Production Task Notes' : 'Task Notes' });
  } catch (error) {
    list.innerHTML = `<div class="alert alert-error"><strong>Tasks could not be loaded.</strong><br>${BRM.escape(error.message || 'Unknown portal error')}</div>`;
  }
}));
