'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  MapPin, 
  ExternalLink, 
  CreditCard, 
  Loader2, 
  Calendar, 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Space {
  id: string;
  area: string;
  city: string;
  address?: string;
  monthly_rate: number;
  width: number;
  height: number;
  location_score?: number;
  map_link?: string;
  space_photo_url?: string;
  is_rented: boolean;
  status: string;
  owner_id: string;
}

export default function AdvertiserSearchPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modal & Payment State
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  // Dynamic Razorpay SDK Loader
  const loadRazorpaySDK = (): Promise<boolean> => {
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

  // Fetch all approved and unrented billboards
  const fetchAvailableSpaces = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    setCurrentUser(authData?.user || null);

    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('status', 'approved')
      .eq('is_rented', false)
      .order('location_score', { ascending: false });

    if (!error && data) {
      setSpaces(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAvailableSpaces();
  }, [fetchAvailableSpaces]);

  // Filtered by Search query (city, area)
  const filteredSpaces = spaces.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.area?.toLowerCase().includes(query) ||
      s.city?.toLowerCase().includes(query) ||
      s.address?.toLowerCase().includes(query)
    );
  });

  // Handle Razorpay Checkout & Trigger Verification + Emails
  const handleProceedPayment = async () => {
    if (!selectedSpace) return;
    setPaymentError(null);
    setPaymentSuccess(null);

    if (!currentUser) {
      setPaymentError('Please log in to your account to rent this space.');
      return;
    }

    setPaymentLoading(true);

    const isLoaded = await loadRazorpaySDK();
    if (!isLoaded) {
      setPaymentError('Unable to load Razorpay payment gateway. Please check your internet connection.');
      setPaymentLoading(false);
      return;
    }

    const payableAmount = Number(selectedSpace.monthly_rate) * durationMonths;

    try {
      // 1. Create order on the server
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payableAmount,
          spaceId: selectedSpace.id,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.id) {
        throw new Error(orderData.error || 'Failed to initialize payment order with gateway.');
      }

      // 2. Open Razorpay Portal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'AdFlex Billboard Platform',
        description: `Rental: ${selectedSpace.area}, ${selectedSpace.city} (${durationMonths} Mo)`,
        order_id: orderData.id,
        image: selectedSpace.space_photo_url || undefined,
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
            setPaymentLoading(true);

            // 3. Post to verify route: inserts booking, updates space, and triggers all 3 emails
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                space_id: selectedSpace.id,
                advertiser_id: currentUser.id,
                duration_months: durationMonths,
                total_amount: payableAmount,
              }),
            });

            const verifyResult = await verifyRes.json();

            if (!verifyRes.ok || verifyResult.error) {
              throw new Error(verifyResult.error || 'Payment verification failed on server.');
            }

            setPaymentSuccess('Payment confirmed! Invoices have been sent to your email.');
            setPaymentLoading(false);

            // 4. Redirect cleanly to banners page after dispatch is confirmed
            setTimeout(() => {
              setSelectedSpace(null);
              router.push('/dashboard/advertiser/banners');
            }, 2000);
          } catch (err: any) {
            console.error('Payment post-verification error:', err);
            setPaymentError(err.message || 'Payment received, but verification failed.');
            setPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on('payment.failed', function (resp: any) {
        setPaymentError(resp.error?.description || 'Payment execution cancelled or failed.');
        setPaymentLoading(false);
      });
      razorpayInstance.open();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setPaymentError(err.message || 'Unable to open checkout portal.');
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Discover Billboard Spaces</h1>
        <p className="text-xs text-slate-400">
          Browse verified physical billboards, inspect location footfall metrics, and reserve online with escrow protection.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by city, area, landmark, or street..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* Billboard Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs">Loading verified billboard spaces...</span>
        </div>
      ) : filteredSpaces.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
          No approved billboards found matching your criteria. Check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSpaces.map((space) => (
            <div
              key={space.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col hover:border-slate-700 transition group shadow-lg"
            >
              {/* Image Preview */}
              <div className="h-48 w-full bg-slate-950 relative overflow-hidden">
                {space.space_photo_url ? (
                  <img
                    src={space.space_photo_url}
                    alt={space.area}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-xs font-mono">
                    No Billboard Image Uploaded
                  </div>
                )}
                <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-cyan-400 border border-slate-800 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-cyan-400" />
                  Score: {space.location_score || 0}/100
                </div>
              </div>

              {/* Details */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-white text-base leading-snug">
                    {space.area}, {space.city}
                  </h3>
                  {space.address && (
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{space.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-medium">Dimensions</span>
                    <span className="text-slate-300 font-mono font-medium">{space.width} × {space.height} ft</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-medium">Rate / Month</span>
                    <span className="text-indigo-400 font-bold">₹{Number(space.monthly_rate).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  {space.map_link ? (
                    <a
                      href={space.map_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition"
                    >
                      <MapPin className="w-3.5 h-3.5" /> View Map <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-600">No GPS Link</span>
                  )}

                  <button
                    onClick={() => {
                      setSelectedSpace(space);
                      setDurationMonths(1);
                      setPaymentError(null);
                      setPaymentSuccess(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-md shadow-indigo-600/20"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Book Space
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checkout & Booking Modal */}
      {selectedSpace && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" /> Book Billboard Rental
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Secure Escrow Reservation</p>
              </div>
              <button
                onClick={() => setSelectedSpace(null)}
                disabled={paymentLoading}
                className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {paymentError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {paymentSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{paymentSuccess}</span>
                </div>
              )}

              {/* Space Information */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-white text-base">{selectedSpace.area}, {selectedSpace.city}</h3>
                {selectedSpace.address && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{selectedSpace.address}</p>
                )}
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-medium">Size</span>
                    <span className="text-slate-200 font-semibold">{selectedSpace.width} × {selectedSpace.height} ft</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-500 text-[10px] block font-medium">Monthly Rate</span>
                    <span className="text-indigo-400 font-semibold">₹{Number(selectedSpace.monthly_rate).toLocaleString('en-IN')}/mo</span>
                  </div>
                </div>
              </div>

              {/* Duration Options */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400" /> Select Duration (Months)
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
                      {months} {months === 1 ? 'Mo' : 'Mos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Calculation */}
              <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950 p-4 rounded-2xl border border-indigo-900/40 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Monthly Rate</span>
                  <span>₹{Number(selectedSpace.monthly_rate).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Duration</span>
                  <span>× {durationMonths} month(s)</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-bold text-white">
                  <span>Total Payable</span>
                  <span className="text-base text-cyan-400 font-extrabold">
                    ₹{(Number(selectedSpace.monthly_rate) * durationMonths).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedSpace(null)}
                disabled={paymentLoading}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedPayment}
                disabled={paymentLoading}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying & Sending...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" /> Pay ₹{(Number(selectedSpace.monthly_rate) * durationMonths).toLocaleString('en-IN')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}