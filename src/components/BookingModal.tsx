'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { sendPaymentInvoices } from '@/lib/sendPaymentEmail';
import { X, Calendar, CreditCard, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface SpaceData {
  id: string;
  area: string;
  city: string;
  address?: string;
  monthly_rate: number;
  width: number;
  height: number;
  owner_id: string;
  space_photo_url?: string;
}

interface BookingModalProps {
  space: SpaceData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function BookingModal({ space, isOpen, onClose, onSuccess }: BookingModalProps) {
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Load current authenticated user
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    }
    if (isOpen) {
      loadUser();
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  // Dynamically load Razorpay SDK script if not already present
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  if (!isOpen) return null;

  const totalAmount = Number(space.monthly_rate) * durationMonths;

  const handlePayment = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentUser) {
      setErrorMsg('Please log in to your account to complete this booking.');
      return;
    }

    setLoading(true);

    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      setErrorMsg('Failed to initialize the secure Razorpay payment gateway. Check your internet connection.');
      setLoading(false);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: Math.round(totalAmount * 100), // In paise
      currency: 'INR',
      name: 'AdFlex AI Billboard Platform',
      description: `Space Rental: ${space.area}, ${space.city} (${durationMonths} Mo)`,
      image: space.space_photo_url || undefined,
      prefill: {
        name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Advertiser',
        email: currentUser.email || '',
        contact: currentUser.user_metadata?.phone || '',
      },
      theme: {
        color: '#4f46e5',
      },
      handler: async function (response: any) {
        try {
          // 1. Create booking record in database
          const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .insert({
              space_id: space.id,
              advertiser_id: currentUser.id,
              duration_months: durationMonths,
              total_amount: totalAmount,
              payment_status: 'paid',
              payment_id: response.razorpay_payment_id,
              status: 'active',
            })
            .select()
            .single();

          if (bookingError || !booking) {
            throw new Error(bookingError?.message || 'Database error creating booking record.');
          }

          // 2. Update billboard status to rented
          const { error: spaceUpdateError } = await supabase
            .from('spaces')
            .update({ is_rented: true })
            .eq('id', space.id);

          if (spaceUpdateError) {
            console.error('Failed to update space rented status:', spaceUpdateError.message);
          }

          // 3. Dispatch automated bills/invoices to Advertiser, Owner, and Admin
          await sendPaymentInvoices({
            bookingId: booking.id,
            spaceId: space.id,
            totalAmount: totalAmount,
            durationMonths: durationMonths,
            paymentId: response.razorpay_payment_id,
          });

          setSuccessMsg('Payment successful! Booking confirmed and invoices sent to your email.');
          setLoading(false);

          setTimeout(() => {
            if (onSuccess) onSuccess();
            onClose();
          }, 2500);
        } catch (err: any) {
          console.error('Post-payment error:', err);
          setErrorMsg(err.message || 'Payment was received, but saving the booking failed. Contact support.');
          setLoading(false);
        }
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
        },
      },
    };

    try {
      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (resp: any) {
        setErrorMsg(resp.error?.description || 'Payment execution failed.');
        setLoading(false);
      });
      paymentObject.open();
    } catch (err: any) {
      console.error('Razorpay invocation error:', err);
      setErrorMsg(err.message || 'Unable to open checkout portal.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" /> Confirm Space Rental
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Secure Escrow Booking System</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Board Spec Preview */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <h3 className="font-bold text-white text-base">{space.area}, {space.city}</h3>
            {space.address && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{space.address}</p>}
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-medium">Board Size</span>
                <span className="text-slate-200 font-semibold">{space.width} × {space.height} ft</span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 text-[10px] block font-medium">Monthly Rate</span>
                <span className="text-indigo-400 font-semibold">₹{Number(space.monthly_rate).toLocaleString('en-IN')}/mo</span>
              </div>
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" /> Select Rental Duration (Months)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map((months) => (
                <button
                  key={months}
                  type="button"
                  onClick={() => setDurationMonths(months)}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                    durationMonths === months
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {months} {months === 1 ? 'Month' : 'Months'}
                </button>
              ))}
            </div>
          </div>

          {/* Price Calculation Card */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950 p-4 rounded-2xl border border-indigo-900/40 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Base Monthly Price</span>
              <span>₹{Number(space.monthly_rate).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Duration Multiplier</span>
              <span>× {durationMonths} month(s)</span>
            </div>
            <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-bold text-white">
              <span>Total Payable</span>
              <span className="text-base text-cyan-400 font-extrabold">₹{totalAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePayment}
            disabled={loading}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" /> Pay ₹{totalAmount.toLocaleString('en-IN')}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}