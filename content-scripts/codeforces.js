// content-scripts/codeforces.js — Codeforces solution detector

(function () {
  "use strict";
  let lastPushed = null;

  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2500);

  function checkForAccepted() {
    // Codeforces submission table shows verdict
    const verdictCells = document.querySelectorAll("td.status-verdict-cell, [class*='verdict']");
    for (const cell of verdictCells) {
      const text = cell.textContent.trim();
      if (text.startsWith("Accepted") || text === "OK") {
        const row = cell.closest("tr");
        const submissionId = row?.querySelector("td:first-child")?.textContent?.trim();
        const key = submissionId || text + Date.now();

        if (key !== lastPushed) {
          lastPushed = key;
          extractAndPush(row);
        }
        break;
      }
    }
  }

  async function extractAndPush(row) {
    const data = extractProblemData(row);
    if (!data) return;

    chrome.runtime.sendMessage({ type: "SOLUTION_ACCEPTED", data }, (response) => {
      showToast(response?.success
        ? `✅ Pushed to GitHub!`
        : `❌ Push failed: ${response?.error}`);
    });
  }

  function extractProblemData(row) {
    // Try to get problem name from submission row
    const problemLink = row?.querySelector("td a[href*='/problem/'], td a[href*='contest']");
    const problemTitle = problemLink?.textContent?.trim() ||
                         document.querySelector(".problem-statement .title")?.textContent?.trim() ||
                         document.title.replace(" - Codeforces", "");

    const langCell = row?.querySelectorAll("td")?.[4];
    const language = langCell?.textContent?.trim() || "cpp";

    const code = extractCode();
    if (!code) return null;

    const descEl = document.querySelector(".problem-statement");
    const problemDescription = descEl?.textContent?.trim()?.slice(0, 1000) || "";

    return {
      platform: "Codeforces",
      problemTitle,
      problemDescription,
      code,
      language,
      difficulty: "Unknown",
      url: window.location.href,
    };
  }

  function extractCode() {
    // Codeforces source code in submission view
    const pre = document.querySelector("pre#program-source-text, .source-code pre");
    if (pre) return pre.textContent;

    // CodeMirror
    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // ACE editor
    const ace = window.ace?.edit(document.querySelector(".ace_editor"));
    if (ace) return ace.getValue();

    return null;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 999999;
      background: #1a1a2e; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #3498db;
      max-width: 400px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
})();
