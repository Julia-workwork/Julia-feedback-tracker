import {
  STATUS_LABELS,
  categoryClass,
  filterFeedback,
  normalizeRow,
  summarizeFeedback,
  uniqueModels,
} from "./lib/domain.mjs";
import { parseCsv } from "./lib/csv.mjs";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1cVR8KAaFwuPyofT-byCk5gWwl5aL7FOsr6lgVV9w6IE/export?format=csv&gid=1702171693";

const state = {
  records: [],
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
    ["Total", summary.total],
    ["To Submit", summary.statusCounts.todo],
    ["Submitted", summary.statusCounts.submitted],
    ["In Progress", summary.statusCounts.inProgress],
    ["Resolved", summary.statusCounts.resolved],
    ["Unresolved BUG", summary.unresolvedBugs],
  ];
  elements.summary.innerHTML = items
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`)
    .join("");
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
    <button class="feedback-card" type="button" data-index="${index}">
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
    </button>
  `;
}

function renderBoard(records) {
  const columns = ["todo", "submitted", "inProgress", "resolved"];
  elements.board.innerHTML = columns
    .map((status) => {
      const items = records.filter((record) => record.status === status);
      return `
        <article class="status-column">
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
    button.addEventListener("click", () => {
      const record = records[Number(button.dataset.index)];
      openDetail(record);
    });
  });
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
  renderSummary(filtered);
  renderBoard(filtered);
  setMessage(filtered.length ? "" : "No feedback matches the selected filters.");
}

async function load() {
  setMessage("Loading Google Sheets data...");
  elements.summary.innerHTML = "";
  elements.board.innerHTML = "";
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error(
        "Google Sheet is not publicly readable as CSV. Share it as Anyone with the link can view, or publish it as CSV.",
      );
    }
    state.records = parseCsv(await response.text()).map(normalizeRow);
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

load();
