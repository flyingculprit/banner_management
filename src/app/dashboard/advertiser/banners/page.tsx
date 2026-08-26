'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import { MessageSquare, ShieldCheck, MapPin, Loader2 } from 'lucide-react';

export default function AdvertiserBannersPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [chatConfig, setChatConfig] = useState<{
    spaceId: string;
    spaceTitle: string;
    channelType: 'advertiser_owner' | 'advertiser_admin';
    bookingId?: string;
  } | null>(null);

  const [unreadOwnerCounts, setUnreadOwnerCounts] = useState<{ [key: string]: number }>({});
  const [unreadAdminCounts, setUnreadAdminCounts] = useState<{ [key: string]: number }>({});

  const fetchPurchases = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, spaces(*, profiles:owner_id(full_name, phone))')
      .eq('advertiser_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setBookings(data);

      const { data: unreadData } = await supabase
        .from('space_chat_messages')
        .select('space_id, channel_type, booking_id')
        .eq('is_read', false)
        .neq('sender_id', userId);

      const ownerCounts: { [key: string]: number } = {};
      const adminCounts: { [key: string]: number } = {};

      unreadData?.forEach((m) => {
        if (m.channel_type === 'advertiser_owner' && m.booking_id) {
          ownerCounts[m.booking_id] = (ownerCounts[m.booking_id] || 0) + 1;
        } else if (m.channel_type === 'advertiser_admin') {
          adminCounts[m.space_id] = (adminCounts[m.space_id] || 0) + 1;
        }
      });

      setUnreadOwnerCounts(ownerCounts);
      setUnreadAdminCounts(adminCounts);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchPurchases(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchPurchases(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Purchased Banners & Rental Campaigns</h1>
      <p className="text-xs text-slate-400 mb-6">Monitor campaign status, due dates, and chat directly with board owners or platform admins[cite: 1].</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-16 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Loading purchased campaigns...
          </div>
        ) : bookings.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            No active billboard rentals found.
          </div>
        ) : (
          bookings.map((booking) => {
            const hasOwnerUnread = (unreadOwnerCounts[booking.id] || 0) > 0;
            const hasAdminUnread = (unreadAdminCounts[booking.space_id] || 0) > 0;
            const isExpired = new Date(booking.end_date) < new Date();

            return (
              <div key={booking.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-white text-base">{booking.campaign_name}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                      {booking.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1 mb-4">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{booking.spaces?.area}, {booking.spaces?.city} ({booking.spaces?.width} × {booking.spaces?.height} ft)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Validity Period</span>
                      <span className="text-slate-200 font-medium">{booking.start_date} to {booking.end_date}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Next Due / Status</span>
                      <span className={`font-semibold ${isExpired ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {isExpired ? 'Rental Ended' : `Valid till ${booking.end_date}`}
                      </span>
                    </div>
                  </div>

                  {booking.banner_photo_url && (
                    <div className="mb-4">
                      <span className="text-[10px] text-slate-500 block mb-1">Active Ad Banner:</span>
                      <img
                        src={booking.banner_photo_url}
                        alt="Ad Creative"
                        className="w-full h-32 object-cover rounded-lg border border-slate-800"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 flex gap-2">
                  <button
                    onClick={() =>
                      setChatConfig({
                        spaceId: booking.space_id,
                        spaceTitle: `${booking.spaces?.area}, ${booking.spaces?.city}`,
                        channelType: 'advertiser_owner',
                        bookingId: booking.id,
                      })
                    }
                    className="relative flex-1 py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat with Owner
                    {hasOwnerUnread && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={() =>
                      setChatConfig({
                        spaceId: booking.space_id,
                        spaceTitle: `${booking.spaces?.area}, ${booking.spaces?.city}`,
                        channelType: 'advertiser_admin',
                      })
                    }
                    className="relative px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    title="Chat with Support Admin"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Admin
                    {hasAdminUnread && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {chatConfig && currentUser && (
        <SpaceChatModal
          spaceId={chatConfig.spaceId}
          spaceTitle={chatConfig.spaceTitle}
          currentUser={currentUser}
          channelType={chatConfig.channelType}
          bookingId={chatConfig.bookingId}
          onClose={() => {
            setChatConfig(null);
            fetchPurchases(currentUser.id);
          }}
        />
      )}
    </div>
  );
}