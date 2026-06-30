# ⚡ CodePush — Auto Push Coding Solutions to GitHub

Auto-detect accepted solutions from **LeetCode, GeeksForGeeks, CodeChef, HackerRank, Codeforces** and push them to your GitHub with an AI-generated README — in 1 click (or automatically on acceptance).

---

## 🚀 How to Install (Personal Use)

### Step 1 — Get Your GitHub Token
1. Go to → https://github.com/settings/tokens/new
2. Give it a name like `CodePush`
3. Select scope: ✅ **repo** (full control)
4. Click **Generate token**
5. **Copy it** — you won't see it again!

### Step 2 — Load Extension in Chrome
1. Open Chrome → go to `chrome://extensions`
2. Toggle **Developer mode** ON (top right)
3. Click **Load unpacked**
4. Select this `codepush-extension` folder
5. The ⚡ CodePush icon appears in your toolbar!

### Step 3 — Configure
1. Click the **⚡ CodePush** icon
2. Paste your **GitHub token**
3. Enter your **GitHub username**
4. Set a **repo name** (e.g. `my-solutions`) — created automatically!
5. Optionally add your **Anthropic API key** for AI-generated READMEs
6. Click **Save Settings** → test with 🔗 **Test Connection**

### Step 4 — Solve & Push!
- Go to LeetCode / GFG / CodeChef / HackerRank / Codeforces
- Solve a problem → submit → get **Accepted**
- CodePush **automatically detects** it and pushes to GitHub!
- You'll see a green toast notification in the corner ✅

---

## 📁 Your GitHub Repo Structure

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
└── ...
```

---

## 🤖 AI README Contents

Each README includes:
- 🧩 **Problem Summary** — plain English explanation
- 💡 **Intuition** — first thought when seeing the problem
- 🔍 **Approach** — step-by-step algorithm
- ⏱️ **Complexity** — Time & Space analysis
- 🧪 **Example Walkthrough** — traced manually
- 🏷️ **Tags** — Arrays, DP, Graph, etc.
- 💻 **Solution** — your code

---

## 🛠️ Platforms Supported

| Platform | Auto-detect | Status |
|---|---|---|
| LeetCode | ✅ On Accepted | ✅ |
| GeeksForGeeks | ✅ On Solved | ✅ |
| CodeChef | ✅ On AC | ✅ |
| HackerRank | ✅ On All Passed | ✅ |
| Codeforces | ✅ On Accepted | ✅ |

---

## 🔧 Troubleshooting

**Push not triggering?**
- Make sure you're on the problem page when you submit
- Check that your GitHub token has `repo` scope
- Open DevTools (F12) → Console for errors

**AI README not working?**
- Verify your Anthropic API key at console.anthropic.com
- Without it, a basic README is still generated (no AI)

**Duplicate pushes?**
- The extension deduplicates by submission ID — safe to leave running

---

Built with ❤️ using Chrome Extension MV3 + GitHub REST API + Claude AI
