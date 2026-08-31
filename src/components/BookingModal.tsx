'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import StatusModal from '@/components/StatusModal';
import { X, CreditCard, CheckCircle2, Loader2, ArrowRight, Layers } from 'lucide-react';

interface BookingModalProps {
  space: any;
  currentUser: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BookingModal({
  space,
  currentUser,
  onClose,
  onSuccess,
}: BookingModalProps) {
  const router = useRouter();
  const [durationMonths, setDurationMonths] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  // Success Payment Receipt State
  const [paymentReceipt, setPaymentReceipt] = useState<{
    campaignName: string;
    totalPaid: number;
    durationMonths: number;
    startDate: string;
    endDate: string;
    bookingId: string;
  } | null>(null);

  // General Status Modal
  const [popup, setPopup] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  const monthlyRate = Number(space.monthly_rate) || 20000;
  const totalRent = monthlyRate * durationMonths;
  const platformFee = Math.round(totalRent * 0.1);
  const ownerPayout = totalRent - platformFee;

  const handlePayAndBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) {
      setPopup({
        isOpen: true,
        type: 'warning',
        title: 'Campaign Title Required',
        message: 'Please provide a campaign title before making payment.',
      });
      return;
    }

    setLoading(true);

    try {
      let bannerPhotoUrl = '';
      if (bannerFile) {
        const fileExt = bannerFile.name.split('.').pop();
        const fileName = `banner_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from('banners')
          .upload(fileName, bannerFile);

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('banners')
            .getPublicUrl(fileName);
          bannerPhotoUrl = urlData.publicUrl;
        }
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + Number(durationMonths));

      const formattedStart = startDate.toISOString().split('T')[0];
      const formattedEnd = endDate.toISOString().split('T')[0];

      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          space_id: space.id,
          advertiser_id: currentUser.id,
          campaign_name: campaignName,
          banner_photo_url: bannerPhotoUrl,
          duration_months: Number(durationMonths),
          start_date: formattedStart,
          end_date: formattedEnd,
          total_amount: totalRent,
          platform_fee: platformFee,
          owner_amount: ownerPayout,
          payment_status: 'paid',
          status: 'active',
        })
        .select()
        .single();

      if (bookingErr) throw bookingErr;

      // Lock board to rented
      await supabase
        .from('spaces')
        .update({ is_rented: true })
        .eq('id', space.id);

      // Open Custom Payment Receipt Modal
      setPaymentReceipt({
        campaignName,
        totalPaid: totalRent,
        durationMonths,
        startDate: formattedStart,
        endDate: formattedEnd,
        bookingId: booking.id,
      });

      onSuccess();
    } catch (err: any) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Payment Transaction Failed',
        message: err.message || 'Payment could not be processed.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-base">Book Billboard Space</h3>
              <p className="text-xs text-slate-400">{space.area}, {space.city}</p>
            </div>
            <button onClick={onClose} className="p-1 text-slate-500 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handlePayAndBook} className="mt-5 space-y-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Campaign Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Summer Mega Promo Campaign"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Rental Duration (Months)</label>
              <select
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              >
                <option value={1}>1 Month</option>
                <option value={3}>3 Months (Quarterly)</option>
                <option value={6}>6 Months (Half-Yearly)</option>
                <option value={12}>12 Months (Annual)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Upload Banner Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Monthly Rent</span>
                <span className="text-white">₹{monthlyRate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Platform Service Fee (10%)</span>
                <span className="text-white">₹{platformFee.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
                <span className="text-white">Total Payable Amount</span>
                <span className="text-emerald-400">₹{totalRent.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              Pay ₹{totalRent.toLocaleString()} via Razorpay
            </button>
          </form>
        </div>
      </div>

      {/* Dedicated Payment Success Receipt Modal */}
      {paymentReceipt && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-white">Payment Successful!</h2>
            <p className="text-xs text-slate-400 mt-1">
              Your billboard reservation has been confirmed and locked.
            </p>

            <div className="my-5 p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Campaign</span>
                <span className="text-white font-semibold">{paymentReceipt.campaignName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid</span>
                <span className="text-emerald-400 font-bold">₹{paymentReceipt.totalPaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration</span>
                <span className="text-slate-200">{paymentReceipt.durationMonths} Month(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rental Validity</span>
                <span className="text-cyan-400 font-medium">{paymentReceipt.startDate} to {paymentReceipt.endDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction State</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                  PAID & ACTIVE
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                router.push('/dashboard/advertiser/banners');
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/25"
            >
              <Layers className="w-4 h-4" /> View Purchased Banners & Chat
            </button>
          </div>
        </div>
      )}

      {/* General Notifications Modal */}
      <StatusModal
        isOpen={popup.isOpen}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onClose={() => setPopup((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}