let announcementRows = [];
const annBool = (value) =>
  value === true || String(value).toUpperCase() === "TRUE";
const localDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value),
    pad = (n) => String(n).padStart(2, "0");
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function announcementCard(row) {
  const required = annBool(row.AcknowledgementRequired),
    ack = annBool(row.IsAcknowledged),
    read = annBool(row.IsRead);
  return `<article class="announcement-card ${String(row.Priority).toLowerCase()} ${read ? "" : "unread"}"><div class="announcement-meta"><span class="badge ${row.Priority === "Urgent" ? "badge-urgent" : row.Priority === "Important" ? "badge-important" : ""}">${row.Priority === "Urgent" ? "⚠ " : ""}${BRM.escape(row.Priority)}</span>${annBool(row.Pinned) ? '<span class="badge">Pinned</span>' : ""}${!read ? '<span class="badge badge-urgent">New</span>' : ""}${ack ? '<span class="badge">✓ Acknowledged</span>' : ""}<span>${BRM.formatDateTime(row.CreatedAt)}</span></div><h2 style="font-size:1.35rem;margin:10px 0">${BRM.escape(row.Title)}</h2><p style="white-space:pre-wrap;color:var(--muted)">${BRM.escape(row.Body)}</p><div class="announcement-structured">${row.DeadlineAt ? `<span>⏳ Deadline: ${BRM.formatDateTime(row.DeadlineAt)}</span>` : ""}${row.Location ? `<span>⌖ ${BRM.escape(row.Location)}</span>` : ""}</div><div class="announcement-action-row">${row.ActionURL ? `<a class="button button-primary button-small" href="${BRM.escape(row.ActionURL)}" target="_blank" rel="noopener">${BRM.escape(row.ActionLabel || "Open link")}</a>` : ""}${required && !ack ? `<button class="button button-primary button-small" data-ack="${row.AnnouncementID}">I have read this — acknowledge</button>` : !read ? `<button class="button button-secondary button-small" data-read="${row.AnnouncementID}">Mark as read</button>` : ""}${BRM.hasPermission("announcement.manage") ? `<button class="button button-secondary button-small" data-report="${row.AnnouncementID}">Delivery report</button><button class="button button-ghost button-small" data-edit="${row.AnnouncementID}">Edit</button><button class="button button-ghost button-small" data-archive="${row.AnnouncementID}">Archive</button>` : ""}${BRM.isAdmin() ? `<button class="button button-danger button-small" data-delete="${row.AnnouncementID}">Delete</button>` : ""}</div><div class="announcement-meta" style="margin-top:12px">Posted by ${BRM.escape(row.AuthorName || "Production Team")}${ack && row.AcknowledgedAt ? ` · acknowledged ${BRM.formatDateTime(row.AcknowledgedAt)}` : ""}</div></article>`;
}
function bindActions(host, reload) {
  host.querySelectorAll("[data-ack]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await BRM.api("acknowledgeAnnouncement", {
            announcementId: b.dataset.ack,
          });
          BRM.toast("Acknowledgement recorded.");
          await reload();
          BRM.refreshAnnouncementBadge();
        } catch (e) {
          BRM.toast(e.message, "error");
        }
      }),
  );
  host.querySelectorAll("[data-read]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await BRM.api("markAnnouncementRead", {
            announcementId: b.dataset.read,
          });
          await reload();
          BRM.refreshAnnouncementBadge();
        } catch (e) {
          BRM.toast(e.message, "error");
        }
      }),
  );
  host.querySelectorAll("[data-edit]").forEach(
    (b) =>
      (b.onclick = () =>
        openAnnouncementModal(
          reload,
          announcementRows.find((row) => row.AnnouncementID === b.dataset.edit),
        )),
  );
  host
    .querySelectorAll("[data-report]")
    .forEach((b) => (b.onclick = () => openDeliveryReport(b.dataset.report)));
  host.querySelectorAll("[data-archive]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await BRM.api("archiveAnnouncement", {
            announcementId: b.dataset.archive,
          });
          BRM.toast("Announcement archived.");
          reload();
        } catch (e) {
          BRM.toast(e.message, "error");
        }
      }),
  );
  host.querySelectorAll("[data-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        const reason = prompt("Reason for deletion:");
        if (reason === null) return;
        try {
          await BRM.api("deleteAnnouncement", {
            announcementId: b.dataset.delete,
            reason,
          });
          BRM.toast("Announcement deleted.");
          reload();
        } catch (e) {
          BRM.toast(e.message, "error");
        }
      }),
  );
}
document.addEventListener("DOMContentLoaded", () =>
  BRM.initPrivatePage(async () => {
    const main = document.querySelector("#app-main");
    main.innerHTML = `<div class="page-head"><div><span class="eyebrow">Production communication</span><h1>Announcements</h1><p>New and required updates stay visible until you read or acknowledge them.</p></div><div class="page-actions">${BRM.hasPermission("announcement.manage") ? '<button class="button button-primary" data-new-announcement>+ New announcement</button>' : ""}</div></div><section class="panel"><div class="toolbar"><input class="search-input" data-search placeholder="Search announcements"><div class="toolbar-group"><select class="search-input" data-state><option value="">All announcements</option><option value="unread">Unread</option><option value="required">Acknowledgement required</option></select><select class="search-input" data-priority><option value="">All priorities</option><option>Urgent</option><option>Important</option><option>Normal</option></select></div></div><div data-announcements></div></section><div data-notes-panel></div>`;
    const host = main.querySelector("[data-announcements]");
    const render = () => {
      const q = main.querySelector("[data-search]").value.toLowerCase(),
        priority = main.querySelector("[data-priority]").value,
        state = main.querySelector("[data-state]").value;
      const rows = announcementRows.filter(
        (row) =>
          (!q || `${row.Title} ${row.Body}`.toLowerCase().includes(q)) &&
          (!priority || row.Priority === priority) &&
          (!state ||
            (state === "unread" && !annBool(row.IsRead)) ||
            (state === "required" &&
              annBool(row.AcknowledgementRequired) &&
              !annBool(row.IsAcknowledged))),
      );
      host.innerHTML = rows.length
        ? `<div class="data-list">${rows.map(announcementCard).join("")}</div>`
        : BRM.empty(
            "No announcements found",
            "There are no posts matching this view.",
            "!",
          );
      bindActions(host, load);
    };
    const load = async () => {
      BRM.loading(host);
      try {
        const result = await BRM.api(
          "announcements",
          {},
          { noCache: true, forceNetwork: true },
        );
        announcementRows = result.data || [];
        render();
        const unread = announcementRows.filter((x) => !annBool(x.IsRead));
        BRM.setAnnouncementBadge(
          unread.length,
          unread.filter((x) => x.Priority === "Urgent").length,
        );
      } catch (error) {
        host.innerHTML = `<div class="alert alert-error">${BRM.escape(error.message)}</div>`;
      }
    };
    main.querySelector("[data-search]").oninput = render;
    main.querySelector("[data-priority]").onchange = render;
    main.querySelector("[data-state]").onchange = render;
    main
      .querySelector("[data-new-announcement]")
      ?.addEventListener("click", () => openAnnouncementModal(load));
    await load();
    await BRM.renderNotesPanel({
      pageKey: "announcements",
      title: "Communication Notes",
    });
    if (new URLSearchParams(location.search).get("new"))
      openAnnouncementModal(load);
  }),
);
function openAnnouncementModal(onSaved, row = null) {
  const departments = BRM.context.departments || [];
  const selectedAudiences = new Set(
    (row?.Audiences || []).map(
      (audience) => `${audience.AudienceType}:${audience.AudienceID || ""}`,
    ),
  );
  const modal = BRM.openModal(
    `<span class="eyebrow">Authorized communication</span><h2>${row ? "Edit" : "Post"} announcement</h2><form data-form><div class="form-grid"><div class="field span-2"><label>Title</label><input name="title" required maxlength="160" value="${BRM.escape(row?.Title || "")}"></div><div class="field span-2"><label>Message</label><textarea name="body" rows="7" required>${BRM.escape(row?.Body || "")}</textarea></div><div class="field"><label>Priority</label><select name="priority">${["Normal", "Important", "Urgent"].map((v) => `<option ${row?.Priority === v ? "selected" : ""}>${v}</option>`).join("")}</select></div><div class="field"><label>Location</label><input name="location" value="${BRM.escape(row?.Location || "")}"></div><div class="field"><label>Publish time</label><input name="publishAt" type="datetime-local" value="${localDateTime(row?.PublishAt)}"></div><div class="field"><label>Expiry time</label><input name="expireAt" type="datetime-local" value="${localDateTime(row?.ExpireAt)}"></div><div class="field"><label>Action deadline</label><input name="deadlineAt" type="datetime-local" value="${localDateTime(row?.DeadlineAt)}"></div><div class="field"><label>Button label</label><input name="actionLabel" value="${BRM.escape(row?.ActionLabel || "")}" placeholder="Confirm attendance"></div><div class="field span-2"><label>Action or resource URL</label><input name="actionUrl" type="url" value="${BRM.escape(row?.ActionURL || "")}" placeholder="https://..."></div><fieldset class="field span-2"><legend>Audiences — select all that apply</legend><div class="grid grid-2"><label class="checkbox-row"><input name="audience" type="checkbox" value="Everyone:" ${row ? "" : "checked"}> Everyone</label><label class="checkbox-row"><input name="audience" type="checkbox" value="Admins:"> Administrators</label>${departments.map((d) => `<label class="checkbox-row"><input name="audience" type="checkbox" value="Department:${d.DepartmentID}"> ${BRM.escape(d.Name)}</label>`).join("")}</div></fieldset><label class="checkbox-row"><input name="pinned" type="checkbox" ${annBool(row?.Pinned) ? "checked" : ""}> Pin to dashboards</label><label class="checkbox-row"><input name="acknowledgementRequired" type="checkbox" ${annBool(row?.AcknowledgementRequired) ? "checked" : ""}> Require acknowledgement</label></div><div class="form-actions"><button class="button button-primary">${row ? "Save changes" : "Publish"}</button></div></form>`,
    { wide: true },
  );
  if (row) {
    modal.querySelectorAll('[name="audience"]').forEach((input) => {
      input.checked = selectedAudiences.has(input.value);
    });
  }
  modal.querySelector("[data-form]").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      audiences = f.getAll("audience").map((v) => {
        const [type, id] = String(v).split(":");
        return { type, id };
      });
    if (!audiences.length)
      return BRM.toast("Choose at least one audience.", "error");
    try {
      await BRM.api("saveAnnouncement", {
        announcementId: row?.AnnouncementID || "",
        title: f.get("title"),
        body: f.get("body"),
        priority: f.get("priority"),
        location: f.get("location"),
        actionLabel: f.get("actionLabel"),
        actionUrl: f.get("actionUrl"),
        audiences,
        publishAt: f.get("publishAt")
          ? new Date(f.get("publishAt")).toISOString()
          : new Date().toISOString(),
        expireAt: f.get("expireAt")
          ? new Date(f.get("expireAt")).toISOString()
          : "",
        deadlineAt: f.get("deadlineAt")
          ? new Date(f.get("deadlineAt")).toISOString()
          : "",
        pinned: f.get("pinned") === "on",
        acknowledgementRequired: f.get("acknowledgementRequired") === "on",
      });
      BRM.toast(row ? "Announcement updated." : "Announcement published.");
      modal.closeModal();
      onSaved();
    } catch (error) {
      BRM.toast(error.message, "error");
    }
  };
}
async function openDeliveryReport(id) {
  const modal = BRM.openModal(
      '<span class="eyebrow">Delivery tracking</span><h2>Loading report…</h2><div data-report></div>',
      { wide: true },
    ),
    host = modal.querySelector("[data-report]");
  try {
    const result = await BRM.api(
        "announcementDeliveryReport",
        { announcementId: id },
        { noCache: true, forceNetwork: true },
      ),
      rows = result.recipients || [],
      read = rows.filter((x) => x.read).length,
      ack = rows.filter((x) => x.acknowledged).length;
    modal.querySelector("h2").textContent = result.announcement.Title;
    host.innerHTML = `<div class="stat-grid"><div class="stat-card"><strong>${rows.length}</strong><span>Recipients</span></div><div class="stat-card"><strong>${read}</strong><span>Read</span></div><div class="stat-card"><strong>${ack}</strong><span>Acknowledged</span></div><div class="stat-card"><strong>${rows.length ? Math.round(((annBool(result.announcement.AcknowledgementRequired) ? ack : read) / rows.length) * 100) : 0}%</strong><span>Complete</span></div></div><div class="delivery-list" style="margin-top:18px">${rows.map((p) => `<div class="delivery-row"><strong>${BRM.escape(p.name)}</strong><small>${p.acknowledged ? "✓ Acknowledged" : p.read ? "Read" : "Not read"}</small></div>`).join("")}</div>`;
  } catch (error) {
    host.innerHTML = `<div class="alert alert-error">${BRM.escape(error.message)}</div>`;
  }
}
