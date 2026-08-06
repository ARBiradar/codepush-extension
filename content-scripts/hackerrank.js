// content-scripts/hackerrank.js — HackerRank solution detector

(function () {
  "use strict";

  const pendingPushes = new Set();

  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2000);

  function checkForAccepted() {
    // Check if HackerRank displays accepted/congrats message
    if (!checkHackerRankAccepted()) {
      return;
    }

    const code = extractCode();
    if (!code) return;

    // Extract problem title
    const titleEl = document.querySelector(".challenge-name, h1.challenge-title, [class*='challenge-name'], h1");
    const problemTitle = titleEl?.textContent?.trim() || document.title.replace(" | HackerRank", "").trim();
    const cleanTitle = problemTitle.replace(/\s+/g, "-").toLowerCase();

    const codeHash = hashCode(code);
    const uniqueKey = `HackerRank:${cleanTitle}:${codeHash}`;

    // 1. Synchronous duplicate check
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

  function checkHackerRankAccepted() {
    // Check success modals or status message elements
    const successEl = document.querySelector(".submission-result-message, [class*='result-message'], .submission-status, .congrats-heading, [class*='congrats']");
    const congratsEl = document.querySelector('[class*="congrats"], [class*="success"], .testcase-status-accepted, .all-testcases-passed');
    const text = (successEl?.textContent || congratsEl?.textContent || "").toLowerCase();

    if (text.includes("congratulations") || 
        text.includes("accepted") || 
        text.includes("all test cases passed") || 
        text.includes("submission successful")) {
      return true;
    }

    // Check for score displays
    const scoreEl = document.querySelector(".score-bar, [class*='score'], .challenge-submit-view");
    if (scoreEl && scoreEl.textContent.includes("Score")) {
      const scores = scoreEl.textContent.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
      if (scores && parseFloat(scores[1]) === parseFloat(scores[2]) && parseFloat(scores[1]) !== 0) {
        return true;
      }
    }

    // Check DOM for congratulations or all test cases passed
    const bodyText = document.body.innerText || "";
    if (bodyText.includes("Congratulations!") || bodyText.includes("All test cases passed")) {
      return true;
    }

    return false;
  }

  function getSubmissionId() {
    // Extract HackerRank submission ID from URL or page elements
    const match = window.location.href.match(/\/submissions\/(\d+)/) ||
                  window.location.pathname.match(/\/submissions\/(\d+)/);
    if (match) return match[1];

    const link = document.querySelector('a[href*="/submissions/"]');
    if (link) {
      const m = link.href.match(/\/submissions\/(\d+)/);
      if (m) return m[1];
    }

    // Search page text for "Submission ID"
    const text = document.body.innerText || "";
    const m2 = text.match(/(?:Submission ID|Run ID|Submission-ID)\s*:\s*(\w+)/i);
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
      console.error("[CodePush] HackerRank extraction error:", err);
    }
  }

  function extractProblemData() {
    const titleEl = document.querySelector(".challenge-name, h1.challenge-title, [class*='challenge-name'], h1");
    const problemTitle = titleEl?.textContent?.trim() || document.title.replace(" | HackerRank", "").trim();

    const diffEl = document.querySelector(".difficulty-block span, [class*='difficulty'], .challenge-desc-difficulty");
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    const code = extractCode();
    if (!code) return null;

    const langEl = document.querySelector(".select-language .Select-value-label, [class*='language-select'], [class*='language']");
    const language = langEl?.textContent?.trim() || "python3";

    const descEl = document.querySelector(".challenge-body-html, .challenge-statement, .challenge-description, [class*='description']");
    const problemDescription = descEl?.textContent?.trim()?.slice(0, 1000) || "";

    return {
      platform: "HackerRank",
      problemTitle,
      problemDescription,
      code,
      language,
      difficulty,
      url: window.location.href,
    };
  }

  function extractCode() {
    // 1. Monaco Editor (lines view)
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
    const ta = document.querySelector("textarea[class*='editor'], textarea.inputarea");
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
      background: #1b2a4a; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #00ea64;
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
