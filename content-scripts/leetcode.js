// content-scripts/leetcode.js — Detects accepted submission on LeetCode

(function () {
  "use strict";

  let lastPushedSubmission = null;

  // Watch for submission result changes via MutationObserver
  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });

  // Also poll every 2 seconds as fallback
  setInterval(checkForAccepted, 2000);

  function checkForAccepted() {
    // LeetCode shows "Accepted" in the result area
    const resultElements = document.querySelectorAll('[data-e2e-locator="submission-result"]');
    for (const el of resultElements) {
      if (el.textContent.trim() === "Accepted") {
        const submissionId = getSubmissionId();
        if (submissionId && submissionId !== lastPushedSubmission) {
          lastPushedSubmission = submissionId;
          extractAndPush();
        }
        break;
      }
    }

    // Also check URL-based result page
    if (window.location.href.includes("/submissions/") && document.title.includes("Accepted")) {
      extractAndPush();
    }
  }

  function getSubmissionId() {
    const match = window.location.href.match(/\/submissions\/(\d+)/);
    return match ? match[1] : Date.now().toString();
  }

  async function extractAndPush() {
    try {
      const data = await extractProblemData();
      if (!data) return;

      chrome.runtime.sendMessage({ type: "SOLUTION_ACCEPTED", data }, (response) => {
        if (response?.success) {
          showToast(`✅ Pushed to GitHub! View: ${response.url}`);
        } else {
          showToast(`❌ Push failed: ${response?.error || "Unknown error"}`);
        }
      });
    } catch (err) {
      console.error("[CodePush] LeetCode extraction error:", err);
    }
  }

  async function extractProblemData() {
    // Get problem title from URL or page
    const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    const slug = pathMatch ? pathMatch[1] : null;
    if (!slug) return null;

    // Problem title from heading
    const titleEl = document.querySelector('[data-cy="question-title"]') ||
                    document.querySelector(".text-title-large") ||
                    document.querySelector("title");
    const rawTitle = titleEl?.textContent?.trim() || slug.replace(/-/g, " ");
    const problemTitle = rawTitle.replace(" - LeetCode", "").trim();

    // Difficulty
    const diffEl = document.querySelector('[diff]') ||
                   document.querySelector(".text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard") ||
                   document.querySelector('[class*="difficulty"]');
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    // Code from editor
    const code = extractCode();
    if (!code) return null;

    // Language
    const langEl = document.querySelector(".ant-select-selection-item") ||
                   document.querySelector('[data-cy="lang-select"]') ||
                   document.querySelector(".editor-language");
    const language = langEl?.textContent?.trim() || "Unknown";

    // Problem description
    const descEl = document.querySelector('[data-key="description-content"]') ||
                   document.querySelector(".question-content") ||
                   document.querySelector('[class*="description"]');
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
    // Try Monaco editor (LeetCode's editor)
    const lines = document.querySelectorAll(".view-line");
    if (lines.length > 0) {
      return Array.from(lines).map(l => l.textContent).join("\n");
    }

    // Try CodeMirror
    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // Try textarea
    const textarea = document.querySelector("textarea.inputarea");
    if (textarea) return textarea.value;

    return null;
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
