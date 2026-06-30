// content-scripts/gfg.js — GeeksForGeeks solution detector

(function () {
  "use strict";
  let lastPushed = null;

  // GFG uses dynamic DOM — observe changes
  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2000);

  function checkForAccepted() {
    // GFG shows result in various ways
    const resultEl = document.querySelector(".problems_header_statusContainer__zVAKM") ||
                     document.querySelector('[class*="result"]') ||
                     document.querySelector('[class*="verdict"]');

    const successEl = document.querySelector(".problems_header_status__D9KD5") ||
                      document.querySelector('[class*="success"]');

    const resultText = (resultEl?.textContent || successEl?.textContent || "").toLowerCase();

    if (resultText.includes("problem solved") || resultText.includes("correct") || resultText.includes("accepted")) {
      const key = window.location.pathname;
      if (key !== lastPushed) {
        lastPushed = key;
        extractAndPush();
      }
    }
  }

  async function extractAndPush() {
    const data = extractProblemData();
    if (!data) return;

    chrome.runtime.sendMessage({ type: "SOLUTION_ACCEPTED", data }, (response) => {
      showToast(response?.success
        ? `✅ Pushed to GitHub!`
        : `❌ Push failed: ${response?.error}`);
    });
  }

  function extractProblemData() {
    // Title
    const titleEl = document.querySelector(".problems_header_content__title__L2cB2") ||
                    document.querySelector("h1") ||
                    document.querySelector('[class*="problem-title"]');
    const problemTitle = titleEl?.textContent?.trim() || document.title.replace(" | Practice | GeeksforGeeks", "");

    // Difficulty
    const diffEl = document.querySelector('[class*="difficulty"]') ||
                   document.querySelector('[class*="Difficulty"]');
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    // Code from ACE / CodeMirror editor
    const code = extractCode();
    if (!code) return null;

    // Language
    const langEl = document.querySelector('[class*="langBtn"]') ||
                   document.querySelector("select#language") ||
                   document.querySelector('[class*="language-selector"]');
    const language = langEl?.textContent?.trim() || "cpp";

    // Description
    const descEl = document.querySelector('[class*="problem-statement"]') ||
                   document.querySelector(".problems_problem_content__Xm_eO");
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
    // ACE editor (GFG uses this)
    const aceEditor = window.ace?.edit(document.querySelector(".ace_editor"));
    if (aceEditor) return aceEditor.getValue();

    // CodeMirror
    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // Monaco
    const lines = document.querySelectorAll(".view-line");
    if (lines.length > 0) return Array.from(lines).map(l => l.textContent).join("\n");

    // Textarea fallback
    const ta = document.querySelector("textarea[id*='editor'], textarea[class*='editor']");
    if (ta) return ta.value;

    return null;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: #0f4c35; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #2ecc71;
      max-width: 400px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
})();
