'use client';

export const dynamic = 'force-dynamic';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StatusModal from '@/components/StatusModal';
import { ShieldCheck, Sparkles, Loader2, ArrowRight } from 'lucide-react';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRole = searchParams.get('role');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [popup, setPopup] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const userRole = profile?.role || 'advertiser';

      if (userRole === 'admin') router.push('/dashboard/admin');
      else if (userRole === 'owner') router.push('/dashboard/owner');
      else router.push('/dashboard/advertiser');
    } catch (err: any) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Authentication Failed',
        message: err.message || 'Invalid email or password.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
          {requestedRole === 'admin' ? <ShieldCheck className="w-5 h-5 text-amber-300" /> : <Sparkles className="w-5 h-5" />}
        </div>
        <div>
          <h1 className="font-bold text-white text-lg">
            {requestedRole === 'admin' ? 'Admin Portal Authentication' : 'Welcome Back'}
          </h1>
          <p className="text-xs text-slate-400">Sign in to manage billboard spaces and campaigns</p>
        </div>
      </div>

      <form onSubmit={handleSignIn} className="space-y-4 text-xs">
        <div>
          <label className="text-slate-400 block mb-1 font-medium">Email Address</label>
          <input
            type="email"
            required
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div>
          <label className="text-slate-400 block mb-1 font-medium">Password</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {requestedRole !== 'admin' && (
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-indigo-400 hover:underline font-semibold">
            Create Account
          </Link>
        </div>
      )}

      <StatusModal
        isOpen={popup.isOpen}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onClose={() => setPopup((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span>Loading login...</span>
          </div>
        }
      >
        <SignInForm />
      </Suspense>
    </div>
  );
}