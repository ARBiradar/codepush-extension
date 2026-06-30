// content-scripts/hackerrank.js — HackerRank solution detector

(function () {
  "use strict";
  let lastPushed = null;

  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2000);

  function checkForAccepted() {
    // HackerRank shows a success modal/message
    const successEl = document.querySelector(".submission-result-message, [class*='result-message'], .submission-status");
    const congratsEl = document.querySelector('[class*="congrats"], [class*="success"], .testcase-status-accepted');

    const text = (successEl?.textContent || congratsEl?.textContent || "").toLowerCase();

    if (text.includes("congratulations") || text.includes("accepted") || text.includes("all test cases passed")) {
      const key = window.location.pathname;
      if (key !== lastPushed) {
        lastPushed = key;
        extractAndPush();
      }
    }

    // Check for checkmark / score display
    const scoreEl = document.querySelector(".score-bar, [class*='score']");
    if (scoreEl?.textContent?.includes("Score")) {
      // if max score, push
      const scores = scoreEl.textContent.match(/(\d+)\/(\d+)/);
      if (scores && scores[1] === scores[2] && scores[1] !== "0") {
        const key = window.location.pathname + "_score";
        if (key !== lastPushed) {
          lastPushed = key;
          extractAndPush();
        }
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
    const titleEl = document.querySelector(".challenge-name, h1.challenge-title, [class*='challenge-name']");
    const problemTitle = titleEl?.textContent?.trim() || document.title.replace(" | HackerRank", "");

    const diffEl = document.querySelector(".difficulty-block span, [class*='difficulty']");
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    const code = extractCode();
    if (!code) return null;

    const langEl = document.querySelector(".select-language .Select-value-label, [class*='language-select']");
    const language = langEl?.textContent?.trim() || "python3";

    const descEl = document.querySelector(".challenge-body-html, .challenge-statement");
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
    // HackerRank uses CodeMirror
    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // Monaco editor
    const lines = document.querySelectorAll(".view-line");
    if (lines.length > 0) return Array.from(lines).map(l => l.textContent).join("\n");

    return null;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: #1b2a4a; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #00ea64;
      max-width: 400px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
})();
