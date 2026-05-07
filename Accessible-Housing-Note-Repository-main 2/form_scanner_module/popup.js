// ══════════════════════════════════════════════
//  Form Scanner — popup.js
//  Uses Gemini Vision API to extract form fields
//  from an uploaded image of a handwritten form.
// ══════════════════════════════════════════════

// ── Config ──────────────────────────────────
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── State ────────────────────────────────────
let currentImageBase64 = null;   // base64 string (no prefix)
let currentImageMime   = null;   // e.g. "image/jpeg"
let extractedFields    = [];     // [{ label, value, flagged }]

// ── DOM refs ─────────────────────────────────
const screens = {
  upload:     document.getElementById("screen-upload"),
  processing: document.getElementById("screen-processing"),
  review:     document.getElementById("screen-review"),
};

const fileInput    = document.getElementById("file-input");
const cameraInput  = document.getElementById("camera-input");
const dropZone     = document.getElementById("drop-zone");
const apiKeyInput  = document.getElementById("api-key-input");
const previewThumb = document.getElementById("preview-thumb");
const processingStatus = document.getElementById("processing-status");
const fieldsContainer  = document.getElementById("fields-container");
const errorBanner  = document.getElementById("error-banner");
const errorMessage = document.getElementById("error-message");
const copyConfirm  = document.getElementById("copy-confirm");

// ── Screen navigation ─────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ── Init: load saved API key ──────────────────
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["geminiApiKey"], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });
  showScreen("upload");
});

// ── Save API key ──────────────────────────────
document.getElementById("btn-save-key").addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  chrome.storage.local.set({ geminiApiKey: key }, () => {
    const btn = document.getElementById("btn-save-key");
    btn.textContent = "✓ Saved";
    setTimeout(() => (btn.textContent = "Save"), 1500);
  });
});

// ── Upload button ─────────────────────────────
document.getElementById("btn-upload-file").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

// ── Camera button ─────────────────────────────
document.getElementById("btn-camera").addEventListener("click", () => cameraInput.click());
cameraInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

// ── Drag-and-drop ─────────────────────────────
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ── Back button ───────────────────────────────
document.getElementById("btn-back").addEventListener("click", () => showScreen("upload"));

// ── Copy buttons ─────────────────────────────
document.getElementById("btn-copy-text").addEventListener("click", () => {
  const text = extractedFields.map(f => `${f.label}: ${f.value}`).join("\n");
  copyToClipboard(text);
});

document.getElementById("btn-copy-json").addEventListener("click", () => {
  const obj = {};
  extractedFields.forEach(f => (obj[f.label] = f.value));
  copyToClipboard(JSON.stringify(obj, null, 2));
});

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    copyConfirm.classList.remove("hidden");
    setTimeout(() => copyConfirm.classList.add("hidden"), 2000);
  });
}

// ══════════════════════════════════════════════
//  Core: Handle image file
// ══════════════════════════════════════════════
function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    return;
  }

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert("Please enter your Gemini API key first.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    // Show preview
    previewThumb.src = dataUrl;
    // Strip the data:image/jpeg;base64, prefix
    const [meta, b64] = dataUrl.split(",");
    currentImageBase64 = b64;
    currentImageMime   = file.type;

    showScreen("processing");
    scanFormWithGemini(apiKey);
  };
  reader.readAsDataURL(file);
}

// ══════════════════════════════════════════════
//  Gemini Vision API call
// ══════════════════════════════════════════════
async function scanFormWithGemini(apiKey) {
  processingStatus.textContent = "Sending image to Gemini AI…";

  const prompt = `You are a form data extraction assistant.

Examine this image of a handwritten or printed form.
Your job is to:
1. Identify every visible field label (e.g. "Name", "Date", "Address", "Signature", etc.)
2. Extract the handwritten or typed value next to or under each label.
3. If a value is unclear, illegible, or missing, mark it with "flagged": true.

Return ONLY valid JSON. No explanation. No markdown. No backticks.

Format:
{
  "fields": [
    { "label": "Field Name", "value": "Extracted value or empty string", "flagged": false },
    { "label": "Another Field", "value": "??", "flagged": true }
  ]
}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: currentImageMime,
              data: currentImageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
  };

  try {
    processingStatus.textContent = "Waiting for AI response…";

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error: ${response.status}`);
    }

    processingStatus.textContent = "Parsing results…";
    const data = await response.json();

    // Extract text from Gemini response
    const rawText = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("") || "";

    // Strip any accidental markdown fences
    const clean = rawText.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(clean);

    if (!parsed.fields || !Array.isArray(parsed.fields)) {
      throw new Error("Unexpected response format from AI.");
    }

    extractedFields = parsed.fields;
    renderReviewScreen();

  } catch (err) {
    console.error(err);
    showScreen("upload");
    alert(`Scan failed: ${err.message}\n\nPlease check your API key and try again.`);
  }
}

// ══════════════════════════════════════════════
//  Render review screen
// ══════════════════════════════════════════════
function renderReviewScreen() {
  fieldsContainer.innerHTML = "";
  copyConfirm.classList.add("hidden");

  const flaggedCount = extractedFields.filter((f) => f.flagged).length;

  if (flaggedCount > 0) {
    errorMessage.textContent = `${flaggedCount} field${flaggedCount > 1 ? "s" : ""} may be incorrect — please review the highlighted fields.`;
    errorBanner.classList.remove("hidden");
  } else {
    errorBanner.classList.add("hidden");
  }

  extractedFields.forEach((field, index) => {
    const item = document.createElement("div");
    item.className = "field-item" + (field.flagged ? " flagged" : "");

    const labelRow = document.createElement("div");
    labelRow.className = "field-label";
    labelRow.textContent = field.label;

    if (field.flagged) {
      const badge = document.createElement("span");
      badge.className = "flag-badge";
      badge.textContent = "⚠ Check this";
      labelRow.appendChild(badge);
    }

    // Editable field
    const input = document.createElement("textarea");
    input.className = "field-input";
    input.rows = 1;
    input.value = field.value;
    input.setAttribute("aria-label", field.label);

    // Auto-resize
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
      // Update our state
      extractedFields[index].value = input.value;
      // If user edits a flagged field, unflag it
      if (field.flagged) {
        field.flagged = false;
        item.classList.remove("flagged");
        badge?.remove?.();
      }
    });

    item.appendChild(labelRow);
    item.appendChild(input);
    fieldsContainer.appendChild(item);

    // Trigger auto-resize on load
    requestAnimationFrame(() => {
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
    });
  });

  showScreen("review");
}
