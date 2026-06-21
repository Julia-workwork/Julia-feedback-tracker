import {
  BETA_TEST_HEADERS,
  betaDetailHeading,
  betaDetailLabel,
  STATUS_LABELS,
  buildFirmwareLookup,
  categoryClass,
  filterBetaTests,
  filterFeedback,
  filterFirmware,
  inferBetaDraft,
  isFirmwareReleaseLikeFeedbackRow,
  canEditModule,
  canViewModule,
  normalizePermissions,
  normalizeBetaRow,
  normalizeFirmwareRow,
  normalizeRequestNumber,
  normalizeRow,
  parseClosedRequests,
  summaryPercentages,
  summarizeBetaTests,
  summarizeFeedback,
  summarizeFirmware,
  uniqueBetaModels,
  uniqueBetaVersions,
  uniqueFirmwareModels,
  uniqueModels,
} from "./lib/domain.mjs?v=20260621-module-permissions";

const SHEET_ID = "1cVR8KAaFwuPyofT-byCk5gWwl5aL7FOsr6lgVV9w6IE";
const FEEDBACK_SHEET_GID = "1702171693";
const FIRMWARE_SHEET_NAME = "firmware change log";
const BETA_SHEET_NAME = "Beta Test Progress";
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
const BETA_REQUIRED_HEADERS = ["Date", "Product Model", "Version", "Issue Found", "Status", "Raw Input"];
const EXPECTED_SHEET_HEADERS = new Set([
  ...SHEET_HEADERS_BY_POSITION,
  ...FIRMWARE_REQUIRED_HEADERS,
  ...BETA_TEST_HEADERS,
]);
const AUTH_STORAGE_KEY = "juliaFeedbackAuth";
const HERO_COPY = {
  feedback: {
    eyebrow: "Julia's Feedback Tracker",
    title: "Engineering Follow-up Dashboard",
    note: "Private internal tool owned by Julia. Personal workflow only.",
  },
  firmware: {
    eyebrow: "Firmware Change Log",
    title: "Release History Dashboard",
    note: "Track firmware versions, resolved requests, and release-level engineering changes.",
  },
  beta: {
    eyebrow: "Beta Test Progress",
    title: "Test Progress Dashboard",
    note: "Review daily beta findings, user test issues, owners, and follow-up progress.",
  },
};

const state = {
  records: [],
  firmwareRecords: [],
  betaRecords: [],
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
  betaFilters: {
    model: "all",
    version: "all",
    testerType: "",
    status: "",
    priority: "",
    search: "",
    dateFrom: "",
    dateTo: "",
  },
  auth: null,
};

const elements = {
  appShell: document.querySelector(".app-shell"),
  loginScreen: document.querySelector("#login-screen"),
  loginForm: document.querySelector("#login-form"),
  loginUsername: document.querySelector("#login-username"),
  loginPassword: document.querySelector("#login-password"),
  loginMessage: document.querySelector("#login-message"),
  authRole: document.querySelector("#auth-role"),
  logout: document.querySelector("#logout-button"),
  viewTabs: document.querySelectorAll("[data-view]"),
  feedbackView: document.querySelector("#feedback-view"),
  firmwareView: document.querySelector("#firmware-view"),
  betaView: document.querySelector("#beta-view"),
  heroEyebrow: document.querySelector("#hero-eyebrow"),
  heroTitle: document.querySelector("#hero-title"),
  heroNote: document.querySelector("#hero-note"),
  model: document.querySelector("#model-filter"),
  search: document.querySelector("#search-filter"),
  category: document.querySelector("#category-filter"),
  priority: document.querySelector("#priority-filter"),
  dateFrom: document.querySelector("#date-from-filter"),
  dateTo: document.querySelector("#date-to-filter"),
  filterMore: document.querySelector("#filter-more-toggle"),
  refresh: document.querySelector("#refresh-button"),
  feedbackAdd: document.querySelector("#feedback-add-button"),
  feedbackClose: document.querySelector("#feedback-close-button"),
  feedbackInputPanel: document.querySelector("#feedback-input-panel"),
  feedbackInputForm: document.querySelector("#feedback-input-form"),
  feedbackGeneratedFields: document.querySelector("#feedback-generated-fields"),
  feedbackRawInput: document.querySelector("#feedback-raw-input"),
  feedbackInputDate: document.querySelector("#feedback-input-date"),
  feedbackInputModel: document.querySelector("#feedback-input-model"),
  feedbackInputId: document.querySelector("#feedback-input-id"),
  feedbackInputEmail: document.querySelector("#feedback-input-email"),
  feedbackInputCategory: document.querySelector("#feedback-input-category"),
  feedbackInputPriority: document.querySelector("#feedback-input-priority"),
  feedbackInputRequest: document.querySelector("#feedback-input-request"),
  feedbackInputChannel: document.querySelector("#feedback-input-channel"),
  feedbackInputStatus: document.querySelector("#feedback-input-status"),
  feedbackInputKeyPoints: document.querySelector("#feedback-input-key-points"),
  feedbackInputUpgrade: document.querySelector("#feedback-input-upgrade"),
  feedbackInputChinese: document.querySelector("#feedback-input-chinese"),
  feedbackInputNotes: document.querySelector("#feedback-input-notes"),
  feedbackAnalyze: document.querySelector("#feedback-analyze-button"),
  feedbackSave: document.querySelector("#feedback-save-button"),
  feedbackClear: document.querySelector("#feedback-clear-button"),
  feedbackInputMessage: document.querySelector("#feedback-input-message"),
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
  betaInputPanel: document.querySelector("#beta-input-panel"),
  betaInputForm: document.querySelector("#beta-input-form"),
  betaRawInput: document.querySelector("#beta-raw-input"),
  betaInputDate: document.querySelector("#beta-input-date"),
  betaInputModel: document.querySelector("#beta-input-model"),
  betaInputVersion: document.querySelector("#beta-input-version"),
  betaInputTestType: document.querySelector("#beta-input-test-type"),
  betaInputTestItem: document.querySelector("#beta-input-test-item"),
  betaInputTesterType: document.querySelector("#beta-input-tester-type"),
  betaInputTesterOwner: document.querySelector("#beta-input-tester-owner"),
  betaInputIssueFound: document.querySelector("#beta-input-issue-found"),
  betaInputKeyPoint: document.querySelector("#beta-input-key-point"),
  betaInputSeverity: document.querySelector("#beta-input-severity"),
  betaInputPriority: document.querySelector("#beta-input-priority"),
  betaInputStatus: document.querySelector("#beta-input-status"),
  betaInputNextAction: document.querySelector("#beta-input-next-action"),
  betaAnalyze: document.querySelector("#beta-analyze-button"),
  betaSave: document.querySelector("#beta-save-button"),
  betaClear: document.querySelector("#beta-clear-button"),
  betaInputMessage: document.querySelector("#beta-input-message"),
  betaModel: document.querySelector("#beta-model-filter"),
  betaVersion: document.querySelector("#beta-version-filter"),
  betaTesterType: document.querySelector("#beta-tester-type-filter"),
  betaStatus: document.querySelector("#beta-status-filter"),
  betaPriority: document.querySelector("#beta-priority-filter"),
  betaSearch: document.querySelector("#beta-search-filter"),
  betaDateFrom: document.querySelector("#beta-date-from-filter"),
  betaDateTo: document.querySelector("#beta-date-to-filter"),
  betaRefresh: document.querySelector("#beta-refresh-button"),
  betaSummary: document.querySelector("#beta-summary"),
  betaMessage: document.querySelector("#beta-message"),
  betaList: document.querySelector("#beta-list"),
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

function setBetaMessage(text, isError = false) {
  elements.betaMessage.textContent = text;
  elements.betaMessage.classList.toggle("state-message--error", isError);
  elements.betaMessage.classList.toggle("is-hidden", !text);
}

function setBetaInputMessage(text, isError = false) {
  if (!elements.betaInputMessage) return;
  elements.betaInputMessage.textContent = text;
  elements.betaInputMessage.classList.toggle("state-message--error", isError);
  elements.betaInputMessage.classList.toggle("is-hidden", !text);
}

function setFeedbackInputMessage(text, isError = false) {
  if (!elements.feedbackInputMessage) return;
  elements.feedbackInputMessage.textContent = text;
  elements.feedbackInputMessage.classList.toggle("state-message--error", isError);
  elements.feedbackInputMessage.classList.toggle("is-hidden", !text);
}

function canView(module) {
  return canViewModule(state.auth, module);
}

function canEdit(module = "feedback") {
  return canEditModule(state.auth, module);
}

function isAdmin() {
  return String(state.auth?.role || "").trim() === "Admin";
}

function updateBetaInputAccess() {
  if (!elements.betaInputPanel || !elements.betaInputForm) return;
  const allowed = canEdit("beta");
  elements.betaInputPanel.hidden = !allowed;
  if (!allowed) {
    elements.betaInputPanel.removeAttribute("open");
    setBetaInputMessage("");
  }
  elements.betaInputForm
    .querySelectorAll("input, select, textarea, button")
    .forEach((control) => {
      control.disabled = !allowed;
    });
}

function updateFeedbackInputAccess() {
  if (!elements.feedbackAdd || !elements.feedbackInputPanel || !elements.feedbackInputForm) return;
  const allowed = canEdit("feedback");
  elements.feedbackAdd.hidden = !allowed;
  elements.feedbackInputPanel.hidden = !allowed;
  if (!allowed) {
    elements.feedbackInputPanel.classList.add("is-hidden");
    setFeedbackInputMessage("");
  }
  elements.feedbackInputForm
    .querySelectorAll("input, select, textarea, button")
    .forEach((control) => {
      control.disabled = !allowed;
    });
}

function setLoginMessage(text, isError = false) {
  elements.loginMessage.textContent = text;
  elements.loginMessage.classList.toggle("state-message--error", isError);
}

function saveAuth(auth) {
  state.auth = normalizePermissions(auth);
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state.auth));
}

function clearAuth() {
  state.auth = null;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function showLogin() {
  elements.loginScreen.classList.remove("is-hidden");
  elements.appShell.classList.add("is-hidden");
}

function firstAllowedView() {
  return normalizePermissions(state.auth).views[0] || "feedback";
}

function updateViewAccess() {
  elements.viewTabs.forEach((button) => {
    const view = button.dataset.view;
    button.hidden = !canView(view);
  });
  if (!canView(state.activeView)) {
    state.activeView = firstAllowedView();
  }
}

function showDashboard() {
  elements.loginScreen.classList.add("is-hidden");
  elements.appShell.classList.remove("is-hidden");
  elements.authRole.textContent = `${state.auth?.role || "Viewer"} · ${state.auth?.username || ""}`;
  updateViewAccess();
  updateFeedbackInputAccess();
  updateBetaInputAccess();
  setActiveView(state.activeView);
}

async function credentialHash(username, password) {
  if (!window.crypto?.subtle) {
    throw new Error("This browser cannot securely prepare the login request.");
  }
  const text = `${String(username || "").trim().toLowerCase()}:${String(password || "")}`;
  const bytes = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function login(username, password) {
  const passwordHash = await credentialHash(username, password);
  const payload = await callGoogleAppsScript({
    action: "login",
    username: String(username || "").trim(),
    passwordHash,
  });
  if (!payload?.ok || !payload?.token) {
    throw new Error(payload?.message || "Login failed.");
  }
  return {
    token: payload.token,
    username: payload.username,
    role: payload.role,
    edits: payload.edits,
    views: payload.views,
    expiresAt: payload.expiresAt,
  };
}

async function verifySession(auth) {
  if (!auth?.token) return null;
  const payload = await callGoogleAppsScript({
    action: "session",
    authToken: auth.token,
  });
  if (!payload?.ok) return null;
  return {
    token: auth.token,
    username: payload.username,
    role: payload.role,
    edits: payload.edits,
    views: payload.views,
    expiresAt: payload.expiresAt,
  };
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

function renderBetaFilterOptions() {
  const currentModel = elements.betaModel.value;
  const currentVersion = elements.betaVersion.value;
  const models = uniqueBetaModels(state.betaRecords);
  const selectedModel = models.includes(currentModel) ? currentModel : "all";
  const versions = uniqueBetaVersions(state.betaRecords, selectedModel);

  elements.betaModel.innerHTML = `<option value="all">All Models</option>${models
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("")}`;
  elements.betaVersion.innerHTML = `<option value="all">All Versions</option>${versions
    .map((version) => `<option value="${escapeHtml(version)}">${escapeHtml(version)}</option>`)
    .join("")}`;

  elements.betaModel.value = selectedModel;
  elements.betaVersion.value = versions.includes(currentVersion) ? currentVersion : "all";
  state.betaFilters.model = elements.betaModel.value;
  state.betaFilters.version = elements.betaVersion.value;
}

function renderSummary(records) {
  const summary = summarizeFeedback(records);
  const percentages = summaryPercentages(summary);
  const items = [
    ["total", "Total", summary.total, "summary-total", ""],
    ["todo", "To Submit", summary.statusCounts.todo, "summary-todo", percentages.todo],
    ["submitted", "Submitted", summary.statusCounts.submitted, "summary-submitted", percentages.submitted],
    ["inProgress", "In Progress", summary.statusCounts.inProgress, "summary-progress", percentages.inProgress],
    ["resolved", "Resolved", summary.statusCounts.resolved, "summary-resolved", percentages.resolved],
    ["unresolvedBug", "Unresolved BUG", summary.unresolvedBugs, "summary-bug", percentages.unresolvedBug],
  ];
  elements.summary.innerHTML = items
    .map(
      ([key, label, value, className, percent]) => `
        <button
          class="${className}${state.summaryFilter === key ? " is-active" : ""}"
          type="button"
          data-summary-filter="${key}"
          aria-pressed="${state.summaryFilter === key ? "true" : "false"}"
        >
          <span>${escapeHtml(label)}</span>
          ${percent ? `<small class="summary-percent">${escapeHtml(percent)}</small>` : ""}
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

function renderBetaSummary(records) {
  const summary = summarizeBetaTests(records);
  const items = [
    ["Total Issues", summary.total, "beta-total"],
    ["Open", summary.open, "beta-open"],
    ["In Progress", summary.inProgress, "beta-progress"],
    ["Resolved", summary.resolved, "beta-resolved"],
    ["Critical / High", summary.highSeverity, "beta-high"],
    ["User Test Issues", summary.userTestIssues, "beta-user"],
  ];
  elements.betaSummary.innerHTML = items
    .map(
      ([label, value, className]) => `
        <div class="${className}">
          <span>${escapeHtml(label)}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join("");
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

function syncFirmwareClosedRequests(release, closedRequests) {
  return callGoogleAppsScript({
    action: "updateFirmwareClosedRequests",
    closedRequests,
    authToken: state.auth?.token || "",
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
            ${
              canEdit("firmware")
                ? `<button class="edit-closed-requests" type="button" data-release-index="${index}">Edit</button>`
                : ""
            }
          </div>
          <div class="closed-request-list">${closedRequests}</div>
          ${
            canEdit("firmware")
              ? `
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
              `
              : ""
          }
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

function betaSeverityClass(severity) {
  const value = cleanText(severity).toLowerCase();
  if (value === "critical") return "severity-critical";
  if (value === "high") return "severity-high";
  if (value === "medium") return "severity-medium";
  if (value === "low") return "severity-low";
  return "severity-unknown";
}

function betaRecordTemplate(record, index) {
  const chips = [
    record.severity ? `<span class="severity-pill ${betaSeverityClass(record.severity)}">${escapeHtml(record.severity)}</span>` : "",
    record.priority ? `<span class="priority-pill">${escapeHtml(record.priority)}</span>` : "",
    record.status ? `<span class="status-pill">${escapeHtml(record.status)}</span>` : "",
  ]
    .filter(Boolean)
    .join("");
  return `
    <article class="beta-card" data-beta-index="${index}" role="button" tabindex="0">
      <div>
        <p>${escapeHtml(record.productModel || "-")}</p>
        <h3>${escapeHtml(record.keyPoint || record.issueFound || record.rawInput || "No key point")}</h3>
      </div>
      <div class="beta-card-meta">
        <span>${escapeHtml(record.version || "-")}</span>
        <span>${escapeHtml(record.testItem || "-")}</span>
        <span>${escapeHtml(record.testType || "-")}</span>
      </div>
      <div class="beta-card-chips">${chips}</div>
      <p class="beta-next-action">${escapeHtml(record.nextAction || record.notes || "-")}</p>
    </article>
  `;
}

function inputTemplate(name, value, type = "text") {
  return `<input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" />`;
}

function textareaTemplate(name, value, rows = 4) {
  return `<textarea name="${escapeHtml(name)}" rows="${rows}">${escapeHtml(value)}</textarea>`;
}

function betaSelectTemplate(name, value, options) {
  return `
    <select name="${escapeHtml(name)}">
      ${options
        .map((option) => `<option value="${escapeHtml(option)}"${option === value ? " selected" : ""}>${escapeHtml(option || "-")}</option>`)
        .join("")}
    </select>
  `;
}

function betaEditableRow(record, header, value, fieldHtml, size = "medium") {
  return canEdit("beta") ? editableDetailRow(betaDetailLabel(header), fieldHtml, size) : detailRow(betaDetailLabel(header), value);
}

function openBetaDetail(record) {
  document.body.classList.add("detail-open");
  elements.detail.classList.remove("is-hidden");
  elements.detail.innerHTML = `
    <div class="detail-panel__header">
      <div>
        <div class="beta-card-chips">
          ${record.severity ? `<span class="severity-pill ${betaSeverityClass(record.severity)}">${escapeHtml(record.severity)}</span>` : ""}
          ${record.priority ? `<span class="priority-pill">${escapeHtml(record.priority)}</span>` : ""}
          ${record.status ? `<span class="status-pill">${escapeHtml(record.status)}</span>` : ""}
        </div>
        <p class="beta-detail-heading">${escapeHtml(betaDetailHeading(record) || "Beta test detail")}</p>
        <h2>${escapeHtml(record.issueFound || "Beta test detail")}</h2>
      </div>
      <div class="detail-actions">
        <button type="button" id="close-detail">Close</button>
      </div>
    </div>
    <dl class="detail-list">
      ${detailRow("Date", record.date)}
      ${detailRow("Product Model", record.productModel)}
      ${betaEditableRow(record, "Version", record.version, inputTemplate("Version", record.version))}
      ${betaEditableRow(record, "Test Item", record.testItem, inputTemplate("Test Item", record.testItem))}
      ${betaEditableRow(
        record,
        "Test Type",
        record.testType,
        betaSelectTemplate("Test Type", record.testType, ["", "Firmware Beta", "APP Beta", "CPS Beta", "Hardware Test", "Regression Test"]),
      )}
      ${betaEditableRow(
        record,
        "Tester Type",
        record.testerType,
        betaSelectTemplate("Tester Type", record.testerType, ["", "Internal Test", "User Beta Test", "Engineer Test", "KOC Test"]),
      )}
      ${detailRow("Tester / Owner", record.testerOwner)}
      ${betaEditableRow(
        record,
        "Issue Source",
        record.issueSource,
        betaSelectTemplate("Issue Source", record.issueSource, ["", "Internal Test", "User Beta Test", "Engineer Test", "KOC Test", "User Feedback", "Internal QA"]),
      )}
      ${betaEditableRow(record, "Issue Found", record.issueFound, textareaTemplate("Issue Found", record.issueFound, 4), "wide")}
      ${betaEditableRow(record, "Key Point", record.keyPoint, textareaTemplate("Key Point", record.keyPoint, 3), "wide")}
      ${betaEditableRow(record, "Severity", record.severity, betaSelectTemplate("Severity", record.severity, ["", "Critical", "High", "Medium", "Low"]), "short")}
      ${betaEditableRow(record, "Priority", record.priority, betaSelectTemplate("Priority", record.priority, ["", "P0", "P1", "P2"]), "short")}
      ${betaEditableRow(
        record,
        "Status",
        record.status,
        betaSelectTemplate("Status", record.status, ["", "Open", "Need Review", "Reproducing", "In Progress", "Resolved", "Closed"]),
        "short",
      )}
      ${betaEditableRow(record, "Assigned To", record.assignedTo, inputTemplate("Assigned To", record.assignedTo))}
      ${betaEditableRow(record, "Engineering Response", record.engineeringResponse, textareaTemplate("Engineering Response", record.engineeringResponse, 3), "wide")}
      ${betaEditableRow(record, "Next Action", record.nextAction, textareaTemplate("Next Action", record.nextAction, 3), "wide")}
      ${betaEditableRow(record, "Target Date", record.targetDate, inputTemplate("Target Date", record.targetDate, "date"), "short")}
      ${betaEditableRow(record, "Resolved Date", record.resolvedDate, inputTemplate("Resolved Date", record.resolvedDate, "date"), "short")}
      ${betaEditableRow(record, "Related Request Number", record.relatedRequestNumber, inputTemplate("Related Request Number", record.relatedRequestNumber))}
      ${betaEditableRow(record, "Related Firmware Version", record.relatedFirmwareVersion, inputTemplate("Related Firmware Version", record.relatedFirmwareVersion))}
      ${betaEditableRow(record, "Notes", record.notes, textareaTemplate("Notes", record.notes, 5), "wide")}
      ${detailRow("Edit Log", record.editLog)}
    </dl>
    ${canEdit("beta") ? `<button class="save-detail-changes beta-save-follow-up" type="button">Save Changes</button>` : ""}
  `;
  elements.detail.querySelector(".beta-save-follow-up")?.addEventListener("click", async () => {
    if (!canEdit("beta")) {
      showToast("You do not have permission to edit.");
      return;
    }
    const changes = betaChangedFields(record);
    if (!Object.keys(changes).length) {
      showToast("No changes to save");
      return;
    }
    setDetailSaving(true);
    try {
      const result = await syncBetaRecordChanges(record, changes);
      applySavedBetaChanges(record, changes, result);
      renderBeta();
      openBetaDetail(record);
      showToast("Changes saved");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Update failed");
    } finally {
      setDetailSaving(false);
    }
  });
  document.querySelector("#close-detail").addEventListener("click", () => {
    elements.detail.classList.add("is-hidden");
    document.body.classList.remove("detail-open");
  });
}

function renderBeta() {
  const visible = filterBetaTests(state.betaRecords, state.betaFilters).sort((a, b) =>
    String(b.date).localeCompare(String(a.date)),
  );
  renderBetaSummary(visible);
  if (!state.betaRecords.length && !elements.betaMessage.textContent) {
    setBetaMessage("No beta test records found.");
  } else if (state.betaRecords.length && !visible.length) {
    setBetaMessage("No beta test records match the selected filters.");
  } else if (state.betaRecords.length) {
    setBetaMessage("");
  }
  elements.betaList.innerHTML = visible.length
    ? visible.map((record) => betaRecordTemplate(record, state.betaRecords.indexOf(record))).join("")
    : "";

  elements.betaList.querySelectorAll(".beta-card").forEach((card) => {
    card.addEventListener("click", () => openBetaDetail(state.betaRecords[Number(card.dataset.betaIndex)]));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openBetaDetail(state.betaRecords[Number(card.dataset.betaIndex)]);
    });
  });
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

function betaRecordMatchPayload(record) {
  return {
    rowNumber: record.rowNumber,
    date: record.date,
    productModel: record.productModel,
    version: record.version,
    testerOwner: record.testerOwner,
    issueFound: record.issueFound,
    rawInput: record.rawInput,
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

async function verifyEditPermission(module = "feedback") {
  if (!canEdit(module)) {
    throw new Error("You do not have permission to edit this section.");
  }
  const payload = await callGoogleAppsScript({
    action: "ping",
    authToken: state.auth?.token || "",
    module,
  });
  if (!payload?.ok || !payload?.canEdit) {
    throw new Error("You do not have permission to edit.");
  }
}

function syncChangesToGoogleSheet(record, changes) {
  return callGoogleAppsScript({
      action: "updateFeedbackFields",
      status: changes["Dashboard Status"] || "",
      changes: JSON.stringify(changes),
      authToken: state.auth?.token || "",
      match: JSON.stringify(recordMatchPayload(record)),
    }).then((payload) => {
      if (payload?.ok) return payload;
      throw new Error(payload?.message || "Update failed.");
    });
}

function feedbackPayloadFromInput() {
  return {
    Date: elements.feedbackInputDate.value.trim(),
    Model: elements.feedbackInputModel.value.trim(),
    ID: elements.feedbackInputId.value.trim(),
    Email: elements.feedbackInputEmail.value.trim(),
    Profile: "",
    "Update Category": elements.feedbackInputCategory.value.trim(),
    "Key Points": elements.feedbackInputKeyPoints.value.trim(),
    "Upgrade requirements": elements.feedbackInputUpgrade.value.trim(),
    Chinese: elements.feedbackInputChinese.value.trim(),
    Notes: elements.feedbackInputNotes.value.trim(),
    "Request number": elements.feedbackInputRequest.value.trim(),
    ING: "",
    Priority: elements.feedbackInputPriority.value.trim(),
    DONE: "",
    Channel: elements.feedbackInputChannel.value.trim(),
    "Dashboard Status": elements.feedbackInputStatus.value.trim() || "To Submit",
  };
}

function feedbackInputDateFromMatch(match) {
  if (!match) return "";
  const year = match[1].length === 2 ? `20${match[1]}` : match[1];
  return `${year}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function likelyFeedbackName(value) {
  const text = String(value || "").trim();
  if (!text || text.length > 60 || /[：:，,.;!?]/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 4 && words.every((word) => /^[A-Z][A-Za-z'’-]+$/.test(word));
}

function extractFeedbackModels(text) {
  const knownModels = ["EZTALK65", "RA89R", "HA1UV", "HA1G", "HA2", "HD1", "HD2", "MA1", "M17", "H1", "A3"];
  const nonModels = new Set(["APP", "CPS", "PTT", "QRP", "SDR", "DMR", "APRS", "GNSS", "USPS"]);
  const seen = new Set();
  const models = [];
  const addModel = (value) => {
    const model = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!model || seen.has(model) || nonModels.has(model) || /^V\d/i.test(model)) return;
    if (knownModels.includes(model) || /^[A-Z]{1,8}\d[A-Z0-9-]*$/.test(model)) {
      seen.add(model);
      models.push(model);
    }
  };

  const matches = String(text || "").match(/[A-Z]+[A-Z0-9]*(?:\/[A-Z0-9]+)?(?:-[A-Z0-9]+)?/gi) || [];
  for (const match of matches) {
    const slash = match.match(/^([A-Z]+\d+[A-Z0-9]*?)\/([A-Z][A-Z0-9]*)$/i);
    if (slash) {
      addModel(slash[1]);
      const prefix = slash[1].match(/^([A-Z]+\d+)/i)?.[1] || "";
      addModel(`${prefix}${slash[2]}`);
      continue;
    }
    addModel(match);
  }
  return models;
}

function inferFeedbackCategory(text) {
  if (/(love|great|good|excellent|thanks|喜欢|很好|不错)/i.test(text)) return "Positive review";
  if (/(horrible|garbage|bad|waste|terrible|差|糟糕)/i.test(text)) return "Negative review";
  if (/(crash|freeze|reboot|fail|cannot|doesn.?t work|no audio|weak|bug|issue|problem|无法|不能|失败|问题|卡死|重启)/i.test(text)) {
    return "BUG";
  }
  if (/(add|need|want|wish|request|option|support|bring back|希望|增加|支持|功能)/i.test(text)) return "Feature Request";
  if (/(improve|optimi[sz]e|better|enhance|优化|改进)/i.test(text)) return "Feature Enhancement";
  return "";
}

function inferFeedbackPriority(text, category) {
  if (/(brick|dead|cannot power|crash|reboot|no tx|no rx|no audio|无法开机|变砖|不能发射|不能接收)/i.test(text)) return "P1";
  if (category === "BUG") return "P2";
  return "P2";
}

function inferFeedbackKeyPoint(text, category) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  if (/(weak.*modulation|modulation.*weak|microphone|mic gain|麦克风|调制)/i.test(clean)) {
    return "Weak TX modulation or microphone audio needs engineering verification.";
  }
  if (/(aprs|gnss|packet|位置|定位)/i.test(clean)) {
    return "APRS/GNSS behavior or settings need validation against expected firmware behavior.";
  }
  if (/(usps|package|shipping|lost in.*system|物流|包裹)/i.test(clean)) {
    return "User reports package/shipping issue; confirm whether this belongs to support follow-up.";
  }
  if (/(6m|six meter|50mhz|50 mhz)/i.test(clean)) {
    return "User requests better 6m amateur radio equipment or antenna support.";
  }
  if (category === "Positive review") return "Positive product feedback; no engineering action unless paired with a request.";
  if (category === "Negative review") return "Negative product feedback; identify concrete receiver, audio, or usability issue before engineering follow-up.";
  return clean.split(/\n+/).map((line) => line.trim()).find(Boolean) || "";
}

function inferFeedbackDraft(input) {
  const raw = String(input || "").trim();
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const issueLines = [];
  let date = "";
  let userId = "";
  let email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  let requestNumber = raw.match(/rt\s*[\d-]+/i)?.[0]?.replace(/\s+/g, "").toUpperCase() || "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fieldMatch = line.match(/^(?:user|from|name|tester|owner|id)\s*[:：]\s*(.+)$/i);
    if (fieldMatch) {
      userId ||= fieldMatch[1].trim();
      continue;
    }

    const standaloneDate = line.match(/^(?:date\s*[:：]\s*)?(\d{4}|\d{2})[/-](\d{1,2})[/-](\d{1,2})$/i);
    if (standaloneDate) {
      date ||= feedbackInputDateFromMatch(standaloneDate);
      continue;
    }

    const leadDate = line.match(/^(\d{4}|\d{2})[/-](\d{1,2})[/-](\d{1,2})\s+(.+)$/);
    if (leadDate) {
      date ||= feedbackInputDateFromMatch(leadDate);
      let rest = leadDate[4].trim();
      const namePrefix = rest.match(/^([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})(?:\s+(.+))?$/);
      if (namePrefix && likelyFeedbackName(namePrefix[1])) {
        userId ||= namePrefix[1];
        rest = (namePrefix[2] || "").trim();
      }
      if (rest) issueLines.push(rest);
      continue;
    }

    const inlineDate = line.match(/(\d{4}|\d{2})[/-](\d{1,2})[/-](\d{1,2})/);
    if (inlineDate && !date) date = feedbackInputDateFromMatch(inlineDate);

    if (!userId && likelyFeedbackName(line) && (index === lines.length - 1 || lines.length > 1)) {
      userId = line;
      continue;
    }

    if (line === email || line === requestNumber) continue;
    issueLines.push(line);
  }

  const originalFeedback = issueLines.join("\n").trim() || raw;
  const models = extractFeedbackModels(raw);
  const channel = /whatsapp/i.test(raw)
    ? "WhatsApp"
    : /facebook|fb/i.test(raw)
      ? "Facebook"
      : /email|@/i.test(raw)
        ? "Email"
        : "";
  const category = inferFeedbackCategory(originalFeedback);
  return {
    date,
    model: models.join(", "),
    userId,
    email,
    requestNumber,
    channel,
    category,
    priority: inferFeedbackPriority(originalFeedback, category),
    keyPoints: inferFeedbackKeyPoint(originalFeedback, category),
    originalFeedback,
  };
}

function analyzeFeedbackInput() {
  if (!canEdit("feedback")) {
    showToast("You do not have permission to analyze feedback input.");
    return;
  }
  const rawInput = elements.feedbackRawInput.value.trim();
  if (!rawInput) {
    setFeedbackInputMessage("Paste Raw Input first.", true);
    return;
  }
  const draft = inferFeedbackDraft(rawInput);
  if (draft.date) elements.feedbackInputDate.value = draft.date;
  if (draft.model && !elements.feedbackInputModel.value.trim()) elements.feedbackInputModel.value = draft.model;
  if (draft.userId && !elements.feedbackInputId.value.trim()) elements.feedbackInputId.value = draft.userId;
  if (draft.email && !elements.feedbackInputEmail.value.trim()) elements.feedbackInputEmail.value = draft.email;
  if (draft.category && !elements.feedbackInputCategory.value.trim()) elements.feedbackInputCategory.value = draft.category;
  if (draft.priority) elements.feedbackInputPriority.value = draft.priority;
  if (draft.requestNumber && !elements.feedbackInputRequest.value.trim()) elements.feedbackInputRequest.value = draft.requestNumber;
  if (draft.channel && !elements.feedbackInputChannel.value.trim()) elements.feedbackInputChannel.value = draft.channel;
  if (draft.keyPoints && !elements.feedbackInputKeyPoints.value.trim()) elements.feedbackInputKeyPoints.value = draft.keyPoints;
  elements.feedbackInputUpgrade.value = draft.originalFeedback;
  elements.feedbackGeneratedFields.open = true;
  setFeedbackInputMessage("Draft generated. Original Feedback keeps the user's original words.");
}

function syncFeedbackRecord(record) {
  return callGoogleAppsScript({
    action: "addFeedbackRecord",
    authToken: state.auth?.token || "",
    record: JSON.stringify(record),
  }).then((payload) => {
    if (payload?.ok) return payload;
    throw new Error(payload?.message || "Save failed.");
  });
}

function clearFeedbackInput() {
  if (!canEdit("feedback")) {
    showToast("You do not have permission to clear feedback input.");
    return;
  }
  elements.feedbackInputForm.reset();
  elements.feedbackInputPriority.value = "P2";
  elements.feedbackInputStatus.value = "To Submit";
  setFeedbackInputMessage("");
}

function toggleFeedbackInput(open) {
  if (!canEdit("feedback")) {
    showToast("You do not have permission to add feedback records.");
    return;
  }
  elements.feedbackInputPanel.classList.toggle("is-hidden", !open);
  elements.feedbackAdd.textContent = open ? "Close Add" : "+ Add Feedback";
  if (open && !elements.feedbackInputDate.value) {
    elements.feedbackInputDate.value = new Date().toISOString().slice(0, 10);
  }
}

async function saveFeedbackInput() {
  if (!canEdit("feedback")) {
    setFeedbackInputMessage("You do not have permission to save feedback records.", true);
    return;
  }
  if (!elements.feedbackInputKeyPoints.value.trim() && !elements.feedbackInputUpgrade.value.trim()) {
    setFeedbackInputMessage("Key Points or Original Feedback is required.", true);
    return;
  }
  if (!elements.feedbackInputDate.value.trim()) {
    elements.feedbackInputDate.value = new Date().toISOString().slice(0, 10);
  }

  const record = feedbackPayloadFromInput();
  elements.feedbackSave.disabled = true;
  elements.feedbackSave.textContent = "Saving...";
  setFeedbackInputMessage("Saving feedback record...");
  try {
    await verifyEditPermission("feedback");
    const result = await syncFeedbackRecord(record);
    const normalized = normalizeRow({
      ...record,
      "Last Modified At": result.lastModifiedAt || "",
      "Last Modified By": result.lastModifiedBy || "",
    });
    state.records.unshift(normalized);
    renderModelOptions();
    render();
    clearFeedbackInput();
    setFeedbackInputMessage("Saved to Feedback Board.");
  } catch (error) {
    setFeedbackInputMessage(error instanceof Error ? error.message : "Save failed.", true);
  } finally {
    elements.feedbackSave.disabled = false;
    elements.feedbackSave.textContent = "Save to Sheet";
  }
}

function betaPayloadFromInput() {
  return {
    Date: elements.betaInputDate.value.trim(),
    "Product Model": elements.betaInputModel.value.trim(),
    Version: elements.betaInputVersion.value.trim(),
    "Test Type": elements.betaInputTestType.value.trim(),
    "Test Item": elements.betaInputTestItem.value.trim(),
    "Tester Type": elements.betaInputTesterType.value.trim(),
    "Tester / Owner": elements.betaInputTesterOwner.value.trim(),
    "Issue Source": elements.betaInputTesterType.value.trim(),
    "Issue Found": elements.betaInputIssueFound.value.trim(),
    "Key Point": elements.betaInputKeyPoint.value.trim(),
    Severity: elements.betaInputSeverity.value.trim(),
    Priority: elements.betaInputPriority.value.trim(),
    Status: elements.betaInputStatus.value.trim(),
    "Assigned To": "",
    "Engineering Response": "",
    "Next Action": elements.betaInputNextAction.value.trim(),
    "Target Date": "",
    "Resolved Date": "",
    "Related Request Number": "",
    "Related Firmware Version": elements.betaInputVersion.value.trim(),
    Notes: "",
    "Raw Input": elements.betaRawInput.value.trim(),
  };
}

function syncBetaTestRecord(record) {
  return callGoogleAppsScript({
    action: "addBetaTestRecord",
    authToken: state.auth?.token || "",
    record: JSON.stringify(record),
  }).then((payload) => {
    if (payload?.ok) return payload;
    throw new Error(payload?.message || "Save failed.");
  });
}

function syncBetaRecordChanges(record, changes) {
  return callGoogleAppsScript({
    action: "updateBetaTestRecord",
    authToken: state.auth?.token || "",
    match: JSON.stringify(betaRecordMatchPayload(record)),
    changes: JSON.stringify(changes),
  }).then((payload) => {
    if (payload?.ok) return payload;
    throw new Error(payload?.message || "Update failed.");
  });
}

function analyzeBetaInput() {
  if (!canEdit("beta")) {
    showToast("You do not have permission to analyze beta input.");
    return;
  }
  const rawInput = elements.betaRawInput.value.trim();
  if (!rawInput) {
    setBetaInputMessage("Paste beta test content first.", true);
    return;
  }
  const draft = inferBetaDraft(rawInput);
  if (!elements.betaInputDate.value) {
    elements.betaInputDate.value = draft.date || new Date().toISOString().slice(0, 10);
  }
  if (!elements.betaInputTesterOwner.value.trim() && draft.testerOwner) {
    elements.betaInputTesterOwner.value = draft.testerOwner;
  }
  elements.betaInputIssueFound.value = draft.issueFound;
  elements.betaInputKeyPoint.value = draft.keyPoint;
  elements.betaInputSeverity.value = draft.severity;
  elements.betaInputPriority.value = draft.priority;
  elements.betaInputStatus.value = draft.status;
  elements.betaInputNextAction.value = draft.nextAction;
  setBetaInputMessage("Draft generated. Review it, then save to Sheet.");
}

function clearBetaInput() {
  if (!canEdit("beta")) {
    showToast("You do not have permission to clear beta input.");
    return;
  }
  elements.betaInputForm.reset();
  elements.betaInputKeyPoint.value = "";
  elements.betaInputPriority.value = "P2";
  elements.betaInputSeverity.value = "Medium";
  elements.betaInputStatus.value = "Open";
  setBetaInputMessage("");
}

async function saveBetaInput() {
  if (!canEdit("beta")) {
    setBetaInputMessage("You do not have permission to save beta test records.", true);
    return;
  }
  if (!elements.betaRawInput.value.trim()) {
    setBetaInputMessage("Raw Input is required.", true);
    return;
  }
  if (!elements.betaInputIssueFound.value.trim()) {
    analyzeBetaInput();
  }
  const record = betaPayloadFromInput();
  elements.betaSave.disabled = true;
  elements.betaSave.textContent = "Saving...";
  setBetaInputMessage("Saving beta test record...");
  try {
    await verifyEditPermission("beta");
    const result = await syncBetaTestRecord(record);
    state.betaRecords.unshift(normalizeBetaRow({ ...record, __rowNumber: result.row || "" }));
    renderBetaFilterOptions();
    renderBeta();
    clearBetaInput();
    setBetaInputMessage("Saved to Beta Test Progress.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed.";
    const friendlyMessage = message.includes("Missing feedback identity")
      ? "Apps Script is still running the old version. Deploy the updated Apps Script, then try again."
      : message;
    setBetaInputMessage(friendlyMessage, true);
  } finally {
    elements.betaSave.disabled = false;
    elements.betaSave.textContent = "Save to Sheet";
  }
}

async function saveRecordChanges(record, changes) {
  showToast("Saving changes...");
  try {
    const result = await syncChangesToGoogleSheet(record, changes);
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

function permissionAwareDetailRow(label, value, fieldHtml, size = "medium") {
  return canEdit("feedback") ? editableDetailRow(label, fieldHtml, size) : detailRow(label, value);
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

const BETA_FIELD_TO_RECORD_KEY = {
  Version: "version",
  "Test Item": "testItem",
  "Test Type": "testType",
  "Tester Type": "testerType",
  "Issue Source": "issueSource",
  "Issue Found": "issueFound",
  "Key Point": "keyPoint",
  Severity: "severity",
  Priority: "priority",
  Status: "status",
  "Assigned To": "assignedTo",
  "Engineering Response": "engineeringResponse",
  "Next Action": "nextAction",
  "Target Date": "targetDate",
  "Resolved Date": "resolvedDate",
  "Related Request Number": "relatedRequestNumber",
  "Related Firmware Version": "relatedFirmwareVersion",
  Notes: "notes",
};

function betaOriginalEditableValues(record) {
  return Object.entries(BETA_FIELD_TO_RECORD_KEY).reduce((values, [field, key]) => {
    values[field] = record[key] || "";
    return values;
  }, {});
}

function betaChangedFields(record) {
  const current = fieldValuesFromDetail();
  const original = betaOriginalEditableValues(record);
  return Object.entries(current).reduce((changes, [field, value]) => {
    if (!Object.prototype.hasOwnProperty.call(original, field)) return changes;
    if ((original[field] || "") !== value) {
      changes[field] = value;
    }
    return changes;
  }, {});
}

function applySavedBetaChanges(record, changes, result = {}) {
  Object.entries(changes).forEach(([field, value]) => {
    const key = BETA_FIELD_TO_RECORD_KEY[field];
    if (key) record[key] = value;
  });
  if (result.editLog !== undefined) record.editLog = result.editLog;
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

function firmwareFullLog(release) {
  return cleanText(release.changeLog || release.chineseLog || "-");
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
          (release) => {
            const fullLog = firmwareFullLog(release);
            return `
            <article>
              <strong>${escapeHtml(release.model || "-")} · ${escapeHtml(release.version || "-")}</strong>
              <span>${escapeHtml(release.date || "-")}</span>
              <details class="linked-firmware-details">
                <summary>View full firmware log</summary>
                <p>${escapeHtml(fullLog)}</p>
              </details>
            </article>
          `;
          },
        )
        .join("")}
    </section>
  `;
}

function detailHeaderTagsTemplate(record) {
  return `
    <div class="detail-header-tags">
      ${record.model ? `<span class="detail-tag detail-tag--model">${escapeHtml(record.model)}</span>` : ""}
      ${categoryPillsTemplate(record)}
      ${record.priority ? `<span class="priority-pill">${escapeHtml(record.priority)}</span>` : ""}
    </div>
  `;
}

function detailSummaryTemplate(record) {
  const meta = [record.requestNumber, record.date, record.id].filter(Boolean).join(" · ");
  return `
    <section class="detail-summary-card">
      <div class="card-meta">
        ${record.status ? `<span class="status-pill">${escapeHtml(STATUS_LABELS[record.status] || record.status)}</span>` : ""}
        ${record.channel ? `<span class="category-pill category-unknown">${escapeHtml(record.channel)}</span>` : ""}
      </div>
      <h2>${escapeHtml(record.keyPoints || "Feedback detail")}</h2>
      ${meta ? `<p>${escapeHtml(meta)}</p>` : ""}
    </section>
  `;
}

function openDetail(record) {
  document.body.classList.add("detail-open");
  elements.detail.classList.remove("is-hidden");
  elements.detail.innerHTML = `
    <div class="detail-panel__header">
      ${detailHeaderTagsTemplate(record)}
      <div class="detail-actions">
        <button class="copy-detail-summary" type="button">Copy Engineer Summary</button>
        <button type="button" id="close-detail">Close</button>
      </div>
    </div>
    ${detailSummaryTemplate(record)}
    <dl class="detail-list">
      ${linkedFirmwareTemplate(record)}
      ${detailRow("Original Feedback", record.upgradeRequirements)}
      ${detailRow("Chinese", record.chinese)}
      ${permissionAwareDetailRow("Status", STATUS_LABELS[record.status] || "-", statusSelectTemplate(record), "short")}
      ${permissionAwareDetailRow("Priority", record.priority, prioritySelectTemplate(record), "short")}
      ${permissionAwareDetailRow("Request number", record.requestNumber, `<input name="Request number" value="${escapeHtml(record.requestNumber)}" />`)}
      ${permissionAwareDetailRow("DONE", record.done, doneSelectTemplate(record), "short")}
      ${permissionAwareDetailRow("ING", record.ing, `<textarea name="ING" rows="3">${escapeHtml(record.ing)}</textarea>`, "wide")}
      ${permissionAwareDetailRow("Notes", record.notes, `<textarea name="Notes" rows="4">${escapeHtml(record.notes)}</textarea>`, "wide")}
      ${modificationRowsTemplate(record)}
      ${detailRow("Model", record.model)}
      ${detailRow("User ID", record.id)}
      ${detailRow("Email", record.email)}
      ${detailRow("Profile", record.profile)}
      ${detailRow("Channel", record.channel)}
      ${detailRow("Date", record.date)}
    </dl>
    ${canEdit("feedback") ? `<button class="save-detail-changes" type="button">Save Changes</button>` : ""}
  `;
  document.querySelector(".copy-detail-summary").addEventListener("click", async () => {
    await copyEngineerSummary(record);
    showToast("Engineer summary copied");
  });
  document.querySelector(".save-detail-changes")?.addEventListener("click", async () => {
    if (!canEdit("feedback")) {
      showToast("You do not have permission to edit.");
      return;
    }
    const changes = changedFields(record);
    if (!Object.keys(changes).length) {
      showToast("No changes to save");
      return;
    }
    const confirmed = window.confirm(`Confirm changes?\n\n${changesSummary(record, changes)}`);
    if (!confirmed) return;
    setDetailSaving(true);
    try {
      await verifyEditPermission("feedback");
      await saveRecordChanges(record, changes);
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
        const canonicalHeader = canonicalSheetHeader(header);
        if (!canonicalHeader) return;
        record[canonicalHeader] = sheetCellValue(row, index);
      });
      return record;
    })
    .filter(hasAnyValue);
}

function normalizeSheetHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const CANONICAL_SHEET_HEADERS = new Map(
  [...EXPECTED_SHEET_HEADERS].map((header) => [normalizeSheetHeader(header), header]),
);

function canonicalSheetHeader(value) {
  const text = String(value || "").trim();
  return CANONICAL_SHEET_HEADERS.get(normalizeSheetHeader(text)) || text;
}

function headerScore(headers) {
  return headers.filter((header) => EXPECTED_SHEET_HEADERS.has(canonicalSheetHeader(header))).length;
}

function tableRowValues(row) {
  return row?.c.map((_, index) => sheetCellValue(row, index)) || [];
}

function recordsFromDetectedHeaderRow(tableRows) {
  const searchLimit = Math.min(tableRows.length, 40);
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < searchLimit; index += 1) {
    const values = tableRowValues(tableRows[index]);
    const score = headerScore(values);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  }

  if (bestIndex >= 0 && bestScore >= 3) {
    return buildRecordsFromHeaders(tableRows.slice(bestIndex + 1), tableRowValues(tableRows[bestIndex]));
  }

  return null;
}

function hasRequiredHeaders(headers, requiredHeaders) {
  return requiredHeaders.every((header) => headers.includes(header));
}

function tableRowsToRecords(table, requiredHeaders = []) {
  if (requiredHeaders.length) {
    const detectedHeaderRecords = recordsFromDetectedHeaderRow(table.rows);
    if (detectedHeaderRecords) {
      return detectedHeaderRecords;
    }
  }

  const labels = table.cols.map((column) => canonicalSheetHeader(column.label));
  const ids = table.cols.map((column) => canonicalSheetHeader(column.id));
  const labelsHaveExpectedHeaders = headerScore(labels) > 0;
  const headers = labelsHaveExpectedHeaders ? labels : ids;
  const parsedRecords = buildRecordsFromHeaders(table.rows, headers);

  if (headerScore(headers) > 0 && hasRequiredHeaders(headers, requiredHeaders)) {
    return parsedRecords;
  }

  const fallbackHeaderRecords = recordsFromDetectedHeaderRow(table.rows);
  if (fallbackHeaderRecords) {
    return fallbackHeaderRecords;
  }

  throw new Error("Sheet header row was not detected. Please keep the field names row visible in the first 40 rows.");
}

function loadSheetRows({ gid = "", sheetName = "", requiredHeaders = [] }) {
  return new Promise((resolve, reject) => {
    const callbackName = `handleSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({
      tq: "select *",
      tqx: `out:json;responseHandler:${callbackName}`,
      headers: requiredHeaders.length ? "0" : "1",
      cacheBust: String(Date.now()),
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

      resolve(tableRowsToRecords(payload.table, requiredHeaders));
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
  if (!rows.length) return [];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return FIRMWARE_REQUIRED_HEADERS.filter((header) => !headers.includes(header));
}

function validateBetaRows(rows) {
  if (!rows.length) return [];
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return BETA_REQUIRED_HEADERS.filter((header) => !headers.includes(header));
}

async function loadFirmwareRecords() {
  const rows = await loadSheetRows({ sheetName: FIRMWARE_SHEET_NAME, requiredHeaders: FIRMWARE_REQUIRED_HEADERS });
  const releases = rows
    .map(normalizeFirmwareRow)
    .filter((release) => release.date || release.model || release.version || release.changeLog);
  const missing = validateFirmwareRows(rows);
  if (missing.length && !releases.length) {
    throw new Error(`Firmware Change Log is missing columns: ${missing.join(", ")}`);
  }
  return releases;
}

async function loadBetaRecords() {
  const payload = await callGoogleAppsScript({ action: "getBetaTestRecords" });
  if (!payload?.ok) {
    throw new Error(payload?.message || "Beta Test Progress is not available yet.");
  }
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const missing = validateBetaRows(rows);
  if (missing.length) {
    throw new Error(`Beta Test Progress is missing columns: ${missing.join(", ")}`);
  }
  return rows
    .map(normalizeBetaRow)
    .filter((record) => record.date || record.productModel || record.issueFound || record.rawInput);
}

async function load() {
  setMessage(canView("feedback") ? "Loading feedback data..." : "");
  setFirmwareMessage(canView("firmware") ? "Loading firmware data..." : "");
  setBetaMessage(canView("beta") ? "Loading beta test data..." : "");
  renderSummary([]);
  renderFirmwareSummary([]);
  renderBetaSummary([]);
  elements.board.innerHTML = "";
  elements.firmwareList.innerHTML = "";
  elements.betaList.innerHTML = "";
  try {
    const [feedbackRows, firmwareResult, betaResult] = await Promise.allSettled([
      canView("feedback") ? loadSheetRows({ gid: FEEDBACK_SHEET_GID }) : Promise.resolve([]),
      canView("firmware") ? loadFirmwareRecords() : Promise.resolve([]),
      canView("beta") ? loadBetaRecords() : Promise.resolve([]),
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

    if (betaResult.status === "fulfilled") {
      state.betaRecords = betaResult.value;
      renderBetaFilterOptions();
      setBetaMessage("");
    } else {
      state.betaRecords = [];
      setBetaMessage(
        betaResult.reason instanceof Error ? betaResult.reason.message : "Beta Test Progress is not available yet.",
        true,
      );
    }

    render();
    renderFirmware();
    renderBeta();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unknown loading error", true);
  }
}

function setActiveView(view) {
  if (!canView(view)) {
    view = firstAllowedView();
  }
  state.activeView = view;
  const hero = HERO_COPY[view] || HERO_COPY.feedback;
  if (elements.heroEyebrow) elements.heroEyebrow.textContent = hero.eyebrow;
  if (elements.heroTitle) elements.heroTitle.textContent = hero.title;
  if (elements.heroNote) elements.heroNote.textContent = hero.note;
  elements.viewTabs.forEach((button) => {
    const isActive = button.dataset.view === view;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  elements.feedbackView.classList.toggle("is-hidden", view !== "feedback");
  elements.firmwareView.classList.toggle("is-hidden", view !== "firmware");
  elements.betaView.classList.toggle("is-hidden", view !== "beta");
}

elements.viewTabs.forEach((button) => {
  button.addEventListener("click", () => {
    if (!canView(button.dataset.view)) return;
    setActiveView(button.dataset.view);
  });
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
elements.feedbackAdd.addEventListener("click", () => {
  const isClosed = elements.feedbackInputPanel.classList.contains("is-hidden");
  toggleFeedbackInput(isClosed);
});
elements.feedbackClose.addEventListener("click", () => toggleFeedbackInput(false));
elements.feedbackAnalyze.addEventListener("click", analyzeFeedbackInput);
elements.feedbackClear.addEventListener("click", clearFeedbackInput);
elements.feedbackInputForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveFeedbackInput();
});
elements.betaModel.addEventListener("change", () => {
  state.betaFilters.model = elements.betaModel.value;
  renderBetaFilterOptions();
  renderBeta();
});
elements.betaVersion.addEventListener("change", () => {
  state.betaFilters.version = elements.betaVersion.value;
  renderBeta();
});
elements.betaTesterType.addEventListener("change", () => {
  state.betaFilters.testerType = elements.betaTesterType.value;
  renderBeta();
});
elements.betaStatus.addEventListener("change", () => {
  state.betaFilters.status = elements.betaStatus.value;
  renderBeta();
});
elements.betaPriority.addEventListener("change", () => {
  state.betaFilters.priority = elements.betaPriority.value;
  renderBeta();
});
elements.betaSearch.addEventListener("input", () => {
  state.betaFilters.search = elements.betaSearch.value;
  renderBeta();
});
elements.betaDateFrom.addEventListener("change", () => {
  state.betaFilters.dateFrom = elements.betaDateFrom.value;
  renderBeta();
});
elements.betaDateTo.addEventListener("change", () => {
  state.betaFilters.dateTo = elements.betaDateTo.value;
  renderBeta();
});
elements.betaRefresh.addEventListener("click", load);
elements.betaAnalyze.addEventListener("click", analyzeBetaInput);
elements.betaClear.addEventListener("click", clearBetaInput);
elements.betaInputForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveBetaInput();
});
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

  if (!canEdit("firmware")) {
    showToast("You do not have permission to edit.");
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
    await verifyEditPermission("firmware");
    await syncFirmwareClosedRequests(release, nextValue);
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
elements.filterMore?.addEventListener("click", () => {
  const filterBar = elements.filterMore.closest(".filter-bar");
  const isExpanded = filterBar?.classList.toggle("is-expanded");
  elements.filterMore.setAttribute("aria-expanded", String(Boolean(isExpanded)));
  elements.filterMore.textContent = isExpanded ? "Hide Filters" : "More Filters";
});
elements.summary.addEventListener("click", (event) => {
  const button = event.target.closest("[data-summary-filter]");
  if (!button) return;

  const nextFilter = button.dataset.summaryFilter;
  state.summaryFilter = nextFilter === "total" || state.summaryFilter === nextFilter ? "" : nextFilter;
  render();
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = elements.loginUsername.value.trim();
  const password = elements.loginPassword.value;
  if (!username || !password) {
    setLoginMessage("Enter account and password.", true);
    return;
  }

  const submitButton = elements.loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";
  setLoginMessage("");

  try {
    const auth = await login(username, password);
    saveAuth(auth);
    elements.loginPassword.value = "";
    showDashboard();
    await load();
  } catch (error) {
    clearAuth();
    showLogin();
    setLoginMessage(error instanceof Error ? error.message : "Login failed.", true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
});

elements.logout.addEventListener("click", async () => {
  if (state.auth?.token) {
    callGoogleAppsScript({ action: "logout", authToken: state.auth.token }).catch(() => {});
  }
  clearAuth();
  elements.board.innerHTML = "";
  elements.firmwareList.innerHTML = "";
  elements.betaList.innerHTML = "";
  renderSummary([]);
  renderFirmwareSummary([]);
  renderBetaSummary([]);
  showLogin();
});

async function initAuth() {
  showLogin();
  let saved = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    clearAuth();
  }
  if (!saved?.token) return;

  setLoginMessage("Checking saved session...");
  try {
    const auth = await verifySession(saved);
    if (!auth) {
      clearAuth();
      setLoginMessage("");
      return;
    }
    saveAuth(auth);
    setLoginMessage("");
    showDashboard();
    await load();
  } catch {
    clearAuth();
    setLoginMessage("");
    showLogin();
  }
}

initAuth();
