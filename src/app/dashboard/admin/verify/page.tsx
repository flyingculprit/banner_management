'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import StatusModal from '@/components/StatusModal';
import { MapPin, ExternalLink, Check, X, MessageSquare, Loader2 } from 'lucide-react';

export default function AdminVerifyPage() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChatSpace, setActiveChatSpace] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});

  const [popup, setPopup] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const fetchSpaces = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    setCurrentUser(user);

    const { data, error } = await supabase
      .from('spaces')
      .select('*, profiles:owner_id(id, full_name, phone)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSpaces(data);

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
  }, []);

  useEffect(() => {
    fetchSpaces();

    // Realtime subscription: Remove deleted spaces and re-fetch changes immediately
    const channel = supabase
      .channel('admin-spaces-realtime')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'spaces' },
        (payload) => {
          setSpaces((prev) => prev.filter((space) => space.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'spaces' },
        () => {
          fetchSpaces();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSpaces]);

  const confirmStatusChange = (spaceId: string, status: 'approved' | 'rejected', areaName: string) => {
    setPopup({
      isOpen: true,
      type: status === 'approved' ? 'warning' : 'error',
      title: `${status === 'approved' ? 'Approve' : 'Reject'} Board Space?`,
      message: `Are you sure you want to mark "${areaName}" as ${status.toUpperCase()}? This will update the space live across the advertiser discovery network.`,
      confirmText: `Confirm ${status.toUpperCase()}`,
      cancelText: 'Cancel',
      onConfirm: async () => {
        const { error } = await supabase
          .from('spaces')
          .update({ status })
          .eq('id', spaceId);

        if (error) {
          setPopup({
            isOpen: true,
            type: 'error',
            title: 'Action Failed',
            message: error.message,
          });
        } else {
          setPopup({
            isOpen: true,
            type: 'success',
            title: 'Status Updated',
            message: `Space "${areaName}" has been successfully ${status}.`,
          });
          fetchSpaces();
        }
      },
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Space Verification Queue</h1>
      <p className="text-xs text-slate-400 mb-6">Review submitted boards, inspect specifications, and verify directly with owners.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="p-4 font-semibold">Location & Owner</th>
                <th className="p-4 font-semibold">Dimensions</th>
                <th className="p-4 font-semibold">Price / Rate</th>
                <th className="p-4 font-semibold">Location Score</th>
                <th className="p-4 font-semibold">Evidence</th>
                <th className="p-4 font-semibold">Current State</th>
                <th className="p-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  </td>
                </tr>
              ) : spaces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No board listings found.</td>
                </tr>
              ) : (
                spaces.map((space) => {
                  const hasUnread = (unreadCounts[space.id] || 0) > 0;
                  const owner = space.profiles;

                  return (
                    <tr key={space.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-semibold text-white">{space.area}, {space.city}</div>
                        <div className="text-slate-400 mt-0.5">{owner?.full_name} ({owner?.phone || 'No phone'})</div>
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
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          space.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                          space.status === 'rejected' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          {space.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {space.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => confirmStatusChange(space.id, 'approved', space.area)}
                                className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => confirmStatusChange(space.id, 'rejected', space.area)}
                                className="px-2.5 py-1 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-medium">Reviewed</span>
                          )}

                          <button
                            onClick={() =>
                              setActiveChatSpace({
                                id: space.id,
                                area: space.area,
                                city: space.city,
                                owner_id: space.owner_id,
                                owner_name: owner?.full_name || 'Board Owner',
                              })
                            }
                            className="relative p-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg transition"
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

      <StatusModal
        isOpen={popup.isOpen}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        confirmText={popup.confirmText}
        cancelText={popup.cancelText}
        onConfirm={popup.onConfirm}
        onClose={() => setPopup((prev) => ({ ...prev, isOpen: false }))}
      />

      {activeChatSpace && currentUser && (
        <SpaceChatModal
          spaceId={activeChatSpace.id}
          spaceTitle={`${activeChatSpace.area}, ${activeChatSpace.city}`}
          currentUser={currentUser}
          recipientId={activeChatSpace.owner_id}
          recipientName={activeChatSpace.owner_name}
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