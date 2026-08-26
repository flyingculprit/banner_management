'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AdvertiserPaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPayments = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*, spaces(area, city)')
      .eq('advertiser_id', userId)
      .order('created_at', { ascending: false });

    if (data) setPayments(data);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadPayments(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadPayments(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Payment Receipts & Ledger</h1>
      <p className="text-xs text-slate-400 mb-6">Historical breakdown of all processed payments.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="p-4 font-semibold">Payment Reference</th>
                <th className="p-4 font-semibold">Campaign Title</th>
                <th className="p-4 font-semibold">Board Space</th>
                <th className="p-4 font-semibold">Duration</th>
                <th className="p-4 font-semibold">Total Paid</th>
                <th className="p-4 font-semibold">Gateway Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No payment records found.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-mono text-[11px] text-slate-400">{p.razorpay_payment_id || p.id.slice(0, 8)}</td>
                    <td className="p-4 font-semibold text-white">{p.campaign_name}</td>
                    <td className="p-4 text-slate-300">{p.spaces?.area}, {p.spaces?.city}</td>
                    <td className="p-4 text-slate-400">{p.duration_months} Month(s)</td>
                    <td className="p-4 font-bold text-cyan-400">₹{Number(p.total_amount).toLocaleString()}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}