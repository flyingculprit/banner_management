'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import StatusModal from '@/components/StatusModal';
import { X, Sparkles, Save, Loader2 } from 'lucide-react';

interface EditSpaceModalProps {
  space: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditSpaceModal({ space, onClose, onSuccess }: EditSpaceModalProps) {
  const [area, setArea] = useState(space.area || '');
  const [city, setCity] = useState(space.city || '');
  const [address, setAddress] = useState(space.address || '');
  const [mapLink, setMapLink] = useState(space.map_link || '');
  const [width, setWidth] = useState(String(space.width || 20));
  const [height, setHeight] = useState(String(space.height || 10));
  const [trafficDensity, setTrafficDensity] = useState(space.traffic_density || 'medium');
  const [monthlyRate, setMonthlyRate] = useState(String(space.monthly_rate || 25000));
  const [locationScore, setLocationScore] = useState(space.location_score || 75);
  const [loading, setLoading] = useState(false);
  const [valuing, setValuing] = useState(false);

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

  const handleAiValuation = async () => {
    if (!area || !city) {
      setPopup({
        isOpen: true,
        type: 'warning',
        title: 'Missing Details',
        message: 'Area and City are required to run AI valuation.',
      });
      return;
    }

    setValuing(true);
    try {
      const res = await fetch('/api/valuation', {
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
          title: 'AI Re-Valuation Complete',
          message: `Updated valuation: ₹${Number(data.monthly_rate).toLocaleString()} /mo (Score: ${data.location_score || 75}/100).`,
        });
      }
    } catch {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Valuation Error',
        message: 'Could not fetch valuation from Gemini AI.',
      });
    } finally {
      setValuing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('spaces')
      .update({
        area,
        city,
        address,
        map_link: mapLink,
        width: Number(width),
        height: Number(height),
        traffic_density: trafficDensity,
        monthly_rate: Number(monthlyRate),
        location_score: locationScore,
      })
      .eq('id', space.id);

    setLoading(false);

    if (error) {
      setPopup({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: error.message,
      });
    } else {
      setPopup({
        isOpen: true,
        type: 'success',
        title: 'Board Updated Successfully',
        message: 'Your billboard specifications have been saved.',
        onConfirm: () => {
          onSuccess();
          onClose();
        },
      });
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-white text-base">Edit Board Specifications</h3>
              <p className="text-xs text-slate-400">{space.area}, {space.city}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Area / Landmark</label>
                <input
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">City</label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Exact Address</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Width (ft)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Height (ft)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Traffic</label>
                <select
                  value={trafficDensity}
                  onChange={(e) => setTrafficDensity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="very_high">Very High</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-indigo-400 block">AI Price Recalculation</span>
                <span className="text-slate-400 text-[11px]">Re-evaluate rates with Gemini</span>
              </div>
              <button
                type="button"
                onClick={handleAiValuation}
                disabled={valuing}
                className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg font-semibold flex items-center gap-1 transition"
              >
                {valuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
                Re-calculate
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Monthly Rent (₹)</label>
                <input
                  type="number"
                  required
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Location Score</label>
                <input
                  type="number"
                  value={locationScore}
                  onChange={(e) => setLocationScore(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-cyan-400 font-bold text-sm outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </form>
        </div>
      </div>

      <StatusModal
        isOpen={popup.isOpen}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onConfirm={popup.onConfirm}
        onClose={() => setPopup((prev) => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}