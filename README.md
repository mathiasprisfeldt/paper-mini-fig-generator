# Paper Mini Fig Generator

[![Deploy to GitHub Pages](https://github.com/mathiasprisfeldt/paper-mini-fig-generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/mathiasprisfeldt/paper-mini-fig-generator/actions/workflows/deploy.yml)

**[▶ Try it live](https://mathiasprisfeldt.github.io/paper-mini-fig-generator/)**

A web-based tool for creating printable 28mm paper miniatures for tabletop games. Upload images, configure your miniatures, and generate a ready-to-print A4 PDF with properly scaled figures and square bases.

## Features

- Keep a reusable binder of named creatures and their D&D sizes
- Add artwork manually or connect an HTML page that lists hosted images
- Select independent print quantities without duplicating binder entries
- Choose 24mm, 28mm, or 32mm mini scale and A4 or A3 paper
- Generate print-ready PDFs with optional name labels
- Sync the binder, print selection, settings, and uploaded images through
  private Google Drive app storage

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn 4 through Corepack

### Installation

```bash
corepack enable
yarn install --immutable
```

### Development

```bash
cp .env.example .env.local
yarn dev
```

Fill in the Google values in `.env.local` to enable Drive sync and Drive-folder
sources.

### Google Drive setup

Users connect their own Google account. The app writes a
`paper-mini-fig-catalogues.json` manifest and uploaded image files to Google
Drive's hidden `appDataFolder`. Linked images remain external URLs in the
manifest, so they do not consume additional Drive storage. Only this app can
access the hidden files, and they do not appear in the user's regular Drive
folders. The app requests only the `drive.appdata` scope.

1. Create or select a project in the
   [Google Cloud console](https://console.cloud.google.com/).
2. Enable the **Google Drive API**. Also enable the **Google Picker API** if
   Drive-folder sources should be available.
3. Configure the OAuth consent screen and add the
   `https://www.googleapis.com/auth/drive.appdata` and
   `https://www.googleapis.com/auth/drive.file` scopes. The latter is narrow,
   per-file access for folders the user explicitly selects through Picker. If
   the app is in testing mode, add the Google accounts that should be able to
   use it as test users.
4. Create an OAuth 2.0 Client ID with application type **Web application**.
5. Add the development and production origins under **Authorized JavaScript
   origins**:
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - `https://mathiasprisfeldt.github.io`
6. Create a browser API key restricted to the Google Picker API and the allowed
   website origins.
7. Find the numeric **Project number** under **IAM & Admin → Settings**. This is
   the Picker app ID.
8. Add the values to `.env.local`:

   ```bash
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GOOGLE_APP_ID=your-google-cloud-project-number
   VITE_GOOGLE_API_KEY=your-restricted-picker-api-key
   ```

For GitHub Pages, create Actions repository variables named `GOOGLE_CLIENT_ID`,
`GOOGLE_APP_ID`, and `GOOGLE_API_KEY`. They are public browser configuration,
not secrets. The OAuth web client does not use a client secret.

Drive access tokens are kept in memory and expire after a short period. The app
asks the user to reconnect when needed. After an explicit **Load from Drive** or
**Save to Drive**, changes autosync for the rest of the session.

The hidden app-data folder counts against the user's Drive storage. Its contents
cannot be browsed, moved, shared, or deleted individually in the normal Drive UI;
users can remove all of the app's hidden data from **Drive settings → Manage
apps**.

Existing images from versions that used `localStorage` are retained until the
first successful Drive save. Once Drive assigns a file ID, the local image data
is removed; only catalogue metadata and Drive file references remain locally.

### Linked image hosting and HTML sources

Manual **Image URL** entries accept a direct link to an image file, for example
`https://example.com/img/owlbear.png`. Because PDF generation renders that image
to a browser canvas, the image server must include an appropriate
`Access-Control-Allow-Origin` response header. For a public image library, this
is usually:

```http
Access-Control-Allow-Origin: *
```

The binder can also save an HTML source consisting of:

- A page URL, such as `https://example.com/img/`
- A CSS selector, such as `a[href]`

The app fetches that page, resolves relative links such as
`<a href="Aerthos%20Vaal.png">`, and creates binder cards for supported image
extensions. The directory page and its images must both permit cross-origin
requests. Source definitions and the last discovered creature list are synced
through Drive, and users can refresh or remove sources from the binder.

A source can alternatively be a Google Drive folder. The official Google Picker
lets the user choose one folder; image files directly inside it become binder
creatures. This uses narrow `drive.file` access rather than access to the user's
entire Drive. The user must be connected to Drive to add or refresh this source.

### Build

```bash
yarn build
```

## Tech Stack

- React 19
- TypeScript
- Vite
- jsPDF for PDF generation
- Official `@googleworkspace/drive-picker-react` folder picker
