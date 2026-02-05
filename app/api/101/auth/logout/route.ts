import { NextResponse } from 'next/server'

export async function POST() {
  // Since we're using JWT stored on client, we just return success
  // The client will remove the token from localStorage
  return NextResponse.json({ success: true })
}

