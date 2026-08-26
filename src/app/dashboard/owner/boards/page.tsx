'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import EditSpaceModal from '@/components/EditSpaceModal';
import { Edit, MessageSquare, Loader2 } from 'lucide-react';

export default function OwnerBoardsPage() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChatSpace, setActiveChatSpace] = useState<any>(null);
  const [editingSpace, setEditingSpace] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});

  const fetchSpaces = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('spaces')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setSpaces(data);

      const { data: unreadData } = await supabase
        .from('space_chat_messages')
        .select('space_id')
        .eq('channel_type', 'owner_admin')
        .eq('is_read', false)
        .neq('sender_id', userId);

      const counts: { [key: string]: number } = {};
      unreadData?.forEach((m) => {
        counts[m.space_id] = (counts[m.space_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    // 1. Initial Session Handshake
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchSpaces(session.user.id);
      }
    });

    // 2. Continuous Auth Listener across Route Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchSpaces(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">My Registered Billboard Boards</h1>
      <p className="text-xs text-slate-400 mb-6">Review approval status, update board parameters with AI valuation, and chat with Admin[cite: 1].</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Loading your billboard listings...
          </div>
        ) : spaces.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No billboard boards registered yet.
          </div>
        ) : (
          spaces.map((space) => {
            const hasUnread = (unreadCounts[space.id] || 0) > 0;
            return (
              <div key={space.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        space.status === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : space.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {space.status}
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      ₹{Number(space.monthly_rate).toLocaleString()} /mo
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-base">{space.area}, {space.city}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{space.address}</p>

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Dimensions</span>
                      <span className="text-slate-200 font-medium">{space.width} × {space.height} ft</span>
                    </div>
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 text-[10px] block">Location Score[cite: 1]</span>
                      <span className="text-cyan-400 font-bold">{space.location_score || 0}/100</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() => setEditingSpace(space)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Board (Full)
                  </button>
                  <button
                    onClick={() => setActiveChatSpace(space)}
                    className="relative p-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-xl transition"
                    title="Chat with Admin"
                  >
                    <MessageSquare className="w-4 h-4" />
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingSpace && (
        <EditSpaceModal
          space={editingSpace}
          onClose={() => setEditingSpace(null)}
          onSuccess={() => currentUser && fetchSpaces(currentUser.id)}
        />
      )}

      {activeChatSpace && currentUser && (
        <SpaceChatModal
          spaceId={activeChatSpace.id}
          spaceTitle={`${activeChatSpace.area}, ${activeChatSpace.city}`}
          currentUser={currentUser}
          channelType="owner_admin"
          onClose={() => {
            setActiveChatSpace(null);
            fetchSpaces(currentUser.id);
          }}
        />
      )}
    </div>
  );
}