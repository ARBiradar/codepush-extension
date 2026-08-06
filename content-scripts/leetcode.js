// content-scripts/leetcode.js — Detects accepted submission on LeetCode

(function () {
  "use strict";

  // Keep track of pending pushes synchronously to prevent multiple quick triggers (race conditions)
  const pendingPushes = new Set();

  // Watch for submission result changes via MutationObserver
  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });

  // Also poll every 2 seconds as fallback
  setInterval(checkForAccepted, 2000);

  function checkForAccepted() {
    // Check if the solution is accepted
    if (!checkLeetCodeAccepted()) {
      return;
    }

    const submissionId = getSubmissionId();
    const code = extractCode();
    if (!code) return; // No code, can't push

    const codeHash = hashCode(code);
    // Use submission ID if available, otherwise fall back to code hash (perfect for identical duplicate checks)
    const uniqueKey = `LeetCode:${submissionId || codeHash}`;

    // 1. Synchronous check to avoid triggering again while async checks/pushes are running
    if (pendingPushes.has(uniqueKey)) {
      return;
    }
    pendingPushes.add(uniqueKey);

    // 2. Persistent storage check (async)
    chrome.storage.local.get(["pushedSubmissions"], (result) => {
      const pushed = result.pushedSubmissions || {};
      if (pushed[uniqueKey]) {
        // Already pushed to GitHub in a previous run/tab
        return;
      }

      // If not pushed, execute the push
      extractAndPush(uniqueKey);
    });
  }

  function checkLeetCodeAccepted() {
    // e2e locator for submission result
    const e2e = document.querySelector('[data-e2e-locator="submission-result"]');
    if (e2e && e2e.textContent.trim() === "Accepted") return true;

    // Check common class names and text
    const successEl = document.querySelector(".text-success, [class*='success'], [class*='verdict']");
    if (successEl && successEl.textContent.trim() === "Accepted") return true;

    // Check all status/result/verdict elements for "Accepted" text
    const els = document.querySelectorAll('[class*="success"], [class*="status"], [class*="verdict"], [class*="result"]');
    for (const el of els) {
      if (el.textContent.trim() === "Accepted") return true;
    }

    // Fallback: URL based result check
    if (window.location.href.includes("/submissions/") && document.title.includes("Accepted")) {
      return true;
    }

    return false;
  }

  function getSubmissionId() {
    const match = window.location.href.match(/\/submissions\/detail\/(\d+)/) ||
                  window.location.href.match(/\/submissions\/(\d+)/);
    if (match) return match[1];

    // Try finding submission ID from links in the DOM (e.g. view details)
    const link = document.querySelector('a[href*="/submissions/detail/"]') ||
                 document.querySelector('a[href*="/submissions/"]');
    if (link) {
      const m = link.href.match(/\/submissions\/(?:detail\/)?(\d+)/);
      if (m) return m[1];
    }

    return null;
  }

  async function extractAndPush(uniqueKey) {
    try {
      const data = await extractProblemData();
      if (!data) {
        pendingPushes.delete(uniqueKey);
        return;
      }

      // Include submission key so background can track and save it
      data.uniqueKey = uniqueKey;

      chrome.runtime.sendMessage({ type: "SOLUTION_ACCEPTED", data }, (response) => {
        if (response?.success) {
          showToast(`✅ Pushed to GitHub! View: ${response.url}`);
        } else {
          // Allow retrying if the push failed
          pendingPushes.delete(uniqueKey);
          showToast(`❌ Push failed: ${response?.error || "Unknown error"}`);
        }
      });
    } catch (err) {
      pendingPushes.delete(uniqueKey);
      console.error("[CodePush] LeetCode extraction error:", err);
    }
  }

  async function extractProblemData() {
    const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    const slug = pathMatch ? pathMatch[1] : null;
    if (!slug) return null;

    // Problem title
    const titleEl = document.querySelector('[data-cy="question-title"]') ||
                    document.querySelector(".text-title-large") ||
                    document.querySelector("h1");
    const rawTitle = titleEl?.textContent?.trim() || slug.replace(/-/g, " ");
    const problemTitle = rawTitle.replace(" - LeetCode", "").trim();

    // Difficulty
    const diffEl = document.querySelector('[diff]') ||
                   document.querySelector(".text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard") ||
                   document.querySelector('[class*="difficulty"]');
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    // Code
    const code = extractCode();
    if (!code) return null;

    // Language
    const langEl = document.querySelector(".ant-select-selection-item") ||
                   document.querySelector('[data-cy="lang-select"]') ||
                   document.querySelector(".editor-language") ||
                   document.querySelector('[class*="language"]');
    const language = langEl?.textContent?.trim() || "Unknown";

    // Description
    const descEl = document.querySelector('[data-key="description-content"]') ||
                   document.querySelector(".question-content") ||
                   document.querySelector('[class*="description"]') ||
                   document.querySelector(".problem-description");
    const problemDescription = descEl?.textContent?.trim()?.slice(0, 1000) || "";

    return {
      platform: "LeetCode",
      problemTitle,
      problemDescription,
      code,
      language,
      difficulty,
      url: window.location.href,
    };
  }

  function extractCode() {
    // Monaco editor (LeetCode's editor)
    const lines = document.querySelectorAll(".view-line");
    if (lines.length > 0) {
      return Array.from(lines).map(l => l.textContent).join("\n");
    }

    // CodeMirror
    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // Textarea fallback
    const textarea = document.querySelector("textarea.inputarea");
    if (textarea) return textarea.value;

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
      background: #1a1a2e; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #4ade80;
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
