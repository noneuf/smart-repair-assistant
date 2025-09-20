"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navigation from "../components/Navigation";

export default function ProblemLogPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      console.log('Session check:', { session, error });
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      
      // Redirect to login if signed out
      if (!session?.user && event === 'SIGNED_OUT') {
        router.push('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch user's problems when user is loaded
  useEffect(() => {
    if (user) {
      fetchProblems();
    }
  }, [user]);

  const fetchProblems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("problems")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProblems(data || []);
    } catch (err) {
      console.error("Error fetching problems:", err);
      setError("Failed to load problems");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'fixed':
        return 'bg-green-100 text-green-800';
      case 'not_fixed':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'fixed':
        return 'Fixed';
      case 'not_fixed':
        return 'Not Fixed';
      case 'in_progress':
      default:
        return 'In Progress';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-6 py-6">
          <Navigation 
            user={user} 
            onSignOut={signOut} 
            title="Problem Log"
            subtitle="Your reported issues"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading your problems...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchProblems}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl"
            >
              Try Again
            </button>
          </div>
        ) : problems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No problems reported yet</h3>
            <p className="text-gray-500 mb-6">Start by reporting your first problem for AI diagnosis</p>
            <button
              onClick={() => router.push('/report')}
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              Report a Problem
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {problems.map((problem) => (
              <div
                key={problem.id}
                onClick={() => router.push(`/diagnose?id=${problem.id}`)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Problem Image/Icon */}
                  <div className="flex-shrink-0">
                    {problem.image_url ? (
                      <img
                        src={problem.image_url}
                        alt="Problem"
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Problem Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {problem.ai_diagnosis?.problem_name || "Problem Report"}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {problem.description || "No description provided"}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>
                            {new Date(problem.created_at).toLocaleDateString()}
                          </span>
                          {problem.ai_diagnosis?.likely_causes && (
                            <span>
                              AI Diagnosed
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(problem.status)}`}>
                        {getStatusText(problem.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}