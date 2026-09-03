'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  MapPin,
  CreditCard,
  Loader2,
  Calendar,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Lock,
  UploadCloud,
  Sparkles
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

export default function AdvertiserOverviewPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Booking Modal State
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadedBannerUrl, setUploadedBannerUrl] = useState<string | null>(null);
  const bannerUrlRef = useRef<string | null>(null);

  // AI Analysis State
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiReport, setAiReport] = useState<{
    score?: number;
    readability?: string;
    contrast?: string;
    suggestions?: string[];
  } | null>(null);

  // Transaction States
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const loadRazorpaySDK = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    setCurrentUser(authData?.user || null);

    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('status', 'approved')
      .order('is_rented', { ascending: true })
      .order('location_score', { ascending: false });

    if (!error && data) {
      setSpaces(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  const resetModalState = () => {
    setSelectedSpace(null);
    setBannerFile(null);
    setBannerPreview(null);
    setUploadedBannerUrl(null);
    bannerUrlRef.current = null;
    setAiReport(null);
    setPaymentError(null);
    setPaymentSuccess(null);
  };

  const handleImageSelection = async (file: File) => {
    setBannerFile(file);
    const previewUrl = URL.createObjectURL(file);
    setBannerPreview(previewUrl);
    setAnalyzingImage(true);
    setPaymentError(null);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `banner_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('banners')
        .upload(fileName, file, { upsert: true });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data: publicData } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      const publicUrl = publicData.publicUrl;
      setUploadedBannerUrl(publicUrl);
      bannerUrlRef.current = publicUrl;

      const aiRes = await fetch('/api/ai/analyze-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });

      const aiData = await aiRes.json();
      setAiReport(aiData);
    } catch (err: any) {
      console.error('Image upload/analysis error:', err);
      setPaymentError('Image upload or AI analysis failed: ' + err.message);
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedSpace || selectedSpace.is_rented) return;
    setPaymentError(null);
    setPaymentSuccess(null);

    const { data: authData } = await supabase.auth.getUser();
    const activeUser = authData?.user || currentUser;

    if (!activeUser) {
      setPaymentError('Please log in to your account to rent this space.');
      return;
    }

    setPaymentLoading(true);

    const isLoaded = await loadRazorpaySDK();
    if (!isLoaded) {
      setPaymentError('Unable to load payment gateway. Check your internet connection.');
      setPaymentLoading(false);
      return;
    }

    const payableAmount = Number(selectedSpace.monthly_rate) * durationMonths;

    try {
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payableAmount,
          spaceId: selectedSpace.id,
          durationMonths,
          advertiserId: activeUser.id,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.id) {
        throw new Error(orderData.error || 'Failed to initialize order.');
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'AdFlex AI Billboard Platform',
        description: `Rental: ${selectedSpace.area}, ${selectedSpace.city} (${durationMonths} Mo)`,
        order_id: orderData.id,
        prefill: {
          name: activeUser.user_metadata?.full_name || activeUser.email?.split('@')[0] || 'Advertiser',
          email: activeUser.email || '',
        },
        theme: {
          color: '#4f46e5',
        },
        handler: async function (response: any) {
          setPaymentLoading(true);

          try {
            const finalBannerUrl = bannerUrlRef.current || uploadedBannerUrl || null;
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                space_id: selectedSpace.id,
                advertiser_id: activeUser.id,
                duration_months: durationMonths,
                total_amount: payableAmount,
                banner_image_url: finalBannerUrl,
              }),
            });

            const verifyResult = await verifyRes.json();

            if (!verifyRes.ok || verifyResult.error) {
              setPaymentError(verifyResult.error || 'Payment verification failed on server.');
              setPaymentLoading(false);
              return;
            }

            setPaymentSuccess('Payment confirmed! Tax invoices sent to all parties.');
            setPaymentLoading(false);

            setTimeout(() => {
              resetModalState();
              router.push('/dashboard/advertiser/banners');
            }, 1500);
          } catch (err: any) {
            console.error('Verify error:', err);
            setPaymentError(err.message || 'Payment completed, but verification failed.');
            setPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setPaymentError(resp.error?.description || 'Payment failed.');
        setPaymentLoading(false);
      });
      rzp.open();
    } catch (err: any) {
      console.error('Payment initialization error:', err);
      setPaymentError(err.message || 'Unable to open checkout portal.');
      setPaymentLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Advertiser Dashboard</h1>
        <p className="text-xs text-slate-400">
          Explore all billboard spaces, evaluate AI performance metrics, and book available spots directly.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs">Loading billboard inventory...</span>
        </div>
      ) : spaces.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
          No billboards found at the moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {spaces.map((space) => (
            <div
              key={space.id}
              className={`bg-slate-900 border rounded-2xl overflow-hidden flex flex-col transition group shadow-lg ${
                space.is_rented ? 'border-slate-800/80 opacity-90' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="h-48 w-full bg-slate-950 relative overflow-hidden">
                {space.space_photo_url ? (
                  <img
                    src={space.space_photo_url}
                    alt={space.area}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-xs font-mono">
                    No Billboard Image
                  </div>
                )}

                <div className="absolute top-3 left-3">
                  {space.is_rented ? (
                    <span className="bg-rose-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow">
                      <Lock className="w-3 h-3" /> Already Rented
                    </span>
                  ) : (
                    <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 shadow">
                      <CheckCircle2 className="w-3 h-3" /> Available
                    </span>
                  )}
                </div>

                <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-cyan-400 border border-slate-800 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-cyan-400" />
                  Score: {space.location_score || 0}/100
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-white text-base">{space.area}, {space.city}</h3>
                  {space.address && (
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{space.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block uppercase font-medium">Dimensions</span>
                    <span className="text-slate-300 font-mono">{space.width} × {space.height} ft</span>
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
                      <MapPin className="w-3.5 h-3.5" /> Map <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-600">No GPS Link</span>
                  )}

                  <button
                    disabled={space.is_rented}
                    onClick={() => {
                      resetModalState();
                      setSelectedSpace(space);
                      setDurationMonths(1);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                      space.is_rented
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/60'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                    }`}
                  >
                    {space.is_rented ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Booked
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-3.5 h-3.5" /> Rent Billboard
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checkout & Creative Modal */}
      {selectedSpace && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" /> Rent & Configure Ad Creative
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Select duration and analyze billboard design visibility prior to booking</p>
              </div>
              <button
                onClick={resetModalState}
                disabled={paymentLoading}
                className="text-slate-400 hover:text-white transition p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
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

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-sm">{selectedSpace.area}, {selectedSpace.city}</h3>
                  <span className="text-xs text-slate-400">Dimensions: {selectedSpace.width} × {selectedSpace.height} ft</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block font-medium">Rate / Month</span>
                  <span className="text-indigo-400 font-bold text-sm">₹{Number(selectedSpace.monthly_rate).toLocaleString('en-IN')}</span>
                </div>
              </div>

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
                      className={`py-2 rounded-xl text-xs font-semibold border transition ${
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

              {/* Upload & AI Analysis Container */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-indigo-400" /> Upload Ad Creative (Optional)
                  </span>
                  {analyzingImage && (
                    <span className="text-[11px] text-cyan-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Analyzing banner with AI...
                    </span>
                  )}
                </label>

                {bannerPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950">
                    <img src={bannerPreview} alt="Ad Preview" className="w-full h-44 object-cover" />
                    <div className="p-3 bg-slate-950 flex items-center justify-between border-t border-slate-800">
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ad Image Selected
                      </span>
                      <label className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg cursor-pointer transition">
                        Change File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleImageSelection(e.target.files[0]);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/40 group">
                    <UploadCloud className="w-7 h-7 text-slate-500 group-hover:text-indigo-400 transition mb-1.5" />
                    <span className="text-xs font-semibold text-slate-300">Choose ad creative image</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      JPG, PNG, WEBP (Target ratio {selectedSpace.width}:{selectedSpace.height})
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleImageSelection(e.target.files[0]);
                      }}
                    />
                  </label>
                )}

                {aiReport && (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> AI Ad Evaluation
                      </span>
                      <span className="text-xs font-extrabold text-cyan-400">
                        Score: {aiReport.score}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Readability</span>
                        <span className="text-slate-200 font-medium text-[11px]">{aiReport.readability}</span>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Contrast</span>
                        <span className="text-slate-200 font-medium text-[11px]">{aiReport.contrast}</span>
                      </div>
                    </div>

                    {aiReport.suggestions && aiReport.suggestions.length > 0 && (
                      <div className="text-[11px] text-slate-400 space-y-1">
                        <span className="font-semibold text-slate-300">Insights:</span>
                        <ul className="list-disc list-inside space-y-0.5">
                          {aiReport.suggestions.map((tip, i) => (
                            <li key={i} className="text-slate-300 text-[10px]">{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

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

            <div className="p-6 border-t border-slate-800 bg-slate-950/40 flex gap-3">
              <button
                type="button"
                onClick={resetModalState}
                disabled={paymentLoading || analyzingImage}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePayment}
                disabled={paymentLoading || analyzingImage}
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