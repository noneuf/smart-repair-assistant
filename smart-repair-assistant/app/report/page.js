"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ReportPage() {
  const [image, setImage] = useState(null);        // preview URL
  const [imageFile, setImageFile] = useState(null); // actual File
  const [video, setVideo] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [description, setDescription] = useState("");

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [audioFile, setAudioFile] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);


  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [diagnosis, setDiagnosis] = useState(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);


  function handleImageChange(e) {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImage(URL.createObjectURL(file));
    }
  }

  function handleVideoChange(e) {
  const file = e.target.files[0];
  if (file) {
    setVideoFile(file);
    setVideo(URL.createObjectURL(file));
  }
}


  async function startRecording() {
    setError("");
    setAudioUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
  const blob = new Blob(chunksRef.current, { type: "audio/webm" });
  const url = URL.createObjectURL(blob);
  setAudioUrl(url);

  // NEW: keep a File for uploading later
  const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
  setAudioFile(file);

  // turn off the mic
  stream.getTracks().forEach((t) => t.stop());
};

      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError("Microphone permission denied or not available.");
      console.error(err);
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
    } catch (e) {
      console.error(e);
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function transcribeVoice() {
  if (!audioFile) {
    alert("Please record a voice note first.");
    return;
  }
  try {
    setIsTranscribing(true);
    const form = new FormData();
    form.append("file", audioFile);

    const res = await fetch("/api/transcribe", {
      method: "POST",
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Transcription failed");
    setVoiceTranscript(json.text || "");
  } catch (err) {
    console.error(err);
    alert("Transcription error: " + (err.message || "see console"));
  } finally {
    setIsTranscribing(false);
  }
}


  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

    async function uploadToStorage(file, folder = "images") {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase
      .storage
      .from("problem-media")
      .upload(path, file, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase
      .storage
      .from("problem-media")
      .getPublicUrl(path);

    return publicData.publicUrl; // string
  }

  async function getDiagnosis() {
  const payload = {
    description: description || "",
  };
  if (!payload.description && !payload.transcript) {
    alert("Please add a description or transcribe a voice note first.");
    return;
  }
  try {
    setIsDiagnosing(true);
    const res = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Diagnosis failed");
    setDiagnosis(json.diagnosis || null);
  } catch (err) {
    console.error(err);
    alert("AI diagnosis error: " + (err.message || "see console"));
  } finally {
    setIsDiagnosing(false);
  }
}





  return (
    <main className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Report a Problem</h1>

      {/* Photo Upload */}
<section>
  <label className="block mb-2 font-medium">Upload a photo:</label>
  <label className="btn btn-ghost border border-gray-300 cursor-pointer w-fit">
    <input
      type="file"
      accept="image/*"
      onChange={handleImageChange}
      className="hidden"
    />
    Upload a photo
    <span className="btn-shine" aria-hidden />
  </label>
</section>

{/* Video Upload */}
<section>
  <label className="block mb-2 font-medium">Upload a video:</label>
  <label className="btn btn-ghost border border-gray-300 cursor-pointer w-fit">
    <input
      type="file"
      accept="video/*"
      onChange={handleVideoChange}
      className="hidden"
    />
    Upload a video
    <span className="btn-shine" aria-hidden />
  </label>
</section>


      {/* Free-text Description */}
      <section>
        <label className="block mb-2 font-medium">Describe the problem:</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Water is dripping from the faucet even when closed…"
          className="w-full h-28 p-3 border rounded-lg focus:outline-none focus:ring"
        />
      </section>

      {/* Voice Note */}
      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="font-semibold mb-2">Record a voice note</h2>
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
            <span className="btn-shine" aria-hidden />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              <span className="btn-shine" aria-hidden />
              Stop
            </button>
          )}
          <span className="text-sm text-gray-600">
            {isRecording ? "Recording…" : "Not recording"}
          </span>
          {isRecording && (
            <span className="text-sm font-mono px-2 py-1 bg-gray-100 rounded">
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:
              {String(seconds % 60).padStart(2, "0")}
            </span>
          )}
        </div>

        {error && <p className="text-red-600 mt-2">{error}</p>}

        {audioUrl && (
          <div className="mt-4">
            <p className="mb-2 font-medium">Voice Preview:</p>
            <audio controls src={audioUrl} className="w-full" />
            <p className="text-xs text-gray-500 mt-1">
              (Next step: send this to Whisper to get text.)
            </p>
          </div>
        )}
      </section>

      {/* Previews */}
      <section className="space-y-6">
        {image && (
          <div>
            <p className="mb-2 font-medium">Photo Preview:</p>
            <img src={image} alt="Preview" className="w-full rounded-lg shadow" />
          </div>
        )}
        {video && (
          <div>
            <p className="mb-2 font-medium">Video Preview:</p>
            <video controls className="w-full rounded-lg shadow">
              <source src={video} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        )}
      </section>
            {/* Submit button */}
            <section className="mt-8">

            <button
  onClick={transcribeVoice}
  disabled={!audioFile || isTranscribing}
  className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
>
  <span className="btn-shine" aria-hidden />
  {isTranscribing ? "Transcribing…" : "Transcribe voice note"}
</button>

{voiceTranscript && (
  <div className="mt-3">
    <p className="text-sm text-gray-600 mb-1">Transcript:</p>
    <div className="whitespace-pre-wrap p-3 border rounded-lg bg-gray-50">
      {voiceTranscript}
    </div>
  </div>
)}

<button
  onClick={() =>
    setDescription((prev) => (prev ? `${prev}\n${voiceTranscript}` : voiceTranscript))
  }
  disabled={!voiceTranscript}
  className="mt-2 bg-gray-800 text-white px-3 py-2 rounded disabled:opacity-50"
>
  <span className="btn-shine" aria-hidden />
  Use transcript as description
</button>


<button
  onClick={async () => {
    setIsSaving(true);
    setJustSaved(false);
    try {
      let imageUrl = null;
      let videoUrl = null;
      let audioPublicUrl = null;

      // 1) Upload media if present
      if (imageFile) imageUrl = await uploadToStorage(imageFile, "images");
      if (videoFile) videoUrl = await uploadToStorage(videoFile, "videos");
      if (audioFile) audioPublicUrl = await uploadToStorage(audioFile, "audio");

      // 2) Ask AI for diagnosis (description + transcript)
      let aiDiagnosis = null;
      try {
        const res = await fetch("/api/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description || "",
            voice_transcript: voiceTranscript || "",
            imageUrl: imageUrl || undefined,
            videoUrl: videoUrl || undefined,
          }),
        });
        const json = await res.json();
        if (res.ok && json?.diagnosis) {
          aiDiagnosis = json.diagnosis;
        } else {
          console.warn("Diagnosis failed:", json?.error);
        }
      } catch (e) {
        console.warn("Diagnosis request error:", e);
        // continue without AI if it fails
      }

      // 3) Insert the problem row with everything
      const { data, error } = await supabase
        .from("problems")
        .insert([{
          description,
          image_url: imageUrl,
          video_url: videoUrl,
          audio_url: audioPublicUrl,
          voice_transcript: voiceTranscript || null,
          ai_diagnosis: aiDiagnosis,
          status: "in_progress",
        }])
        .select("id, image_url, video_url, audio_url, voice_transcript, ai_diagnosis, created_at")
        .single();

      if (error) {
        console.error(error);
        alert("Insert failed: " + error.message);
        return;
      }

      setJustSaved(true);  // success pulse
      setTimeout(() => setJustSaved(false), 900);

      alert(
        `Saved!\n` +
        `Problem id: ${data.id}\n` +
        `Image: ${data.image_url ? "yes" : "no"} | ` +
        `Video: ${data.video_url ? "yes" : "no"} | ` +
        `Audio: ${data.audio_url ? "yes" : "no"}\n` +
        `AI diagnosis: ${data.ai_diagnosis ? "included" : "not available"}`
      );
      console.log("Inserted row:", data);
    } catch (e) {
      console.error(e);
      alert("Upload/insert error: " + (e.message || "see console"));
    } finally {
      setIsSaving(false);
    }
  }}
  disabled={isSaving}
  aria-busy={isSaving ? "true" : "false"}
  className={[
    "w-full btn btn-primary py-3 rounded-xl relative overflow-hidden will-change-transform",
    isSaving ? "btn-disabled cursor-wait" : "active:btn-press",
    justSaved ? "btn-success-pulse" : ""
  ].join(" ")}
>
  {isSaving ? (
    <span className="inline-flex items-center gap-2">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
      </svg>
      Submitting…
    </span>
  ) : (
    <span className="inline-flex items-center gap-2">
      Submit Problem
      <span className="btn-shine" aria-hidden />
    </span>
  )}
</button>



      </section>
    </main>
  );
}
