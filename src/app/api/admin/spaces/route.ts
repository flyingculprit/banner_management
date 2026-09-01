import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[API /admin/spaces] Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY missing in .env.local' },
        { status: 500 }
      );
    }

    // Bypass RLS using service role client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Fetch all registered spaces
    const { data: spaces, error: spacesError } = await supabaseAdmin
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (spacesError) {
      console.error('[API /admin/spaces] Fetch error:', spacesError);
      return NextResponse.json({ error: spacesError.message }, { status: 500 });
    }

    if (!spaces || spaces.length === 0) {
      return NextResponse.json({ spaces: [] });
    }

    // 2. Fetch owner details
    const ownerIds = Array.from(new Set(spaces.map((s) => s.owner_id).filter(Boolean)));
    let profilesMap: { [key: string]: any } = {};

    if (ownerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, phone, email')
        .in('id', ownerIds);

      profiles?.forEach((p) => {
        profilesMap[p.id] = p;
      });
    }

    const combinedSpaces = spaces.map((space) => ({
      ...space,
      profiles: profilesMap[space.owner_id] || {
        full_name: 'Board Owner',
        phone: 'N/A',
        email: null,
      },
    }));

    return NextResponse.json({ spaces: combinedSpaces });
  } catch (err: any) {
    console.error('[API /admin/spaces] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}