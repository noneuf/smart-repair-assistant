// app/api/diagnose/route.js
import OpenAI from "openai";

export const runtime = "nodejs"; // ensure server runtime
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const { description, transcript } = await req.json();
    const userText = [description, transcript].filter(Boolean).join("\n\n").trim();

    if (!userText) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a home-repair diagnostician. Read the user's report and return a concise, practical diagnosis in strict JSON only.",
        },
        {
          role: "user",
          content:
            `User report:\n${userText}\n\n` +
            "Return JSON with keys: problem_name (string), likely_causes (string[]), diy_steps (string[]), caution_notes (string[]), need_professional (boolean), confidence (number 0..1). No extra text.",
        },
      ],
    });

    const text = completion.choices?.[0]?.message?.content ?? "{}";
    const diagnosis = JSON.parse(text);
    return Response.json({ diagnosis });
  } catch (err) {
    console.error(err);
    return Response.json(
      { error: err.message || "Diagnosis failed" },
      { status: 500 }
    );
  }
}
