'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import StatusModal from '@/components/StatusModal';
import { Sparkles, Upload, Loader2, ArrowLeft, CheckCircle2, Layers } from 'lucide-react';

export default function NewBoardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [valuing, setValuing] = useState(false);

  // Form State
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [width, setWidth] = useState('20');
  const [height, setHeight] = useState('10');
  const [trafficDensity, setTrafficDensity] = useState('medium');
  const [monthlyRate, setMonthlyRate] = useState('25000');
  const [locationScore, setLocationScore] = useState(75);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Upload Success Modal
  const [createdBoard, setCreatedBoard] = useState<{
    area: string;
    city: string;
    monthlyRate: number;
    locationScore: number;
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

  const handleAiValuation = async () => {
    if (!area || !city) {
      setPopup({
        isOpen: true,
        type: 'warning',
        title: 'Missing Details',
        message: 'Please enter Area and City to calculate pricing with AI.',
      });
      return;
    }

    setValuing(true);
    try {
      const res = await fetch('/api/ai/analyze-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, city, width, height, trafficDensity }),
      });
      const data = await res.json();
      if (data.monthly_rate) {
        setMonthlyRate(String(data.monthly_rate));
        setLocationScore(data.location_score || 75);
        setPopup({
          isOpen: true,
          type: 'success',
          title: 'AI Valuation Complete',
          message: `Recommended Monthly Rate: ₹${Number(data.monthly_rate).toLocaleString()} | Location Score: ${data.location_score || 75}/100`,
        });
      }
    } catch {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Valuation Error',
        message: 'Could not connect to Gemini AI valuation engine.',
      });
    } finally {
      setValuing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in. Please sign in again.');

      let spacePhotoUrl = '';
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('billboards')
          .upload(fileName, photoFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('billboards')
            .getPublicUrl(fileName);
          spacePhotoUrl = urlData.publicUrl;
        }
      }

      // Payload handles district fallback to prevent NOT-NULL constraint error
      const { error: insertError } = await supabase.from('spaces').insert({
        owner_id: user.id,
        area: area.trim(),
        city: city.trim(),
        district: district.trim() || city.trim() || 'General',
        address: address.trim(),
        map_link: mapLink,
        width: Number(width),
        height: Number(height),
        monthly_rate: Number(monthlyRate),
        location_score: locationScore,
        space_photo_url: spacePhotoUrl,
        status: 'pending',
        is_rented: false,
      });

      if (insertError) throw insertError;

      setCreatedBoard({
        area,
        city,
        monthlyRate: Number(monthlyRate),
        locationScore,
      });
    } catch (err: any) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'An error occurred while uploading your billboard.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard/owner/boards"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Boards
        </Link>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-white">Register New Billboard Space</h1>
        <p className="text-xs text-slate-400 mt-1 mb-6">Provide board specifications to calculate valuation and list for verification.</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Area / Landmark</label>
              <input
                type="text"
                required
                placeholder="e.g. Town Bus Stand"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">City</label>
              <input
                type="text"
                required
                placeholder="e.g. Karur"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">District</label>
              <input
                type="text"
                required
                placeholder="e.g. Karur"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Exact Address</label>
            <textarea
              rows={2}
              placeholder="Full location details, cross road, building rooftop..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Google Maps Link</label>
            <input
              type="url"
              placeholder="https://maps.app.goo.gl/..."
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Width (ft)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Height (ft)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Traffic Density</label>
              <select
                value={trafficDensity}
                onChange={(e) => setTrafficDensity(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="very_high">Very High</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">Gemini AI Valuation</span>
              <span className="text-slate-300 font-medium">Auto-evaluate suggested monthly rent</span>
            </div>
            <button
              type="button"
              onClick={handleAiValuation}
              disabled={valuing}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition"
            >
              {valuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
              Run AI Valuation
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Monthly Rent (₹)</label>
              <input
                type="number"
                required
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Location Score (0-100)</label>
              <input
                type="number"
                value={locationScore}
                onChange={(e) => setLocationScore(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-cyan-400 font-bold text-sm outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Board Site Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Publish Board Listing
          </button>
        </form>
      </div>

      {/* Upload Success Modal */}
      {createdBoard && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-white">Billboard Board Registered!</h2>
            <p className="text-xs text-slate-400 mt-1">
              Your board listing has been saved and queued for Platform Administrator review.
            </p>

            <div className="my-5 p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Board Location</span>
                <span className="text-white font-semibold">{createdBoard.area}, {createdBoard.city}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Monthly Rent</span>
                <span className="text-emerald-400 font-bold">₹{createdBoard.monthlyRate.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location Score</span>
                <span className="text-cyan-400 font-bold">{createdBoard.locationScore}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Initial Status</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400">
                  PENDING REVIEW
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard/owner/boards')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/25"
            >
              <Layers className="w-4 h-4" /> Go to My Boards
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
    </div>
  );
}