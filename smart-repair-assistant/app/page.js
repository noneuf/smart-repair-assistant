import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-8">Smart Repair Assistant</h1>

      <div className="flex flex-col gap-4 w-64">
        <Link href="/report" className="bg-blue-600 text-white py-3 rounded-lg shadow-md hover:bg-blue-700 text-center">
          Report a Problem
        </Link>

        <button className="bg-green-600 text-white py-3 rounded-lg shadow-md hover:bg-green-700">
          My Problem Log
        </button>
      </div>
    </main>
  );
}
