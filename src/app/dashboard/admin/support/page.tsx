'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import { MessageSquare, MapPin, Loader2, User } from 'lucide-react';

export default function AdminSupportCenterPage() {
  const [tab, setTab] = useState<'advertiser_admin' | 'advertiser_owner'>('advertiser_admin');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [unreadPerCard, setUnreadPerCard] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);

  const [activeChat, setActiveChat] = useState<{
    spaceId: string;
    spaceTitle: string;
    recipientId?: string;
    recipientName?: string;
    channelType: 'advertiser_admin' | 'advertiser_owner';
    bookingId?: string;
  } | null>(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    setCurrentUser(user);

    if (tab === 'advertiser_admin') {
      // 1. Fetch all Advertiser ↔ Admin messages
      const { data: messages } = await supabase
        .from('space_chat_messages')
        .select('*, spaces(id, area, city), sender:sender_id(id, full_name, phone, role), receiver:receiver_id(id, full_name, phone, role)')
        .eq('channel_type', 'advertiser_admin')
        .order('created_at', { ascending: false });

      const grouped: { [key: string]: any } = {};
      const unreadMap: { [key: string]: number } = {};

      messages?.forEach((msg) => {
        // Group uniquely by conversation key (or space + non-admin party)
        const nonAdminUser = msg.sender?.role !== 'admin' ? msg.sender : msg.receiver;
        const groupKey = msg.conversation_key || `${msg.space_id}_${nonAdminUser?.id}`;

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            ...msg,
            chatUser: nonAdminUser,
            groupKey,
          };
        }

        // Check if this specific message is unread and sent by a non-admin
        if (!msg.is_read && msg.sender_id !== user?.id) {
          unreadMap[groupKey] = (unreadMap[groupKey] || 0) + 1;
        }
      });

      setInquiries(Object.values(grouped));
      setUnreadPerCard(unreadMap);
    } else {
      // 2. Fetch Advertiser ↔ Owner Booking threads
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, spaces(id, area, city, profiles:owner_id(id, full_name, phone)), profiles:advertiser_id(id, full_name, phone)')
        .order('created_at', { ascending: false });

      // Calculate unread for each booking
      const { data: unreadAdvOwner } = await supabase
        .from('space_chat_messages')
        .select('booking_id')
        .eq('channel_type', 'advertiser_owner')
        .eq('is_read', false);

      const unreadBookingMap: { [key: string]: number } = {};
      unreadAdvOwner?.forEach((m) => {
        if (m.booking_id) {
          unreadBookingMap[m.booking_id] = (unreadBookingMap[m.booking_id] || 0) + 1;
        }
      });

      setInquiries(bookings || []);
      setUnreadPerCard(unreadBookingMap);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    fetchInquiries();

    // Listen for incoming live chat messages
    const channel = supabase
      .channel(`support-live-cards-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'space_chat_messages' },
        () => {
          fetchInquiries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInquiries]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Platform Communications & Support Center</h1>
          <p className="text-xs text-slate-400">Respond directly to advertiser tickets and monitor tenant-owner contracts.</p>
        </div>

        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setTab('advertiser_admin')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === 'advertiser_admin' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Advertiser Support Tickets
          </button>
          <button
            onClick={() => setTab('advertiser_owner')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === 'advertiser_owner' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Advertiser ↔ Owner Audit
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> Loading threads...
        </div>
      ) : inquiries.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-xs">
          No communication threads found under this category.
        </div>
      ) : tab === 'advertiser_admin' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inquiries.map((item) => {
            const hasUnread = (unreadPerCard[item.groupKey] || 0) > 0;
            const advertiserName = item.chatUser?.full_name || 'Advertiser';
            const advertiserId = item.chatUser?.id;

            return (
              <div
                key={item.groupKey}
                className={`relative bg-slate-900 border ${
                  hasUnread ? 'border-rose-500/50 shadow-lg shadow-rose-500/10' : 'border-slate-800'
                } rounded-2xl p-5 flex flex-col justify-between transition-all`}
              >
                {/* Individual Card Notification Dot */}
                {hasUnread && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-[10px] font-bold text-rose-400">
                      {unreadPerCard[item.groupKey]} New Message{unreadPerCard[item.groupKey] > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-sm block">{advertiserName}</span>
                      <span className="text-[10px] text-slate-500">{item.chatUser?.phone || 'No phone'}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center gap-1 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Board: {item.spaces?.area}, {item.spaces?.city}</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 mb-4 text-xs text-slate-300">
                    <span className="text-[10px] text-slate-500 block mb-0.5">Latest Message:</span>
                    {item.message}
                  </div>
                </div>

                <button
                  onClick={() =>
                    setActiveChat({
                      spaceId: item.space_id,
                      spaceTitle: `${item.spaces?.area}, ${item.spaces?.city}`,
                      recipientId: advertiserId,
                      recipientName: advertiserName,
                      channelType: 'advertiser_admin',
                    })
                  }
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Reply to {advertiserName}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <th className="p-4 font-semibold">Board Space</th>
                  <th className="p-4 font-semibold">Board Owner</th>
                  <th className="p-4 font-semibold">Tenant Advertiser</th>
                  <th className="p-4 font-semibold">Campaign Duration</th>
                  <th className="p-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inquiries.map((booking) => {
                  const hasUnread = (unreadPerCard[booking.id] || 0) > 0;
                  return (
                    <tr key={booking.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-semibold text-white">{booking.spaces?.area}, {booking.spaces?.city}</div>
                        <div className="text-[10px] text-slate-400">{booking.campaign_name}</div>
                      </td>
                      <td className="p-4 text-slate-300">
                        <div>{booking.spaces?.profiles?.full_name}</div>
                        <div className="text-[10px] text-slate-500">{booking.spaces?.profiles?.phone || 'No phone'}</div>
                      </td>
                      <td className="p-4 text-slate-300">
                        <div>{booking.profiles?.full_name}</div>
                        <div className="text-[10px] text-slate-500">{booking.profiles?.phone || 'No phone'}</div>
                      </td>
                      <td className="p-4 text-slate-400">
                        {booking.start_date} to {booking.end_date}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() =>
                            setActiveChat({
                              spaceId: booking.space_id,
                              spaceTitle: `${booking.spaces?.area}, ${booking.spaces?.city}`,
                              recipientId: booking.spaces?.profiles?.id,
                              recipientName: booking.spaces?.profiles?.full_name,
                              channelType: 'advertiser_owner',
                              bookingId: booking.id,
                            })
                          }
                          className="relative px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Inspect Thread
                          {hasUnread && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeChat && currentUser && (
        <SpaceChatModal
          spaceId={activeChat.spaceId}
          spaceTitle={activeChat.spaceTitle}
          currentUser={currentUser}
          recipientId={activeChat.recipientId}
          recipientName={activeChat.recipientName}
          channelType={activeChat.channelType}
          bookingId={activeChat.bookingId}
          onClose={() => {
            setActiveChat(null);
            fetchInquiries();
          }}
        />
      )}
    </div>
  );
}