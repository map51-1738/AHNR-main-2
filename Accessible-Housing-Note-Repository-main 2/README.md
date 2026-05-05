# Accessible Housing Notes (Chrome Extension)

Capture listing info and accessibility flags, save by normalized address (Firestore).

## Features

### Address Normalizer
The Address Normalizer automatically detects and standardizes address formats from web pages. It uses string manipulation and regular expressions to ensure consistency (e.g., removing punctuation, consistent spacing), which is crucial for accurately saving and retrieving housing reports. This process does not currently utilize AI.

### Form Scanner
The Form Scanner enables users to upload an image of a housing application form (e.g., a PDF converted to an image). It leverages the Gemini API to scan the form, extract relevant information, including the status of checked boxes, and automatically populate the extension's user interface fields with the extracted data.

## For users installing from GitHub

1. **Clone** this repo (or download ZIP and extract).

2. **Install & build** (Node.js required):
   ```bash
   npm install
   npm run build
   ```
   This generates **`popup.bundle.js`** from `popup.js`.

3. **Firebase config**  
   Put your Firebase web app values in `popup.js` → `firebaseConfig`.  
   If this is a **public** repo, do **not** commit real keys; use a private fork or local-only changes, or refactor to build-time env vars.

4. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable **Developer mode**
   - **Load unpacked** → select this project folder

5. **Reload after changes**  
   After editing `popup.js` or `manifest.json`, run `npm run build`, then click **Reload** on the extension card.

## What to commit to GitHub

| Include | Skip |
|--------|------|
| `manifest.json`, `popup.html`, `popup.js`, `package.json`, `package-lock.json` | `node_modules/` |
| This `README.md`, `.gitignore` | Secrets (Firebase keys in public repos) |

You **may** commit `popup.bundle.js` so others can skip `npm run build` — then document that in the README. If you ignore it in git, everyone must run the build step once.

## Security note (public GitHub)

Firebase `apiKey` is not a “secret” in the same way as a server key, but you should still use **Firestore Security Rules** and restrict **Authorized domains**. Consider replacing committed config with placeholders and documenting setup in README.

## License

Add a `LICENSE` file if you want others to reuse the project clearly.
