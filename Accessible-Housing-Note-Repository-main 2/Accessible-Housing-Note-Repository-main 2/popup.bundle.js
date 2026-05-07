(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // popup.js
  var require_popup = __commonJS({
    "popup.js"() {
      var PROJECT_ID = "accessible-living-database";
      var DATABASE_ID = "accessible-living-test";
      var FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
      function toFirestoreValue(value) {
        if (value === null || value === void 0) return { nullValue: null };
        if (typeof value === "boolean") return { booleanValue: value };
        if (typeof value === "number")
          return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
        if (Array.isArray(value))
          return { arrayValue: { values: value.map(toFirestoreValue) } };
        if (typeof value === "object")
          return { mapValue: { fields: toFirestoreFields(value) } };
        return { stringValue: String(value) };
      }
      function toFirestoreFields(obj) {
        const fields = {};
        for (const [k, v] of Object.entries(obj)) {
          fields[k] = toFirestoreValue(v);
        }
        return fields;
      }
      function fromFirestoreValue(v) {
        if ("stringValue" in v) return v.stringValue;
        if ("booleanValue" in v) return v.booleanValue;
        if ("integerValue" in v) return Number(v.integerValue);
        if ("doubleValue" in v) return v.doubleValue;
        if ("nullValue" in v) return null;
        if ("timestampValue" in v) return v.timestampValue;
        if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
        if ("mapValue" in v) return fromFirestoreFields(v.mapValue.fields || {});
        return null;
      }
      function fromFirestoreFields(fields) {
        const obj = {};
        for (const [k, v] of Object.entries(fields)) {
          obj[k] = fromFirestoreValue(v);
        }
        return obj;
      }
      async function firestoreGet(docPath) {
        const resp = await fetch(`${FIRESTORE_BASE}/${docPath}`);
        if (resp.status === 404) return null;
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error?.message || `HTTP ${resp.status}`);
        }
        const doc = await resp.json();
        return fromFirestoreFields(doc.fields || {});
      }
      async function firestoreSet(docPath, data) {
        const fields = toFirestoreFields(data);
        const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
        const resp = await fetch(`${FIRESTORE_BASE}/${docPath}?${mask}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields })
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error?.message || `HTTP ${resp.status}`);
        }
      }
      function sanitizeFirestoreDocId(id) {
        if (!id) return "";
        return String(id).replace(/\//g, "_").slice(0, 700);
      }
      function normalizeAddress(address) {
        if (!address) return "";
        let normalized = address.trim().toLowerCase();
        normalized = normalized.replace(/[.,]+/g, " ");
        normalized = normalized.replace(/\s+/g, " ");
        const replacements = [
          { from: /\bmt\.?\b/g, to: "mount" },
          { from: /\bmtn\.?\b/g, to: "mountain" },
          { from: /\bst\.?\b/g, to: "street" },
          { from: /\brd\.?\b/g, to: "road" },
          { from: /\bave\.?\b/g, to: "avenue" },
          { from: /\bblvd\.?\b/g, to: "boulevard" },
          { from: /\bdr\.?\b/g, to: "drive" },
          { from: /\bln\.?\b/g, to: "lane" },
          { from: /\bct\.?\b/g, to: "court" }
        ];
        for (const { from, to } of replacements) {
          normalized = normalized.replace(from, to);
        }
        return normalized.trim();
      }
      function normalizeApartment(apartment) {
        if (!apartment) return "";
        let s = String(apartment).trim().toLowerCase();
        s = s.replace(/^#+\s*/, "");
        s = s.replace(/\s+/g, " ");
        return s.trim();
      }
      function parseZip(address) {
        const atEnd = address.match(/\b(\d{5})(?:-\d{4})?\s*$/);
        if (atEnd) return atEnd[1];
        const afterComma = address.match(/,.*?(\d{5})(?:-\d{4})?/);
        return afterComma ? afterComma[1] : "";
      }
      function parseCity(address) {
        const parts = address.split(",").map((s) => s.trim());
        return parts.length >= 3 ? parts[parts.length - 2].toLowerCase() : "";
      }
      function buildReportDocKey(address, apartmentRaw) {
        const addrNorm = normalizeAddress(address);
        if (!addrNorm) return "";
        const aptNorm = normalizeApartment(apartmentRaw);
        if (!aptNorm) return sanitizeFirestoreDocId(addrNorm);
        return sanitizeFirestoreDocId(`${addrNorm}__apt__${aptNorm}`);
      }
      async function extractListingInfoFromPage() {
        return new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const [tab] = tabs;
            if (!tab || !tab.id) {
              resolve(null);
              return;
            }
            chrome.scripting.executeScript(
              {
                target: { tabId: tab.id },
                func: () => {
                  const result = { address: "", url: window.location.href };
                  try {
                    const addressSelectors = [
                      "[itemprop='streetAddress']",
                      "[itemprop='address']",
                      "[data-testid='address']",
                      "h1[data-testid*='address']",
                      "h1[data-test='home-details-summary-address']",
                      "[data-testid*='address' i]",
                      "[class*='address' i]",
                      "[id*='address' i]"
                    ];
                    for (const sel of addressSelectors) {
                      const el = document.querySelector(sel);
                      const text = el && (el.innerText || el.textContent);
                      if (text && text.trim()) {
                        result.address = text.replace(/\s+/g, " ").trim();
                        break;
                      }
                    }
                    if (!result.address) {
                      const addrPattern = /\d{1,5}\s+\S.{2,50}?(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|way|ct|court|pkwy|hwy|[A-Z]{2}\s+\d{5})/i;
                      const candidates = [
                        ...document.querySelectorAll("h1, h2, h3"),
                        ...document.querySelectorAll("[class*='address' i], [id*='address' i]")
                      ];
                      const maybe = candidates.find(
                        (el) => addrPattern.test(el.innerText || el.textContent || "")
                      );
                      if (maybe) {
                        result.address = (maybe.innerText || maybe.textContent).replace(/\s+/g, " ").trim();
                      }
                    }
                  } catch (_) {
                  }
                  return result;
                }
              },
              (results) => {
                if (chrome.runtime.lastError || !results || !results.length) {
                  resolve(null);
                  return;
                }
                resolve(results[0].result || null);
              }
            );
          });
        });
      }
      function setStatus(message, kind = "ok") {
        const el = document.getElementById("status");
        if (!el) return;
        el.textContent = message;
        el.className = "status " + (kind || "");
      }
      function setMeta(text) {
        const el = document.getElementById("meta");
        if (!el) return;
        el.textContent = text || "";
      }
      async function handleSave() {
        const addressInput = document.getElementById("address-input");
        const apartmentInput = document.getElementById("apartment-input");
        const descriptionInput = document.getElementById("description-input");
        if (!addressInput || !descriptionInput) return;
        const address = addressInput.value.trim();
        const apartment = apartmentInput ? apartmentInput.value.trim() : "";
        const description = descriptionInput.value.trim();
        const zipInput = document.getElementById("zip-input");
        const zipOverride = zipInput ? zipInput.value.trim() : "";
        const accessibilityFeatures = Array.from(
          document.querySelectorAll(".accessibility-checkbox:checked")
        ).map((cb) => cb.value);
        const flagReason = document.getElementById("flag-input")?.value.trim() || "";
        if (!address) {
          setStatus("Please enter an address before saving.", "error");
          return;
        }
        const key = buildReportDocKey(address, apartment);
        if (!key) {
          setStatus("Address could not be normalized for saving.", "error");
          return;
        }
        const savedAt = (/* @__PURE__ */ new Date()).toISOString();
        const zip = zipOverride || parseZip(address);
        const entry = { address, apartment, zip, description, flagReason, accessibilityFeatures, url: "", savedAt };
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.url) entry.url = tabs[0].url;
        } catch (_) {
        }
        try {
          const existing = await firestoreGet(`reports/${key}`);
          const prevEntries = existing?.entries || [];
          const city = parseCity(address);
          const featureFields = Object.fromEntries(accessibilityFeatures.map((f) => [f, true]));
          await firestoreSet(`reports/${key}`, {
            address,
            apartment,
            key,
            zip,
            city,
            ...featureFields,
            updatedAt: savedAt,
            entries: [...prevEntries, entry]
          });
          setStatus("Report saved for this address.", "ok");
          setMeta(`Saved at ${new Date(savedAt).toLocaleString()}`);
          clearHistory();
        } catch (error) {
          setStatus(`Error saving report: ${error.message}`, "error");
        }
      }
      function renderRecord(record) {
        const addressInput = document.getElementById("address-input");
        const apartmentInput = document.getElementById("apartment-input");
        const descriptionInput = document.getElementById("description-input");
        if (!addressInput || !descriptionInput) return;
        addressInput.value = record.address || "";
        const zipInput = document.getElementById("zip-input");
        if (zipInput) zipInput.value = record.zip || parseZip(record.address || "");
        if (apartmentInput) {
          apartmentInput.value = record.apartment != null ? String(record.apartment) : "";
        }
        descriptionInput.value = record.description || "";
        const flagInput = document.getElementById("flag-input");
        if (flagInput) flagInput.value = record.flagReason || "";
        document.querySelectorAll(".accessibility-checkbox").forEach((cb) => {
          cb.checked = Array.isArray(record.accessibilityFeatures) ? record.accessibilityFeatures.includes(cb.value) : false;
        });
        document.querySelectorAll("details.filter-dropdown").forEach((el) => {
          el.open = !!el.querySelector(".accessibility-checkbox:checked");
        });
        setStatus("Existing report loaded for this address.", "ok");
        const parts = [];
        if (record.url) parts.push(`URL: ${record.url}`);
        if (record.savedAt) parts.push(`Saved: ${new Date(record.savedAt).toLocaleString()}`);
        setMeta(parts.join("  \u2022  "));
      }
      function renderHistory(entries) {
        const container = document.getElementById("report-history");
        if (!container) return;
        container.innerHTML = "";
        if (!entries.length) return;
        const label = document.createElement("div");
        label.className = "history-label";
        label.textContent = "Previous reports:";
        container.appendChild(label);
        const list = document.createElement("div");
        list.className = "history-list";
        for (const entry of entries) {
          const btn = document.createElement("button");
          btn.className = "history-btn";
          btn.textContent = new Date(entry.savedAt).toLocaleString();
          btn.addEventListener("click", () => renderRecord(entry));
          list.appendChild(btn);
        }
        container.appendChild(list);
      }
      function clearHistory() {
        const container = document.getElementById("report-history");
        if (container) container.innerHTML = "";
      }
      async function handleLoad() {
        const addressInput = document.getElementById("address-input");
        const apartmentInput = document.getElementById("apartment-input");
        if (!addressInput) return;
        const address = addressInput.value.trim();
        const apartment = apartmentInput ? apartmentInput.value.trim() : "";
        if (!address) {
          setStatus("Enter an address to search for a report.", "error");
          return;
        }
        const key = buildReportDocKey(address, apartment);
        if (!key) {
          setStatus("Address could not be normalized for lookup.", "error");
          return;
        }
        try {
          const parent = await firestoreGet(`reports/${key}`);
          if (!parent) {
            setStatus(
              apartment ? "No report found for this address and apartment." : "No report found for this address yet.",
              "error"
            );
            setMeta("");
            clearHistory();
            return;
          }
          const entries = parent.entries || [];
          if (entries.length === 0) {
            renderRecord(parent);
            clearHistory();
            return;
          }
          entries.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
          const [latest, ...older] = entries;
          renderRecord({ address: parent.address, apartment: parent.apartment, ...latest });
          renderHistory(older.map((e) => ({ address: parent.address, apartment: parent.apartment, ...e })));
        } catch (error) {
          setStatus(`Error loading report: ${error.message}`, "error");
        }
      }
      document.addEventListener("DOMContentLoaded", async () => {
        document.getElementById("save-btn")?.addEventListener("click", handleSave);
        document.getElementById("load-btn")?.addEventListener("click", handleLoad);
        const addressInputEl = document.getElementById("address-input");
        const zipInputEl = document.getElementById("zip-input");
        if (addressInputEl && zipInputEl) {
          addressInputEl.addEventListener("input", () => {
            const zip = parseZip(addressInputEl.value);
            if (zip) zipInputEl.value = zip;
          });
        }
        try {
          const info = await extractListingInfoFromPage();
          if (info) {
            if (addressInputEl && info.address) {
              addressInputEl.value = info.address;
              if (zipInputEl) zipInputEl.value = parseZip(info.address);
            }
            setStatus(
              info.address ? "Pre-filled from the current page. Edit before saving if needed." : "Could not auto-detect listing info. Enter it manually.",
              info.address ? "ok" : "error"
            );
          } else {
            setStatus("Could not read the current page. You may need to reload it.", "error");
          }
        } catch (_) {
          setStatus("Error while reading page content.", "error");
        }
      });
    }
  });
  require_popup();
})();
