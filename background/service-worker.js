// background/service-worker.js — Main orchestrator

import { pushToGitHub } from "../utils/github.js";
import { generateReadme, generateFallbackReadme } from "../utils/claude.js";
import { getSettings, incrementPushCount, isAlreadyPushed, markAsPushed } from "../utils/storage.js";

// In-memory set to prevent concurrent double-triggers in the background worker
const currentlyPushing = new Set();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SOLUTION_ACCEPTED") {
    handleSolutionPush(message.data)
      .then((result) => sendResponse({ success: true, url: result }))
      .catch((err) => {
        console.error("[CodePush] Error during solution push:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep message channel open for async
  }

  if (message.type === "MANUAL_PUSH") {
    handleSolutionPush(message.data)
      .then((result) => sendResponse({ success: true, url: result }))
      .catch((err) => {
        console.error("[CodePush] Error during manual push:", err);
        sendResponse({ success: false, error: err.message });
      });
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

  const uniqueKey = data.uniqueKey || `${data.platform}:${data.problemTitle}`;

  // 1. Centralized double-push prevention check
  if (currentlyPushing.has(uniqueKey)) {
    throw new Error("Push is already in progress for this solution.");
  }

  const alreadyPushed = await isAlreadyPushed(uniqueKey);
  if (alreadyPushed) {
    console.log(`[CodePush] Key ${uniqueKey} has already been pushed. Skipping.`);
    throw new Error("This solution has already been successfully pushed.");
  }

  currentlyPushing.add(uniqueKey);

  try {
    // Show notification: starting push
    showNotification("⏳ CodePush", `Pushing ${data.problemTitle} to GitHub...`);

    let readme;
    try {
      // Use anthropicKey (which holds the user's Gemini key in settings) for AI README
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
      console.warn("AI README generation failed, using fallback:", err);
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

    // Save success in local storage
    await markAsPushed(uniqueKey);

    // Save metadata history
    await incrementPushCount({
      platform: data.platform,
      title: data.problemTitle,
      url: repoUrl,
      date: new Date().toISOString(),
      language: data.language,
    });

    showNotification("✅ CodePush — Success!", `${data.problemTitle} pushed to GitHub!`);
    return repoUrl;
  } catch (err) {
    // Sanitize any potential token/key exposure in error messages
    const sanitizedError = sanitizeError(err, settings);
    throw new Error(sanitizedError);
  } finally {
    currentlyPushing.delete(uniqueKey);
  }
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

function sanitizeError(err, settings) {
  let message = err.message || String(err);
  if (settings.githubToken) {
    message = message.replace(new RegExp(settings.githubToken, "g"), "[GITHUB_TOKEN]");
  }
  if (settings.anthropicKey) {
    message = message.replace(new RegExp(settings.anthropicKey, "g"), "[AI_API_KEY]");
  }
  // General pattern matching for safety
  message = message.replace(/ghp_[a-zA-Z0-9]{36}/g, "[GITHUB_TOKEN]");
  message = message.replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, "[GEMINI_API_KEY]");
  return message;
}
