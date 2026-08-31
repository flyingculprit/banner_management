'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import EditSpaceModal from '@/components/EditSpaceModal';
import { Edit, MessageSquare, ShieldCheck, User, Loader2 } from 'lucide-react';

export default function OwnerBoardsPage() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chat Modal State
  const [chatConfig, setChatConfig] = useState<{
    spaceId: string;
    spaceTitle: string;
    recipientId?: string;
    recipientName?: string;
    channelType: 'owner_admin' | 'advertiser_owner';
    bookingId?: string;
  } | null>(null);

  const [editingSpace, setEditingSpace] = useState<any>(null);

  // Unread maps
  const [adminUnreadCounts, setAdminUnreadCounts] = useState<{ [spaceId: string]: number }>({});
  const [advertiserUnreadCounts, setAdvertiserUnreadCounts] = useState<{ [spaceId: string]: number }>({});

  const fetchSpaces = useCallback(async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('spaces')
      .select('*, bookings(*, profiles:advertiser_id(id, full_name, phone))')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setSpaces(data);

      // Fetch unread messages for this owner
      const { data: unreadData } = await supabase
        .from('space_chat_messages')
        .select('space_id, channel_type, booking_id')
        .eq('is_read', false)
        .neq('sender_id', userId);

      const adminCounts: { [key: string]: number } = {};
      const advCounts: { [key: string]: number } = {};

      unreadData?.forEach((m) => {
        if (m.channel_type === 'owner_admin') {
          adminCounts[m.space_id] = (adminCounts[m.space_id] || 0) + 1;
        } else if (m.channel_type === 'advertiser_owner') {
          advCounts[m.space_id] = (advCounts[m.space_id] || 0) + 1;
        }
      });

      setAdminUnreadCounts(adminCounts);
      setAdvertiserUnreadCounts(advCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchSpaces(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchSpaces(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchSpaces]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">My Registered Billboard Boards</h1>
      <p className="text-xs text-slate-400 mb-6">Review board verifications, update parameters with AI, and chat with Admin or active Advertisers.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Loading boards...
          </div>
        ) : spaces.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No billboard boards registered yet.
          </div>
        ) : (
          spaces.map((space) => {
            const hasAdminUnread = (adminUnreadCounts[space.id] || 0) > 0;
            const hasAdvUnread = (advertiserUnreadCounts[space.id] || 0) > 0;
            const activeBooking = space.bookings?.find((b: any) => b.status === 'active' || b.payment_status === 'paid');
            const advertiser = activeBooking?.profiles;

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
                      <span className="text-slate-500 text-[10px] block">Rental State</span>
                      <span className={space.is_rented ? 'text-indigo-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {space.is_rented ? 'RENTED' : 'VACANT'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
                  <button
                    onClick={() => setEditingSpace(space)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Board (Full Setup)
                  </button>

                  <div className="flex gap-2">
                    {/* 1. Admin Verification Chat (Always Available) */}
                    <button
                      onClick={() =>
                        setChatConfig({
                          spaceId: space.id,
                          spaceTitle: `${space.area}, ${space.city}`,
                          channelType: 'owner_admin',
                        })
                      }
                      className="relative flex-1 py-2 bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      title="Chat with Support Admin"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Admin Chat
                      {hasAdminUnread && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                      )}
                    </button>

                    {/* 2. Tenant Advertiser Chat (Shows ONLY IF RENTED) */}
                    {space.is_rented && activeBooking ? (
                      <button
                        onClick={() =>
                          setChatConfig({
                            spaceId: space.id,
                            spaceTitle: `${space.area}, ${space.city}`,
                            recipientId: advertiser?.id,
                            recipientName: advertiser?.full_name || 'Advertiser',
                            channelType: 'advertiser_owner',
                            bookingId: activeBooking.id,
                          })
                        }
                        className="relative flex-1 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <User className="w-3.5 h-3.5" /> Tenant Chat
                        {hasAdvUnread && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                        )}
                      </button>
                    ) : null}
                  </div>
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

      {chatConfig && currentUser && (
        <SpaceChatModal
          spaceId={chatConfig.spaceId}
          spaceTitle={chatConfig.spaceTitle}
          currentUser={currentUser}
          recipientId={chatConfig.recipientId}
          recipientName={chatConfig.recipientName}
          channelType={chatConfig.channelType}
          bookingId={chatConfig.bookingId}
          onClose={() => {
            setChatConfig(null);
            fetchSpaces(currentUser.id);
          }}
        />
      )}
    </div>
  );
}