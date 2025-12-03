# Repository Guidelines

## Project Structure & Module Organization
- `index.html` is the entry point; wires the setlist UI, drag-and-drop placeholders, and loads `firebase.js` and `app.js`.
- `app.js` holds UI behavior (drag/drop with SortableJS, duration math, setlist history rendering) and bridges to Firebase helpers exposed on `window`.
- `firebase.js` initializes Firebase (Auth + Firestore) and provides the CRUD helpers used by `app.js` via `window.*` hooks.
- `styles.css` contains the layout and pill/button styling; keep class names stable when adding elements.
- Hosting config lives in `.firebaserc` and `firebase.json`; `404.html` is the static fallback page.

## Build, Test, and Development Commands
- `npm install` - syncs `node_modules` to match `package-lock.json` (dependencies are minimal for local tools).
- `npx serve .` (or any static server) - quick local preview of the HTML/JS without Firebase emulation.
- `firebase emulators:start --only hosting` - if the Firebase CLI is installed, serves the site with hosting config for closer parity to production.

## Coding Style & Naming Conventions
- Vanilla ES modules; prefer `const`/`let`, arrow functions for callbacks, and template literals for UI strings.
- Keep two-space indentation and trailing semicolons consistent with existing files.
- Preserve current DOM ids/classes (`songLibrary`, `setlist`, `song-item`, `icon-btn`, etc.) so SortableJS and event delegation keep working.
- Inline strings include Japanese copy and emoji; keep wording and encoding intact when touching UI text.

## Testing Guidelines
- No automated tests today; rely on manual checks: drag songs between library and setlist, edit durations, clear lists, and verify total/remaining time pills update.
- Sign in/out with Google, add/delete songs, and save/load/delete setlists to confirm Firestore reads/writes succeed and UI re-renders.
- When changing styles, smoke-test on desktop and mobile widths to ensure pills, buttons, and lists remain legible and scrollable.

## Commit & Pull Request Guidelines
- Use descriptive messages (e.g., `feat: add setlist import`, `fix: guard song duration parsing`).
- Reference related issues, summarize user-facing impact, and call out any Firebase rule or config changes.
- For UI-affecting changes, attach before/after screenshots or short notes on layout/interaction differences.

## Security & Configuration Tips
- Firebase config is public by design; never commit private keys or service accounts. Manage secrets in Firebase Console or local env tooling.
- Ensure Firestore security rules restrict access to the authenticated user before enabling write access in production.
