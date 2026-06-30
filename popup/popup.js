// popup/popup.js

// ── Tab switching ──────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");

    if (tab.dataset.tab === "history") loadHistory();
  });
});

// ── Password toggles ───────────────────────────────────────
document.getElementById("toggleToken").addEventListener("click", () => toggleVisibility("githubToken"));
document.getElementById("toggleAnthropicKey").addEventListener("click", () => toggleVisibility("anthropicKey"));

function toggleVisibility(id) {
  const el = document.getElementById(id);
  el.type = el.type === "password" ? "text" : "password";
}

// ── Load saved settings on open ────────────────────────────
chrome.storage.sync.get(
  ["githubToken", "githubUsername", "repoName", "anthropicKey", "totalPushed"],
  (data) => {
    if (data.githubToken) document.getElementById("githubToken").value = data.githubToken;
    if (data.githubUsername) document.getElementById("githubUsername").value = data.githubUsername;
    if (data.repoName) document.getElementById("repoName").value = data.repoName;
    if (data.anthropicKey) document.getElementById("anthropicKey").value = data.anthropicKey;
    if (data.githubToken && data.githubUsername) {
      checkConnection(data.githubToken, data.githubUsername, data.totalPushed || 0);
    }
  }
);

// ── Save settings ──────────────────────────────────────────
document.getElementById("saveBtn").addEventListener("click", () => {
  const token = document.getElementById("githubToken").value.trim();
  const username = document.getElementById("githubUsername").value.trim();
  const repoName = document.getElementById("repoName").value.trim() || "coding-solutions";
  const anthropicKey = document.getElementById("anthropicKey").value.trim();

  if (!token || !username) {
    showMsg("GitHub token and username are required.", "error");
    return;
  }

  chrome.storage.sync.set({ githubToken: token, githubUsername: username, repoName, anthropicKey }, () => {
    showMsg("✅ Settings saved!", "success");
    checkConnection(token, username);
  });
});

// ── Validate / test connection ─────────────────────────────
document.getElementById("validateBtn").addEventListener("click", () => {
  const token = document.getElementById("githubToken").value.trim();
  const username = document.getElementById("githubUsername").value.trim();
  if (!token || !username) {
    showMsg("Enter GitHub token and username first.", "error");
    return;
  }
  showMsg("Testing connection…", "info");
  checkConnection(token, username);
});

async function checkConnection(token, username, pushCount = 0) {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}` },
    });

    if (!res.ok) throw new Error("Invalid token");

    const user = await res.json();

    // Show user card
    document.getElementById("userCard").classList.remove("hidden");
    document.getElementById("userAvatar").src = user.avatar_url;
    document.getElementById("userName").textContent = user.login;
    document.getElementById("pushCount").textContent = `${pushCount} pushes`;

    // Status dot green
    const dot = document.getElementById("statusDot");
    dot.classList.add("connected");
    dot.classList.remove("error");
    dot.title = `Connected as ${user.login}`;

    showMsg(`✅ Connected as @${user.login}`, "success");
  } catch {
    const dot = document.getElementById("statusDot");
    dot.classList.add("error");
    dot.classList.remove("connected");
    dot.title = "Connection failed";
    document.getElementById("userCard").classList.add("hidden");
    showMsg("❌ Invalid GitHub token. Please check and try again.", "error");
  }
}

// ── History ────────────────────────────────────────────────
function loadHistory() {
  chrome.storage.sync.get(["recentPushes"], ({ recentPushes = [] }) => {
    const list = document.getElementById("historyList");

    if (recentPushes.length === 0) {
      list.innerHTML = '<div class="empty-state">No pushes yet.<br>Solve a problem to get started! 🚀</div>';
      return;
    }

    list.innerHTML = recentPushes.map(push => {
      const platformClass = `platform-${push.platform.toLowerCase().replace(/[^a-z]/g, "")}`;
      const date = new Date(push.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return `
        <div class="history-item" onclick="window.open('${push.url}', '_blank')">
          <span class="history-platform ${platformClass}">${push.platform}</span>
          <div class="history-title">${push.title}</div>
          <div class="history-meta">
            <span>${push.language || "—"}</span>
            <span>${date}</span>
          </div>
        </div>
      `;
    }).join("");
  });
}

// ── Utility ────────────────────────────────────────────────
function showMsg(text, type) {
  const msg = document.getElementById("msg");
  msg.textContent = text;
  msg.className = `msg ${type}`;
  if (type !== "info") setTimeout(() => msg.classList.add("hidden"), 4000);
}
