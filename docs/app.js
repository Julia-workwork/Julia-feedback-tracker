import {
  STATUS_LABELS,
  categoryClass,
  filterFeedback,
  normalizeRow,
  summarizeFeedback,
  uniqueModels,
} from "./lib/domain.mjs";

const SHEET_ID = "1cVR8KAaFwuPyofT-byCk5gWwl5aL7FOsr6lgVV9w6IE";
const SHEET_GID = "1702171693";
const EXPECTED_SHEET_HEADERS = new Set([
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
]);

const state = {
  records: [],
  summaryFilter: "",
  filters: {
    model: "all",
    search: "",
    category: "",
    priority: "",
    dateFrom: "",
    dateTo: "",
  },
};

const elements = {
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

function renderModelOptions() {
  const current = elements.model.value;
  const models = uniqueModels(state.records);
  elements.model.innerHTML = `<option value="all">All Models</option>${models
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("")}`;
  elements.model.value = models.includes(current) ? current : "all";
  state.filters.model = elements.model.value;
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

function detailRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd></div>`;
}

function openDetail(record) {
  elements.detail.classList.remove("is-hidden");
  elements.detail.innerHTML = `
    <div class="detail-panel__header">
      <div>
        <div class="card-meta">${categoryPillsTemplate(record)}</div>
        <h2>${escapeHtml(record.keyPoints || "Feedback detail")}</h2>
      </div>
      <button type="button" id="close-detail">Close</button>
    </div>
    <dl class="detail-list">
      ${detailRow("Model", record.model)}
      ${detailRow("User ID", record.id)}
      ${detailRow("Email", record.email)}
      ${detailRow("Profile", record.profile)}
      ${detailRow("Channel", record.channel)}
      ${detailRow("Date", record.date)}
      ${detailRow("Priority", record.priority)}
      ${detailRow("Request number", record.requestNumber)}
      ${detailRow("ING", record.ing)}
      ${detailRow("DONE", record.done)}
      ${detailRow("Upgrade requirements", record.upgradeRequirements)}
      ${detailRow("Chinese", record.chinese)}
      ${detailRow("Notes", record.notes)}
    </dl>
  `;
  document.querySelector("#close-detail").addEventListener("click", () => {
    elements.detail.classList.add("is-hidden");
  });
}

function render() {
  const filtered = filterFeedback(state.records, state.filters);
  const visibleRecords = applySummaryFilter(filtered);
  renderSummary(filtered);
  renderBoard(visibleRecords);
  if (!state.records.length) {
    setMessage("Google Sheet loaded, but no feedback rows were found. Please check the sheet tab and headers.", true);
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

  return parsedRecords;
}

function loadSheetRows() {
  return new Promise((resolve, reject) => {
    const callbackName = `handleFeedbackSheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const query = new URLSearchParams({
      gid: SHEET_GID,
      tq: "select *",
      tqx: `out:json;responseHandler:${callbackName}`,
    });
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${query.toString()}`;

    window[callbackName] = (payload) => {
      delete window[callbackName];
      script.remove();

      if (payload.status !== "ok") {
        reject(new Error("Google Sheet is not publicly readable. Please share it as Anyone with the link can view."));
        return;
      }

      resolve(tableRowsToRecords(payload.table));
    };

    script.addEventListener("error", () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("Unable to load Google Sheets data."));
    });

    document.head.append(script);
  });
}

async function load() {
  setMessage("Loading Google Sheets data...");
  renderSummary([]);
  elements.board.innerHTML = "";
  try {
    state.records = (await loadSheetRows()).map(normalizeRow);
    renderModelOptions();
    render();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Unknown loading error", true);
  }
}

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
elements.refresh.addEventListener("click", load);
elements.summary.addEventListener("click", (event) => {
  const button = event.target.closest("[data-summary-filter]");
  if (!button) return;

  const nextFilter = button.dataset.summaryFilter;
  state.summaryFilter = nextFilter === "total" || state.summaryFilter === nextFilter ? "" : nextFilter;
  render();
});

load();
