'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import StatusModal from '@/components/StatusModal';
import { Search, Sparkles, MapPin, CreditCard, Loader2, X } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function AdvertiserExplorerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [filteredSpaces, setFilteredSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [maxBudget, setMaxBudget] = useState('');

  // Booking Modal State
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [campaignName, setCampaignName] = useState('');
  const [durationMonths, setDurationMonths] = useState('1');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [aiVerifying, setAiVerifying] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // StatusModal State
  const [popup, setPopup] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/signin');
      else {
        setUser(user);
        fetchSpaces();
      }
    });
  }, [router]);

  const fetchSpaces = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('spaces')
      .select('*')
      .eq('status', 'approved')
      .order('location_score', { ascending: false });

    if (data) {
      setSpaces(data);
      setFilteredSpaces(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let result = [...spaces];
    if (searchDistrict) {
      result = result.filter((s) => s.district?.toLowerCase().includes(searchDistrict.toLowerCase()));
    }
    if (searchArea) {
      result = result.filter((s) =>
        s.area?.toLowerCase().includes(searchArea.toLowerCase()) ||
        s.city?.toLowerCase().includes(searchArea.toLowerCase()) ||
        s.landmark?.toLowerCase().includes(searchArea.toLowerCase())
      );
    }
    if (maxBudget) {
      result = result.filter((s) => Number(s.monthly_rate) <= Number(maxBudget));
    }
    setFilteredSpaces(result);
  }, [searchDistrict, searchArea, maxBudget, spaces]);

  const handleBannerSelect = (file: File) => {
    setBannerFile(file);
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const runAiBannerVerification = async () => {
    if (!bannerPreview || !selectedSpace) return;
    setAiVerifying(true);
    try {
      const res = await fetch('/api/ai/verify-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: campaignName || 'Billboard Campaign',
          flexWidth: selectedSpace.width,
          flexHeight: selectedSpace.height,
          base64Image: bannerPreview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAiResult(data);
    } catch (err: any) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'AI Verification Failed',
        message: err.message || 'Could not complete AI creative verification.',
      });
    } finally {
      setAiVerifying(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!bannerFile || !user || !selectedSpace) {
      setPopup({
        isOpen: true,
        type: 'warning',
        title: 'Banner Required',
        message: 'Please upload an ad banner file before proceeding.',
      });
      return;
    }

    setBookingLoading(true);

    try {
      const totalAmount = Number(selectedSpace.monthly_rate) * Number(durationMonths);
      const platformCommission = totalAmount * 0.1;
      const ownerAmount = totalAmount - platformCommission;

      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'INR',
          receipt: `ord_${Date.now()}`,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error);

      const fileExt = bannerFile.name.split('.').pop();
      const fileName = `ad_${user.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, bannerFile);

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'AdFlex AI Outdoor Network',
        description: `Booking flex: ${selectedSpace.area}, ${selectedSpace.city}`,
        order_id: orderData.id,
        handler: async function (response: any) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + Number(durationMonths));

          const { error: bookingErr } = await supabase.from('bookings').insert({
            space_id: selectedSpace.id,
            advertiser_id: user.id,
            campaign_name: campaignName || 'Standard Campaign',
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            duration_months: Number(durationMonths),
            total_amount: totalAmount,
            platform_commission: platformCommission,
            owner_amount: ownerAmount,
            banner_photo_url: publicData.publicUrl,
            ai_content_score: aiResult?.contentScore || 90,
            ai_verification_details: aiResult || null,
            ad_approval_status: 'approved',
            payment_status: 'paid',
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=ADV-${selectedSpace.id.slice(0, 8)}`,
            status: 'active',
          });

          if (bookingErr) throw bookingErr;
          
          await supabase.from('spaces').update({ is_rented: true }).eq('id', selectedSpace.id);

          setSelectedSpace(null);
          setPopup({
            isOpen: true,
            type: 'success',
            title: 'Payment Successful',
            message: 'Your billboard space has been booked and activated successfully.',
            onConfirm: () => router.push('/dashboard/advertiser/banners'),
          });
        },
        prefill: {
          name: user.user_metadata?.full_name || 'Advertiser',
          email: user.email,
        },
        theme: { color: '#4f46e5' },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err: any) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Payment Failed',
        message: err.message || 'An error occurred during payment processing.',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Explore Outdoor Flex Billboard Spaces</h1>
        <p className="text-xs text-slate-400 mb-6">Browse verified locations across districts with Gemini AI location intelligence.</p>

        {/* Filter Card */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search District (e.g. Karur)"
            value={searchDistrict}
            onChange={(e) => setSearchDistrict(e.target.value)}
            className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
          />
          <input
            type="text"
            placeholder="Search Area / Landmark (Bus Stand, Roundabout...)"
            value={searchArea}
            onChange={(e) => setSearchArea(e.target.value)}
            className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
          />
          <input
            type="number"
            placeholder="Max Monthly Rate (₹)"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
          />
        </div>

        {/* Boards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full py-16 flex items-center justify-center gap-2 text-slate-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Loading available spaces...
            </div>
          ) : filteredSpaces.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 text-xs">
              No billboard boards match your filters.
            </div>
          ) : (
            filteredSpaces.map((space) => (
              <div key={space.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
                <div className="h-44 bg-slate-950 relative">
                  {space.space_photo_url ? (
                    <img src={space.space_photo_url} alt={space.area} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">No Image Available</div>
                  )}

                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      <Sparkles className="w-3 h-3 inline mr-1" /> Score {space.location_score || 85}/100
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-base">{space.area}, {space.city}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        space.is_rented ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {space.is_rented ? 'Already Rented' : 'Available'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-1">{space.address}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Dimensions</span>
                        <span className="text-slate-200 font-semibold">{space.width} × {space.height} ft</span>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 text-[10px] block">Visibility</span>
                        <span className="text-slate-200 font-semibold">{space.road_visibility}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between">
                      <span className="text-lg font-extrabold text-cyan-400">
                        ₹{Number(space.monthly_rate).toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ month</span>
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-800">
                    {space.is_rented ? (
                      <button disabled className="w-full py-2.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold cursor-not-allowed">
                        Currently Occupied / Unavailable
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedSpace(space);
                          setAiResult(null);
                          setBannerFile(null);
                          setBannerPreview(null);
                        }}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
                      >
                        Book This Space →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Booking Modal */}
        {selectedSpace && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <h3 className="font-bold text-white text-base">Book Billboard</h3>
                  <p className="text-xs text-slate-400">{selectedSpace.area}, {selectedSpace.city} ({selectedSpace.width} × {selectedSpace.height} ft)</p>
                </div>
                <button onClick={() => setSelectedSpace(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Campaign Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Festival Promotional Campaign"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Rental Duration</label>
                  <select
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="1">1 Month (₹{Number(selectedSpace.monthly_rate).toLocaleString()})</option>
                    <option value="2">2 Months (₹{(Number(selectedSpace.monthly_rate) * 2).toLocaleString()})</option>
                    <option value="3">3 Months (₹{(Number(selectedSpace.monthly_rate) * 3).toLocaleString()})</option>
                    <option value="6">6 Months (₹{(Number(selectedSpace.monthly_rate) * 6).toLocaleString()})</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Upload Ad Banner Creative</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleBannerSelect(e.target.files[0])}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                  />
                </div>

                {bannerPreview && (
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> AI Ad Content Verification
                      </span>
                      <button
                        type="button"
                        onClick={runAiBannerVerification}
                        disabled={aiVerifying}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium"
                      >
                        {aiVerifying ? 'Analyzing Banner...' : 'Verify Creative'}
                      </button>
                    </div>

                    {aiResult && (
                      <div className="text-xs space-y-1 pt-2 border-t border-indigo-900/60">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Content Score:</span>
                          <span className="font-bold text-cyan-400">{aiResult.contentScore}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Quality:</span>
                          <span className="text-emerald-400 font-medium">{aiResult.imageQuality}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">{aiResult.remarks}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Rent Total:</span>
                    <span>₹{(Number(selectedSpace.monthly_rate) * Number(durationMonths)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
                    <span>Total Amount Payable:</span>
                    <span className="text-emerald-400">₹{(Number(selectedSpace.monthly_rate) * Number(durationMonths)).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={bookingLoading}
                  onClick={handleRazorpayPayment}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
                >
                  {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CreditCard className="w-4 h-4" /> Pay with Razorpay & Confirm</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Status Modal for Notifications & Confirmations */}
        <StatusModal
          isOpen={popup.isOpen}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onConfirm={popup.onConfirm}
          onClose={() => {
            if (popup.onConfirm) popup.onConfirm();
            setPopup((prev) => ({ ...prev, isOpen: false }));
          }}
        />
      </div>
    </>
  );
}