export const CATEGORY_ORDER = [
  "BUG",
  "Feature Request",
  "Feature Enhancement",
  "CPS",
  "APP",
  "Positive review",
  "Negative review",
];


export const STATUS_LABELS = {
  todo: "To Submit",
  submitted: "Submitted",
  inProgress: "In Progress",
  resolved: "Resolved",
};

export function clean(value) {
  return String(value ?? "").trim();
}

export function deriveStatus(row) {
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
    status: deriveStatus(row),
  };
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

export function validateColumns(headers, requiredColumns) {
  return requiredColumns.filter((column) => !headers.includes(column));
}
