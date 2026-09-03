'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import { MessageSquare, Loader2 } from 'lucide-react';

export default function OwnerRentsPage() {
  const [rentals, setRentals] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChatRental, setActiveChatRental] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});

  const fetchRentals = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, spaces!inner(*), profiles:advertiser_id(id, full_name, phone)')
      .eq('spaces.owner_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setRentals(data);

      const { data: unreadData } = await supabase
        .from('space_chat_messages')
        .select('booking_id')
        .eq('channel_type', 'advertiser_owner')
        .eq('is_read', false)
        .neq('sender_id', userId);

      const counts: { [key: string]: number } = {};
      unreadData?.forEach((m) => {
        if (m.booking_id) counts[m.booking_id] = (counts[m.booking_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchRentals(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchRentals(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Rented Billboard & Tenant Management</h1>
      <p className="text-xs text-slate-400 mb-6">Track tenant details, rental validities, next due dates, and direct chat with advertisers.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="p-4 font-semibold">Board Space</th>
                <th className="p-4 font-semibold">Advertiser & Contact</th>
                <th className="p-4 font-semibold">Duration & Validity</th>
                <th className="p-4 font-semibold">Next Due / Expiry</th>
                <th className="p-4 font-semibold">Net Payout</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Direct Chat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  </td>
                </tr>
              ) : rentals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">No billboard boards are currently rented.</td>
                </tr>
              ) : (
                rentals.map((rental) => {
                  const hasUnread = (unreadCounts[rental.id] || 0) > 0;
                  const isExpired = new Date(rental.end_date) < new Date();
                  const gross = Number(rental.total_amount || 0);
                  const netPayout = Number(rental.owner_amount) > 0
                    ? Number(rental.owner_amount)
                    : Math.round(gross * 0.9);

                  return (
                    <tr key={rental.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4">
                        <div className="font-semibold text-white">{rental.spaces?.area || 'Prime Spot'}, {rental.spaces?.city || 'Tamil Nadu'}</div>
                        <div className="text-[11px] text-slate-400">{rental.spaces?.width || 20} × {rental.spaces?.height || 10} ft</div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-200 font-medium">{rental.profiles?.full_name || 'Advertiser'}</div>
                        <div className="text-[11px] text-slate-400">{rental.profiles?.phone || 'No Phone'}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-slate-300">{rental.duration_months} Month(s)</div>
                        <div className="text-[11px] text-slate-500">{rental.start_date} to {rental.end_date}</div>
                      </td>
                      <td className="p-4">
                        <span className={`font-semibold ${isExpired ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {isExpired ? 'Contract Expired' : rental.end_date}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-emerald-400">₹{netPayout.toLocaleString('en-IN')}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                          {rental.payment_status || 'PAID'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setActiveChatRental(rental)}
                          className="relative px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Chat with {rental.profiles?.full_name || 'Advertiser'}
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeChatRental && currentUser && (
        <SpaceChatModal
          spaceId={activeChatRental.space_id}
          spaceTitle={`${activeChatRental.spaces?.area || 'Billboard'}, ${activeChatRental.spaces?.city || ''}`}
          currentUser={currentUser}
          recipientId={activeChatRental.profiles?.id}
          recipientName={activeChatRental.profiles?.full_name || 'Advertiser'}
          channelType="advertiser_owner"
          bookingId={activeChatRental.id}
          onClose={() => {
            setActiveChatRental(null);
            fetchRentals(currentUser.id);
          }}
        />
      )}
    </div>
  );
}