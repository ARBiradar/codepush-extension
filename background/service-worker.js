// background/service-worker.js — Main orchestrator

import { pushToGitHub } from "../utils/github.js";
import { generateReadme, generateFallbackReadme } from "../utils/claude.js";
import { getSettings, incrementPushCount } from "../utils/storage.js";

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SOLUTION_ACCEPTED") {
    handleSolutionPush(message.data)
      .then((result) => sendResponse({ success: true, url: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep message channel open for async
  }

  if (message.type === "MANUAL_PUSH") {
    handleSolutionPush(message.data)
      .then((result) => sendResponse({ success: true, url: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "VALIDATE_SETTINGS") {
    validateSettings()
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ valid: false, error: err.message }));
    return true;
  }
});

async function handleSolutionPush(data) {
  const settings = await getSettings();

  if (!settings.githubToken || !settings.githubUsername || !settings.repoName) {
    throw new Error("Please configure GitHub settings in the extension popup first.");
  }

  // Show notification: starting push
  showNotification("⏳ CodePush", `Pushing ${data.problemTitle} to GitHub...`);

  let readme;
  try {
    if (settings.anthropicKey) {
      readme = await generateReadme({
        apiKey: settings.anthropicKey,
        platform: data.platform,
        problemTitle: data.problemTitle,
        problemDescription: data.problemDescription,
        code: data.code,
        language: data.language,
        difficulty: data.difficulty,
      });
    } else {
      readme = generateFallbackReadme(data);
    }
  } catch (err) {
    console.warn("README generation failed, using fallback:", err);
    readme = generateFallbackReadme(data);
  }

  const repoUrl = await pushToGitHub({
    token: settings.githubToken,
    repoName: settings.repoName,
    username: settings.githubUsername,
    platform: data.platform,
    problemTitle: data.problemTitle,
    code: data.code,
    language: data.language,
    readme,
  });

  await incrementPushCount({
    platform: data.platform,
    title: data.problemTitle,
    url: repoUrl,
    date: new Date().toISOString(),
    language: data.language,
  });

  showNotification("✅ CodePush — Success!", `${data.problemTitle} pushed to GitHub!`);
  return repoUrl;
}

async function validateSettings() {
  const settings = await getSettings();
  if (!settings.githubToken || !settings.githubUsername) {
    return { valid: false, error: "GitHub credentials not set" };
  }

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${settings.githubToken}` },
    });
    if (!res.ok) return { valid: false, error: "Invalid GitHub token" };
    const user = await res.json();
    return { valid: true, username: user.login, avatar: user.avatar_url };
  } catch {
    return { valid: false, error: "Network error" };
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "../icons/icon48.png",
    title,
    message,
  });
}
