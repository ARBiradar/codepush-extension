// utils/github.js — GitHub REST API helper

export async function pushToGitHub({ token, repoName, username, platform, problemTitle, code, language, readme }) {
  const baseURL = "https://api.github.com";
  const headers = {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  };

  // 1. Ensure repo exists
  await ensureRepo(baseURL, headers, username, repoName);

  // 2. Build file paths
  const safeTitle = problemTitle.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").trim();
  const ext = getExtension(language);
  const folder = `${platform}/${safeTitle}`;
  const solutionPath = `${folder}/solution${ext}`;
  const readmePath = `${folder}/README.md`;

  // 3. Push solution file
  await pushFile(baseURL, headers, username, repoName, solutionPath, code, `Add ${platform} solution: ${problemTitle}`);

  // 4. Push README
  await pushFile(baseURL, headers, username, repoName, readmePath, readme, `Add README for ${problemTitle}`);

  return `https://github.com/${username}/${repoName}/tree/main/${folder}`;
}

async function ensureRepo(baseURL, headers, username, repoName) {
  const check = await fetch(`${baseURL}/repos/${username}/${repoName}`, { headers });
  if (check.status === 404) {
    await fetch(`${baseURL}/user/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: repoName,
        description: "My coding solutions — auto-pushed by CodePush extension",
        private: false,
        auto_init: true,
      }),
    });
    // Wait for repo to initialize
    await new Promise(r => setTimeout(r, 2000));
  }
}

async function pushFile(baseURL, headers, username, repoName, path, content, message) {
  const url = `${baseURL}/repos/${username}/${repoName}/contents/${path}`;

  // Check if file already exists (to get SHA for update)
  let sha = null;
  const existing = await fetch(url, { headers });
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  }

  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    ...(sha && { sha }),
  };

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub push failed: ${err.message}`);
  }
}

function getExtension(language) {
  const map = {
    python: ".py", python3: ".py",
    javascript: ".js", typescript: ".ts",
    java: ".java", cpp: ".cpp", "c++": ".cpp",
    c: ".c", go: ".go", rust: ".rs",
    kotlin: ".kt", swift: ".swift", ruby: ".rb",
    scala: ".scala", php: ".php", cs: ".cs", "c#": ".cs",
  };
  return map[language?.toLowerCase()] || ".txt";
}

export async function validateToken(token) {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) throw new Error("Invalid GitHub token");
  return await res.json();
}
