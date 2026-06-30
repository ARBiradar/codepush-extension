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
