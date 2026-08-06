// content-scripts/gfg.js — GeeksForGeeks solution detector

(function () {
  "use strict";

  const pendingPushes = new Set();

  // GFG uses dynamic DOM — observe changes
  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2000);

  function checkForAccepted() {
    // Check if GFG shows correct/solved status
    if (!checkGfgAccepted()) {
      return;
    }

    const code = extractCode();
    if (!code) return; // No code, can't push

    // Extract problem title
    const titleEl = document.querySelector(".problems_header_content__title__L2cB2") ||
                    document.querySelector("h1") ||
                    document.querySelector('[class*="problem-title"]');
    const problemTitle = titleEl?.textContent?.trim() || document.title.replace(" | Practice | GeeksforGeeks", "").trim();
    const cleanTitle = problemTitle.replace(/\s+/g, "-").toLowerCase();

    const codeHash = hashCode(code);
    const uniqueKey = `GeeksForGeeks:${cleanTitle}:${codeHash}`;

    // 1. Synchronous check to avoid duplicate triggers in same event loop/page state
    if (pendingPushes.has(uniqueKey)) {
      return;
    }
    pendingPushes.add(uniqueKey);

    // 2. Persistent storage check (async)
    chrome.storage.local.get(["pushedSubmissions"], (result) => {
      const pushed = result.pushedSubmissions || {};
      if (pushed[uniqueKey]) {
        // Already pushed to GitHub
        return;
      }

      extractAndPush(uniqueKey);
    });
  }

  function checkGfgAccepted() {
    // Check text of status and result containers
    const resultEl = document.querySelector(".problems_header_statusContainer__zVAKM") ||
                     document.querySelector('[class*="result"]') ||
                     document.querySelector('[class*="verdict"]') ||
                     document.querySelector('[class*="status"]');

    const successEl = document.querySelector(".problems_header_status__D9KD5") ||
                      document.querySelector('[class*="success"]') ||
                      document.querySelector(".problems_header_statusContainer__zVAKM");

    const resultText = (resultEl?.textContent || successEl?.textContent || "").toLowerCase();

    if (resultText.includes("problem solved") || 
        resultText.includes("correct answer") || 
        resultText.includes("accepted") || 
        resultText.includes("correct")) {
      return true;
    }

    // Search page text for "Problem Solved Successfully" or "Correct Answer"
    const text = document.body.innerText || "";
    if (text.includes("Problem Solved Successfully") || text.includes("Correct Answer")) {
      return true;
    }

    return false;
  }

  function getGfgSubmissionId() {
    // Extract Submission ID or Run ID from the text content of the page
    const text = document.body.innerText || "";
    const match = text.match(/(?:Submission ID|Run ID|Submission-ID)\s*:\s*(\w+)/i);
    return match ? match[1] : null;
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
          // Allow retrying if failed
          pendingPushes.delete(uniqueKey);
          showToast(`❌ Push failed: ${response?.error || "Unknown error"}`);
        }
      });
    } catch (err) {
      pendingPushes.delete(uniqueKey);
      console.error("[CodePush] GFG extraction error:", err);
    }
  }

  function extractProblemData() {
    // Title
    const titleEl = document.querySelector(".problems_header_content__title__L2cB2") ||
                    document.querySelector("h1") ||
                    document.querySelector('[class*="problem-title"]');
    const problemTitle = titleEl?.textContent?.trim() || document.title.replace(" | Practice | GeeksforGeeks", "").trim();

    // Difficulty
    const diffEl = document.querySelector('[class*="difficulty"]') ||
                   document.querySelector('[class*="Difficulty"]') ||
                   document.querySelector(".problems_header_statusContainer__zVAKM div");
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    // Code
    const code = extractCode();
    if (!code) return null;

    // Language
    const langEl = document.querySelector('[class*="langBtn"]') ||
                   document.querySelector("select#language") ||
                   document.querySelector('[class*="language-selector"]') ||
                   document.querySelector(".problems_header_statusContainer__zVAKM select");
    const language = langEl?.value || langEl?.textContent?.trim() || "cpp";

    // Description
    const descEl = document.querySelector('[class*="problem-statement"]') ||
                   document.querySelector(".problems_problem_content__Xm_eO") ||
                   document.querySelector('[class*="description"]');
    const problemDescription = descEl?.textContent?.trim()?.slice(0, 1000) || "";

    return {
      platform: "GeeksForGeeks",
      problemTitle,
      problemDescription,
      code,
      language,
      difficulty,
      url: window.location.href,
    };
  }

  function extractCode() {
    // 1. ACE Editor DOM elements (since window.ace is isolated)
    const aceLines = document.querySelectorAll(".ace_line");
    if (aceLines.length > 0) {
      return Array.from(aceLines).map(l => l.textContent).join("\n");
    }

    // 2. Monaco Editor DOM elements
    const monacoLines = document.querySelectorAll(".view-line");
    if (monacoLines.length > 0) {
      return Array.from(monacoLines).map(l => l.textContent).join("\n");
    }

    // 3. CodeMirror DOM elements
    const cmLines = document.querySelectorAll(".CodeMirror-line");
    if (cmLines.length > 0) {
      return Array.from(cmLines).map(l => l.textContent).join("\n");
    }

    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // 4. Textarea fallbacks
    const ta = document.querySelector("textarea[id*='editor'], textarea[class*='editor'], textarea.inputarea");
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
      background: #0f4c35; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #2ecc71;
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
