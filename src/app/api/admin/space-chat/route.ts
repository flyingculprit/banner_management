import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch all clarification messages for a space
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get('spaceId');

  if (!spaceId) {
    return NextResponse.json({ error: 'Space ID is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('space_chat_messages')
    .select('*, profiles:sender_id(full_name, role)')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}

// POST: Send an inquiry or clarification message
export async function POST(request: Request) {
  try {
    const { spaceId, senderId, message } = await request.json();

    if (!spaceId || !senderId || !message) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('space_chat_messages')
      .insert({
        space_id: spaceId,
        sender_id: senderId,
        message,
      })
      .select('*, profiles:sender_id(full_name, role)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}