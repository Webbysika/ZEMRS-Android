# Zambia Election Monitoring and Results System (ZEMRS)

This is the first offline-first working version of the election monitoring tool.

## Included

- 13,529 polling stations and 8,786,300 registered voters
- Province, district, constituency and ward drill-down attributes
- 14 presidential candidates
- Installable Android/desktop Progressive Web App
- Offline polling-station search and result entry
- Candidate-vote arithmetic checks
- GPS capture and signed result-form photograph capture
- Local submission register and synchronization status
- Reporting-progress cards, candidate totals and polling-station map
- Configurable secure synchronization endpoint

## Run locally

1. Install Node.js 20 or later.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the address displayed in the terminal.

## Production build

Run `npm run build`. The deployable application is created in `dist`.

## Synchronization API contract

In Settings, enter the server API base address and device token. The app sends:

`POST {API_BASE}/submissions`

with `Authorization: Bearer {DEVICE_TOKEN}` and a JSON result record. The server should return HTTP 200–299 after securely saving the record. Pending records remain on the device and retry when connectivity returns.

## Important election-integrity rule

Dashboard results must be labelled provisional until an authorized supervisor verifies them against the attached signed polling-station results form. Individual voter choices must never be collected.

