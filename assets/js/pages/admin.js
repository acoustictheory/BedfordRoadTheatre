const adminBool=value=>Boolean(
  value===true ||
  String(value||'').toLowerCase()==='true' ||
  String(value||'')==='1'
);

function generateBrowserTemporaryPassword(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes=new Uint32Array(16);
  crypto.getRandomValues(bytes);
  let password='Brm!';
  for(let i=0;i<14;i+=1) password+=alphabet[bytes[i]%alphabet.length];
  return password;
}

async function copyAdminText(text){
  try{
    await navigator.clipboard.writeText(text);
    BRM.toast('Copied to clipboard.');
  }catch(error){
    const area=document.createElement('textarea');
    area.value=text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    BRM.toast('Copied to clipboard.');
  }
}

function readAdminPhoto(file){
  if(!file||!file.size)return Promise.resolve('');
  if(file.size>10*1024*1024)return Promise.reject(new Error('Choose a profile photo smaller than 10 MB.'));
  if(!/^image\/(?:jpeg|png|webp)$/i.test(file.type||''))return Promise.reject(new Error('Use a JPG, PNG, or WebP profile photo.'));
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The profile photo could not be read.'));reader.readAsDataURL(file)});
}

document.addEventListener('DOMContentLoaded',()=>BRM.initPrivatePage(async()=>{
  if(!BRM.isAdmin()){location.href='dashboard.html';return}
  const main=document.querySelector('#app-main');BRM.loading(main,'Loading administration centre…');
  try{const data=await BRM.api('adminData');renderAdmin(main,data);const heading=main.querySelector('[data-tab-panel="users"] .section-heading');heading?.insertAdjacentHTML('beforeend','<button class="button button-primary" data-add-student>+ Add student</button>');main.querySelector('[data-add-student]')?.addEventListener('click',()=>openCreateStudent(data,()=>location.reload()))}catch(e){main.innerHTML=`<div class="alert alert-error">${BRM.escape(e.message)}</div>`}
}));

function renderAdmin(main,data){
  main.innerHTML=`<div class="page-head admin-page-head"><div><span class="eyebrow">◆ Full administrator access · admin.all active</span><h1>Administration centre</h1><p>Manage accounts, permissions, registration, annual productions, and protected system workflows.</p></div><div class="page-actions"><a class="button button-secondary" href="dashboard.html">← Admin Dashboard</a></div></div><section class="stat-grid"><div class="stat-card"><strong>${data.stats.activeUsers}</strong><span>Active users</span></div><div class="stat-card"><strong>${data.stats.journalEntries}</strong><span>Journal entries</span></div><div class="stat-card"><strong>${data.stats.openTasks}</strong><span>Open tasks</span></div><div class="stat-card"><strong>${data.stats.upcomingEvents}</strong><span>Upcoming events</span></div></section><section class="panel" style="margin-top:20px"><div class="tabs"><button class="tab-button active" data-tab="users">People & access</button><button class="tab-button" data-tab="requests">Department requests${(data.departmentRequests||[]).filter(r=>r.Status==='Pending').length?` <span class="badge badge-urgent">${(data.departmentRequests||[]).filter(r=>r.Status==='Pending').length}</span>`:''}</button><button class="tab-button" data-tab="codes">Registration codes</button><button class="tab-button" data-tab="productions">Productions & reset</button><button class="tab-button" data-tab="system">System</button></div><div data-tab-panel="users">${renderUsersTab(data)}</div><div class="hidden" data-tab-panel="requests">${renderDepartmentRequestsTab(data)}</div><div class="hidden" data-tab-panel="codes">${renderCodesTab(data)}</div><div class="hidden" data-tab-panel="productions">${renderProductionsTab(data)}</div><div class="hidden" data-tab-panel="system">${renderSystemTab()}</div></section>`;
  const activateTab=tabName=>{const valid=['users','requests','codes','productions','system'];const selected=valid.includes(tabName)?tabName:'users';main.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===selected));main.querySelectorAll('[data-tab-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.tabPanel!==selected));history.replaceState(null,'','#'+selected)};
  main.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  activateTab(location.hash.replace('#',''));
  main.querySelectorAll('[data-edit-user]').forEach(b=>b.addEventListener('click',()=>openUserAccess(data.users.find(u=>u.UserID===b.dataset.editUser),data,()=>location.reload())));
  main.querySelector('[data-add-student]')?.addEventListener('click',()=>openCreateStudent(data,()=>location.reload()));
  main.querySelectorAll('[data-approve-department-request]').forEach(button=>button.addEventListener('click',async()=>{
    const card=button.closest('[data-department-request-card]');
    const roleLabel=card.querySelector('[name="roleLabel"]')?.value||'Member';
    const original=button.textContent;
    button.disabled=true;
    button.textContent='Approving…';

    try{
      await BRM.api('reviewDepartmentRequest',{
        departmentRequestId:button.dataset.approveDepartmentRequest,
        decision:'Approved',
        roleLabel
      });
      BRM.toast('Department access approved.');
      location.reload();
    }catch(error){
      button.disabled=false;
      button.textContent=original;
      BRM.toast(error.message,'error');
    }
  }));

  main.querySelectorAll('[data-decline-department-request]').forEach(button=>button.addEventListener('click',async()=>{
    const reason=prompt('Optional note explaining the decision:','')??null;
    if(reason===null)return;

    const original=button.textContent;
    button.disabled=true;
    button.textContent='Declining…';

    try{
      await BRM.api('reviewDepartmentRequest',{
        departmentRequestId:button.dataset.declineDepartmentRequest,
        decision:'Declined',
        reviewNote:reason
      });
      BRM.toast('Department request declined.');
      location.reload();
    }catch(error){
      button.disabled=false;
      button.textContent=original;
      BRM.toast(error.message,'error');
    }
  }));
  main.querySelector('[data-new-code]')?.addEventListener('click',()=>openCodeModal(data,()=>location.reload()));
  main.querySelector('[data-new-production]')?.addEventListener('click',()=>openProductionModal(()=>location.reload()));
  main.querySelectorAll('[data-request-delete]').forEach(b=>b.addEventListener('click',()=>openDeleteRequest(data.productions.find(p=>p.ProductionID===b.dataset.requestDelete),()=>location.reload())));
  main.querySelectorAll('[data-approve-reset]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Approve this permanent deletion request? This cannot be undone.'))return;try{await BRM.api('approveProductionDeletion',{resetRequestId:b.dataset.approveReset});BRM.toast('Deletion approved and completed.');location.reload()}catch(e){BRM.toast(e.message,'error')}}));
}
function renderUsersTab(data){
  return `<div class="section-heading"><div><span class="eyebrow">Accounts, identities and permissions</span><h2>People</h2><p>Edit usernames, display names, email addresses, temporary passwords, departments, and permission groups for any account.</p></div></div><div class="toolbar"><div class="search-wrap"><input class="search-input" placeholder="Search people or usernames" oninput="filterAdminUsers(this.value)"></div></div><div class="table-wrap"><table><thead><tr><th>Person</th><th>Username</th><th>Departments</th><th>Access</th><th>Status</th><th></th></tr></thead><tbody data-admin-users>${data.users.map(u=>`<tr data-user-search="${BRM.escape(`${u.DisplayName||''} ${u.Username||''} ${u.Email||''}`.toLowerCase())}"><td><strong>${BRM.escape(u.DisplayName||u.Username)}</strong><br><span class="field-hint">${BRM.escape(u.Email||'No email')}</span>${(data.departmentRequests||[]).filter(r=>r.UserID===u.UserID&&r.Status==='Pending').length?`<br><a href="#requests" class="badge badge-important">${(data.departmentRequests||[]).filter(r=>r.UserID===u.UserID&&r.Status==='Pending').length} department request(s)</a>`:''}</td><td><code>${BRM.escape(u.Username)}</code>${adminBool(u.MustChangePassword)?'<br><span class="badge badge-warning">Password change required</span>':''}</td><td>${u.DepartmentIDs.map(id=>BRM.escape(data.departments.find(d=>d.DepartmentID===id)?.Name||'')).filter(Boolean).join(', ')||'—'}</td><td>${adminBool(u.IsFullAdmin)?'<span class="badge badge-urgent">Full Admin</span>':u.GroupIDs.map(id=>`<span class="tag">${BRM.escape(data.permissionGroups.find(g=>g.PermissionGroupID===id)?.GroupName||'')}</span>`).join(' ')||'Student'}</td><td><span class="badge">${BRM.escape(u.Status)}</span></td><td><button class="button button-secondary button-small" data-edit-user="${u.UserID}">Edit account</button></td></tr>`).join('')}</tbody></table></div>`;
}
function renderDepartmentRequestsTab(data){
  const all=data.departmentRequests||[];
  const pending=all.filter(request=>request.Status==='Pending');
  const history=all.filter(request=>request.Status!=='Pending').slice(0,30);

  return `
    <div class="section-heading">
      <div>
        <span class="eyebrow">Student-selected production areas</span>
        <h2>Department requests</h2>
        <p>Approve only the workspaces each student should access. You may also assign a more specific role label.</p>
      </div>
      <span class="badge ${pending.length?'badge-urgent':''}">${pending.length} pending</span>
    </div>

    ${pending.length
      ? `<div class="data-list">
          ${pending.map(request=>`
            <article class="data-card" data-department-request-card>
              <span class="avatar avatar-small">${BRM.escape(BRM.initials(request.DisplayName||request.Username))}</span>
              <div class="data-card-main">
                <div class="item-meta">
                  <span class="badge badge-important">Pending</span>
                  <span>${BRM.formatDateTime(request.RequestedAt)}</span>
                </div>
                <h3>${BRM.escape(request.DisplayName||request.Username)} → ${BRM.escape(request.DepartmentName)}</h3>
                <p>@${BRM.escape(request.Username||'')}</p>
                ${request.RequestNote?`<div class="panel-inset" style="margin-top:10px">${BRM.escape(request.RequestNote)}</div>`:''}
                <div class="field" style="margin-top:12px;max-width:360px">
                  <label>Approved role label</label>
                  <input name="roleLabel" value="${BRM.escape(request.RequestedRole||'Member')}" maxlength="120">
                  <span class="field-hint">Examples: Member, Lighting Operator, Props Crew, Assistant Stage Manager.</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="button button-primary button-small" data-approve-department-request="${request.DepartmentRequestID}">Approve</button>
                <button class="button button-danger button-small" data-decline-department-request="${request.DepartmentRequestID}">Decline</button>
                <button class="button button-secondary button-small" data-edit-user="${request.UserID}">Open account</button>
              </div>
            </article>
          `).join('')}
        </div>`
      : BRM.empty('No department requests waiting','New student selections will appear here for approval.','✓')}

    ${history.length
      ? `<div class="section-heading" style="margin-top:26px">
          <div>
            <span class="eyebrow">Recent decisions</span>
            <h2>Request history</h2>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Person</th><th>Department</th><th>Decision</th><th>Reviewed</th><th>Note</th></tr></thead>
            <tbody>
              ${history.map(request=>`
                <tr>
                  <td>${BRM.escape(request.DisplayName||request.Username)}</td>
                  <td>${BRM.escape(request.DepartmentName)}</td>
                  <td><span class="badge ${request.Status==='Approved'?'':'badge-urgent'}">${BRM.escape(request.Status)}</span></td>
                  <td>${request.ReviewedAt?BRM.formatDateTime(request.ReviewedAt):'—'}</td>
                  <td>${BRM.escape(request.ReviewNote||'—')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      : ''}
  `;
}

window.filterAdminUsers=function(q){document.querySelectorAll('[data-user-search]').forEach(r=>r.classList.toggle('hidden',!r.dataset.userSearch.includes(String(q).toLowerCase())))};
function renderCodesTab(data){return `<div class="section-heading"><div><span class="eyebrow">Controlled registration</span><h2>Registration codes</h2><p>Create codes that automatically assign a permission group and optional department.</p></div><button class="button button-primary" data-new-code>+ New code</button></div><div class="table-wrap"><table><thead><tr><th>Code</th><th>Purpose</th><th>Default access</th><th>Uses</th><th>Status</th></tr></thead><tbody>${data.registrationCodes.map(c=>`<tr><td><code>${BRM.escape(c.Code)}</code></td><td>${BRM.escape(c.Label)}</td><td>${BRM.escape(c.PermissionGroupName)}${c.DepartmentName?` · ${BRM.escape(c.DepartmentName)}`:''}</td><td>${c.Uses}/${c.MaxUses}</td><td><span class="badge">${BRM.escape(c.Status)}</span></td></tr>`).join('')}</tbody></table></div>`}
function renderProductionsTab(data){return `<div class="section-heading"><div><span class="eyebrow">Reusable annual platform</span><h2>Productions</h2><p>Start a new musical without rebuilding the website. Accounts and profiles can carry forward while production data remains separate.</p></div><button class="button button-primary" data-new-production>+ Start new production</button></div><div class="data-list">${data.productions.map(p=>`<article class="data-card"><span class="rating-pill">${p.Status==='Active'?'●':'○'}</span><div class="data-card-main"><div class="item-meta"><span class="badge">${BRM.escape(p.Status)}</span><span>${BRM.escape(p.SchoolYear)}</span></div><h3>${BRM.escape(p.Title)}</h3><p>${p.OpeningDate?`Opening ${BRM.formatDate(p.OpeningDate+'T12:00:00')}`:'Performance dates not set'}</p></div>${p.Status!=='Active'&&p.Status!=='Deleted'?`<button class="button button-danger button-small" data-request-delete="${p.ProductionID}">Request permanent deletion</button>`:''}</article>`).join('')}</div>${data.resetRequests.length?`<div class="alert alert-error" style="margin-top:20px"><strong>Pending deletion approvals</strong><div class="data-list" style="margin-top:12px">${data.resetRequests.map(r=>`<div class="data-card"><div class="data-card-main"><strong>${BRM.escape(data.productions.find(p=>p.ProductionID===r.ProductionID)?.Title||r.ProductionID)}</strong><p>Requested ${BRM.formatDateTime(r.RequestedAt)}. A different full administrator must approve.</p></div><button class="button button-danger button-small" data-approve-reset="${r.ResetRequestID}">Approve deletion</button></div>`).join('')}</div></div>`:''}`}
function renderSystemTab(){return `<div class="section-heading"><div><span class="eyebrow">Deployment and maintenance</span><h2>System tools</h2></div></div><div class="grid grid-2"><div class="panel-inset"><h3>Track synchronization</h3><p style="color:var(--muted)">Upload MP3s to the production’s Drive track folders, then open Apps Script and run <code>syncTracksFromDrive()</code>.</p></div><div class="panel-inset"><h3>Session cleanup</h3><p style="color:var(--muted)">Create a daily Apps Script trigger for <code>clearExpiredSessions()</code> to remove expired login sessions.</p></div><div class="panel-inset"><h3>Database and Drive</h3><p style="color:var(--muted)">The master spreadsheet and all generated folders are stored inside the universal root folder created during installation.</p></div><div class="panel-inset"><h3>Audit protection</h3><p style="color:var(--muted)">Deleted posts remain soft-deleted with author, administrator, reason, and time in the AuditLog and NoteHistory sheets.</p></div></div>`}
function openCreateStudent(data,onSaved){
  const generated=generateBrowserTemporaryPassword();
  const modal=BRM.openModal(`
    <span class="eyebrow">Administrator-created account</span><h2>Add student</h2>
    <p style="color:var(--muted)">Create the student login, profile, department access, and initial permissions in one step.</p>
    <form data-create-student><div class="form-grid">
      <div class="field"><label>First name</label><input name="firstName" required maxlength="80"></div>
      <div class="field"><label>Last name</label><input name="lastName" required maxlength="80"></div>
      <div class="field"><label>Display name</label><input name="displayName" maxlength="120" placeholder="Defaults to first and last name"></div>
      <div class="field"><label>Username</label><input name="username" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._-]+"></div>
      <div class="field span-2"><label>Email</label><input name="email" type="email"></div>
      <div class="field"><label>Pronouns</label><input name="pronouns" maxlength="80"></div>
      <div class="field"><label>Grade</label><input name="grade" maxlength="40"></div>
      <div class="field"><label>Phone</label><input name="phone" type="tel" maxlength="40"></div>
      <div class="field"><label>Emergency contact</label><input name="emergencyContact" maxlength="160"></div>
      <div class="field"><label>Profile visibility</label><select name="visibility"><option>Company</option><option>Private</option></select></div>
      <div class="field"><label>Department role label</label><input name="roleLabel" value="Member" maxlength="120"></div>
      <div class="field span-2"><label>Bio</label><textarea name="bio" maxlength="1000"></textarea></div>
      <div class="field span-2"><label>Profile photo</label><input name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp"><span class="field-hint">Optional JPG, PNG, or WebP up to 10 MB.</span></div>
      <div class="field span-2"><label>Departments</label><div class="grid grid-2">${data.departments.map(d=>`<label class="checkbox-row"><input type="checkbox" name="departmentIds" value="${d.DepartmentID}"> ${BRM.escape(d.Name)}</label>`).join('')}</div></div>
      <div class="field span-2"><label>Permission groups</label><div class="grid grid-2">${data.permissionGroups.map(g=>`<label class="checkbox-row"><input type="checkbox" name="groupIds" value="${g.PermissionGroupID}"> ${BRM.escape(g.GroupName)}</label>`).join('')||'<span class="field-hint">No permission groups configured; the account will be a standard student.</span>'}</div></div>
      <div class="field span-2"><label>Temporary password</label><div style="display:flex;gap:8px"><input name="temporaryPassword" value="${BRM.escape(generated)}" minlength="8" required style="flex:1"><button type="button" class="button button-secondary button-small" data-create-generate>Generate</button></div></div>
      <label class="checkbox-row span-2"><input name="requirePasswordChange" type="checkbox" checked> Require password change at first login</label>
    </div><div class="form-actions"><button class="button button-primary" type="submit">Create student</button></div></form>`,{wide:true});
  const form=modal.querySelector('[data-create-student]');
  modal.querySelector('[data-create-generate]').onclick=()=>{form.elements.temporaryPassword.value=generateBrowserTemporaryPassword()};
  form.addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter,original=button.textContent;button.disabled=true;button.textContent='Creating…';try{const values=new FormData(form),photo=await readAdminPhoto(values.get('profilePhoto'));const result=await BRM.api('createManagedUser',{firstName:values.get('firstName'),lastName:values.get('lastName'),displayName:values.get('displayName'),username:values.get('username'),email:values.get('email'),pronouns:values.get('pronouns'),grade:values.get('grade'),phone:values.get('phone'),emergencyContact:values.get('emergencyContact'),visibility:values.get('visibility'),roleLabel:values.get('roleLabel'),bio:values.get('bio'),departmentIds:values.getAll('departmentIds'),groupIds:values.getAll('groupIds'),temporaryPassword:values.get('temporaryPassword'),requirePasswordChange:values.get('requirePasswordChange')==='on',profilePhotoData:photo,profilePhotoName:values.get('profilePhoto')?.name||''});modal.closeModal();const credentials=BRM.openModal(`<span class="eyebrow">Student created</span><h2>${BRM.escape(result.displayName)}</h2><div class="alert alert-info">Copy these credentials now and send them privately.</div><div class="panel-inset"><p><strong>Username:</strong> ${BRM.escape(result.username)}</p><p><strong>Temporary password:</strong> <code>${BRM.escape(result.issuedTemporaryPassword)}</code></p></div><div class="form-actions"><button class="button button-primary" data-copy-new>Copy credentials</button><button class="button button-secondary" data-close-new>Done</button></div>`);credentials.querySelector('[data-copy-new]').onclick=()=>copyAdminText(`Bedford Road Musical\nUsername: ${result.username}\nTemporary password: ${result.issuedTemporaryPassword}`);credentials.querySelector('[data-close-new]').onclick=()=>{credentials.closeModal();onSaved()};}catch(error){button.disabled=false;button.textContent=original;BRM.toast(error.message,'error')}});
}

function openUserAccess(user,data,onSaved){
  const modal=BRM.openModal(`
    <span class="eyebrow">Full administrator account management</span>
    <h2>Edit ${BRM.escape(user.DisplayName||user.Username)}</h2>
    <p style="color:var(--muted)">Update this person’s login, profile identity, password, departments, and permissions.</p>

    <form data-form>
      <div class="form-grid">
        <div class="field">
          <label>Display name</label>
          <input name="displayName" value="${BRM.escape(user.DisplayName||user.Username)}" required maxlength="120">
        </div>

        <div class="field">
          <label>Username</label>
          <input name="username" value="${BRM.escape(user.Username)}" required minlength="3" maxlength="40" pattern="[A-Za-z0-9._-]+">
          <span class="field-hint">Letters, numbers, periods, underscores, and hyphens.</span>
        </div>

        <div class="field span-2">
          <label>Email address</label>
          <input name="email" type="email" value="${BRM.escape(user.Email||'')}" placeholder="Optional">
        </div>

        <div class="field"><label>First name</label><input name="firstName" value="${BRM.escape(user.FirstName||'')}" maxlength="80"></div>
        <div class="field"><label>Last name</label><input name="lastName" value="${BRM.escape(user.LastName||'')}" maxlength="80"></div>
        <div class="field"><label>Pronouns</label><input name="pronouns" value="${BRM.escape(user.Pronouns||'')}" maxlength="80"></div>
        <div class="field"><label>Grade</label><input name="grade" value="${BRM.escape(user.Grade||'')}" maxlength="40"></div>
        <div class="field"><label>Phone</label><input name="phone" type="tel" value="${BRM.escape(user.Phone||'')}" maxlength="40"></div>
        <div class="field"><label>Emergency contact</label><input name="emergencyContact" value="${BRM.escape(user.EmergencyContact||'')}" maxlength="160"></div>
        <div class="field"><label>Profile visibility</label><select name="visibility"><option ${user.Visibility==='Company'?'selected':''}>Company</option><option ${user.Visibility==='Private'?'selected':''}>Private</option></select></div>
        <div class="field"><label>Department role label</label><input name="roleLabel" value="${BRM.escape(user.RoleLabel||'Member')}" maxlength="120"></div>
        <div class="field span-2"><label>Bio</label><textarea name="bio" maxlength="1000">${BRM.escape(user.Bio||'')}</textarea></div>
        <div class="field span-2"><label>Replace profile photo</label><input name="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp"><span class="field-hint">Leave blank to keep the current photo.</span></div>
        ${user.PhotoURL?'<label class="checkbox-row span-2"><input name="removeProfilePhoto" type="checkbox"> Remove current profile photo</label>':''}

        <div class="field">
          <label>Account status</label>
          <select name="status">
            <option ${user.Status==='Active'?'selected':''}>Active</option>
            <option ${user.Status==='Disabled'?'selected':''}>Disabled</option>
          </select>
        </div>

        <label class="checkbox-row">
          <input name="isFullAdmin" type="checkbox" ${adminBool(user.IsFullAdmin)?'checked':''}>
          Full administrator
        </label>

        <div class="field span-2">
          <label>Temporary password</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input name="temporaryPassword" type="text" minlength="8" autocomplete="off" placeholder="Leave blank to keep the current password" style="flex:1">
            <button class="button button-secondary button-small" type="button" data-generate-password>Generate</button>
          </div>
          <span class="field-hint">Setting a password signs this person out of all devices.</span>
        </div>

        <label class="checkbox-row span-2">
          <input name="requirePasswordChange" type="checkbox" ${adminBool(user.MustChangePassword)?'checked':''}>
          Require a password change at the next login
        </label>

        <div class="field span-2">
          <label>Departments</label>
          <div class="grid grid-2">
            ${data.departments.map(d=>`<label class="checkbox-row"><input type="checkbox" name="departmentIds" value="${d.DepartmentID}" ${user.DepartmentIDs.includes(d.DepartmentID)?'checked':''}> ${BRM.escape(d.Name)}</label>`).join('')}
          </div>
        </div>

        <div class="field span-2">
          <label>Permission groups</label>
          <div class="grid grid-2">
            ${data.permissionGroups.map(g=>`<label class="checkbox-row"><input type="checkbox" name="groupIds" value="${g.PermissionGroupID}" ${user.GroupIDs.includes(g.PermissionGroupID)?'checked':''}> ${BRM.escape(g.GroupName)}</label>`).join('')}
          </div>
        </div>
      </div>

      <div class="alert alert-info" style="margin-top:18px">
        Changing a username or password invalidates that person’s existing sessions. Their journals, posts, tasks, profile, and department history remain connected through their permanent User ID.
      </div>

      <div class="form-actions">
        ${!adminBool(user.IsFullAdmin)&&String(user.UserID)!==String(BRM.context?.userId)?'<button class="button button-danger" type="button" data-delete-student>Delete student</button>':''}
        <button class="button button-primary" type="submit">Save account</button>
      </div>
    </form>
  `,{wide:true});

  const form=modal.querySelector('[data-form]');
  const passwordInput=form.querySelector('[name="temporaryPassword"]');
  const requireChange=form.querySelector('[name="requirePasswordChange"]');

  modal.querySelector('[data-generate-password]').addEventListener('click',()=>{
    passwordInput.value=generateBrowserTemporaryPassword();
    requireChange.checked=true;
    passwordInput.focus();
    passwordInput.select();
  });

  modal.querySelector('[data-delete-student]')?.addEventListener('click',()=>{
    const confirmation=BRM.openModal(`
      <span class="eyebrow">Permanent account deletion</span>
      <h2>Delete ${BRM.escape(user.DisplayName||user.Username)}?</h2>
      <div class="alert alert-error">This permanently removes the student account, profile, active sessions, and department requests. Their submitted journals, notes, and production history remain in the audit record.</div>
      <div class="field" style="margin-top:16px"><label>Type the username <strong>${BRM.escape(user.Username)}</strong></label><input data-confirm-username autocomplete="off"></div>
      <div class="form-actions"><button class="button button-secondary" type="button" data-cancel-delete>Cancel</button><button class="button button-danger" type="button" data-confirm-delete>Delete student permanently</button></div>`);
    confirmation.querySelector('[data-cancel-delete]').addEventListener('click',()=>confirmation.closeModal());
    confirmation.querySelector('[data-confirm-delete]').addEventListener('click',async event=>{
      const button=event.currentTarget,confirmUsername=confirmation.querySelector('[data-confirm-username]').value.trim();
      button.disabled=true;button.textContent='Deleting…';
      try{await BRM.api('deleteManagedUser',{userId:user.UserID,confirmUsername});confirmation.closeModal();modal.closeModal();BRM.toast('Student account deleted.');onSaved();}
      catch(error){button.disabled=false;button.textContent='Delete student permanently';BRM.toast(error.message,'error');}
    });
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();

    const submitButton=event.submitter||form.querySelector('button[type="submit"]');
    const originalLabel=submitButton.textContent;
    submitButton.disabled=true;
    submitButton.textContent='Saving…';

    const values=new FormData(form);
    const temporaryPassword=String(values.get('temporaryPassword')||'').trim();

    try{
      const profilePhotoData=await readAdminPhoto(values.get('profilePhoto'));
      const result=await BRM.api('saveManagedUser',{
        userId:user.UserID,
        displayName:values.get('displayName'),
        username:values.get('username'),
        email:values.get('email'),
        firstName:values.get('firstName'),
        lastName:values.get('lastName'),
        pronouns:values.get('pronouns'),
        grade:values.get('grade'),
        phone:values.get('phone'),
        emergencyContact:values.get('emergencyContact'),
        visibility:values.get('visibility'),
        roleLabel:values.get('roleLabel'),
        bio:values.get('bio'),
        profilePhotoData,
        profilePhotoName:values.get('profilePhoto')?.name||'',
        removeProfilePhoto:values.get('removeProfilePhoto')==='on',
        status:values.get('status'),
        isFullAdmin:values.get('isFullAdmin')==='on',
        mustChangePassword:values.get('requirePasswordChange')==='on',
        passwordMode:temporaryPassword?'custom':'unchanged',
        temporaryPassword,
        requirePasswordChange:values.get('requirePasswordChange')==='on',
        departmentIds:values.getAll('departmentIds'),
        groupIds:values.getAll('groupIds')
      });

      modal.closeModal();

      if(result.issuedTemporaryPassword){
        const credentialText=`Bedford Road Musical\nUsername: ${result.username}\nTemporary password: ${result.issuedTemporaryPassword}`;

        const credentials=BRM.openModal(`
          <span class="eyebrow">Temporary credentials created</span>
          <h2>${BRM.escape(result.displayName)}</h2>
          <div class="alert alert-info">This temporary password is shown only now. Send it privately to the account holder.</div>
          <div class="panel-inset" style="margin-top:16px">
            <div class="field"><label>Username</label><input readonly value="${BRM.escape(result.username)}"></div>
            <div class="field" style="margin-top:12px"><label>Temporary password</label><input readonly value="${BRM.escape(result.issuedTemporaryPassword)}"></div>
          </div>
          <div class="form-actions">
            <button class="button button-primary" type="button" data-copy-credentials>Copy credentials</button>
            <button class="button button-secondary" type="button" data-done>Done</button>
          </div>
        `);

        credentials.querySelector('[data-copy-credentials]').addEventListener('click',()=>copyAdminText(credentialText));
        credentials.querySelector('[data-done]').addEventListener('click',()=>{
          credentials.closeModal();
          if(result.editedCurrentUser && (result.usernameChanged||result.passwordWasReset)){
            BRM.clearSession();
            location.href='login.html';
          }else{
            onSaved();
          }
        });
      }else if(result.editedCurrentUser && result.usernameChanged){
        BRM.toast('Your username was changed. Sign in again with the new username.');
        BRM.clearSession();
        setTimeout(()=>{location.href='login.html'},700);
      }else{
        BRM.toast('Account updated.');
        onSaved();
      }
    }catch(error){
      BRM.toast(error.message,'error');
      submitButton.disabled=false;
      submitButton.textContent=originalLabel;
    }
  });
}
function openCodeModal(data,onSaved){const modal=BRM.openModal(`<span class="eyebrow">Registration access</span><h2>Create registration code</h2><form data-form><div class="form-grid"><div class="field"><label>Code</label><input name="code" required minlength="6"></div><div class="field"><label>Label</label><input name="label" required></div><div class="field"><label>Permission group</label><select name="permissionGroupName">${data.permissionGroups.map(g=>`<option>${BRM.escape(g.GroupName)}</option>`).join('')}</select></div><div class="field"><label>Default department</label><select name="departmentName"><option value="">None</option>${data.departments.map(d=>`<option>${BRM.escape(d.Name)}</option>`).join('')}</select></div><div class="field"><label>Maximum uses</label><input name="maxUses" type="number" value="250" min="1"></div><div class="field"><label>Expiry date (optional)</label><input name="expiresAt" type="date"></div></div><div class="form-actions"><button class="button button-primary">Create code</button></div></form>`);modal.querySelector('[data-form]').addEventListener('submit',async e=>{e.preventDefault();try{await BRM.api('createRegistrationCode',Object.fromEntries(new FormData(e.currentTarget)));BRM.toast('Registration code created.');modal.closeModal();onSaved()}catch(error){BRM.toast(error.message,'error')}})}
function openProductionModal(onSaved){const modal=BRM.openModal(`<span class="eyebrow">Annual production setup</span><h2>Start a new musical</h2><div class="alert alert-info">The current production will be archived. Accounts and profile pictures can remain, while new production-specific schedules, journals, notes, tracks, and department data begin empty.</div><form data-form><div class="form-grid"><div class="field span-2"><label>Musical title</label><input name="title" required></div><div class="field"><label>Short title</label><input name="shortTitle"></div><div class="field"><label>School year</label><input name="schoolYear" placeholder="2027-2028" required></div><div class="field"><label>Opening date</label><input name="openingDate" type="date"></div><div class="field"><label>Closing date</label><input name="closingDate" type="date"></div><div class="field span-2"><label>Default theme</label><select name="defaultTheme">${BRM_CONFIG.THEMES.map(t=>`<option value="${t.id}">${BRM.escape(t.name)}</option>`).join('')}</select></div><label class="checkbox-row span-2"><input name="carryAccounts" type="checkbox" checked> Carry active accounts and profile pictures into the new production</label></div><div class="form-actions"><button class="button button-primary">Create production workspace</button></div></form>`,{wide:true});modal.querySelector('[data-form]').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(!confirm('Archive the current production and activate this new one?'))return;try{await BRM.api('startNewProduction',{...Object.fromEntries(f),carryAccounts:f.get('carryAccounts')==='on',archiveCurrent:true});BRM.toast('New production created. Sign in again to refresh access.');modal.closeModal();setTimeout(()=>{BRM.clearSession();location.href='login.html'},1000)}catch(error){BRM.toast(error.message,'error')}})}
function openDeleteRequest(production,onSaved){const modal=BRM.openModal(`<span class="eyebrow">Protected permanent reset</span><h2>Request deletion of ${BRM.escape(production.Title)}</h2><div class="alert alert-error">This removes production-specific spreadsheet rows and can trash the production Drive folder. A different full administrator must approve it.</div><form data-form><div class="field"><label>Type the exact production title</label><input name="confirmTitle" required></div><label class="checkbox-row"><input name="deleteDriveFolder" type="checkbox" checked> Trash the production Drive folder</label><div class="form-actions"><button class="button button-danger">Create deletion request</button></div></form>`);modal.querySelector('[data-form]').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await BRM.api('requestProductionDeletion',{productionId:production.ProductionID,confirmTitle:f.get('confirmTitle'),deleteDriveFolder:f.get('deleteDriveFolder')==='on'});BRM.toast('Deletion request created. A second admin must approve.');modal.closeModal();onSaved()}catch(error){BRM.toast(error.message,'error')}})}
