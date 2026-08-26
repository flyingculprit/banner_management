'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Lock, User, Mail, Phone, Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ProfileModalProps {
  currentUser: any;
  onClose: () => void;
}

export default function ProfileModal({ currentUser, onClose }: ProfileModalProps) {
  const [profile, setProfile] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      setProfile(data);
    }
    loadProfile();
  }, [currentUser]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccessMsg('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Account Profile</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Details */}
        <div className="mt-4 space-y-2.5 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-indigo-400" /> Full Name</span>
            <span className="text-slate-200 font-semibold">{profile?.full_name || currentUser?.user_metadata?.full_name || 'N/A'}</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-cyan-400" /> Email</span>
            <span className="text-slate-200 font-medium">{currentUser?.email}</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-emerald-400" /> Phone</span>
            <span className="text-slate-200 font-medium">{profile?.phone || 'N/A'}</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-purple-400" /> Role</span>
            <span className="text-indigo-400 font-bold uppercase">{profile?.role || 'user'}</span>
          </div>
        </div>

        {/* Change Password Form */}
        <form onSubmit={handleChangePassword} className="mt-5 pt-4 border-t border-slate-800 space-y-3">
          <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-400" /> Change Password
          </h4>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {successMsg}
            </div>
          )}

          <div>
            <input
              type="password"
              placeholder="New Password (min. 6 characters)"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Confirm New Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}