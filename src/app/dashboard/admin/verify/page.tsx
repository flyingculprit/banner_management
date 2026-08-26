'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import { MapPin, ExternalLink, Check, X, MessageSquare, Loader2 } from 'lucide-react';

export default function AdminVerifyPage() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChatSpace, setActiveChatSpace] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});

  const fetchSpaces = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    const { data, error } = await supabase
      .from('spaces')
      .select('*, profiles:owner_id(full_name, phone)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSpaces(data);

      // Check unread messages for each space
      const { data: unreadData } = await supabase
        .from('space_chat_messages')
        .select('space_id')
        .eq('channel_type', 'owner_admin')
        .eq('is_read', false)
        .neq('sender_id', user?.id || '');

      const counts: { [key: string]: number } = {};
      unreadData?.forEach((m) => {
        counts[m.space_id] = (counts[m.space_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  const handleUpdateStatus = async (spaceId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('spaces')
      .update({ status })
      .eq('id', spaceId);

    if (error) {
      alert('Failed to update status: ' + error.message);
    } else {
      alert(`Space status locked as ${status.toUpperCase()}!`);
      fetchSpaces();
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Space Verification Hub</h1>
      <p className="text-xs text-slate-400 mb-6">Inspect physical specs, verify locations, and approve or reject submissions.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="p-4 font-semibold">Location & Owner</th>
                <th className="p-4 font-semibold">Dimensions</th>
                <th className="p-4 font-semibold">Price / Rate</th>
                <th className="p-4 font-semibold">AI Location Score</th>
                <th className="p-4 font-semibold">Location / Photo</th>
                <th className="p-4 font-semibold">Decision / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  </td>
                </tr>
              ) : spaces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No board listings found.</td>
                </tr>
              ) : (
                spaces.map((space) => {
                  const hasUnread = (unreadCounts[space.id] || 0) > 0;
                  return (
                    <tr key={space.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-semibold text-white">{space.area}, {space.city}</div>
                        <div className="text-slate-400 mt-0.5">{space.profiles?.full_name} ({space.profiles?.phone || 'No phone'})</div>
                      </td>
                      <td className="p-4 font-mono text-slate-300">{space.width} × {space.height} ft</td>
                      <td className="p-4 font-semibold text-white">₹{Number(space.monthly_rate).toLocaleString()}</td>
                      <td className="p-4">
                        <span className="text-cyan-400 font-bold">{space.location_score || 0}/100</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {space.map_link && (
                            <a href={space.map_link} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> Map
                            </a>
                          )}
                          {space.space_photo_url && (
                            <a href={space.space_photo_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline flex items-center gap-1">
                              <ExternalLink className="w-3.5 h-3.5" /> Photo
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {space.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(space.id, 'approved')}
                                className="px-3 py-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(space.id, 'rejected')}
                                className="px-3 py-1 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                                space.status === 'approved'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {space.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                            </span>
                          )}

                          {/* Chat button with live unread indicator */}
                          <button
                            onClick={() => setActiveChatSpace(space)}
                            className="relative p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                            title="Chat with Owner"
                          >
                            <MessageSquare className="w-4 h-4" />
                            {hasUnread && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeChatSpace && currentUser && (
        <SpaceChatModal
          spaceId={activeChatSpace.id}
          spaceTitle={`${activeChatSpace.area}, ${activeChatSpace.city}`}
          currentUser={currentUser}
          channelType="owner_admin"
          onClose={() => {
            setActiveChatSpace(null);
            fetchSpaces();
          }}
        />
      )}
    </div>
  );
}