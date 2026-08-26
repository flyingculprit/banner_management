'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Sparkles, Loader2, MapPin, UploadCloud } from 'lucide-react';

interface EditSpaceModalProps {
  space: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditSpaceModal({ space, onClose, onSuccess }: EditSpaceModalProps) {
  // Exact fields from Add New Board
  const [district, setDistrict] = useState(space.district || 'Karur');
  const [city, setCity] = useState(space.city || 'Karur');
  const [area, setArea] = useState(space.area || '');
  const [address, setAddress] = useState(space.address || '');
  const [landmark, setLandmark] = useState(space.landmark || '');
  const [mapLink, setMapLink] = useState(space.map_link || '');
  const [latitude, setLatitude] = useState(space.latitude ? space.latitude.toString() : '');
  const [longitude, setLongitude] = useState(space.longitude ? space.longitude.toString() : '');
  const [width, setWidth] = useState(space.width ? space.width.toString() : '20');
  const [height, setHeight] = useState(space.height ? space.height.toString() : '10');
  const [monthlyRate, setMonthlyRate] = useState(space.monthly_rate ? space.monthly_rate.toString() : '15000');
  const [lighting, setLighting] = useState<boolean>(Boolean(space.lighting));
  const [roadVisibility, setRoadVisibility] = useState(space.road_visibility || 'High');

  // Photo & AI state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(space.space_photo_url || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(space.ai_analysis_raw || {
    trafficScore: space.traffic_score || 0,
    visibilityScore: space.visibility_score || 0,
    demandScore: space.demand_score || 0,
    locationScore: space.location_score || 0,
    aiSuggestedRate: space.ai_suggested_rate || space.monthly_rate,
    reason: 'Existing valuation score on record'
  });
  const [submitting, setSubmitting] = useState(false);

  // Run Gemini AI Re-analysis
  const handleAiValuation = async () => {
    if (!area || !address) {
      alert('Please fill in Area and Address before running AI valuation.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/analyze-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district,
          city,
          area,
          address,
          landmark,
          width,
          height,
          requestedPrice: monthlyRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze location');
      setAiResult(data);
    } catch (err: any) {
      alert('AI Valuation Error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let photoUrl = space.space_photo_url;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${space.owner_id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('billboards')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('billboards')
          .getPublicUrl(fileName);

        photoUrl = publicData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from('spaces')
        .update({
          district,
          city,
          area,
          address,
          landmark,
          map_link: mapLink,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          width: parseFloat(width),
          height: parseFloat(height),
          monthly_rate: parseFloat(monthlyRate),
          lighting,
          road_visibility: roadVisibility,
          space_photo_url: photoUrl,
          traffic_score: aiResult?.trafficScore ?? space.traffic_score,
          visibility_score: aiResult?.visibilityScore ?? space.visibility_score,
          demand_score: aiResult?.demandScore ?? space.demand_score,
          location_score: aiResult?.locationScore ?? space.location_score,
          ai_suggested_rate: aiResult?.aiSuggestedRate ?? space.ai_suggested_rate,
          ai_analysis_raw: aiResult,
        })
        .eq('id', space.id);

      if (updateError) throw updateError;

      alert('Billboard board and AI valuation updated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Failed to update board: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div>
            <h3 className="font-bold text-white text-base sm:text-lg">Edit Advertisement Space (Full Setup)</h3>
            <p className="text-xs text-slate-400">Update location, dimensions, photo, and recalculate AI valuation[cite: 1].</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Section 1: Location */}
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">1. Location Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">District</label>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">City / Town</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Area / Landmark</label>
              <input
                type="text"
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Exact Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Prominent Landmark</label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Google Maps Link</label>
              <input
                type="url"
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Section 2: Physical Flex Specs */}
          <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider pt-2">2. Flex Specifications</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Width (ft)</label>
              <input
                type="number"
                required
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Height (ft)</label>
              <input
                type="number"
                required
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Monthly Rate (₹)</label>
              <input
                type="number"
                required
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Night Lighting</label>
              <select
                value={lighting ? 'yes' : 'no'}
                onChange={(e) => setLighting(e.target.value === 'yes')}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              >
                <option value="yes">Yes (Equipped with Lights)</option>
                <option value="no">No (Non-lit Board)</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Road Visibility</label>
              <select
                value={roadVisibility}
                onChange={(e) => setRoadVisibility(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500"
              >
                <option value="High">High Visibility</option>
                <option value="Medium">Medium Visibility</option>
                <option value="Low">Low Visibility</option>
              </select>
            </div>
          </div>

          {/* Photo Preview & Replace */}
          <div>
            <label className="text-slate-400 block mb-1">Billboard Photo</label>
            <div className="flex items-center gap-4">
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Site Preview"
                  className="w-24 h-16 object-cover rounded-lg border border-slate-800 shrink-0"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
              />
            </div>
          </div>

          {/* AI Valuation Engine Section */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Gemini AI Valuation Engine[cite: 1]
              </span>
              <button
                type="button"
                onClick={handleAiValuation}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Re-calculate AI Valuation'}
              </button>
            </div>

            {aiResult && (
              <div>
                <p className="text-[11px] text-slate-300 mb-2">{aiResult.reason}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Traffic Score[cite: 1]</div>
                    <div className="text-cyan-400 font-bold">{aiResult.trafficScore}/100</div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Visibility Score[cite: 1]</div>
                    <div className="text-cyan-400 font-bold">{aiResult.visibilityScore}/100</div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px]">Location Score[cite: 1]</div>
                    <div className="text-cyan-400 font-bold">{aiResult.locationScore}/100</div>
                  </div>
                  <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                    <div className="text-slate-400 text-[10px]">AI Suggested Rate[cite: 1]</div>
                    <div className="text-emerald-400 font-bold">₹{Number(aiResult.aiSuggestedRate).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-800">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Complete Billboard Details'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}