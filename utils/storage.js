// utils/storage.js — chrome.storage wrapper

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["githubToken", "githubUsername", "repoName", "anthropicKey", "totalPushed", "recentPushes"],
      resolve
    );
  });
}

export async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

export async function incrementPushCount(pushInfo) {
  const { totalPushed = 0, recentPushes = [] } = await getSettings();
  const updated = [pushInfo, ...recentPushes].slice(0, 10); // keep last 10
  await saveSettings({ totalPushed: totalPushed + 1, recentPushes: updated });
}

// Generates a simple, stable hash for a string (used to hash solution code for deduplication)
export function hashCode(str) {
  if (!str) return "empty";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Check if a submission key has already been pushed to GitHub
export async function isAlreadyPushed(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pushedSubmissions"], (result) => {
      const pushed = result.pushedSubmissions || {};
      resolve(!!pushed[key]);
    });
  });
}

// Mark a submission key as successfully pushed to prevent double execution
export async function markAsPushed(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pushedSubmissions"], (result) => {
      const pushed = result.pushedSubmissions || {};
      pushed[key] = true;
      chrome.storage.local.set({ pushedSubmissions: pushed }, resolve);
    });
  });
}
