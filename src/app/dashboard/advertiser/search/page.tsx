'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StatusModal from '@/components/StatusModal';
import styles from './search.module.css';
import { 
  ArrowLeft, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  Upload, 
  X,
  CreditCard
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function SearchBoardsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [filteredSpaces, setFilteredSpaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search Filters
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchArea, setSearchArea] = useState('');
  const [maxBudget, setMaxBudget] = useState('');

  // Booking Modal State
  const [selectedSpace, setSelectedSpace] = useState<any>(null);
  const [campaignName, setCampaignName] = useState('');
  const [durationMonths, setDurationMonths] = useState('1');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // AI Verification State
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
        fetchAvailableSpaces();
      }
    });

    // Realtime subscription: Remove space immediately if deleted by owner or updated
    const channel = supabase
      .channel('advertiser-spaces-changes')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'spaces' },
        (payload) => {
          setSpaces((prev) => prev.filter((s) => s.id !== payload.old.id));
          setFilteredSpaces((prev) => prev.filter((s) => s.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'spaces' },
        (payload: any) => {
          if (payload.new.status !== 'approved' || payload.new.is_rented) {
            setSpaces((prev) => prev.filter((s) => s.id !== payload.new.id));
            setFilteredSpaces((prev) => prev.filter((s) => s.id !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchAvailableSpaces = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('status', 'approved')
      .eq('is_rented', false)
      .order('location_score', { ascending: false });

    if (!error && data) {
      setSpaces(data);
      setFilteredSpaces(data);
    }
    setLoading(false);
  };

  // Filter Search
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
          campaignName: campaignName || 'New Launch Campaign',
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
        message: err.message || 'Could not verify banner creative.',
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
        message: 'Please upload an ad banner file before continuing.',
      });
      return;
    }

    setBookingLoading(true);

    try {
      const totalAmount = Number(selectedSpace.monthly_rate) * Number(durationMonths);
      const platformCommission = totalAmount * 0.10;
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

      const bannerPhotoUrl = publicData.publicUrl;

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
            banner_photo_url: bannerPhotoUrl,
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

          await supabase
            .from('spaces')
            .update({ is_rented: true })
            .eq('id', selectedSpace.id);

          setSelectedSpace(null);
          setPopup({
            isOpen: true,
            type: 'success',
            title: 'Payment Successful',
            message: 'Your billboard space has been successfully booked and activated!',
            onConfirm: () => router.push('/dashboard/advertiser'),
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
        title: 'Payment Initialization Failed',
        message: err.message || 'Could not initiate Razorpay transaction.',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className={styles.container}>
        <div className={styles.inner}>
          <div className={styles.topBar}>
            <div>
              <Link href="/dashboard/advertiser" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-2">
                <ArrowLeft className="w-4 h-4" /> Back to Advertiser Hub
              </Link>
              <h1 className={styles.title}>Find & Rent Billboard Spaces</h1>
              <p className={styles.subtitle}>Discover verified hoardings ranked by Gemini AI Location Scores.</p>
            </div>
          </div>

          {/* Search & Filter Card */}
          <div className={styles.filterCard}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>District</label>
              <input
                type="text"
                placeholder="e.g. Karur"
                value={searchDistrict}
                onChange={(e) => setSearchDistrict(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Area / Landmark / Junction</label>
              <input
                type="text"
                placeholder="Bus stand, Roundabout, Highway..."
                value={searchArea}
                onChange={(e) => setSearchArea(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Max Monthly Budget (₹)</label>
              <input
                type="number"
                placeholder="e.g. 25000"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          {/* Boards Grid */}
          <div className={styles.boardsGrid}>
            {loading ? (
              <div className="col-span-3 text-center py-12 text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> Loading available spaces...
              </div>
            ) : filteredSpaces.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
                No verified billboard boards matching your criteria.
              </div>
            ) : (
              filteredSpaces.map((space) => (
                <div key={space.id} className={styles.boardCard}>
                  <div className={styles.imageWrapper}>
                    {space.space_photo_url ? (
                      <img src={space.space_photo_url} alt={space.area} className={styles.boardImg} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">No Image</div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className={styles.scoreBadge}>
                        <Sparkles className="w-3 h-3" /> Score {space.location_score || 85}/100
                      </span>
                    </div>
                  </div>

                  <div className={styles.boardContent}>
                    <div>
                      <h3 className="font-bold text-base text-white">{space.area}, {space.city}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{space.address}</p>

                      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block">Flex Dimensions</span>
                          <span className="text-slate-200 font-semibold">{space.width} × {space.height} ft</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-500 block">Visibility</span>
                          <span className="text-slate-200 font-semibold">{space.road_visibility}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-baseline justify-between">
                        <div>
                          <span className="text-xl font-extrabold text-cyan-400">₹{Number(space.monthly_rate).toLocaleString()}</span>
                          <span className="text-xs text-slate-400"> / month</span>
                        </div>
                        {space.lighting && (
                          <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Night Lit</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedSpace(space);
                        setAiResult(null);
                        setBannerFile(null);
                        setBannerPreview(null);
                      }}
                      className={styles.bookBtn}
                    >
                      Book Flex Board →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Booking & AI Check Modal */}
        {selectedSpace && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalBox}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <h3 className="font-bold text-lg text-white">Book Flex Space</h3>
                  <p className="text-xs text-slate-400">{selectedSpace.area}, {selectedSpace.city} ({selectedSpace.width} × {selectedSpace.height} ft)</p>
                </div>
                <button onClick={() => setSelectedSpace(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Campaign Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Summer Electronics Sale"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Duration (Months)</label>
                  <select
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className={styles.input}
                  >
                    <option value="1">1 Month (₹{Number(selectedSpace.monthly_rate).toLocaleString()})</option>
                    <option value="2">2 Months (₹{(Number(selectedSpace.monthly_rate) * 2).toLocaleString()})</option>
                    <option value="3">3 Months (₹{(Number(selectedSpace.monthly_rate) * 3).toLocaleString()})</option>
                    <option value="6">6 Months (₹{(Number(selectedSpace.monthly_rate) * 6).toLocaleString()})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Upload Ad Banner / Creative</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleBannerSelect(e.target.files[0])}
                    className={styles.input}
                  />
                </div>

                {bannerPreview && (
                  <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> AI Ad Content Inspector
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
                      <div className="text-xs space-y-1.5 pt-2 border-t border-indigo-900/60">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Content Score:</span>
                          <span className="font-bold text-cyan-400">{aiResult.contentScore}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Quality:</span>
                          <span className="text-emerald-400 font-medium">{aiResult.imageQuality}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Dimension Match:</span>
                          <span className="text-slate-200">{aiResult.dimensionCheck}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 italic">{aiResult.remarks}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Base Rent ({durationMonths} Mo):</span>
                    <span>₹{(Number(selectedSpace.monthly_rate) * Number(durationMonths)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Platform Service Fee:</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-slate-800">
                    <span>Total Amount Payable:</span>
                    <span className="text-emerald-400">₹{(Number(selectedSpace.monthly_rate) * Number(durationMonths)).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={bookingLoading}
                  onClick={handleRazorpayPayment}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg"
                >
                  {bookingLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" /> Pay with Razorpay & Confirm Booking
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

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