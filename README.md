# Bonnetjes PWA

Plain HTML/CSS/JS, no build step, no framework, no login. Files:

- `index.html` -- the single submission screen
- `config.js` -- the Flow 0 URL + the hardcoded dropdown values (fill in
  per below)
- `app.js` -- compresses the photo, POSTs everything as JSON to Flow 0
- `manifest.json` + `sw.js` -- makes it installable via "Add to Home
  Screen" on iOS
- `staticwebapp.config.json` -- Azure Static Web Apps routing config

This app never talks to Microsoft Graph or SharePoint directly -- it just
POSTs a JSON body (photo as base64, plus the form fields) to Flow 0's
HTTP-trigger URL. See CLAUDE.md, "How the PWA talks to SharePoint", for why
that avoids needing any Entra ID app registration or admin consent for the
PWA itself.

## What you need to fill in before this runs for real

1. **`config.js`**: `flowUrl` -- Flow 0's HTTP-trigger URL, once that flow
   exists in Power Automate (see `docs/RUNBOOK.md`, Phase 3). Treat this
   URL like a password: it's the only thing standing in for
   authentication, so don't commit the real value to a public repo (keep
   a placeholder committed, set the real one only in the deployed Azure
   Static Web App's configuration).
2. **Icons**: `icons/icon-192.png`, `icons/icon-512.png`, and
   `icons/icon-180.png` (referenced by `manifest.json` and the
   apple-touch-icon tag) don't exist yet -- square DNIGL logo/icon images
   at those pixel sizes. Not a functional blocker, just needed for a
   polished home-screen icon.

## Local testing

Needs to run over `http://localhost` or `https://` (service workers
require it) -- opening `index.html` directly via `file://` will not work.
Any static file server works, e.g. from this folder:

```
npx serve .
```

Point `config.js`'s `flowUrl` at the real Flow 0 URL (or a test flow) to
actually exercise the submit path locally.

## Deploying

See `docs/RUNBOOK.md`, Phase 2, for the Azure Static Web Apps steps.
