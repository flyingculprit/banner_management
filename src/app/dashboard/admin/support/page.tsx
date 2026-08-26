'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import { MessageSquare, ShieldAlert, User, MapPin, Loader2, CheckCircle2 } from 'lucide-react';

export default function AdminSupportCenterPage() {
  const [tab, setTab] = useState<'advertiser_admin' | 'advertiser_owner'>('advertiser_admin');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active chat modal state
  const [activeChat, setActiveChat] = useState<{
    spaceId: string;
    spaceTitle: string;
    channelType: 'advertiser_admin' | 'advertiser_owner';
    bookingId?: string;
  } | null>(null);

  const fetchInquiries = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    if (tab === 'advertiser_admin') {
      // Fetch all Advertiser ↔ Admin threads
      const { data } = await supabase
        .from('space_chat_messages')
        .select('*, spaces(id, area, city), profiles:sender_id(full_name, phone, role)')
        .eq('channel_type', 'advertiser_admin')
        .order('created_at', { ascending: false });

      // Group latest message per space
      const grouped: any = {};
      data?.forEach((msg) => {
        if (!grouped[msg.space_id]) {
          grouped[msg.space_id] = msg;
        }
      });
      setInquiries(Object.values(grouped));
    } else {
      // Fetch all Advertiser ↔ Owner rental conversation threads
      const { data } = await supabase
        .from('bookings')
        .select('*, spaces(id, area, city, profiles:owner_id(full_name, phone)), profiles:advertiser_id(full_name, phone)')
        .order('created_at', { ascending: false });

      setInquiries(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInquiries();
  }, [tab]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Platform Communications & Support Center</h1>
          <p className="text-xs text-slate-400">Respond to advertiser help requests and supervise tenant-owner communications[cite: 1].</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setTab('advertiser_admin')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === 'advertiser_admin' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Advertiser Support Requests[cite: 1]
          </button>
          <button
            onClick={() => setTab('advertiser_owner')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              tab === 'advertiser_owner' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Advertiser ↔ Owner Audit[cite: 1]
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> Loading inquiries...
        </div>
      ) : inquiries.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-xs">
          No communication threads found under this category.
        </div>
      ) : tab === 'advertiser_admin' ? (
        /* Tab 1: Advertiser ↔ Admin Support Chats */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {inquiries.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">{item.profiles?.full_name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-mono">
                    ADVERTISER[cite: 1]
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Board: {item.spaces?.area}, {item.spaces?.city}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 mb-4 text-xs text-slate-300">
                  <span className="text-[10px] text-slate-500 block mb-0.5">Latest Query:</span>
                  {item.message}
                </div>
              </div>

              <button
                onClick={() =>
                  setActiveChat({
                    spaceId: item.space_id,
                    spaceTitle: `${item.spaces?.area}, ${item.spaces?.city}`,
                    channelType: 'advertiser_admin',
                  })
                }
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Open Support Chat with Advertiser[cite: 1]
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Tab 2: Advertiser ↔ Owner Rental Channel Oversight */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <th className="p-4 font-semibold">Board Space</th>
                  <th className="p-4 font-semibold">Board Owner</th>
                  <th className="p-4 font-semibold">Tenant Advertiser</th>
                  <th className="p-4 font-semibold">Campaign Duration</th>
                  <th className="p-4 font-semibold">Supervisory Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {inquiries.map((booking) => (
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
                            channelType: 'advertiser_owner',
                            bookingId: booking.id,
                          })
                        }
                        className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Inspect Conversation[cite: 1]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Realtime Modal */}
      {activeChat && currentUser && (
        <SpaceChatModal
          spaceId={activeChat.spaceId}
          spaceTitle={activeChat.spaceTitle}
          currentUser={currentUser}
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