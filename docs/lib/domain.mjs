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

export const BETA_TEST_HEADERS = [
  "Date",
  "Product Model",
  "Version",
  "Test Type",
  "Tester Type",
  "Tester / Owner",
  "Issue Source",
  "Test Item",
  "Issue Found",
  "Severity",
  "Priority",
  "Status",
  "Assigned To",
  "Engineering Response",
  "Next Action",
  "Target Date",
  "Resolved Date",
  "Related Request Number",
  "Related Firmware Version",
  "Notes",
  "Raw Input",
];

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
  const text = clean(value);
  const requestNumber = text.match(/rt\s*[\d-]+/i)?.[0];
  return clean(requestNumber || text).replace(/\s+/g, "").toLowerCase();
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

export function normalizeBetaRow(row) {
  return {
    date: clean(row.Date),
    productModel: clean(row["Product Model"]),
    version: clean(row.Version),
    testType: clean(row["Test Type"]),
    testerType: clean(row["Tester Type"]),
    testerOwner: clean(row["Tester / Owner"]),
    issueSource: clean(row["Issue Source"]),
    testItem: clean(row["Test Item"]),
    issueFound: clean(row["Issue Found"]),
    severity: clean(row.Severity),
    priority: clean(row.Priority),
    status: clean(row.Status),
    assignedTo: clean(row["Assigned To"]),
    engineeringResponse: clean(row["Engineering Response"]),
    nextAction: clean(row["Next Action"]),
    targetDate: clean(row["Target Date"]),
    resolvedDate: clean(row["Resolved Date"]),
    relatedRequestNumber: clean(row["Related Request Number"]),
    relatedFirmwareVersion: clean(row["Related Firmware Version"]),
    notes: clean(row.Notes),
    rawInput: clean(row["Raw Input"]),
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

const KNOWN_MODELS = ["EZTALK65", "RA89R", "HA1UV", "HA1G", "HA2", "HD1", "HD2", "MA1", "M17", "H1", "A3"];
const NON_MODEL_WORDS = new Set([
  "APP",
  "CPS",
  "DUAL",
  "PTT",
  "QRP",
  "SDR",
  "TRANSCEIVER",
  "RETEVIS",
  "RADIO",
  "RADIOS",
  "FIRMWARE",
  "VERSION",
]);

function addModel(models, value) {
  const model = clean(value).toUpperCase();
  if (!model || NON_MODEL_WORDS.has(model) || /^V\d/i.test(model)) return;
  if (KNOWN_MODELS.includes(model) || /^[A-Z]{1,8}\d[A-Z0-9-]*$/.test(model)) {
    models.push(model);
  }
}

function modelParts(value) {
  const text = clean(value);
  if (!text) return [];
  const matches = text.match(/[A-Z]+[A-Z0-9]*(?:\/[A-Z0-9]+)?(?:-[A-Z0-9]+)?/gi) || [];
  const models = [];
  for (const match of matches) {
    const slash = match.match(/^([A-Z]+\d+[A-Z0-9]*?)\/([A-Z][A-Z0-9]*)$/i);
    if (slash) {
      addModel(models, slash[1]);
      const prefix = slash[1].match(/^([A-Z]+\d+)/i)?.[1] || "";
      addModel(models, `${prefix}${slash[2]}`);
      continue;
    }
    addModel(models, match);
  }
  const seen = new Set();
  return models
    .filter((part) => {
      const key = normalizedModel(part);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
    for (const model of modelParts(record.model)) {
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

export function uniqueBetaModels(records) {
  const models = new Set();
  for (const record of records) {
    for (const model of modelParts(record.productModel)) {
      models.add(model);
    }
  }
  return [...models].sort((a, b) => a.localeCompare(b));
}

export function uniqueBetaVersions(records, model = "all") {
  const requestedModel = normalizedModel(model);
  return [
    ...new Set(
      records
        .filter((record) => {
          if (!model || model === "all") return true;
          return modelParts(record.productModel).some((part) => normalizedModel(part) === requestedModel);
        })
        .map((record) => clean(record.version))
        .filter(Boolean),
    ),
  ].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
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
      normalizedModel(record.model) === requestedModel ||
      modelParts(record.model).some((part) => normalizedModel(part) === requestedModel);
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

export function filterBetaTests(records, filters) {
  const model = clean(filters.model);
  const version = clean(filters.version);
  const testType = clean(filters.testType);
  const testerType = clean(filters.testerType);
  const status = clean(filters.status);
  const priority = clean(filters.priority);
  const search = clean(filters.search).toLowerCase();
  const dateFrom = dateKey(filters.dateFrom);
  const dateTo = dateKey(filters.dateTo);
  const requestedModel = normalizedModel(model);

  return records.filter((record) => {
    const recordDate = dateKey(record.date);
    const modelMatch =
      !model ||
      model === "all" ||
      normalizedModel(record.productModel) === requestedModel ||
      modelParts(record.productModel).some((part) => normalizedModel(part) === requestedModel);
    const versionMatch = !version || version === "all" || record.version === version;
    const testTypeMatch = !testType || record.testType === testType;
    const testerTypeMatch = !testerType || record.testerType === testerType;
    const statusMatch = !status || record.status === status;
    const priorityMatch = !priority || record.priority === priority;
    const dateFromMatch = !dateFrom || (recordDate && recordDate >= dateFrom);
    const dateToMatch = !dateTo || (recordDate && recordDate <= dateTo);
    const haystack = [
      record.productModel,
      record.version,
      record.testType,
      record.testerType,
      record.testerOwner,
      record.issueSource,
      record.testItem,
      record.issueFound,
      record.severity,
      record.priority,
      record.status,
      record.assignedTo,
      record.engineeringResponse,
      record.nextAction,
      record.relatedRequestNumber,
      record.relatedFirmwareVersion,
      record.notes,
      record.rawInput,
    ]
      .join("\n")
      .toLowerCase();
    const searchMatch = !search || haystack.includes(search);
    return (
      modelMatch &&
      versionMatch &&
      testTypeMatch &&
      testerTypeMatch &&
      statusMatch &&
      priorityMatch &&
      dateFromMatch &&
      dateToMatch &&
      searchMatch
    );
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

function formatPercent(numerator, denominator) {
  if (!denominator) return "-";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function summaryPercentages(summary) {
  const total = summary.total || 0;
  const submitted = summary.statusCounts?.submitted || 0;
  return {
    todo: formatPercent(summary.statusCounts?.todo || 0, total),
    submitted: formatPercent(submitted, total),
    inProgress: formatPercent(summary.statusCounts?.inProgress || 0, total),
    resolved: formatPercent(summary.statusCounts?.resolved || 0, total),
    unresolvedBug: formatPercent(summary.unresolvedBugs || 0, submitted),
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

export function summarizeBetaTests(records) {
  const openStatuses = new Set(["Open", "Need Review", "Reproducing", "In Progress"]);
  const resolvedStatuses = new Set(["Resolved", "Closed", "Fixed"]);
  const highSeverity = new Set(["Critical", "High"]);
  return {
    total: records.length,
    open: records.filter((record) => openStatuses.has(record.status)).length,
    inProgress: records.filter((record) => record.status === "In Progress").length,
    resolved: records.filter((record) => resolvedStatuses.has(record.status)).length,
    highSeverity: records.filter((record) => highSeverity.has(record.severity)).length,
    userTestIssues: records.filter((record) => /user|beta|koc/i.test(record.testerType || record.issueSource)).length,
  };
}

function firstMeaningfulLine(text) {
  return (
    clean(text)
      .split(/\n+/)
      .map((line) => clean(line).replace(/^[-*•\d.)、\s]+/, ""))
      .find(Boolean) || ""
  );
}

export function inferBetaDraft(input) {
  const rawInput = clean(input);
  const lower = rawInput.toLowerCase();
  const issueFound = firstMeaningfulLine(rawInput);
  let severity = "Medium";
  if (/(crash|reboot|brick|cannot power|dead|freeze|卡死|死机|重启|无法开机|变砖)/i.test(rawInput)) {
    severity = "Critical";
  } else if (/(fail|cannot|no audio|no tx|no rx|wrong|严重|失败|无法|没有声音|不能发射|不能接收)/i.test(rawInput)) {
    severity = "High";
  } else if (/(minor|typo|display|ui|小问题|显示|文案)/i.test(rawInput)) {
    severity = "Low";
  }

  const priority = severity === "Critical" ? "P0" : severity === "High" ? "P1" : "P2";
  const status = lower.includes("fixed") || lower.includes("resolved") || /已修复|已解决/.test(rawInput) ? "Resolved" : "Open";
  const nextAction =
    status === "Resolved"
      ? "Verify fix in the next test round."
      : "Reproduce the issue, confirm affected version, and assign engineering owner.";

  return {
    issueFound,
    severity,
    priority,
    status,
    nextAction,
    rawInput,
  };
}

export function validateColumns(headers, requiredColumns) {
  return requiredColumns.filter((column) => !headers.includes(column));
}
