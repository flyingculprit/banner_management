'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import { Layers, CheckCircle, Clock, IndianRupee, Bell, MessageSquare, Check, X } from 'lucide-react';

export default function OwnerOverviewPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    rented: 0,
    totalEarned: 0,
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null);

  useEffect(() => {
    async function loadOwnerData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUser(user);

      const { data: spaces } = await supabase
        .from('spaces')
        .select('*, bookings(*)')
        .eq('owner_id', user.id);

      if (spaces) {
        const totalEarned = spaces.reduce((acc, curr) => {
          const paidBookings = curr.bookings?.filter((b: any) => b.payment_status === 'paid') || [];
          return acc + paidBookings.reduce((sum: number, b: any) => sum + (b.owner_amount || 0), 0);
        }, 0);

        setStats({
          total: spaces.length,
          approved: spaces.filter((s) => s.status === 'approved').length,
          rented: spaces.filter((s) => s.is_rented).length,
          totalEarned,
        });
      }

      // Fetch unread messages from Admin or Advertisers
      const { data: unreadMsgs } = await supabase
        .from('space_chat_messages')
        .select('*, spaces!inner(owner_id, area, city), profiles:sender_id(full_name, role)')
        .eq('spaces.owner_id', user.id)
        .eq('is_read', false)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false });

      setNotifications(unreadMsgs || []);
    }

    loadOwnerData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Owner Dashboard Overview</h1>
      <p className="text-xs text-slate-400 mb-8">Summary of your listings, active rentals, and notification alerts.</p>

      {/* Stats Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <Layers className="w-4 h-4 text-indigo-400" /> Total Listed Spaces
          </div>
          <div className="text-2xl font-bold text-white mt-3">{stats.total}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Approved Listings
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-3">{stats.approved}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <Clock className="w-4 h-4 text-cyan-400" /> Currently Rented
          </div>
          <div className="text-2xl font-bold text-cyan-400 mt-3">{stats.rented}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <IndianRupee className="w-4 h-4 text-emerald-400" /> Total Payout Earned
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-3">₹{stats.totalEarned.toLocaleString()}</div>
        </div>
      </div>

      {/* Notifications and Message Alerts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-white text-base">Unread Chats & Inquiries</h2>
        </div>

        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No unread chat inquiries. Everything is up to date.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{n.profiles?.full_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase font-mono">
                      {n.channel_type === 'owner_admin' ? 'Support Admin' : 'Tenant Advertiser'}
                    </span>
                    <span className="text-xs text-indigo-400">• {n.spaces?.area}, {n.spaces?.city}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-1">{n.message}</p>
                </div>

                <button
                  onClick={() =>
                    setActiveChat({
                      spaceId: n.space_id,
                      spaceTitle: `${n.spaces?.area}, ${n.spaces?.city}`,
                      channelType: n.channel_type,
                      bookingId: n.booking_id,
                    })
                  }
                  className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Reply
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeChat && currentUser && (
        <SpaceChatModal
          spaceId={activeChat.spaceId}
          spaceTitle={activeChat.spaceTitle}
          currentUser={currentUser}
          channelType={activeChat.channelType}
          bookingId={activeChat.bookingId}
          onClose={() => setActiveChat(null)}
        />
      )}
    </div>
  );
}