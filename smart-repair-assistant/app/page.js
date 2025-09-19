import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen container-app animate-in">
      <div className="card text-center space-y-8">
        <h1 className="h1">Smart Repair Assistant</h1>
        <p className="muted">Snap → Diagnose → Fix</p>

        <div className="flex flex-col gap-4 w-64 mx-auto">
          <Link href="/report" className="btn btn-primary">
          <span className="btn-shine" aria-hidden />
            Report a Problem
          </Link>

          <button className="btn btn-success">
            <span className="btn-shine" aria-hidden />
            My Problem Log
          </button>
        </div>
      </div>
    </main>
  );
}
