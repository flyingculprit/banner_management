'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function OwnerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/signin');
      else setUser(user);
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">Land / Board Owner Dashboard</h1>
        <p className="text-slate-400 mt-1">Welcome, {user?.user_metadata?.full_name || user?.email}</p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/');
          }}
          className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded text-sm"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}