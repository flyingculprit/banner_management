'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AdminFinancialsPage() {
  const [financials, setFinancials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFinancials() {
      setLoading(true);
      const { data } = await supabase
        .from('bookings')
        .select('*, spaces(area, city, profiles:owner_id(full_name)), profiles:advertiser_id(full_name)')
        .order('created_at', { ascending: false });

      if (data) setFinancials(data);
      setLoading(false);
    }

    loadFinancials();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Financial Ledger & Payout Settlement</h1>
      <p className="text-xs text-slate-400 mb-6">Track gross payments collected, platform commissions, and board owner payouts.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="p-4 font-semibold">Payment / Campaign Ref</th>
                <th className="p-4 font-semibold">Advertiser</th>
                <th className="p-4 font-semibold">Space Location</th>
                <th className="p-4 font-semibold">Payable To (Owner)</th>
                <th className="p-4 font-semibold">Gross Collected</th>
                <th className="p-4 font-semibold">10% Platform Fee</th>
                <th className="p-4 font-semibold">Owner Net Payout</th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  </td>
                </tr>
              ) : financials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">No transaction records found.</td>
                </tr>
              ) : (
                financials.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4">
                      <div className="font-semibold text-white">{item.campaign_name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{item.razorpay_payment_id || item.id.slice(0, 8)}</div>
                    </td>
                    <td className="p-4 text-slate-300">{item.profiles?.full_name}</td>
                    <td className="p-4 text-slate-300">{item.spaces?.area}, {item.spaces?.city}</td>
                    <td className="p-4 font-medium text-amber-300">{item.spaces?.profiles?.full_name}</td>
                    <td className="p-4 font-semibold text-cyan-400">₹{Number(item.total_amount).toLocaleString()}</td>
                    <td className="p-4 font-semibold text-emerald-400">₹{Number(item.platform_commission).toLocaleString()}</td>
                    <td className="p-4 font-semibold text-purple-400">₹{Number(item.owner_amount).toLocaleString()}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                        {item.payment_status}
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