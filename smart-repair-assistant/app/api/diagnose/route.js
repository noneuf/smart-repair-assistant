// app/api/diagnose/route.js
import OpenAI from "openai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export const runtime = "nodejs";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// point fluent-ffmpeg at the static binary
const ffmpegResolvedPath = typeof ffmpegStatic === "string" ? ffmpegStatic : process.env.FFMPEG_PATH;
ffmpeg.setFfmpegPath(ffmpegResolvedPath);
console.log("[Diagnose API] Using ffmpeg at:", ffmpegResolvedPath);


// ---------- helpers ----------
async function readBody(req) {
  // Try JSON first
  try {
    const json = await req.json();
    return { kind: "json", data: json };
  } catch {
    // Then try multipart/form-data
    try {
      const form = await req.formData();
      const obj = Object.fromEntries(form.entries());
      return { kind: "form", data: obj, form };
    } catch {
      return { kind: "none", data: {} };
    }
  }
}

function isLikelyPublicUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.toLowerCase();
  if (u.startsWith("blob:") || u.startsWith("file:")) return false;
  if (u.startsWith("http://localhost") || u.startsWith("http://127.0.0.1")) return false;
  return u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:");
}

async function fileToBase64(file) {
  // file is a Blob from formData.get('image')
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("base64");
}

function buildUserContent({ userText, imageUrl, imageBase64 }) {
  const content = [];
  if (userText) {
    content.push({ type: "text", text: `User report:\n${userText}` });
  }
  if (imageBase64) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    });
  } else if (imageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: imageUrl }, // optionally add: detail: "high"
    });
  }
  content.push({
    type: "text",
    text:
      "Return ONLY a JSON object with keys: " +
      "problem_name (string), likely_causes (string[]), diy_steps (string[]), " +
      "caution_notes (string[]), need_professional (boolean), confidence (number 0..1). No extra text.",
  });
  return content;
}

// ---- video helpers ----
async function downloadToTmp(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpFile = path.join(os.tmpdir(), `video-${Date.now()}.mp4`);
  await fs.writeFile(tmpFile, buf);
  return tmpFile;
}

// smart frame sampling: ~1 fps, max 12 frames
const FRAME_FPS = 1;
const FRAME_MAX = 12;

async function extractFramesSmart(filePath, fps = FRAME_FPS, maxFrames = FRAME_MAX) {
  const folder = path.join(os.tmpdir(), `frames-${Date.now()}`);
  await fs.mkdir(folder, { recursive: true });

  await new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions([
        "-vf", `fps=${fps}`,           // ~1 frame per second
        "-frames:v", String(maxFrames) // cap total frames
      ])
      .output(path.join(folder, "frame-%03d.jpg"))
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  const frames = [];
  for (let i = 1; i <= maxFrames; i++) {
    const f = path.join(folder, `frame-${String(i).padStart(3, "0")}.jpg`);
    try {
      const b = await fs.readFile(f);
      frames.push(b.toString("base64"));
    } catch {
      break; // stop when we run out of frames
    }
  }
  return frames;
}

// ---------- route ----------
export async function POST(req) {
  try {
    const body = await readBody(req);

    // Normalize fields (JSON or FormData)
    let description = (body.data.description ?? body.data.text ?? "").toString();
    let transcript = (body.data.transcript ?? body.data.voice_transcript ?? "").toString();

    // Image inputs
    let imageUrl = body.data.imageUrl ?? body.data.image_url ?? undefined;
    let imageBase64 = body.data.imageBase64 ?? undefined;

    // Video input
    let videoUrl = body.data.videoUrl ?? body.data.video_url ?? undefined;

    // If a file was uploaded as multipart field `image`, convert to base64
    if (body.kind === "form" && body.form) {
      const file = body.form.get("image");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        imageBase64 = await fileToBase64(file);
      }
    }

    const userText = [description, transcript]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join("\n\n");

    console.log("[Diagnose API] Parsed body:", {
      bodyKind: body.kind,
      hasText: Boolean(userText),
      hasImageUrl: Boolean(imageUrl),
      hasImageBase64: Boolean(imageBase64),
      hasVideoUrl: Boolean(videoUrl),
      imageUrl,
      videoUrl,
      keys: Object.keys(body.data || {}),
    });

    // Validate inputs
    if (!userText && !imageUrl && !imageBase64 && !videoUrl) {
      return Response.json(
        { error: "No input provided (need description/transcript or image/video)" },
        { status: 400 }
      );
    }
    if (imageUrl && !isLikelyPublicUrl(imageUrl)) {
      return Response.json(
        { error: "imageUrl must be a public http(s) or data: URL (not blob:/localhost)" },
        { status: 400 }
      );
    }
    if (videoUrl && !isLikelyPublicUrl(videoUrl)) {
      return Response.json(
        { error: "videoUrl must be a public http(s) URL (not blob:/localhost)" },
        { status: 400 }
      );
    }

    // If we have a video, extract frames smartly
    let videoFrameBase64s = [];
    if (videoUrl) {
      try {
        const tmp = await downloadToTmp(videoUrl);
        videoFrameBase64s = await extractFramesSmart(tmp); // ~1 fps, capped at 12
        console.log("[Diagnose API] Extracted frames:", videoFrameBase64s.length);
      } catch (e) {
        console.warn("[Diagnose API] Video frame extraction failed:", e?.message || e);
      }
    }

    // Build messages for multimodal reasoning
    const messages = [
      {
        role: "system",
        content:
          "You are a home-repair diagnostician. Prefer visual evidence; use text as context. Respond in strict JSON only.",
      },
      { role: "user", content: buildUserContent({ userText, imageUrl, imageBase64 }) },
    ];

    // Attach video frames as additional images
    if (videoFrameBase64s.length) {
      for (const b64 of videoFrameBase64s) {
        messages.push({
          role: "user",
          content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }],
        });
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages,
    });

    const text = completion?.choices?.[0]?.message?.content ?? "{}";
    console.log("[Diagnose API] OpenAI content:", text);

    let diagnosis;
    try {
      diagnosis = JSON.parse(text);
    } catch (e) {
      console.error("[Diagnose API] JSON parse error:", e);
      diagnosis = {
        problem_name: "Unknown",
        likely_causes: [],
        diy_steps: [],
        caution_notes: [],
        need_professional: false,
        confidence: 0,
        _raw: text,
      };
    }

    return Response.json({ diagnosis });
  } catch (err) {
    console.error("[Diagnose API] Fatal error:", err);
    return Response.json({ error: err?.message || "Diagnosis failed" }, { status: 500 });
  }
}
