# Form Scanner — Accessible Living Chrome Extension

Scans handwritten/printed forms from an image using **Gemini Vision AI**, extracts all field data, and lets the user review and correct any errors before copying.

---

## Setup

1. **Get a Gemini API key**
   - Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - Create a key (free tier works fine for testing)

2. **Load the extension in Chrome**
   - Open `chrome://extensions`
   - Enable **Developer Mode** (top right)
   - Click **Load unpacked** and select this folder

3. **Add an icon** *(optional but recommended)*
   - Add `icon48.png` and `icon128.png` to this folder
   - Any simple 48×48 and 128×128 PNG will work

---

## How to use

1. Click the extension icon in your toolbar
2. Paste your Gemini API key and click **Save** (saved locally, one time only)
3. Click **Choose Image** or **Use Camera** to upload a photo of your form
4. Wait for Gemini to extract the fields (~5–10 seconds)
5. Review all extracted fields — flagged ones (⚠) may need correction
6. Edit any incorrect values directly in the boxes
7. Click **Copy as Text** or **Copy JSON** to use the data

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome extension config |
| `popup.html` | 3-screen UI (upload → processing → review) |
| `popup.css` | Styles |
| `popup.js` | Logic: file handling, Gemini API, field rendering |

---

## Customization

**Want a specific form format?** Edit the `prompt` string in `popup.js` inside `scanFormWithGemini()`. For example, you can tell Gemini the exact fields expected:

```js
const prompt = `Extract these specific fields from the form: Name, Date of Birth, Address, Phone Number, Signature. Return JSON as described...`;
```

**Change the AI model?** Edit the `GEMINI_MODEL` constant at the top of `popup.js`. `gemini-1.5-flash` is fast and free-tier friendly.

---

## Notes

- API key is stored with `chrome.storage.local` (stays on-device)
- Flagged fields = Gemini wasn't confident about that handwriting
- After editing a flagged field, the warning clears automatically
