import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { spaceId, status, adminNotes } = await request.json();

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('spaces')
      .update({
        status,
        admin_notes: adminNotes || null,
      })
      .eq('id', spaceId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, space: data });
  } catch (error: any) {
    console.error('Admin verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update space status' },
      { status: 500 }
    );
  }
}