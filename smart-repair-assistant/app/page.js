"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navigation from "./components/Navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
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

  if (!user) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen container-app animate-in">
        <div className="card text-center space-y-8">
          <h1 className="h1">Smart Repair Assistant</h1>
          <p className="muted">Please sign in to continue</p>
          <button
            onClick={() => router.push('/auth')}
            className="btn btn-primary"
          >
            <span className="btn-shine" aria-hidden />
            Sign In
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Navigation */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 py-4">
          <Navigation 
            user={user} 
            onSignOut={signOut} 
            title="Smart Repair Assistant"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gray-50 border-b border-gray-200">
  <div className="px-6 py-8 text-center">
    <h1 className="h1">Smart Repair Assistant</h1>
    <p className="muted">Snap → Diagnose → Fix</p>
  </div>
</div>

{/* Main Content */}
<main className="flex flex-col items-center justify-center flex-1 container-app animate-in py-20">
  <div className="card text-center space-y-8">
    <div className="flex flex-col gap-4 w-64 mx-auto">
      <Link href="/report" className="btn btn-primary">
        <span className="btn-shine" aria-hidden />
        Report a Problem
      </Link>

      <button 
        onClick={() => router.push('/log')}
        className="btn btn-success"
      >
        <span className="btn-shine" aria-hidden />
        My Problem Log
      </button>
    </div>
  </div>
</main>
    </div>
  );
}