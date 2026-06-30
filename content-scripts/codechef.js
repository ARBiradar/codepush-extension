// content-scripts/codechef.js — CodeChef solution detector

(function () {
  "use strict";
  let lastPushed = null;

  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2500);

  function checkForAccepted() {
    // CodeChef shows verdict in submission table or result banner
    const verdictEls = document.querySelectorAll('[class*="verdict"], [class*="result"], .ac, .AC');
    for (const el of verdictEls) {
      const text = el.textContent.trim().toUpperCase();
      if (text === "AC" || text === "ACCEPTED" || text.includes("ACCEPTED")) {
        const key = el.closest("tr")?.querySelector('a')?.href || window.location.pathname;
        if (key !== lastPushed) {
          lastPushed = key;
          extractAndPush();
        }
        break;
      }
    }

    // Check for success banner on problem submission page
    const banner = document.querySelector('[class*="success-banner"], [class*="accepted-banner"]');
    if (banner && banner.textContent.toLowerCase().includes("accepted")) {
      const key = window.location.pathname + "_banner";
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
    // Get problem code from URL (e.g. /problems/TWOSUM)
    const pathMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
    const problemCode = pathMatch ? pathMatch[1] : null;

    const titleEl = document.querySelector("h1.problem-name, [class*='problem-title'], h1");
    const problemTitle = titleEl?.textContent?.trim() || problemCode || "Unknown Problem";

    const diffEl = document.querySelector('[class*="difficulty-level"], [class*="difficulty"]');
    const difficulty = diffEl?.textContent?.trim() || "Unknown";

    const code = extractCode();
    if (!code) return null;

    const langEl = document.querySelector('[name="language"], select[id*="lang"], [class*="language"]');
    const language = langEl?.value || langEl?.textContent?.trim() || "cpp";

    const descEl = document.querySelector('[class*="problem-statement"], .problem-body');
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
    // CodeChef uses CodeMirror or ACE
    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    const ace = window.ace?.edit(document.querySelector(".ace_editor"));
    if (ace) return ace.getValue();

    const ta = document.querySelector("textarea#edit-program, textarea[name='source']");
    if (ta) return ta.value;

    return null;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: #2c1810; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #f5a623;
      max-width: 400px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
})();
