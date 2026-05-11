import { parseCsv } from "../lib/csv.mjs";
import { normalizeRow, validateColumns } from "../lib/domain.mjs";

const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1cVR8KAaFwuPyofT-byCk5gWwl5aL7FOsr6lgVV9w6IE/export?format=csv&gid=1702171693";
const SHEET_CSV_URL = process.env.SHEET_CSV_URL || DEFAULT_SHEET_CSV_URL;

const REQUIRED_COLUMNS = [
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
];

export default async function handler(request, response) {
  try {
    const sheetResponse = await fetch(SHEET_CSV_URL);
    if (!sheetResponse.ok) {
      if (sheetResponse.status === 401 || sheetResponse.status === 403) {
        response
          .status(500)
          .send(
            "Google Sheet is not publicly readable as CSV. Share it as Anyone with the link can view, or set SHEET_CSV_URL to a published CSV URL.",
          );
        return;
      }
      response.status(500).send(`Google Sheets request failed: ${sheetResponse.status}`);
      return;
    }

    const rows = parseCsv(await sheetResponse.text());
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const missing = validateColumns(headers, REQUIRED_COLUMNS);
    if (missing.length) {
      response.status(500).send(`Missing required columns: ${missing.join(", ")}`);
      return;
    }

    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(rows.map(normalizeRow));
  } catch (error) {
    response.status(500).send(error instanceof Error ? error.message : "Unknown server error");
  }
}
