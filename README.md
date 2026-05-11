# Julia's Feedback Tracker

Read-only dashboard for querying HAM user feedback from the Google Sheets tracker.

This implementation is zero-dependency: it uses a small Node server as a Google Sheets CSV proxy and a static browser UI.

## Run locally

```bash
/Users/Zhuanz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
```

Open `http://127.0.0.1:5173/`.

## Test

```bash
/Users/Zhuanz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test test/*.mjs
```

## Data source

The app reads this Google Sheets CSV export:

https://docs.google.com/spreadsheets/d/1cVR8KAaFwuPyofT-byCk5gWwl5aL7FOsr6lgVV9w6IE/export?format=csv&gid=1702171693

The sheet must be viewable through the link for v1.

If the sheet is private, Google returns `401` or `403` because this local app cannot use your browser login. Fix it by setting the Google Sheet sharing to `Anyone with the link can view`, or by publishing the sheet as CSV and starting the app with:

```bash
SHEET_CSV_URL="your-published-csv-url" /Users/Zhuanz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.mjs
```

## Status logic

- `DONE = Yes` -> `Resolved`
- non-empty `ING` -> `In Progress`
- non-empty `Request number` -> `Submitted`
- otherwise -> `To Submit`

## V1 scope

The dashboard is read-only. It does not write back to Google Sheets.

## Public Deployment

The project is ready for Vercel deployment:

- `public/` contains the public webpage files.
- `api/feedback.mjs` is the hosted API endpoint that reads the Google Sheet CSV.
- `vercel.json` routes `/api/feedback` to the serverless API.

To publish:

1. Create a new Vercel project.
2. Upload or import this `ham-feedback-dashboard` folder.
3. Use the default Vercel settings.
4. After deployment, Vercel will give you a public URL such as `https://your-project.vercel.app`.

The Google Sheet must be readable as CSV for the public dashboard to show data. Viewers will not see a Google Sheet button, but the feedback data displayed in the dashboard is public to anyone with the dashboard URL.
