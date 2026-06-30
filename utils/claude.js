// utils/claude.js — AI README generator using Google Gemini (Free!)

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function generateReadme({ apiKey, platform, problemTitle, problemDescription, code, language, difficulty = "Unknown" }) {
  const prompt = `You are a technical documentation expert. Generate a professional, detailed README.md for a coding problem solution.

Platform: ${platform}
Problem Title: ${problemTitle}
Difficulty: ${difficulty}
Language Used: ${language}
Problem Description:
${problemDescription}

Solution Code:
\`\`\`${language}
${code}
\`\`\`

Generate a README.md with these EXACT sections:
1. A title with platform badge and difficulty
2. ## 🧩 Problem Summary — plain English explanation of what the problem asks
3. ## 💡 Intuition — first thought/approach when seeing this problem
4. ## 🔍 Approach — step-by-step algorithm explanation
5. ## ⏱️ Complexity Analysis — Time and Space complexity with explanation
6. ## 🧪 Example Walkthrough — trace through an example manually
7. ## 🏷️ Tags — relevant topic tags like Arrays, HashMap, DP, etc.
8. ## 💻 Solution — the code block
9. ## 🔗 Platform Link — placeholder for the problem URL
10. ## 📅 Solved On — today's date

Make it genuinely useful for someone reading this repo to understand both the problem AND your thinking. Use emojis in headings for readability. Be concise but thorough.`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini API error: ${err.error?.message || "Unknown error"}`);
  }

  const data = await response.json();

  // Extract text from Gemini response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  return text;
}

export async function validateGeminiKey(apiKey) {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Say hello in one word." }] }],
      generationConfig: { maxOutputTokens: 10 }
    }),
  });
  if (!response.ok) throw new Error("Invalid Gemini API key");
  return true;
}

export function generateFallbackReadme({ platform, problemTitle, problemDescription, code, language, difficulty = "Unknown" }) {
  const date = new Date().toISOString().split("T")[0];
  const ext = language?.toLowerCase() || "txt";

  return `# ${problemTitle}

![Platform](https://img.shields.io/badge/Platform-${platform}-blue) ![Difficulty](https://img.shields.io/badge/Difficulty-${difficulty}-orange) ![Language](https://img.shields.io/badge/Language-${language}-green)

## 🧩 Problem Summary

${problemDescription || "See the original problem on " + platform}

## 💻 Solution

\`\`\`${ext}
${code}
\`\`\`

## 🏷️ Tags

\`${platform}\` \`Coding\` \`${language}\`

## 📅 Solved On

${date}

---
*Auto-pushed by [CodePush Extension](https://github.com)*
`;
}
