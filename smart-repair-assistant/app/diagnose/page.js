"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navigation from "../components/Navigation";

export default function DiagnosePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const problemId = searchParams.get('id');
  
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      router.push('/auth');
    } catch (error) {
      console.error('Error signing out:', error.message);
      alert('Error signing out: ' + error.message);
    }
  };

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Fetch problem data
    if (!problemId) {
      setError("No problem ID provided");
      setLoading(false);
      return;
    }

    async function fetchProblem() {
      try {
        const { data, error } = await supabase
          .from("problems")
          .select("*")
          .eq("id", problemId)
          .single();

        if (error) throw error;
        setProblem(data);
      } catch (err) {
        console.error("Error fetching problem:", err);
        setError("Failed to load diagnosis");
      } finally {
        setLoading(false);
      }
    }

    fetchProblem();

    return () => subscription.unsubscribe();
  }, [problemId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading diagnosis...</p>
        </div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Problem not found"}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const diagnosis = problem.ai_diagnosis;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 py-6">
          <Navigation 
            user={user} 
            onSignOut={signOut} 
            title="Diagnosis Results"
            subtitle="AI Analysis Complete"
          />
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        
        {/* Problem Name Card */}
        {diagnosis?.problem_name && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Problem Identified</h2>
                <p className="text-sm text-gray-500">AI diagnosis</p>
              </div>
            </div>
            <p className="text-gray-700 font-medium">{diagnosis.problem_name}</p>
          </div>
        )}

        {/* Likely Cause Card */}
        {diagnosis?.likely_cause && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Likely Cause</h2>
                <p className="text-sm text-gray-500">What's causing this issue</p>
              </div>
            </div>
            <p className="text-gray-700">{diagnosis.likely_cause}</p>
          </div>
        )}

        {/* Caution Notes Card */}
        {diagnosis?.caution_notes && (
          <div className="bg-amber-50 rounded-2xl shadow-sm border border-amber-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-amber-900">Important Safety Notes</h2>
                <p className="text-sm text-amber-700">Please read carefully</p>
              </div>
            </div>
            <p className="text-amber-800">{diagnosis.caution_notes}</p>
          </div>
        )}

        {/* Cost Estimation Card */}
        {(diagnosis?.analysis_cost_nis || diagnosis?.fix_cost_nis) && (
          <div className="bg-blue-50 rounded-2xl shadow-sm border border-blue-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Cost Estimates</h2>
                <p className="text-sm text-blue-700">Professional service pricing</p>
              </div>
            </div>
            
            <div className="space-y-3">
              {diagnosis?.analysis_cost_nis && (
                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-blue-100">
                  <div>
                    <p className="font-medium text-gray-900">Professional Analysis</p>
                    <p className="text-sm text-gray-500">Diagnostic fee</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">₪{diagnosis.analysis_cost_nis}</p>
                  </div>
                </div>
              )}
              
              {diagnosis?.fix_cost_nis && (
                <div className="flex justify-between items-center p-3 bg-white rounded-xl border border-blue-100">
                  <div>
                    <p className="font-medium text-gray-900">Estimated Fix Cost</p>
                    <p className="text-sm text-gray-500">Repair estimate</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">₪{diagnosis.fix_cost_nis}</p>
                  </div>
                </div>
              )}
              
              {diagnosis?.analysis_cost_nis && diagnosis?.fix_cost_nis && (
                <div className="flex justify-between items-center p-3 bg-blue-100 rounded-xl border border-blue-200">
                  <div>
                    <p className="font-semibold text-blue-900">Total Estimated Cost</p>
                    <p className="text-sm text-blue-700">Analysis + Fix</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-800">₪{parseInt(diagnosis.analysis_cost_nis || 0) + parseInt(diagnosis.fix_cost_nis || 0)}</p>
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-xs text-blue-700 mt-3">
              *Estimates based on average market rates, actual costs may vary.
            </p>
          </div>
        )}

        {/* DIY Steps Card */}
        {diagnosis?.diy_steps && Array.isArray(diagnosis.diy_steps) && diagnosis.diy_steps.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">DIY Fix Steps</h2>
                <p className="text-sm text-gray-500">Try these solutions</p>
              </div>
            </div>
            <div className="space-y-3">
              {diagnosis.diy_steps.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-gray-700 pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Professional Help Card */}
        {diagnosis?.need_professional && (
          <div className="bg-red-50 rounded-2xl shadow-sm border border-red-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-900">Professional Help Recommended</h2>
                <p className="text-sm text-red-700">Expert assistance needed</p>
              </div>
            </div>
            <p className="text-red-800 mb-4">{diagnosis.need_professional}</p>
            <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
              Find Local Professionals
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-3 font-medium transition-colors"
          >
            Report Another Problem
          </button>
          <button
            onClick={() => router.push('/log')}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 font-medium transition-colors"
          >
            View Problem Log
          </button>
        </div>

        {/* Debug Info */}
        {problem.description && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Original Description</h3>
            <p className="text-sm text-gray-600">{problem.description}</p>
            {problem.voice_transcript && (
              <div className="mt-2">
                <h4 className="text-sm font-medium text-gray-700 mb-1">Voice Transcript</h4>
                <p className="text-sm text-gray-600">{problem.voice_transcript}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}