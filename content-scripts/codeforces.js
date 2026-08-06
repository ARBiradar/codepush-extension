// content-scripts/codeforces.js — Codeforces solution detector

(function () {
  "use strict";

  const pendingPushes = new Set();

  const observer = new MutationObserver(() => checkForAccepted());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(checkForAccepted, 2500);

  function checkForAccepted() {
    // Codeforces submission table shows verdict
    const verdictCells = document.querySelectorAll("td.status-verdict-cell, [class*='verdict'], .verdict-accepted, span.verdict-accepted");
    for (const cell of verdictCells) {
      const text = cell.textContent.trim();
      if (text.startsWith("Accepted") || text === "OK" || text.includes("Correct") || text.includes("Verdict: OK")) {
        const row = cell.closest("tr");
        const code = extractCode();
        if (!code) continue; // Skip if code not found

        // Extract problem title
        const problemLink = row?.querySelector("td a[href*='/problem/'], td a[href*='contest']");
        const problemTitle = problemLink?.textContent?.trim() ||
                             document.querySelector(".problem-statement .title")?.textContent?.trim() ||
                             document.title.replace(" - Codeforces", "").trim();
        const cleanTitle = problemTitle.replace(/\s+/g, "-").toLowerCase();

        const codeHash = hashCode(code);
        const uniqueKey = `Codeforces:${cleanTitle}:${codeHash}`;

        // 1. Synchronous duplicate check
        if (pendingPushes.has(uniqueKey)) {
          continue;
        }
        pendingPushes.add(uniqueKey);

        // 2. Persistent storage check (async)
        chrome.storage.local.get(["pushedSubmissions"], (result) => {
          const pushed = result.pushedSubmissions || {};
          if (pushed[uniqueKey]) {
            // Already pushed
            return;
          }

          extractAndPush(row, uniqueKey);
        });
        break;
      }
    }
  }

  function getSubmissionIdFromPage() {
    const match = window.location.href.match(/\/submission\/(\d+)/);
    return match ? match[1] : null;
  }

  async function extractAndPush(row, uniqueKey) {
    try {
      const data = extractProblemData(row);
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
      console.error("[CodePush] Codeforces extraction error:", err);
    }
  }

  function extractProblemData(row) {
    // Get problem name from row links or DOM
    const problemLink = row?.querySelector("td a[href*='/problem/'], td a[href*='contest']");
    const problemTitle = problemLink?.textContent?.trim() ||
                         document.querySelector(".problem-statement .title")?.textContent?.trim() ||
                         document.title.replace(" - Codeforces", "").trim();

    const langCell = row?.querySelectorAll("td")?.[4];
    const language = langCell?.textContent?.trim() || 
                     document.querySelector(".info tr:nth-child(4) td")?.textContent?.trim() || // submission info table
                     "cpp";

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
    // 1. Source code pre element (CF view submission page)
    const pre = document.querySelector("pre#program-source-text, .source-code pre, pre.prettyprint");
    if (pre) return pre.textContent;

    // 2. Monaco Editor
    const monacoLines = document.querySelectorAll(".view-line");
    if (monacoLines.length > 0) {
      return Array.from(monacoLines).map(l => l.textContent).join("\n");
    }

    // 3. ACE Editor
    const aceLines = document.querySelectorAll(".ace_line");
    if (aceLines.length > 0) {
      return Array.from(aceLines).map(l => l.textContent).join("\n");
    }

    // 4. CodeMirror
    const cmLines = document.querySelectorAll(".CodeMirror-line");
    if (cmLines.length > 0) {
      return Array.from(cmLines).map(l => l.textContent).join("\n");
    }

    const cm = document.querySelector(".CodeMirror");
    if (cm?.CodeMirror) return cm.CodeMirror.getValue();

    // 5. Textareas
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
      background: #1a1a2e; color: #fff; padding: 14px 20px;
      border-radius: 10px; font-family: monospace; font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); border-left: 4px solid #3498db;
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
