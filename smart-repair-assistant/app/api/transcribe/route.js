// app/api/transcribe/route.js
import OpenAI from "openai";

export const runtime = "nodejs"; // ensure Node runtime (not edge)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get("file"); // must be a File

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Whisper STT — stable choice
    const result = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file, // File is supported by the SDK
    });

    return Response.json({ text: result.text ?? "" });
  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message || "Transcription failed" }, { status: 500 });
  }
}
