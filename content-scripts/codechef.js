// content-scripts/codechef.js — CodeChef solution detector

(function () {
  "use strict";

  const pendingPushes = new Set();

  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2500);

  function checkForAccepted() {
    // Check if CodeChef shows AC or accepted status
    if (!checkCodeChefAccepted()) {
      return;
    }

    const code = extractCode();
    if (!code) return;

    // Extract problem title
    const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    const problemCode = pathMatch ? pathMatch[1] : null;
    const titleEl = document.querySelector("h1.problem-name, [class*='problem-title'], h1, [id*='problem-title']");
    const problemTitle = titleEl?.textContent?.trim() || problemCode || "Unknown-Problem";
    const cleanTitle = problemTitle.replace(/\s+/g, "-").toLowerCase();

    const codeHash = hashCode(code);
    const uniqueKey = `CodeChef:${cleanTitle}:${codeHash}`;

    // 1. Synchronous check to prevent race conditions
    if (pendingPushes.has(uniqueKey)) {
      return;
    }
    pendingPushes.add(uniqueKey);

    // 2. Persistent storage check (async)
    chrome.storage.local.get(["pushedSubmissions"], (result) => {
      const pushed = result.pushedSubmissions || {};
      if (pushed[uniqueKey]) {
        // Already pushed
        return;
      }

      extractAndPush(uniqueKey);
    });
  }

  function checkCodeChefAccepted() {
    // Check submission table verdicts
    const verdictEls = document.querySelectorAll('[class*="verdict"], [class*="result"], .ac, .AC, [class*="status"]');
    for (const el of verdictEls) {
      const text = el.textContent.trim().toUpperCase();
      // Ensure we don't trigger on sample test panels
      if ((text === "AC" || text === "ACCEPTED" || text.includes("ACCEPTED") || text.includes("CORRECT")) && 
          !el.closest(".sample-tests") && !el.closest("[class*='sample']")) {
        return true;
      }
    }

    // Check success banners
    const banner = document.querySelector('[class*="success-banner"], [class*="accepted-banner"], [class*="submission-status"]');
    if (banner) {
      const text = banner.textContent.toLowerCase();
      if ((text.includes("accepted") || text.includes("correct answer") || text.includes("ac") || text.includes("successfully")) && 
          !text.includes("sample")) {
        return true;
      }
    }

    // Scan body for typical success strings
    const bodyText = document.body.innerText || "";
    if ((bodyText.includes("Submission Successful") || bodyText.includes("Accepted")) && 
        !bodyText.includes("sample test cases passed") && !bodyText.includes("Sample Run")) {
      return true;
    }

    return false;
  }

  function getSubmissionId() {
    const match = window.location.pathname.match(/\/viewsolution\/(\d+)/) ||
                  window.location.href.match(/\/viewsolution\/(\d+)/);
    if (match) return match[1];

    // Try to find a link to the solution
    const link = document.querySelector('a[href*="/viewsolution/"]');
    if (link) {
      const m = link.href.match(/\/viewsolution\/(\d+)/);
      if (m) return m[1];
    }

    // Look for Run ID or Submission ID in page text
    const text = document.body.innerText || "";
    const m2 = text.match(/(?:Submission ID|Run ID|Run-ID)\s*:\s*(\w+)/i);
    if (m2) return m2[1];

    return null;
  }

  async function extractAndPush(uniqueKey) {
    try {
      const data = extractProblemData();
      if (!data) {
        pendingPushes.delete(uniqueKey);
        return;
      }

      data.uniqueKey = uniqueKey;

      chrome.runtime.sendMessage({ type: "SOLUTION_ACCEPTED", data }, (response) => {
        if (response?.success) {
          showToast(`✅ Pushed to GitHub!`);
        } else {
          pendingPushes.delete(uniqueKey);
          showToast(`❌ Push failed: ${response?.error || "Unknown error"}`);
        }
      });
    } catch (err) {
      pendingPushes.delete(uniqueKey);
      console.error("[CodePush] CodeChef extraction error:", err);
    }
  }

  function extractProblemData() {
    const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    const problemCode = pathMatch ? pathMatch[1] : null;

    const titleEl = document.querySelector("h1.problem-name, [class*='problem-title'], h1, [id*='problem-title']");
    const problemTitle = titleEl?.textContent?.trim() || problemCode || "Unknown Problem";

    const diffEl = document.querySelector('[class*="difficulty-level"], [class*="difficulty"], [class*='level']');
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    const code = extractCode();
    if (!code) return null;

    const langEl = document.querySelector('[name="language"], select[id*="lang"], [class*="language"], select.language-select');
    const language = langEl?.value || langEl?.textContent?.trim() || "cpp";

    const descEl = document.querySelector('[class*="problem-statement"], .problem-body, [class*="description"]');
    const problemDescription = descEl?.textContent?.trim()?.slice(0, 1000) || "";

    return {
      platform: "CodeChef",
      problemTitle,
      problemDescription,
      code,
      language,
      difficulty,
      url: window.location.href,
    };
  }

  function extractCode() {
    // 1. Monaco Editor
    const monacoLines = document.querySelectorAll(".view-line");
    if (monacoLines.length > 0) {
      return Array.from(monacoLines).map(l => l.textContent).join("\n");
    }

    // 2. ACE Editor
    const aceLines = document.querySelectorAll(".ace_line");
    if (aceLines.length > 0) {
      return Array.from(aceLines).map(l => l.textContent).join("\n");
    }

    // 3. CodeMirror
    const cmLines = document.querySelectorAll(".CodeMirror-line");
    if (cmLines.length > 0) {
      return Array.from(cmLines).map(l => l.textContent).join("\n");
    }

    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // 4. Textareas
    const ta = document.querySelector("textarea#edit-program, textarea[name='source'], textarea.inputarea, textarea[class*='editor']");
    if (ta) return ta.value;

    return null;
  }

  function hashCode(str) {
    if (!str) return "empty";
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  function showToast(message) {
    const existing = document.getElementById("codepush-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "codepush-toast";
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: #2c1810; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #f5a623;
      max-width: 400px; line-height: 1.4; animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;

    const style = document.createElement("style");
    style.textContent = `@keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    document.head.appendChild(style);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
})();
