export const CATEGORY_ORDER = [
  "BUG",
  "Feature Request",
  "Feature Enhancement",
  "Positive review",
  "Negative review",
  "CPS",
  "APP",
];

export const STATUS_LABELS = {
  todo: "To Submit",
  submitted: "Submitted",
  inProgress: "In Progress",
  resolved: "Resolved",
};

export const STATUS_BY_LABEL = {
  "To Submit": "todo",
  Submitted: "submitted",
  "In Progress": "inProgress",
  Resolved: "resolved",
};

export function clean(value) {
  return String(value ?? "").trim();
}

export function deriveStatus(row) {
  const dashboardStatus = STATUS_BY_LABEL[clean(row["Dashboard Status"])];
  if (dashboardStatus) return dashboardStatus;
  if (clean(row.DONE).toLowerCase() === "yes") return "resolved";
  if (clean(row.ING)) return "inProgress";
  if (clean(row["Request number"])) return "submitted";
  return "todo";
}

export function parseCategories(input) {
  const parts = clean(input)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.filter((category) => CATEGORY_ORDER.includes(category));
}

export function categoryClass(input) {
  const primary = parseCategories(input)[0];
  if (primary === "BUG") return "category-bug";
  if (primary === "Feature Request") return "category-feature-request";
  if (primary === "Feature Enhancement") return "category-feature-enhancement";
  if (primary === "Positive review") return "category-positive-review";
  if (primary === "Negative review") return "category-negative-review";
  if (primary === "CPS") return "category-cps";
  if (primary === "APP") return "category-app";
  return "category-unknown";
}

export function normalizeRow(row) {
  const updateCategory = clean(row["Update Category"]);
  const categories = parseCategories(updateCategory);
  return {
    date: clean(row.Date),
    model: clean(row.Model),
    id: clean(row.ID),
    email: clean(row.Email),
    profile: clean(row.Profile),
    updateCategory,
    categories,
    primaryCategory: categories[0] || "",
    keyPoints: clean(row["Key Points"]),
    upgradeRequirements: clean(row["Upgrade requirements"]),
    chinese: clean(row.Chinese),
    notes: clean(row.Notes),
    requestNumber: clean(row["Request number"]),
    ing: clean(row.ING),
    priority: clean(row.Priority),
    done: clean(row.DONE),
    channel: clean(row.Channel),
    dashboardStatus: clean(row["Dashboard Status"]),
    lastModifiedAt: clean(row["Last Modified At"]),
    lastModifiedBy: clean(row["Last Modified By"]),
    statusChangeLog: clean(row["Status Change Log"]),
    status: deriveStatus(row),
  };
}

export function normalizeRequestNumber(value) {
  return clean(value).toLowerCase();
}

export function parseClosedRequests(input) {
  const seen = new Set();
  return clean(input)
    .split(/[\n,，;；\s]+/)
    .map((part) => clean(part))
    .filter(Boolean)
    .filter((part) => {
      const key = normalizeRequestNumber(part);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeFirmwareRow(row) {
  return {
    date: clean(row.Date),
    model: clean(row.Model),
    hardwareVersion: clean(row["Hardware version"]),
    version: clean(row["Firmware Version"] || row.Verion || row.Version),
    versionStatus: clean(row["版本状态"]),
    reasonForChange: clean(row["Reason for Change"]),
    changeLog: clean(row["Change log"]),
    chineseLog: clean(row["更新日志"]),
    closedRequestsRaw: clean(row["关闭需求"]),
    closedRequests: parseClosedRequests(row["关闭需求"]),
  };
}

export function isFirmwareReleaseLikeFeedbackRow(row) {
  const updateCategory = clean(row["Update Category"]);
  const id = clean(row.ID);
  const requestNumber = clean(row["Request number"]);
  const channel = clean(row.Channel);
  const model = clean(row.Model);
  const keyPoints = clean(row["Key Points"]);
  const upgradeRequirements = clean(row["Upgrade requirements"]);
  const chinese = clean(row.Chinese);

  const versionPattern = /\bv?\d+\.\d+(?:\.\d+){1,}\b/i;
  const numberedListPattern = /(^|\n)\s*\d+[.)、]/;
  const firmwareWordPattern = /\b(firmware|version|fixed|added|optimized|modified)\b/i;
  const chineseFirmwarePattern = /(固件|版本|修复|新增|优化|修改|解决)/;

  const hasVersionSignal = versionPattern.test(model) || versionPattern.test(keyPoints);
  const hasChangelogSignal =
    numberedListPattern.test(upgradeRequirements) ||
    numberedListPattern.test(chinese) ||
    firmwareWordPattern.test(upgradeRequirements) ||
    chineseFirmwarePattern.test(chinese);

  return !updateCategory && !id && !requestNumber && !channel && hasVersionSignal && hasChangelogSignal;
}

export function buildFirmwareLookup(releases) {
  const lookup = new Map();
  for (const release of releases) {
    for (const requestNumber of release.closedRequests) {
      const key = normalizeRequestNumber(requestNumber);
      const existing = lookup.get(key) || [];
      existing.push(release);
      lookup.set(key, existing);
    }
  }
  return lookup;
}

function normalizedModel(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function dateKey(value) {
  const text = clean(value);
  if (!text) return "";

  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }

  return text.slice(0, 10);
}

export function uniqueModels(records) {
  const models = new Set();
  for (const record of records) {
    const model = clean(record.model);
    if (model) {
      models.add(model);
    }
  }
  return [...models].sort((a, b) => a.localeCompare(b));
}

export function uniqueFirmwareModels(releases) {
  return [...new Set(releases.map((release) => clean(release.model)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function uniqueFirmwareVersions(releases) {
  return [...new Set(releases.map((release) => clean(release.version)).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function filterFeedback(records, filters) {
  const model = clean(filters.model);
  const search = clean(filters.search).toLowerCase();
  const category = clean(filters.category);
  const priority = clean(filters.priority);
  const dateFrom = dateKey(filters.dateFrom);
  const dateTo = dateKey(filters.dateTo);

  return records.filter((record) => {
    const requestedModel = normalizedModel(model);
    const recordDate = dateKey(record.date);
    const modelMatch =
      !model ||
      model === "all" ||
      normalizedModel(record.model) === requestedModel;
    const categoryMatch = !category || record.categories.includes(category);
    const priorityMatch = !priority || record.priority === priority;
    const dateFromMatch = !dateFrom || (recordDate && recordDate >= dateFrom);
    const dateToMatch = !dateTo || (recordDate && recordDate <= dateTo);
    const haystack = [
      record.keyPoints,
      record.upgradeRequirements,
      record.chinese,
      record.notes,
      record.requestNumber,
      record.id,
    ]
      .join("\n")
      .toLowerCase();
    const searchMatch = !search || haystack.includes(search);
    return modelMatch && categoryMatch && priorityMatch && dateFromMatch && dateToMatch && searchMatch;
  });
}

export function filterFirmware(releases, filters) {
  const model = clean(filters.model);
  const version = clean(filters.version);
  const search = clean(filters.search).toLowerCase();
  const dateFrom = dateKey(filters.dateFrom);
  const dateTo = dateKey(filters.dateTo);

  return releases.filter((release) => {
    const releaseDate = dateKey(release.date);
    const modelMatch = !model || model === "all" || normalizedModel(release.model) === normalizedModel(model);
    const versionMatch = !version || version === "all" || clean(release.version) === version;
    const dateFromMatch = !dateFrom || (releaseDate && releaseDate >= dateFrom);
    const dateToMatch = !dateTo || (releaseDate && releaseDate <= dateTo);
    const haystack = [
      release.model,
      release.hardwareVersion,
      release.version,
      release.versionStatus,
      release.reasonForChange,
      release.changeLog,
      release.chineseLog,
      release.closedRequestsRaw,
    ]
      .join("\n")
      .toLowerCase();
    const searchMatch = !search || haystack.includes(search);
    return modelMatch && versionMatch && dateFromMatch && dateToMatch && searchMatch;
  });
}

export function summarizeFeedback(records) {
  const statusCounts = {
    todo: 0,
    submitted: 0,
    inProgress: 0,
    resolved: 0,
  };
  const categoryCounts = {
    BUG: 0,
    "Feature Request": 0,
    "Feature Enhancement": 0,
    "Positive review": 0,
    "Negative review": 0,
    CPS: 0,
    APP: 0,
  };

  for (const record of records) {
    statusCounts[record.status] += 1;
    for (const category of record.categories) {
      categoryCounts[category] += 1;
    }
  }

  return {
    total: records.length,
    statusCounts,
    categoryCounts,
    unresolvedBugs: records.filter((record) => record.status !== "resolved" && record.categories.includes("BUG")).length,
  };
}

export function summarizeFirmware(releases) {
  const closedRequests = new Set();
  for (const release of releases) {
    for (const requestNumber of release.closedRequests) {
      closedRequests.add(normalizeRequestNumber(requestNumber));
    }
  }
  return {
    total: releases.length,
    modelCount: uniqueFirmwareModels(releases).length,
    closedRequestCount: closedRequests.size,
  };
}

export function validateColumns(headers, requiredColumns) {
  return requiredColumns.filter((column) => !headers.includes(column));
}
