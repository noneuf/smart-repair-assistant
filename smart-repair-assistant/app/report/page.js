"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ReportPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
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

  // Keep all your existing functions exactly the same
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
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        setAudioFile(file);
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

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Clear user state immediately
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error.message);
      alert('Error signing out: ' + error.message);
    }
  };

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

    return publicData.publicUrl;
  }

  useEffect(() => {
    // Check if we just came back from OAuth (look for fragments or params)
    const url = new URL(window.location.href);
    const hasAuthFragment = url.hash.includes('access_token') || url.searchParams.has('code');
    
    if (hasAuthFragment) {
      console.log('Detected OAuth redirect, checking session in 2 seconds...');
      // Wait a bit for Supabase to process the OAuth callback
      setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          console.log('Delayed session check after OAuth:', { session, error });
          setUser(session?.user ?? null);
          setAuthLoading(false);
        });
      }, 2000);
    } else {
      // Normal session check
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        console.log('Normal session check:', { session, error });
        setUser(session?.user ?? null);
        setAuthLoading(false);
        
        // Redirect to login if no user
        if (!session?.user) {
          router.push('/auth');
        }
      });
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Main page auth change:', event, session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      
      // Redirect to login if signed out
      if (!session?.user && event === 'SIGNED_OUT') {
        router.push('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []); // Remove router from dependency array

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Report Problem</h1>
              <p className="text-sm text-gray-500">Describe your issue for AI diagnosis</p>
            </div>
            
            {/* User Avatar & Sign Out */}
            {user && (
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url && (
                  <img 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <button
                  onClick={signOut}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
            
            {/* Default Icon when not logged in */}
            {!user && (
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        
        {/* Input Methods Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-medium text-gray-900 mb-4">Choose input method</h2>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            
            {/* Photo Button */}
            <label className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <svg className="w-6 h-6 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span className="text-sm font-medium text-slate-700">Photo</span>
            </label>

            {/* Video Button */}
            <label className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="hidden"
              />
              <svg className="w-6 h-6 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span className="text-sm font-medium text-slate-700">Video</span>
            </label>

            {/* Voice Button */}
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-colors ${
                isRecording 
                  ? 'bg-red-50 hover:bg-red-100 border-red-200' 
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <svg className={`w-6 h-6 mb-2 ${isRecording ? 'text-red-600' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
              <span className={`text-sm font-medium ${isRecording ? 'text-red-700' : 'text-slate-700'}`}>
                {isRecording ? "Stop" : "Voice"}
              </span>
              {isRecording && (
                <span className="text-xs text-red-600 mt-1">
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:
                  {String(seconds % 60).padStart(2, "0")}
                </span>
              )}
            </button>

            {/* Text Button */}
            <button 
              onClick={() => document.getElementById('description').focus()}
              className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            >
              <svg className="w-6 h-6 text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              <span className="text-sm font-medium text-slate-700">Text</span>
            </button>

          </div>

          {/* Description Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your problem in detail..."
              className="w-full h-24 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Voice Controls Card */}
        {audioUrl && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Voice Recording</h3>
            
            <div className="mb-4">
              <audio controls src={audioUrl} className="w-full" />
            </div>

            <div className="flex gap-3">
              <button
                onClick={transcribeVoice}
                disabled={!audioFile || isTranscribing}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 px-4 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTranscribing ? "Converting..." : "Convert to Text"}
              </button>
              
              {voiceTranscript && (
                <button
                  onClick={() =>
                    setDescription((prev) => (prev ? `${prev}\n${voiceTranscript}` : voiceTranscript))
                  }
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 px-4 text-sm font-medium transition-colors"
                >
                  Use as Description
                </button>
              )}
            </div>

            {voiceTranscript && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Transcript:</p>
                <p className="text-sm text-gray-700">{voiceTranscript}</p>
              </div>
            )}
          </div>
        )}

        {/* Media Preview Cards */}
        {(image || video) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Media Preview</h3>
            
            {image && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Photo:</p>
                <img src={image} alt="Preview" className="w-full rounded-xl" />
              </div>
            )}
            
            {video && (
              <div>
                <p className="text-sm text-gray-500 mb-2">Video:</p>
                <video controls className="w-full rounded-xl">
                  <source src={video} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={async (e) => {
            e.preventDefault(); // Prevent any form submission behavior
            setIsSaving(true);
            setJustSaved(false);
            
            
            console.log('Starting submission, user:', user?.id);
            
            try {
              let imageUrl = null;
              let videoUrl = null;
              let audioPublicUrl = null;

              // Upload media if present
              if (imageFile) imageUrl = await uploadToStorage(imageFile, "images");
              if (videoFile) videoUrl = await uploadToStorage(videoFile, "videos");
              if (audioFile) audioPublicUrl = await uploadToStorage(audioFile, "audio");

              console.log('Media uploaded, getting AI diagnosis...');

              // Get AI diagnosis
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
              }

              console.log('AI diagnosis received, inserting to database...');

              // Insert into database
              const { data, error } = await supabase
                .from("problems")
                .insert([{
                  user_id: user?.id || null,
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
                console.error("Database insert error:", error);
                alert("Insert failed: " + error.message);
                return;
              }

              console.log('Problem saved, redirecting to:', `/diagnose?id=${data.id}`);

              setJustSaved(true);
              setTimeout(() => setJustSaved(false), 900);

              // Force navigation using window.location
              window.location.href = `/diagnose?id=${data.id}`;

              console.log("Inserted row:", data);
            } catch (e) {
              console.error(e);
              alert("Upload/insert error: " + (e.message || "see console"));
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving || (!description && !voiceTranscript && !imageFile && !videoFile)}
          className={`w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-4 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${justSaved ? 'bg-green-600 hover:bg-green-700' : ''}`}
        >
          {isSaving ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              Processing & Saving...
            </span>
          ) : (
            "Submit for AI Diagnosis"
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}