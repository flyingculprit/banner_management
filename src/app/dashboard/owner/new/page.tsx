'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from './new-board.module.css';
import { ArrowLeft, Sparkles, UploadCloud, Loader2, CheckCircle2 } from 'lucide-react';

export default function AddBoardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  // Form Fields
  const [district, setDistrict] = useState('Karur');
  const [city, setCity] = useState('Karur');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [width, setWidth] = useState('20');
  const [height, setHeight] = useState('10');
  const [monthlyRate, setMonthlyRate] = useState('15000');
  const [lighting, setLighting] = useState(false);
  const [roadVisibility, setRoadVisibility] = useState('High');

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // AI Valuation State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/signin');
      else setUser(user);
    });
  }, [router]);

  // Run AI Valuation via Gemini 2.5 Flash
  const handleAiValuation = async () => {
    if (!area || !address) {
      alert('Please fill Area and Address before running AI Valuation');
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
      if (!res.ok) throw new Error(data.error);
      setAiResult(data);
    } catch (err: any) {
      alert('AI Valuation error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Submit Listing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUploading(true);

    try {
      let photoUrl = '';

      // Upload space photo to Supabase storage
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('billboards')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('billboards')
          .getPublicUrl(fileName);

        photoUrl = publicData.publicUrl;
      }

      // Insert Billboard record
      const { error: insertError } = await supabase.from('spaces').insert({
        owner_id: user.id,
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
        ai_suggested_rate: aiResult?.aiSuggestedRate || null,
        lighting,
        road_visibility: roadVisibility,
        space_photo_url: photoUrl,
        traffic_score: aiResult?.trafficScore || 0,
        visibility_score: aiResult?.visibilityScore || 0,
        demand_score: aiResult?.demandScore || 0,
        location_score: aiResult?.locationScore || 0,
        ai_analysis_raw: aiResult || null,
        status: 'pending', // Pending Admin approval
      });

      if (insertError) throw insertError;

      alert('Advertisement Space listed successfully! Pending Admin verification.');
      router.push('/dashboard/owner');
    } catch (err: any) {
      alert('Failed to save flex board: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <Link href="/dashboard/owner" className={styles.backBtn}>
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className={styles.header}>
          <h1 className={styles.title}>Add New Advertisement Space</h1>
          <p className={styles.subtitle}>Provide location specifics, physical dimensions, and run Gemini AI valuation[cite: 1].</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.card}>
          <div className={styles.sectionTitle}>1. Location Details</div>
          <div className={styles.grid3}>
            <div className={styles.formGroup}>
              <label className={styles.label}>District</label>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>City / Town</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Area / Junction</label>
              <input
                type="text"
                required
                placeholder="e.g. Bus Stand / Roundabout"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Exact Address</label>
              <input
                type="text"
                required
                placeholder="Near Old Bus Stand Main Entrance"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Prominent Landmark</label>
              <input
                type="text"
                placeholder="Opposite to Clock Tower"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.grid3}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Google Maps Link</label>
              <input
                type="url"
                placeholder="https://maps.app.goo.gl/..."
                value={mapLink}
                onChange={(e) => setMapLink(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Latitude (Optional)</label>
              <input
                type="number"
                step="any"
                placeholder="10.9603"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Longitude (Optional)</label>
              <input
                type="number"
                step="any"
                placeholder="78.0764"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>2. Physical Flex Specifications</div>
          <div className={styles.grid3}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Width (in feet)</label>
              <input
                type="number"
                required
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Height (in feet)</label>
              <input
                type="number"
                required
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Road Visibility</label>
              <select
                value={roadVisibility}
                onChange={(e) => setRoadVisibility(e.target.value)}
                className={styles.select}
              >
                <option value="High">High Visibility</option>
                <option value="Medium">Medium Visibility</option>
                <option value="Low">Low Visibility</option>
              </select>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Monthly Rate (₹)</label>
              <input
                type="number"
                required
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Night Lighting / Backlit</label>
              <select
                value={lighting ? 'yes' : 'no'}
                onChange={(e) => setLighting(e.target.value === 'yes')}
                className={styles.select}
              >
                <option value="yes">Yes (Equipped with Lights)</option>
                <option value="no">No (Non-lit Board)</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
            <label className={styles.label}>Space Photo</label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className={styles.input}
            />
          </div>

          {/* AI Valuation Section */}
          <div className={styles.aiBox}>
            <div className={styles.aiHeader}>
              <span className={styles.aiBadge}>
                <Sparkles className="w-4 h-4 text-cyan-400" />
                Gemini AI Valuation Engine[cite: 1]
              </span>
              <button
                type="button"
                onClick={handleAiValuation}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Run AI Analysis'}
              </button>
            </div>

            {aiResult ? (
              <div>
                <p className="text-xs text-slate-300 mb-2">{aiResult.reason}</p>
                <div className={styles.aiScoresGrid}>
                  <div className={styles.scoreItem}>
                    <div className={styles.scoreValue}>{aiResult.trafficScore}/100</div>
                    <div className={styles.scoreLabel}>Traffic Score[cite: 1]</div>
                  </div>
                  <div className={styles.scoreItem}>
                    <div className={styles.scoreValue}>{aiResult.visibilityScore}/100</div>
                    <div className={styles.scoreLabel}>Visibility Score[cite: 1]</div>
                  </div>
                  <div className={styles.scoreItem}>
                    <div className={styles.scoreValue}>{aiResult.demandScore}/100</div>
                    <div className={styles.scoreLabel}>Demand Score[cite: 1]</div>
                  </div>
                  <div className={styles.scoreItem}>
                    <div className={styles.scoreValue} style={{ color: '#34d399' }}>
                      ₹{aiResult.aiSuggestedRate?.toLocaleString()}
                    </div>
                    <div className={styles.scoreLabel}>AI Suggested Rate[cite: 1]</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Click "Run AI Analysis" to predict visibility scores and recommended pricing via Gemini[cite: 1].
              </p>
            )}
          </div>

          <button type="submit" disabled={uploading} className={styles.submitBtn}>
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit for Admin Approval'}
          </button>
        </form>
      </div>
    </div>
  );
}