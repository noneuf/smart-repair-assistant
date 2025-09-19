import { supabase } from '@/lib/supabaseClient'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Get the correct origin - check if we're in Codespaces
  const origin = requestUrl.origin.includes('localhost') 
    ? 'https://refactored-space-succotash-6vjj4g4qjvvf4jrr-3000.app.github.dev'
    : requestUrl.origin

  // Redirect to home page after successful authentication
  return NextResponse.redirect(`${origin}/`)
}