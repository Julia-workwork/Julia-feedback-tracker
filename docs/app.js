import {
  STATUS_LABELS,
  buildFirmwareLookup,
  categoryClass,
  filterFeedback,
  filterFirmware,
  isFirmwareReleaseLikeFeedbackRow,
  normalizeFirmwareRow,
  normalizeRequestNumber,
  normalizeRow,
  parseClosedRequests,
  summarizeFeedback,
  summarizeFirmware,
  uniqueFirmwareModels,
  uniqueModels,
} from "./lib/domain.mjs";

const SHEET_ID = "1cVR8KAaFwuPyofT-byCk5gWwl5aL7FOsr6lgVV9w6IE";
const FEEDBACK_SHEET_GID = "1702171693";
const FIRMWARE_SHEET_NAME = "firmware change log";
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwGan0BA3Zsl_EXw0gYkAYrgapvvt1k0oTQZB5uGXi8LqhQsp3KyfqrJv0qyGysL5UN/exec";
const SHEET_HEADERS_BY_POSITION = [
  "Date",
  "Model",
  "ID",
  "Email",
  "Profile",
  "Update Category",
  "Key Points",
  "Upgrade requirements",
  "Chinese",
  "Notes",
  "Request number",
  "ING",
  "Priority",
  "DONE",
  "Channel",
  "Dashboard Status",
  "Last Modified At",
  "Last Modified By",
  "Status Change Log",
];
const FIRMWARE_REQUIRED_HEADERS = ["Date", "Model", "Firmware Version", "Change log", "更新日志", "关闭需求"];
const EXPECTED_SHEET_HEADERS = new Set([
  ...SHEET_HEADERS_BY_POSITION,
  ...FIRMWARE_REQUIRED_HEADERS,
]);

const state = {
  records: [],
  firmwareRecords: [],
  firmwareLookup: new Map(),
  activeView: "feedback",
  summaryFilter: "",
  filters: {
    model: "all",
    search: "",
    category: "",
    priority: "",
    dateFrom: "",
    dateTo: "",
  },
  firmwareFilters: {
    model: "all",
    version: "all",
    search: "",
    dateFrom: "",
    dateTo: "",
  },
};

const elements = {
  viewTabs: document.querySelectorAll("[data-view]"),
  feedbackView: document.querySelector("#feedback-view"),
  firmwareView: document.querySelector("#firmware-view"),
  model: document.querySelector("#model-filter"),
  search: document.querySelector("#search-filter"),
  category: document.querySelector("#category-filter"),
  priority: document.querySelector("#priority-filter"),
  dateFrom: document.querySelector("#date-from-filter"),
  dateTo: document.querySelector("#date-to-filter"),
  refresh: document.querySelector("#refresh-button"),
  message: document.querySelector("#state-message"),
  summary: document.querySelector("#summary"),
  board: document.querySelector("#board"),
  detail: document.querySelector("#detail-panel"),
  firmwareModel: document.querySelector("#firmware-model-filter"),
  firmwareVersion: document.querySelector("#firmware-version-filter"),
  firmwareSearch: document.querySelector("#firmware-search-filter"),
  firmwareDateFrom: document.querySelector("#firmware-date-from-filter"),
  firmwareDateTo: document.querySelector("#firmware-date-to-filter"),
  firmwareRefresh: document.querySelector("#firmware-refresh-button"),
  firmwareSummary: document.querySelector("#firmware-summary"),
  firmwareMessage: document.querySelector("#firmware-message"),
  firmwareList: document.querySelector("#firmware-list"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("state-message--error", isError);
  elements.message.classList.toggle("is-hidden", !text);
}

function setFirmwareMessage(text, isError = false) {
  elements.firmwareMessage.textContent = text;
  elements.firmwareMessage.classList.toggle("state-message--error", isError);
  elements.firmwareMessage.classList.toggle("is-hidden", !text);
}

function renderModelOptions() {
  const current = elements.model.value;
  const models = uniqueModels(state.records);
  elements.model.innerHTML = `<option value="all">All Models</option>${models
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("")}`;
  elements.model.value = models.includes(current) ? current : "all";
  state.filters.model = elements.model.value;
}

function renderFirmwareFilterOptions() {
  const currentModel = elements.firmwareModel.value;
  const currentVersion = elements.firmwareVersion.value;
  const models = uniqueFirmwareModels(state.firmwareRecords);
  const selectedModel = models.includes(currentModel) ? currentModel : "all";
  const versionSource =
    selectedModel === "all" ? [] : state.firmwareRecords.filter((release) => release.model === selectedModel);
  const versionByValue = new Map();

  for (const release of versionSource) {
    if (!release.version || versionByValue.has(release.version)) continue;
    versionByValue.set(release.version, release);
  }

  const versions = [...versionByValue.keys()].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  elements.firmwareModel.innerHTML = `<option value="all">All Models</option>${models
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("")}`;
  const defaultVersionLabel = selectedModel === "all" ? "Select Model First" : "All Versions";
  elements.firmwareVersion.innerHTML = `<option value="all">${defaultVersionLabel}</option>${versions
    .map((version) => {
      const release = versionByValue.get(version);
      const parts = [version, release?.date, release?.versionStatus].filter(Boolean);
      return `<option value="${escapeHtml(version)}">${escapeHtml(parts.join(" · "))}</option>`;
    })
    .join("")}`;

  elements.firmwareModel.value = selectedModel;
  elements.firmwareVersion.value = versions.includes(currentVersion) ? currentVersion : "all";
  state.firmwareFilters.model = elements.firmwareModel.value;
  state.firmwareFilters.version = elements.firmwareVersion.value;
}

function renderSummary(records) {
  const summary = summarizeFeedback(records);
  const items = [
    ["total", "Total", summary.total, "summary-total"],
    ["todo", "To Submit", summary.statusCounts.todo, "summary-todo"],
    ["submitted", "Submitted", summary.statusCounts.submitted, "summary-submitted"],
    ["inProgress", "In Progress", summary.statusCounts.inProgress, "summary-progress"],
    ["resolved", "Resolved", summary.statusCounts.resolved, "summary-resolved"],
    ["unresolvedBug", "Unresolved BUG", summary.unresolvedBugs, "summary-bug"],
  ];
  elements.summary.innerHTML = items
    .map(
      ([key, label, value, className]) => `
        <button
          class="${className}${state.summaryFilter === key ? " is-active" : ""}"
          type="button"
          data-summary-filter="${key}"
          aria-pressed="${state.summaryFilter === key ? "true" : "false"}"
        >
          <span>${escapeHtml(label)}</span>
          <strong>${value}</strong>
        </button>
      `,
    )
    .join("");
}

function renderFirmwareSummary(records) {
  const summary = summarizeFirmware(records);
  elements.firmwareSummary.innerHTML = `
    <div><span>Total Releases</span><strong>${summary.total}</strong></div>
    <div><span>Models</span><strong>${summary.modelCount}</strong></div>
    <div><span>Closed Requests</span><strong>${summary.closedRequestCount}</strong></div>
  `;
}

function applySummaryFilter(records) {
  if (state.summaryFilter === "todo") {
    return records.filter((record) => record.status === "todo");
  }
  if (state.summaryFilter === "submitted") {
    return records.filter((record) => record.status === "submitted");
  }
  if (state.summaryFilter === "inProgress") {
    return records.filter((record) => record.status === "inProgress");
  }
  if (state.summaryFilter === "resolved") {
    return records.filter((record) => record.status === "resolved");
  }
  if (state.summaryFilter === "unresolvedBug") {
    return records.filter((record) => record.status !== "resolved" && record.categories.includes("BUG"));
  }
  return records;
}

function categoryPillsTemplate(record) {
  if (!record.categories.length) {
    return `<span class="category-pill category-unknown">Uncategorized</span>`;
  }

  return record.categories
    .map((category) => `<span class="category-pill ${categoryClass(category)}">${escapeHtml(category)}</span>`)
    .join("");
}

function cardTemplate(record, index) {
  return `
    <article
      class="feedback-card"
      data-index="${index}"
      role="button"
      tabindex="0"
      aria-label="Open feedback details"
    >
      <div class="card-meta">
        ${categoryPillsTemplate(record)}
        ${record.priority ? `<span class="priority-pill">${escapeHtml(record.priority)}</span>` : ""}
      </div>
      <h3>${escapeHtml(record.keyPoints || record.upgradeRequirements || "No summary")}</h3>
      <dl>
        <div><dt>Date</dt><dd>${escapeHtml(record.date || "-")}</dd></div>
        <div><dt>Request</dt><dd>${escapeHtml(record.requestNumber || "-")}</dd></div>
        <div><dt>Done</dt><dd>${escapeHtml(record.done || "-")}</dd></div>
        <div><dt>Channel</dt><dd>${escapeHtml(record.channel || "-")}</dd></div>
      </dl>
      <div class="card-actions">
        <button class="copy-summary" type="button" data-index="${index}">Copy Summary</button>
        <span aria-hidden="true">View</span>
      </div>
    </article>
  `;
}

function firmwareMatchPayload(release) {
  return {
    date: release.date,
    model: release.model,
    hardwareVersion: release.hardwareVersion,
    version: release.version,
    reasonForChange: release.reasonForChange,
  };
}

function syncFirmwareClosedRequests(release, closedRequests, editorCode) {
  return callGoogleAppsScript({
    action: "updateFirmwareClosedRequests",
    closedRequests,
    editorCode: String(editorCode || "").trim(),
    match: JSON.stringify(firmwareMatchPayload(release)),
  }).then((payload) => {
    if (payload?.ok) return payload;
    throw new Error(payload?.message || "Update failed.");
  });
}

function firmwareCardTemplate(release, index) {
  const closedRequests = release.closedRequests.length
    ? release.closedRequests
        .map(
          (request) => `
            <button class="closed-request-link" type="button" data-request-number="${escapeHtml(request)}">
              ${escapeHtml(request)}
            </button>
          `,
        )
        .join("")
    : `<span>-</span>`;
  const metadata = [
    ["Hardware", release.hardwareVersion],
    ["Status", release.versionStatus],
    ["Reason", release.reasonForChange],
  ].filter(([, value]) => value);
  return `
    <article class="firmware-card">
      <div class="firmware-title">
        <p>${escapeHtml(release.model || "-")}</p>
        <h2>${escapeHtml(release.version || "Unknown version")}</h2>
      </div>
      ${
        metadata.length
          ? `<div class="firmware-meta">${metadata
              .map(
                ([label, value]) => `
                  <span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>
                `,
              )
              .join("")}</div>`
          : ""
      }
      <time>${escapeHtml(release.date || "-")}</time>
      <details class="firmware-details">
        <summary>View details</summary>
        <div class="firmware-log-grid">
          <section>
            <h3>Change Log</h3>
            <p>${escapeHtml(release.changeLog || "-")}</p>
          </section>
          <section>
            <h3>更新日志</h3>
            <p>${escapeHtml(release.chineseLog || "-")}</p>
          </section>
        </div>
        <div class="closed-requests">
          <div class="closed-requests-header">
            <h3>Closed Requests</h3>
            <button class="edit-closed-requests" type="button" data-release-index="${index}">Edit</button>
          </div>
          <div class="closed-request-list">${closedRequests}</div>
          <form class="closed-request-editor is-hidden" data-release-index="${index}">
            <label>
              Closed request numbers
              <textarea rows="3">${escapeHtml(release.closedRequestsRaw)}</textarea>
            </label>
            <div>
              <button type="submit">Save</button>
              <button type="button" class="cancel-closed-request-edit">Cancel</button>
            </div>
          </form>
        </div>
      </details>
    </article>
  `;
}

function renderFirmware() {
  const visible = filterFirmware(state.firmwareRecords, state.firmwareFilters).sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  renderFirmwareSummary(visible);
  if (!state.firmwareRecords.length && !elements.firmwareMessage.textContent) {
    setFirmwareMessage("No firmware releases found.");
  } else if (state.firmwareRecords.length && !visible.length) {
    setFirmwareMessage("No firmware releases match the selected filters.");
  } else if (state.firmwareRecords.length) {
    setFirmwareMessage("");
  }
  elements.firmwareList.innerHTML = visible.length
    ? visible.map((release) => firmwareCardTemplate(release, state.firmwareRecords.indexOf(release))).join("")
    : "";
}

function renderBoard(records) {
  const columns = ["todo", "submitted", "inProgress", "resolved"];
  elements.board.innerHTML = columns
    .map((status) => {
      const items = records.filter((record) => record.status === status);
      return `
        <article class="status-column" data-status="${status}">
          <header><h2>${STATUS_LABELS[status]}</h2><span>${items.length}</span></header>
          <div class="card-list">
            ${
              items.length
                ? items.map((record) => cardTemplate(record, records.indexOf(record))).join("")
                : `<p class="empty-column">No feedback here.</p>`
            }
          </div>
        </article>
      `;
    })
    .join("");

  elements.board.querySelectorAll(".feedback-card").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target.closest(".copy-summary")) return;
      const record = records[Number(button.dataset.index)];
      openDetail(record);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest(".copy-summary")) return;
      event.preventDefault();
      const record = records[Number(button.dataset.index)];
      openDetail(record);
    });
  });

  elements.board.querySelectorAll(".copy-summary").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const record = records[Number(button.dataset.index)];
      await copyEngineerSummary(record);
      showToast("Engineer summary copied");
    });
  });
}

function engineerSummary(record) {
  return [
    `Model: ${record.model || "-"}`,
    `Category: ${record.updateCategory || "-"}`,
    `Priority: ${record.priority || "-"}`,
    `Status: ${STATUS_LABELS[record.status] || record.status || "-"}`,
    `Date: ${record.date || "-"}`,
    `Request number: ${record.requestNumber || "-"}`,
    `Key Points: ${record.keyPoints || "-"}`,
    `Upgrade requirements: ${record.upgradeRequirements || "-"}`,
    `Chinese: ${record.chinese || "-"}`,
    `Notes: ${record.notes || "-"}`,
    `Channel: ${record.channel || "-"}`,
    `User ID: ${record.id || "-"}`,
  ].join("\n");
}

async function copyEngineerSummary(record) {
  const text = engineerSummary(record);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showToast(text) {
  const existing = document.querySelector(".copy-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.className = "copy-toast";
  toast.textContent = text;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function recordMatchPayload(record) {
  return {
    date: record.date,
    model: record.model,
    id: record.id,
    keyPoints: record.keyPoints,
    upgradeRequirements: record.upgradeRequirements,
    requestNumber: record.requestNumber,
  };
}

function callGoogleAppsScript(params) {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_APPS_SCRIPT_URL) {
      reject(new Error("Sync is not configured yet."));
      return;
    }

    const callbackName = `handleSheetSync_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({
      callback: callbackName,
      ...params,
    });
    const separator = GOOGLE_APPS_SCRIPT_URL.includes("?") ? "&" : "?";
    script.src = `${GOOGLE_APPS_SCRIPT_URL}${separator}${query.toString()}`;

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.addEventListener("error", () => {
      cleanup();
      reject(new Error("Unable to contact the edit service."));
    });

    document.head.append(script);
  });
}

async function verifyEditorCode(editorCode) {
  const payload = await callGoogleAppsScript({
    action: "ping",
    editorCode: String(editorCode || "").trim(),
  });
  if (!payload?.ok || !payload?.canEdit) {
    throw new Error("Edit code was rejected by this dashboard endpoint.");
  }
}

function syncChangesToGoogleSheet(record, changes, editorCode) {
  return callGoogleAppsScript({
      status: changes["Dashboard Status"] || "",
      changes: JSON.stringify(changes),
      editorCode: String(editorCode || "").trim(),
      match: JSON.stringify(recordMatchPayload(record)),
    }).then((payload) => {
      if (payload?.ok) return payload;
      throw new Error(payload?.message || "Update failed.");
    });
}

async function saveRecordChanges(record, changes, editorCode) {
  showToast("Saving changes...");
  try {
    const result = await syncChangesToGoogleSheet(record, changes, editorCode);
    applySavedChanges(record, changes, result);
    const filtered = filterFeedback(state.records, state.filters);
    renderSummary(filtered);
    renderBoard(applySummaryFilter(filtered));
    setMessage("");
    openDetail(record);
    showToast("Changes saved");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Update failed");
  }
}

function setDetailSaving(isSaving) {
  const button = elements.detail.querySelector(".save-detail-changes");
  const fields = elements.detail.querySelectorAll(".detail-editable-row input, .detail-editable-row select, .detail-editable-row textarea");
  if (button) {
    button.disabled = isSaving;
    button.textContent = isSaving ? "Saving..." : "Save Changes";
  }
  fields.forEach((field) => {
    field.disabled = isSaving;
  });
}

function applySavedChanges(record, changes, result = {}) {
  if (changes["Dashboard Status"] !== undefined) {
    record.dashboardStatus = changes["Dashboard Status"];
    record.status = Object.entries(STATUS_LABELS).find(([, label]) => label === changes["Dashboard Status"])?.[0] || record.status;
  }
  if (changes.Priority !== undefined) record.priority = changes.Priority;
  if (changes.Notes !== undefined) record.notes = changes.Notes;
  if (changes["Request number"] !== undefined) record.requestNumber = changes["Request number"];
  if (changes.ING !== undefined) record.ing = changes.ING;
  if (changes.DONE !== undefined) record.done = changes.DONE;
  if (result.lastModifiedAt) record.lastModifiedAt = result.lastModifiedAt;
  if (result.lastModifiedBy) record.lastModifiedBy = result.lastModifiedBy;
  if (result.statusChangeLog !== undefined) record.statusChangeLog = result.statusChangeLog;
}

function detailRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd></div>`;
}

function editableDetailRow(label, fieldHtml, size = "medium") {
  return `<div class="detail-editable-row detail-editable-row--${size}"><dt>${escapeHtml(label)}</dt><dd>${fieldHtml}</dd></div>`;
}

function statusSelectTemplate(record) {
  return `
    <select name="Dashboard Status">
      ${Object.entries(STATUS_LABELS)
        .map(
          ([status, label]) =>
            `<option value="${escapeHtml(label)}"${record.status === status ? " selected" : ""}>${escapeHtml(label)}</option>`,
        )
        .join("")}
    </select>
  `;
}

function prioritySelectTemplate(record) {
  return `
    <select name="Priority">
      ${["", "P0", "P1", "P2"]
        .map((priority) => `<option value="${priority}"${record.priority === priority ? " selected" : ""}>${priority || "-"}</option>`)
        .join("")}
    </select>
  `;
}

function doneSelectTemplate(record) {
  return `
    <select name="DONE">
      ${["", "No", "Yes"]
        .map((done) => `<option value="${done}"${record.done === done ? " selected" : ""}>${done || "-"}</option>`)
        .join("")}
    </select>
  `;
}

function fieldValuesFromDetail() {
  const fields = elements.detail.querySelectorAll("[name]");
  return [...fields].reduce((values, field) => {
    values[field.name] = field.value.trim();
    return values;
  }, {});
}

function originalEditableValues(record) {
  return {
    "Dashboard Status": STATUS_LABELS[record.status] || "",
    Priority: record.priority,
    Notes: record.notes,
    "Request number": record.requestNumber,
    ING: record.ing,
    DONE: record.done,
  };
}

function changedFields(record) {
  const current = fieldValuesFromDetail();
  const original = originalEditableValues(record);
  return Object.entries(current).reduce((changes, [field, value]) => {
    if ((original[field] || "") !== value) {
      changes[field] = value;
    }
    return changes;
  }, {});
}

function changesSummary(record, changes) {
  const original = originalEditableValues(record);
  return Object.entries(changes)
    .map(([field, value]) => `${field}: ${original[field] || "-"} -> ${value || "-"}`)
    .join("\n");
}

function modificationRowsTemplate(record) {
  return `
    ${detailRow("Last Modified At", record.lastModifiedAt)}
    ${detailRow("Last Modified By", record.lastModifiedBy)}
    ${detailRow("Status Change Log", record.statusChangeLog)}
  `;
}

function cleanText(value) {
  return String(value || "").trim();
}

function firmwarePreview(text) {
  const value = cleanText(text);
  return value.length > 180 ? `${value.slice(0, 180)}...` : value;
}

function linkedFirmwareForRecord(record) {
  const key = normalizeRequestNumber(record.requestNumber);
  return key ? state.firmwareLookup.get(key) || [] : [];
}

function feedbackForRequestNumber(requestNumber) {
  const key = normalizeRequestNumber(requestNumber);
  if (!key) return [];
  return state.records.filter((record) => normalizeRequestNumber(record.requestNumber) === key);
}

function requestMatchesTemplate(records) {
  return `
    <section class="request-match-picker">
      <h3>Matching Feedback</h3>
      ${records
        .map(
          (record, index) => `
            <button type="button" data-match-index="${index}">
              <strong>${escapeHtml(record.keyPoints || record.upgradeRequirements || "Feedback detail")}</strong>
              <span>${escapeHtml([record.date, record.model, record.id].filter(Boolean).join(" · ") || "-")}</span>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function openRequestMatches(records) {
  document.body.classList.add("detail-open");
  elements.detail.classList.remove("is-hidden");
  elements.detail.innerHTML = `
    <div class="detail-panel__header">
      <div>
        <h2>Select Feedback</h2>
      </div>
      <div class="detail-actions">
        <button type="button" id="close-detail">Close</button>
      </div>
    </div>
    ${requestMatchesTemplate(records)}
  `;
  elements.detail.querySelectorAll("[data-match-index]").forEach((button) => {
    button.addEventListener("click", () => {
      openDetail(records[Number(button.dataset.matchIndex)]);
    });
  });
  document.querySelector("#close-detail").addEventListener("click", () => {
    elements.detail.classList.add("is-hidden");
    document.body.classList.remove("detail-open");
  });
}

function linkedFirmwareTemplate(record) {
  const releases = linkedFirmwareForRecord(record);
  if (!releases.length) return "";

  return `
    <section class="linked-firmware">
      <h3>Resolved in Firmware</h3>
      ${releases
        .map(
          (release) => `
            <article>
              <strong>${escapeHtml(release.model || "-")} · ${escapeHtml(release.version || "-")}</strong>
              <span>${escapeHtml(release.date || "-")}</span>
              <p>${escapeHtml(firmwarePreview(release.changeLog || release.chineseLog))}</p>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function openDetail(record) {
  document.body.classList.add("detail-open");
  elements.detail.classList.remove("is-hidden");
  elements.detail.innerHTML = `
    <div class="detail-panel__header">
      <div>
        <div class="card-meta">${categoryPillsTemplate(record)}</div>
        <h2>${escapeHtml(record.keyPoints || "Feedback detail")}</h2>
      </div>
      <div class="detail-actions">
        <button class="copy-detail-summary" type="button">Copy Engineer Summary</button>
        <button type="button" id="close-detail">Close</button>
      </div>
    </div>
    <dl class="detail-list">
      ${detailRow("Model", record.model)}
      ${detailRow("User ID", record.id)}
      ${detailRow("Email", record.email)}
      ${detailRow("Profile", record.profile)}
      ${detailRow("Channel", record.channel)}
      ${detailRow("Date", record.date)}
      ${editableDetailRow("Status", statusSelectTemplate(record), "short")}
      ${editableDetailRow("Priority", prioritySelectTemplate(record), "short")}
      ${editableDetailRow("Request number", `<input name="Request number" value="${escapeHtml(record.requestNumber)}" />`)}
      ${editableDetailRow("ING", `<textarea name="ING" rows="3">${escapeHtml(record.ing)}</textarea>`, "wide")}
      ${editableDetailRow("DONE", doneSelectTemplate(record), "short")}
      ${modificationRowsTemplate(record)}
      ${detailRow("Upgrade requirements", record.upgradeRequirements)}
      ${detailRow("Chinese", record.chinese)}
      ${linkedFirmwareTemplate(record)}
      ${editableDetailRow("Notes", `<textarea name="Notes" rows="4">${escapeHtml(record.notes)}</textarea>`, "wide")}
    </dl>
    <button class="save-detail-changes" type="button">Save Changes</button>
  `;
  document.querySelector(".copy-detail-summary").addEventListener("click", async () => {
    await copyEngineerSummary(record);
    showToast("Engineer summary copied");
  });
  document.querySelector(".save-detail-changes").addEventListener("click", async () => {
    const changes = changedFields(record);
    if (!Object.keys(changes).length) {
      showToast("No changes to save");
      return;
    }
    const confirmed = window.confirm(`Confirm changes?\n\n${changesSummary(record, changes)}`);
    if (!confirmed) return;
    const editorCode = window.prompt("Enter editor code to save changes:");
    const cleanEditorCode = String(editorCode || "").trim();
    if (!cleanEditorCode) {
      showToast("Edit cancelled");
      return;
    }
    setDetailSaving(true);
    try {
      await verifyEditorCode(cleanEditorCode);
      await saveRecordChanges(record, changes, cleanEditorCode);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Update failed");
    }
    setDetailSaving(false);
  });
  document.querySelector("#close-detail").addEventListener("click", () => {
    elements.detail.classList.add("is-hidden");
    document.body.classList.remove("detail-open");
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || elements.detail.classList.contains("is-hidden")) return;
  elements.detail.classList.add("is-hidden");
  document.body.classList.remove("detail-open");
});

function render() {
  const filtered = filterFeedback(state.records, state.filters);
  const visibleRecords = applySummaryFilter(filtered);
  renderSummary(filtered);
  renderBoard(visibleRecords);
  if (!state.records.length) {
    setMessage("Feedback data loaded, but no records were found.", true);
    return;
  }
  setMessage(visibleRecords.length ? "" : "No feedback matches the selected filters.");
}

function sheetCellValue(row, index) {
  const cell = row.c[index];
  return cell ? String(cell.f ?? cell.v ?? "").trim() : "";
}

function hasAnyValue(record) {
  return Object.values(record).some(Boolean);
}

function buildRecordsFromHeaders(tableRows, headers) {
  return tableRows
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        if (!header) return;
        record[header] = sheetCellValue(row, index);
      });
      return record;
    })
    .filter(hasAnyValue);
}

function tableRowsToRecords(table) {
  const labels = table.cols.map((column) => String(column.label || "").trim());
  const ids = table.cols.map((column) => String(column.id || "").trim());
  const labelsHaveExpectedHeaders = labels.some((label) => EXPECTED_SHEET_HEADERS.has(label));
  const headers = labelsHaveExpectedHeaders ? labels : ids;
  const parsedRecords = buildRecordsFromHeaders(table.rows, headers);

  if (headers.some((header) => EXPECTED_SHEET_HEADERS.has(header))) {
    return parsedRecords;
  }

  const firstRowHeaders = table.rows[0]?.c.map((_, index) => sheetCellValue(table.rows[0], index)) || [];
  const firstRowHasExpectedHeaders = firstRowHeaders.some((header) => EXPECTED_SHEET_HEADERS.has(header));
  if (firstRowHasExpectedHeaders) {
    return buildRecordsFromHeaders(table.rows.slice(1), firstRowHeaders);
  }

  const idsLookLikeColumnLetters = ids.every((id) => /^[A-Z]+$/.test(id));
  if (idsLookLikeColumnLetters) {
    return buildRecordsFromHeaders(table.rows, SHEET_HEADERS_BY_POSITION);
  }

  return parsedRecords;
}

function loadSheetRows({ gid = "", sheetName = "" }) {
  return new Promise((resolve, reject) => {
    const callbackName = `handleSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({
      tq: "select *",
      tqx: `out:json;responseHandler:${callbackName}`,
    });
    if (gid) query.set("gid", gid);
    if (sheetName) query.set("sheet", sheetName);
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${query.toString()}`;

    window[callbackName] = (payload) => {
      delete window[callbackName];
      script.remove();

      if (payload.status !== "ok") {
        reject(new Error("Sheet data is not available right now."));
        return;
      }

      resolve(tableRowsToRecords(payload.table));
    };

    script.addEventListener("error", () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("Unable to load sheet data."));
    });

    document.head.append(script);
  });
}

function validateFirmwareRows(rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return FIRMWARE_REQUIRED_HEADERS.filter((header) => !headers.includes(header));
}

async function loadFirmwareRecords() {
  const rows = await loadSheetRows({ sheetName: FIRMWARE_SHEET_NAME });
  const missing = validateFirmwareRows(rows);
  if (missing.length) {
    throw new Error(`Firmware Change Log is missing columns: ${missing.join(", ")}`);
  }
  return rows
    .map(normalizeFirmwareRow)
    .filter((release) => release.date || release.model || release.version || release.changeLog);
}

async function load() {
  setMessage("Loading feedback data...");
  setFirmwareMessage("Loading firmware data...");
  renderSummary([]);
  renderFirmwareSummary([]);
  elements.board.innerHTML = "";
  elements.firmwareList.innerHTML = "";
  try {
    const [feedbackRows, firmwareResult] = await Promise.allSettled([
      loadSheetRows({ gid: FEEDBACK_SHEET_GID }),
      loadFirmwareRecords(),
    ]);

    if (feedbackRows.status !== "fulfilled") {
      throw feedbackRows.reason;
    }

    state.records = feedbackRows.value.filter((row) => !isFirmwareReleaseLikeFeedbackRow(row)).map(normalizeRow);
    renderModelOptions();

    if (firmwareResult.status === "fulfilled") {
      state.firmwareRecords = firmwareResult.value;
      state.firmwareLookup = buildFirmwareLookup(state.firmwareRecords);
      renderFirmwareFilterOptions();
      setFirmwareMessage("");
    } else {
      state.firmwareRecords = [];
      state.firmwareLookup = new Map();
      setFirmwareMessage(
        firmwareResult.reason instanceof Error
          ? firmwareResult.reason.message
          : "Firmware Change Log is not available yet.",
        true,
      );
    }

    render();
    renderFirmware();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unknown loading error", true);
  }
}

function setActiveView(view) {
  state.activeView = view;
  elements.viewTabs.forEach((button) => {
    const isActive = button.dataset.view === view;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  elements.feedbackView.classList.toggle("is-hidden", view !== "feedback");
  elements.firmwareView.classList.toggle("is-hidden", view !== "firmware");
}

elements.viewTabs.forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.view));
});
elements.model.addEventListener("change", () => {
  state.filters.model = elements.model.value;
  render();
});
elements.search.addEventListener("input", () => {
  state.filters.search = elements.search.value;
  render();
});
elements.category.addEventListener("change", () => {
  state.filters.category = elements.category.value;
  render();
});
elements.priority.addEventListener("change", () => {
  state.filters.priority = elements.priority.value;
  render();
});
elements.dateFrom.addEventListener("change", () => {
  state.filters.dateFrom = elements.dateFrom.value;
  render();
});
elements.dateTo.addEventListener("change", () => {
  state.filters.dateTo = elements.dateTo.value;
  render();
});
elements.firmwareModel.addEventListener("change", () => {
  state.firmwareFilters.model = elements.firmwareModel.value;
  renderFirmwareFilterOptions();
  renderFirmware();
});
elements.firmwareVersion.addEventListener("change", () => {
  state.firmwareFilters.version = elements.firmwareVersion.value;
  renderFirmware();
});
elements.firmwareSearch.addEventListener("input", () => {
  state.firmwareFilters.search = elements.firmwareSearch.value;
  renderFirmware();
});
elements.firmwareDateFrom.addEventListener("change", () => {
  state.firmwareFilters.dateFrom = elements.firmwareDateFrom.value;
  renderFirmware();
});
elements.firmwareDateTo.addEventListener("change", () => {
  state.firmwareFilters.dateTo = elements.firmwareDateTo.value;
  renderFirmware();
});
elements.firmwareRefresh.addEventListener("click", load);
elements.firmwareList.addEventListener("click", (event) => {
  const requestButton = event.target.closest(".closed-request-link");
  if (requestButton) {
    const matches = feedbackForRequestNumber(requestButton.dataset.requestNumber);
    if (!matches.length) {
      showToast("No matching feedback found for this request number.");
      return;
    }
    if (matches.length === 1) {
      openDetail(matches[0]);
      return;
    }
    openRequestMatches(matches);
    return;
  }

  const editButton = event.target.closest(".edit-closed-requests");
  if (editButton) {
    const container = editButton.closest(".closed-requests");
    container?.querySelector(".closed-request-editor")?.classList.remove("is-hidden");
    editButton.disabled = true;
  }

  const cancelButton = event.target.closest(".cancel-closed-request-edit");
  if (cancelButton) {
    const form = cancelButton.closest(".closed-request-editor");
    const container = cancelButton.closest(".closed-requests");
    form?.classList.add("is-hidden");
    const editButton = container?.querySelector(".edit-closed-requests");
    if (editButton) editButton.disabled = false;
  }
});
elements.firmwareList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".closed-request-editor");
  if (!form) return;
  event.preventDefault();

  const release = state.firmwareRecords[Number(form.dataset.releaseIndex)];
  if (!release) {
    showToast("Firmware release was not found.");
    return;
  }

  const editorCode = window.prompt("Enter editor code to save changes:");
  const cleanEditorCode = String(editorCode || "").trim();
  if (!cleanEditorCode) {
    showToast("Edit cancelled");
    return;
  }

  const textarea = form.querySelector("textarea");
  const nextValue = textarea.value.trim();
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";
  }

  try {
    await verifyEditorCode(cleanEditorCode);
    await syncFirmwareClosedRequests(release, nextValue, cleanEditorCode);
    release.closedRequestsRaw = nextValue;
    release.closedRequests = parseClosedRequests(nextValue);
    state.firmwareLookup = buildFirmwareLookup(state.firmwareRecords);
    renderFirmware();
    showToast("Changes saved");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Update failed");
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Save";
    }
  }
});
elements.refresh.addEventListener("click", load);
elements.summary.addEventListener("click", (event) => {
  const button = event.target.closest("[data-summary-filter]");
  if (!button) return;

  const nextFilter = button.dataset.summaryFilter;
  state.summaryFilter = nextFilter === "total" || state.summaryFilter === nextFilter ? "" : nextFilter;
  render();
});

load();
