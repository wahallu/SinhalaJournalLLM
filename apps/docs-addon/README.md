# SinAI — Google Docs Add-on

The **SinAI Document Assistant** brings Sinhala grammar checking, headlines generation, style rewriting, and news summarization directly into Google Docs. 

This folder contains the local codebase for the Google Apps Script project. We use Google's official CLI tool **clasp** to push changes to the Google Apps Script cloud runtime.

---

## 1. Prerequisites

Make sure you have Node.js installed. In this folder, install the devDependencies (which includes `@google/clasp`):
```bash
cd apps/docs-addon
npm install
```

---

## 2. Setting Up the Google Apps Script Project

### A. Authenticate with Google
Log in to your Google account from the command line:
```bash
npm run login
```
*(This opens a browser tab asking you to authenticate and authorize clasp access)*

### B. Enable Google Apps Script API
Before you can create or push scripts, clasp requires you to enable the Google Apps Script API in your user settings:
1. Visit [script.google.com/home/usersettings](https://script.google.com/home/usersettings).
2. Toggle **Google Apps Script API** to **ON**.

### C. Create a New Document Script
Create a new script project bound to a new Google Doc:
```bash
npm run create
```
This will:
1. Create a brand new Google Doc in your Google Drive.
2. Initialize a local `.clasp.json` containing the script and document reference IDs.
3. Overwrite/generate a default local `.clasp.json` (you can select `document` when prompted).

*(Alternatively, if you already have an existing script project, edit `.clasp.json` and paste your `"scriptId"` into it).*

---

## 3. Deploying Local Code to Google Cloud

To push the local files (`Code.js`, `Sidebar.html`, `SidebarStyles.html`, `SidebarJavaScript.html`, and `appsscript.json`) to the Google Cloud Apps Script editor, run:
```bash
npm run push
```

If you are developing actively, you can watch for changes and auto-push:
```bash
npm run watch
```

---

## 4. Testing in Google Docs

1. Open the Google Document associated with your Apps Script project (you can find the link in the terminal output when you ran `clasp create` or look inside your Google Drive).
2. Navigate to **Extensions** ➔ **Apps Script** in the document menu.
3. You will see all your uploaded files in the editor.
4. Close the editor, refresh your Google Document tab, or run the `onOpen()` function once inside the Apps Script editor to initialize the custom menu.
5. In the Google Document menu, click **Extensions** ➔ **SinAI Document Assistant** ➔ **Open Assistant**.
6. The glassmorphic dark-theme sidebar will slide open on the right side!

---

## 5. Backend Configuration

The Google Docs Add-on connects directly to the production SinAI backend service (`https://sinhalajournalllm.onrender.com/api/v1`) by default. The connection status indicator in the sidebar header automatically reflects the live status.
