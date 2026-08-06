# ⚡ CodePush — Auto Push Coding Solutions to GitHub

Auto-detect accepted solutions from **LeetCode, GeeksForGeeks, CodeChef, HackerRank, and Codeforces** and push them to your GitHub with an AI-generated README — fully automatically on submission acceptance.

---

## 🚀 How to Install & Configure

### Step 1 — Get Your GitHub Personal Access Token
1. Go to → [GitHub Token Settings](https://github.com/settings/tokens/new)
2. Give it a name like `CodePush`
3. Select scope: ✅ **repo** (full control of private and public repositories)
4. Click **Generate token**
5. **Copy it** immediately — you won't see it again!

### Step 2 — Load the Extension in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Toggle **Developer mode** to **ON** (top right corner)
3. Click **Load unpacked**
4. Select the `codepush-extension` root folder
5. The ⚡ CodePush icon will appear in your toolbar!

### Step 3 — Configure Credentials
1. Click the **⚡ CodePush** icon in your toolbar.
2. Paste your **GitHub Token**.
3. Enter your **GitHub Username**.
4. Set a **Repository Name** (e.g. `my-coding-solutions`) — this repository will be created automatically on GitHub if it doesn't already exist!
5. Optionally add your **Google Gemini API Key** (configured under the API Key field in settings) for AI-generated READMEs.
6. Click **Save Settings** and verify by clicking 🔗 **Test Connection**.

### Step 4 — Solve & Push!
- Go to LeetCode, GFG, CodeChef, HackerRank, or Codeforces.
- Solve a problem, click submit, and get an **Accepted / Correct** verdict.
- CodePush will **instantly detect** the acceptance and push the code directly to GitHub.
- A success toast notification will appear in the bottom-right corner of the page: ✅ `Pushed to GitHub!`

---

## 📁 Your GitHub Repo Structure

The repository structure matches the platform names and problem titles automatically:

```
your-repo/
├── LeetCode/
│   └── Two-Sum/
│       ├── solution.py
│       └── README.md    ← AI-generated!
├── GeeksForGeeks/
│   └── Longest-Common-Subsequence/
│       ├── solution.cpp
│       └── README.md
├── CodeChef/
│   └── TWOSUM/
│       ├── solution.java
│       └── README.md
├── HackerRank/
│   └── simple-array-sum/
│       ├── solution.cpp
│       └── README.md
└── Codeforces/
    └── 4A-Watermelon/
        ├── solution.cpp
        └── README.md
```

---

## 🤖 AI README Contents

When Gemini is configured, each solution gets a detailed markdown documentation file containing:
- 🧩 **Problem Summary** — plain English explanation of the task.
- 💡 **Intuition** — first thought or strategy when approaching the problem.
- 🔍 **Approach** — step-by-step algorithm breakdown.
- ⏱️ **Complexity Analysis** — rigorous Time & Space complexity analysis.
- 🧪 **Example Walkthrough** — manual dry-run trace of an example.
- 🏷️ **Tags** — topic tags (e.g., Arrays, Dynamic Programming, Greedy).
- 💻 **Solution** — syntax-highlighted code.
- 📅 **Solved On** — date of the successful submission.

---

## 🛠️ Platforms Supported

| Platform | Auto-Detect Verdict | Editor Parsing Support | Status |
|---|---|---|---|
| **LeetCode** | ✅ Accepted | Monaco Editor (`.view-line`), CodeMirror, Textarea | Active |
| **GeeksForGeeks** | ✅ Correct Answer / Solved | ACE Editor (`.ace_line`), Monaco, CodeMirror | Active |
| **CodeChef** | ✅ AC / Correct Answer | CodeMirror (`.CodeMirror-line`), ACE, Monaco, Textarea | Active |
| **HackerRank** | ✅ Congratulations / All passed | Monaco (`.view-line`), CodeMirror, Textarea | Active |
| **Codeforces** | ✅ OK / Accepted | DOM Pre (`pre#program-source-text`), Monaco, ACE, CodeMirror | Active |

---

## 🔧 Troubleshooting & Stability

### Push not triggering?
- Make sure you are on the problem page when submitting.
- Ensure you have configured and saved your credentials in the extension popup.
- Verify your GitHub Personal Access Token has the `repo` scope.
- Open DevTools (F12) → Console on the problem page to check for errors.

### Duplicate pushes?
- The extension implements **dual-layer deduplication**:
  1. An in-memory tracking set per tab ensures a solution is only pushed once immediately upon submission acceptance.
  2. A persistent local storage record (`chrome.storage.local`) ensures that even if you reload the page, switch tabs, or submit the same solution multiple times, the extension will skip redundant writes.

### AI README failures / Rate Limits?
- The extension integrates **exponential backoff retries** (retrying up to 3 times on rate-limits `429` or server errors `5xx` with doubling delays).
- If the Gemini API key is missing or calls continue to fail after retrying, the extension gracefully falls back to generating a clean, basic markdown README template containing your solution and metadata.

### Secure Token Usage
- Your GitHub Token and Gemini API Key are stored securely in Chrome's extension sync storage and are only accessed from the extension's background script.
- The background script automatically sanitizes all logs and error messages sent to content scripts or toast notifications, completely scrubbing any token or key strings.

---

## 🔮 Future Improvements Roadmap

We welcome contributions to expand CodePush support! Future plans include:
- **AtCoder Support**: Scraping submitted codes and parsing the verdict from AtCoder submission status tables.
- **SPOJ Support**: Support for Sphere Online Judge accepted solutions using pre/textarea editor extraction.
- **Dark Mode Preview**: A preview panel inside the extension popup to view formatting before syncing.
- **Custom Commit Messages**: Ability to change the default git commit message formats.

---
Built with ❤️ using Chrome Extension MV3 + GitHub REST API 
