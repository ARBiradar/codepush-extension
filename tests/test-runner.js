// tests/test-runner.js — CodePush Unit Testing Suite
import { hashCode, isAlreadyPushed, markAsPushed } from "../utils/storage.js";
import { generateReadme, generateFallbackReadme } from "../utils/claude.js";

// ── Chrome Mock Environment ──────────────────────────────────────────
const mockLocalStorage = {};
const mockSyncStorage = {};

global.chrome = {
  storage: {
    sync: {
      get: (keys, cb) => {
        const res = {};
        keys.forEach(k => res[k] = mockSyncStorage[k]);
        cb(res);
      },
      set: (data, cb) => {
        Object.assign(mockSyncStorage, data);
        if (cb) cb();
      }
    },
    local: {
      get: (keys, cb) => {
        const res = {};
        keys.forEach(k => res[k] = mockLocalStorage[k]);
        cb(res);
      },
      set: (data, cb) => {
        Object.assign(mockLocalStorage, data);
        if (cb) cb();
      }
    }
  },
  notifications: {
    create: (id, options, cb) => {
      if (cb) cb();
    }
  }
};

// ── Basic assertion helper ───────────────────────────────────────────
function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log("🚀 Starting CodePush Unit Tests...");
  let failed = false;

  const runTest = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ Passed: ${name}`);
    } catch (err) {
      console.error(`❌ Failed: ${name}`);
      console.error(err.stack || err);
      failed = true;
    }
  };

  // 1. Hash Code Generation Tests
  await runTest("hashCode should generate stable hex codes", () => {
    const code = "function foo() { return 'bar'; }";
    const h1 = hashCode(code);
    const h2 = hashCode(code);
    assert(h1 === h2, "Hashes of identical code must be equal");
    assert(h1 !== "empty", "Hash should not be default 'empty'");
    assert(typeof h1 === "string", "Hash should be a string");
    
    assert(hashCode("") === "empty", "Empty string should hash to 'empty'");
    assert(hashCode(null) === "empty", "Null should hash to 'empty'");
  });

  // 2. Storage Deduplication Tests
  await runTest("isAlreadyPushed & markAsPushed should record solutions correctly", async () => {
    const testKey = "LeetCode:123456";
    
    // Check initial state
    let pushed = await isAlreadyPushed(testKey);
    assert(pushed === false, "Key should not be marked as pushed initially");

    // Mark as pushed
    await markAsPushed(testKey);

    // Verify state updated
    pushed = await isAlreadyPushed(testKey);
    assert(pushed === true, "Key must be marked as pushed after markAsPushed");
  });

  // 3. Fallback README Generation Tests
  await runTest("generateFallbackReadme should create standard template", () => {
    const data = {
      platform: "LeetCode",
      problemTitle: "Two Sum",
      problemDescription: "Given an array of integers...",
      code: "print('hello')",
      language: "python3",
      difficulty: "Easy"
    };

    const readme = generateFallbackReadme(data);
    assert(readme.includes("# Two Sum"), "README must contain problem title");
    assert(readme.includes("Platform-LeetCode"), "README must contain platform badge");
    assert(readme.includes("Difficulty-Easy"), "README must contain difficulty badge");
    assert(readme.includes("Language-python3"), "README must contain language badge");
    assert(readme.includes("print('hello')"), "README must contain solution code");
  });

  // 4. Exponential Backoff & Retry Logic Tests
  await runTest("fetchWithRetry should succeed after rate limit retries", async () => {
    let callCount = 0;
    
    // Mock global fetch
    global.fetch = async (url, options) => {
      callCount++;
      if (callCount < 3) {
        // Return 429 Rate Limit for first 2 calls
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: "Rate limit exceeded" } })
        };
      }
      // Return 200 OK for 3rd call
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Mock AI README content" }] } }]
        })
      };
    };

    // We expect generateReadme to invoke fetch, hit the mock, retry twice, then succeed.
    const readme = await generateReadme({
      apiKey: "mock-api-key",
      platform: "LeetCode",
      problemTitle: "Two Sum",
      problemDescription: "Desc",
      code: "Code",
      language: "Python",
      difficulty: "Easy"
    });

    assert(callCount === 3, `Expected fetch to be called 3 times, but got ${callCount}`);
    assert(readme === "Mock AI README content", "Expected response content mismatch");
  });

  await runTest("fetchWithRetry should fail and throw after exceeding max retries", async () => {
    let callCount = 0;

    global.fetch = async (url, options) => {
      callCount++;
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Rate limit exceeded" } })
      };
    };

    try {
      await generateReadme({
        apiKey: "mock-api-key",
        platform: "LeetCode",
        problemTitle: "Two Sum",
        problemDescription: "Desc",
        code: "Code",
        language: "Python",
        difficulty: "Easy"
      });
      assert(false, "Expected generateReadme to throw error after exhausting retries");
    } catch (err) {
      assert(err.message.includes("Rate limit exceeded"), "Expected rate limit message in error");
      assert(callCount === 4, `Expected exactly 4 attempts (1 initial + 3 retries), but got ${callCount}`);
    }
  });

  // 5. Token & Key Sanitization Tests
  await runTest("Error sanitization should prevent leaks", () => {
    const settings = {
      githubToken: "ghp_secureToken12345678901234567890",
      anthropicKey: "AIzaSyKey12345678901234567890123456"
    };

    const sanitizeError = (err, settings) => {
      let message = err.message || String(err);
      if (settings.githubToken) {
        message = message.replace(new RegExp(settings.githubToken, "g"), "[GITHUB_TOKEN]");
      }
      if (settings.anthropicKey) {
        message = message.replace(new RegExp(settings.anthropicKey, "g"), "[AI_API_KEY]");
      }
      message = message.replace(/ghp_[a-zA-Z0-9]{36}/g, "[GITHUB_TOKEN]");
      message = message.replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, "[GEMINI_API_KEY]");
      return message;
    };

    const rawErrorMsg = `Failed to push code using token ghp_secureToken12345678901234567890 and Gemini Key AIzaSyKey12345678901234567890123456.`;
    const sanitized = sanitizeError(new Error(rawErrorMsg), settings);

    assert(!sanitized.includes("ghp_secureToken12345678901234567890"), "Sanitized error still contains github token!");
    assert(!sanitized.includes("AIzaSyKey12345678901234567890123456"), "Sanitized error still contains gemini API key!");
    assert(sanitized.includes("[GITHUB_TOKEN]"), "Expected [GITHUB_TOKEN] placeholder");
    assert(sanitized.includes("[AI_API_KEY]"), "Expected [AI_API_KEY] placeholder");
  });

  if (failed) {
    console.error("\n❌ Some tests failed!");
    process.exit(1);
  } else {
    console.log("\n⭐️ All tests passed successfully!");
    process.exit(0);
  }
}

runTests();
