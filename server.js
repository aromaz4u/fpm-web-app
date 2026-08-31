// FPM video backend — proxies real video-generation APIs so their keys never
// have to leave the server (and never reach the browser). Currently supports:
//   - Runway (Gen-4.5) via the official Runway developer API
//   - Wan 2.2 (Alibaba's open model) via fal.ai, a documented third-party host —
//     "Wan AI" is not one single official company/API; fal.ai is the most
//     credibly documented way to call it for real. See README for details.
//
// Runway flow:
//   1. Browser POSTs a prompt to /api/generate-video
//   2. This server creates a Runway task and immediately returns { taskId }
//   3. Browser polls GET /api/status/:taskId every few seconds
//   4. When Runway reports SUCCEEDED, this server returns the signed video URL(s)
//
// Wan (fal.ai) flow is the same shape, on separate routes:
//   POST /api/generate-video-wan  -> { requestId }
//   GET  /api/status-wan/:requestId -> { status, output, error }
//
// Docs used to build this:
//   Runway: https://dev.runwayml.com/ — base https://api.dev.runwayml.com/v1
//           Auth: Authorization: Bearer <key> + X-Runway-Version: 2024-11-06
//   Wan/fal: https://fal.ai/models/fal-ai/wan/v2.2-a14b/text-to-video/api
//           Auth: @fal-ai/client, FAL_KEY env var, queue submit/status/result pattern

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const RunwayML = require("@runwayml/sdk").default || require("@runwayml/sdk");
const { fal } = require("@fal-ai/client");

const app = express();

// In production, replace with your actual frontend origin instead of allowing all origins.
app.use(cors());
app.use(express.json());

const RUNWAY_API_KEY = process.env.RUNWAYML_API_SECRET;
const RUNWAY_VERSION = "2024-11-06";
const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";

const FAL_API_KEY = process.env.FAL_KEY;
const WAN_MODEL_ID = "fal-ai/wan/v2.2-a14b/text-to-video";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

if (!RUNWAY_API_KEY) {
  console.error(
    "Missing RUNWAYML_API_SECRET. Copy .env.example to .env and set your Runway API key before starting the server."
  );
}
if (!FAL_API_KEY) {
  console.error("Missing FAL_KEY. Set it in .env if you want the Wan (fal.ai) route to work.");
} else {
  fal.config({ credentials: FAL_API_KEY });
}
if (!ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY. Set it in .env — the app's AI text features (scripts, competitor analysis) need it now that it's running outside the Claude.ai artifact sandbox.");
}

const client = new RunwayML({ apiKey: RUNWAY_API_KEY });

// ============================== Runway ==============================

// --- Create a generation task -----------------------------------------------
app.post("/api/generate-video", async (req, res) => {
  if (!RUNWAY_API_KEY) {
    return res.status(500).json({ error: "Server is missing RUNWAYML_API_SECRET. Check your .env file." });
  }

  const { promptText, ratio, duration, seed } = req.body || {};
  if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
    return res.status(400).json({ error: "promptText is required" });
  }

  try {
    const task = await client.textToVideo.create({
      promptText: promptText.trim(),
      model: "gen4.5",
      ratio: ratio || "720:1280", // vertical, short-form ad format
      duration: duration || 5,
      ...(seed ? { seed } : {}),
    });
    res.json({ taskId: task.id });
  } catch (err) {
    console.error("generate-video failed:", err);
    res.status(502).json({ error: err?.message || "Runway rejected the generation request." });
  }
});

// --- Poll a task's status -----------------------------------------------
// Uses a raw fetch against Runway's documented REST endpoint rather than an
// SDK convenience method, since that endpoint shape is directly confirmed
// in Runway's own API reference and less likely to drift between SDK versions.
app.get("/api/status/:taskId", async (req, res) => {
  if (!RUNWAY_API_KEY) {
    return res.status(500).json({ error: "Server is missing RUNWAYML_API_SECRET. Check your .env file." });
  }

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/tasks/${req.params.taskId}`, {
      headers: {
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    });
    const task = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: task?.error || "Failed to fetch task status from Runway." });
    }

    res.json({
      status: task.status, // PENDING | RUNNING | SUCCEEDED | FAILED
      output: task.output || null, // array of signed URLs once SUCCEEDED
      error: task.failure || null,
    });
  } catch (err) {
    console.error("status check failed:", err);
    res.status(502).json({ error: err?.message || "Couldn't reach Runway to check task status." });
  }
});

// ============================== Wan 2.2 (via fal.ai) ==============================

// --- Create a generation task -----------------------------------------------
app.post("/api/generate-video-wan", async (req, res) => {
  if (!FAL_API_KEY) {
    return res.status(500).json({ error: "Server is missing FAL_KEY. Check your .env file." });
  }

  const { promptText, aspectRatio } = req.body || {};
  if (!promptText || typeof promptText !== "string" || !promptText.trim()) {
    return res.status(400).json({ error: "promptText is required" });
  }

  try {
    // fal's queue API is non-blocking: submit returns a request_id immediately,
    // the actual generation happens async and is polled below.
    const { request_id } = await fal.queue.submit(WAN_MODEL_ID, {
      input: {
        prompt: promptText.trim(),
        aspect_ratio: aspectRatio || "9:16",
      },
    });
    res.json({ requestId: request_id });
  } catch (err) {
    console.error("generate-video-wan failed:", err);
    res.status(502).json({
      error:
        err?.body?.detail || err?.message ||
        "fal.ai rejected the generation request. Double-check the model's current input schema at fal.ai/models/fal-ai/wan/v2.2-a14b/text-to-video/api — providers change these occasionally.",
    });
  }
});

// --- Poll a task's status -----------------------------------------------
app.get("/api/status-wan/:requestId", async (req, res) => {
  if (!FAL_API_KEY) {
    return res.status(500).json({ error: "Server is missing FAL_KEY. Check your .env file." });
  }

  try {
    const statusResult = await fal.queue.status(WAN_MODEL_ID, {
      requestId: req.params.requestId,
      logs: false,
    });

    if (statusResult.status === "COMPLETED") {
      const result = await fal.queue.result(WAN_MODEL_ID, { requestId: req.params.requestId });
      const videoUrl = result?.data?.video?.url;
      if (!videoUrl) {
        return res.json({ status: "FAILED", output: null, error: "fal.ai reported completion but returned no video URL." });
      }
      return res.json({ status: "SUCCEEDED", output: [videoUrl], error: null });
    }

    if (statusResult.status === "ERROR") {
      return res.json({ status: "FAILED", output: null, error: "fal.ai reported the generation failed." });
    }

    // IN_QUEUE | IN_PROGRESS
    res.json({ status: statusResult.status === "IN_PROGRESS" ? "RUNNING" : "PENDING", output: null, error: null });
  } catch (err) {
    console.error("status-wan check failed:", err);
    res.status(502).json({ error: err?.message || "Couldn't reach fal.ai to check task status." });
  }
});

app.get("/health", (_req, res) =>
  res.json({ ok: true, runway: !!RUNWAY_API_KEY, wan: !!FAL_API_KEY, claude: !!ANTHROPIC_API_KEY })
);

// ============================== Claude (text generation) ==============================
// Inside the Claude.ai artifact sandbox, text generation went through a free, built-in
// proxy with no API key needed. Running as a standalone app, that proxy doesn't exist —
// this replaces it with a normal server-side call to the real Anthropic API, using your
// own key. Every AI text feature (competitor analysis, ad scripts, AI customization)
// calls this one endpoint.
app.post("/api/ask-claude", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Check your .env file." });
  }

  const { system, prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        system: system || undefined,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Anthropic API rejected the request." });
    }
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    res.json({ text });
  } catch (err) {
    console.error("ask-claude failed:", err);
    res.status(502).json({ error: err?.message || "Couldn't reach the Anthropic API." });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`FPM video backend listening on http://localhost:${PORT}`);
  if (!RUNWAY_API_KEY) console.warn("⚠️  RUNWAYML_API_SECRET is not set — Runway requests will fail until it is.");
  if (!FAL_API_KEY) console.warn("⚠️  FAL_KEY is not set — Wan requests will fail until it is.");
  if (!ANTHROPIC_API_KEY) console.warn("⚠️  ANTHROPIC_API_KEY is not set — AI text features will fail until it is.");
});
