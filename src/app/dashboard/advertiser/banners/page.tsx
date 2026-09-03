'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import {
  Calendar,
  CreditCard,
  MapPin,
  MessageSquare,
  ShieldCheck,
  UploadCloud,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface BookingRecord {
  id: string;
  space_id: string;
  advertiser_id: string;
  duration_months: number;
  total_amount: number;
  payment_status: string;
  payment_id?: string;
  banner_image_url?: string;
  ad_image_url?: string;
  created_at: string;
  spaces?: {
    id: string;
    area: string;
    city: string;
    address?: string;
    width: number;
    height: number;
    monthly_rate: number;
    space_photo_url?: string;
    map_link?: string;
    owner_id: string;
  } | null;
}

export default function AdvertiserBannersPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Unread badge counts per booking/space
  const [ownerUnreadCounts, setOwnerUnreadCounts] = useState<{ [bookingId: string]: number }>({});
  const [adminUnreadCounts, setAdminUnreadCounts] = useState<{ [bookingId: string]: number }>({});

  const [activeChat, setActiveChat] = useState<{
    spaceId: string;
    spaceTitle: string;
    recipientId?: string;
    recipientName?: string;
    channelType: 'owner_admin' | 'advertiser_owner' | 'advertiser_admin';
    bookingId?: string;
  } | null>(null);

  const fetchUnreadCounts = useCallback(async (userId: string, currentBookings: BookingRecord[]) => {
    if (!currentBookings || currentBookings.length === 0) return;

    const bookingIds = currentBookings.map((b) => b.id);
    const spaceIds = Array.from(new Set(currentBookings.map((b) => b.space_id)));

    const { data: unreadMsgs } = await supabase
      .from('space_chat_messages')
      .select('space_id, booking_id, channel_type, sender_id')
      .in('channel_type', ['advertiser_owner', 'advertiser_admin'])
      .eq('is_read', false)
      .neq('sender_id', userId);

    const ownerCounts: { [key: string]: number } = {};
    const adminCounts: { [key: string]: number } = {};

    unreadMsgs?.forEach((m) => {
      // Find matching booking
      const matched = currentBookings.find(
        (b) => (m.booking_id && b.id === m.booking_id) || b.space_id === m.space_id
      );
      if (!matched) return;

      if (m.channel_type === 'advertiser_owner') {
        ownerCounts[matched.id] = (ownerCounts[matched.id] || 0) + 1;
      } else if (m.channel_type === 'advertiser_admin') {
        adminCounts[matched.id] = (adminCounts[matched.id] || 0) + 1;
      }
    });

    setOwnerUnreadCounts(ownerCounts);
    setAdminUnreadCounts(adminCounts);
  }, []);

  const loadPurchasedBanners = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user) {
      setLoading(false);
      return;
    }

    setCurrentUser(authData.user);

    try {
      const { data: bookingsData, error: bookingErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('advertiser_id', authData.user.id)
        .order('created_at', { ascending: false });

      if (bookingErr || !bookingsData || bookingsData.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const spaceIds = Array.from(new Set(bookingsData.map((b) => b.space_id).filter(Boolean)));

      let spacesMap: Record<string, any> = {};
      if (spaceIds.length > 0) {
        const { data: spacesData } = await supabase
          .from('spaces')
          .select('id, area, city, address, width, height, monthly_rate, space_photo_url, map_link, owner_id')
          .in('id', spaceIds);

        if (spacesData) {
          spacesMap = spacesData.reduce((acc, sp) => {
            acc[sp.id] = sp;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const formatted = bookingsData.map((b) => ({
        ...b,
        spaces: spacesMap[b.space_id] || null,
      })) as BookingRecord[];

      setBookings(formatted);
      await fetchUnreadCounts(authData.user.id, formatted);
    } catch (err) {
      console.error('[Error loading banners]:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchUnreadCounts]);

  useEffect(() => {
    loadPurchasedBanners();
  }, [loadPurchasedBanners]);

  // Real-time listener for incoming messages to update unread badge on buttons
  useEffect(() => {
    if (!currentUser?.id || bookings.length === 0) return;

    const channel = supabase
      .channel(`advertiser_chat_badges_${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'space_chat_messages' },
        () => {
          fetchUnreadCounts(currentUser.id, bookings);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, bookings, fetchUnreadCounts]);

  const handleImageReplace = async (bookingId: string, file: File) => {
    try {
      setUploadingId(bookingId);
      const ext = file.name.split('.').pop();
      const fileName = `banner_${bookingId}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('banners')
        .upload(fileName, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from('banners').getPublicUrl(fileName);
      const publicUrl = publicData.publicUrl;

      await supabase
        .from('bookings')
        .update({
          banner_image_url: publicUrl,
          ad_image_url: publicUrl,
        })
        .eq('id', bookingId);

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, banner_image_url: publicUrl, ad_image_url: publicUrl }
            : b
        )
      );
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingId(null);
    }
  };

  const calculateDueDate = (createdAt: string, durationMonths: number) => {
    const start = new Date(createdAt);
    const due = new Date(start);
    due.setMonth(due.getMonth() + (durationMonths || 1));

    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      formattedDate: due.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      daysLeft: diffDays,
      isExpired: diffDays <= 0,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Purchased Banners & Subscriptions</h1>
          <p className="text-xs text-slate-400">
            Monitor active billboard installations, track lease expiry dates, manage banners, and contact property owners.
          </p>
        </div>
        <Link
          href="/dashboard/advertiser"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
        >
          + Rent Another Space
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-500 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs">Loading your purchased billboards...</span>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">No Billboard Bookings Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You haven't rented any billboard spaces yet. Browse available inventory on the dashboard to start advertising.
          </p>
          <Link
            href="/dashboard/advertiser"
            className="inline-block mt-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-500 transition"
          >
            Explore Billboards
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => {
            const space = booking.spaces;
            const currentAdImage = booking.banner_image_url || booking.ad_image_url;
            const dueInfo = calculateDueDate(booking.created_at, booking.duration_months);
            const spaceName = space ? `${space.area}, ${space.city}` : 'Billboard Space';

            const hasOwnerUnread = (ownerUnreadCounts[booking.id] || 0) > 0;
            const hasAdminUnread = (adminUnreadCounts[booking.id] || 0) > 0;

            return (
              <div
                key={booking.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl"
              >
                {/* Top Status Strip */}
                <div className="bg-slate-950/70 px-6 py-3.5 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
                      ID: #{booking.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" /> Booked On:{' '}
                      {new Date(booking.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {dueInfo.isExpired ? (
                      <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full text-[11px] font-bold">
                        Lease Expired
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active ({dueInfo.daysLeft} days remaining)
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Billboard & Ad Creative Visuals */}
                  <div className="lg:col-span-5 space-y-4">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                        Active Live Banner Graphic
                      </span>
                      <div className="relative h-52 w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 group">
                        {currentAdImage ? (
                          <img
                            src={currentAdImage}
                            alt="Uploaded Banner Graphic"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                            <UploadCloud className="w-8 h-8 text-slate-600 mb-1.5" />
                            <span className="text-xs text-slate-400 font-medium">No graphic uploaded yet</span>
                            <span className="text-[10px] text-slate-600 mt-0.5">Please upload your billboard creative</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                            {uploadingId === booking.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UploadCloud className="w-3.5 h-3.5" />
                            )}
                            {currentAdImage ? 'Replace Image' : 'Upload Banner'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageReplace(booking.id, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                          {currentAdImage && (
                            <a
                              href={currentAdImage}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Physical Dimensions</span>
                        <span className="font-semibold text-slate-200">{space?.width || 0} × {space?.height || 0} ft</span>
                      </div>
                      {space?.map_link && (
                        <a
                          href={space.map_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium text-[11px]"
                        >
                          <MapPin className="w-3 h-3" /> View on Map
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Middle Column */}
                  <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {space?.area || 'Billboard Spot'}, {space?.city || 'Location'}
                      </h2>
                      {space?.address && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{space.address}</p>
                      )}

                      <div className="mt-4 space-y-2.5">
                        <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/50 rounded-xl border border-slate-800/60">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> Amount Paid:
                          </span>
                          <span className="font-bold text-cyan-400">
                            ₹{Number(booking.total_amount).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/50 rounded-xl border border-slate-800/60">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Rental Term:
                          </span>
                          <span className="font-semibold text-slate-200">
                            {booking.duration_months} Month(s)
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs p-2.5 bg-slate-950/50 rounded-xl border border-slate-800/60">
                          <span className="text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" /> Expiry Due Date:
                          </span>
                          <span className="font-bold text-amber-300">
                            {dueInfo.formattedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl text-[11px] text-indigo-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Verified invoice sent to registered email address.</span>
                    </div>
                  </div>

                  {/* Right Column: Communication Hub with Live Badges */}
                  <div className="lg:col-span-3 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-6 space-y-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                        Direct Support & Inquiries
                      </span>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Need flex replacement, physical inspection updates, or lease renewals?
                      </p>
                    </div>

                    <div className="space-y-2 w-full">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveChat({
                            spaceId: booking.space_id,
                            spaceTitle: spaceName,
                            recipientId: space?.owner_id || '',
                            recipientName: space?.area ? `${space.area} Owner` : 'Space Owner',
                            channelType: 'advertiser_owner',
                            bookingId: booking.id,
                          })
                        }
                        className="relative w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                        Chat with Space Owner
                        {hasOwnerUnread && (
                          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveChat({
                            spaceId: booking.space_id,
                            spaceTitle: `${spaceName} (Support)`,
                            recipientId: 'admin',
                            recipientName: 'Platform Support & Admin',
                            channelType: 'advertiser_admin',
                            bookingId: booking.id,
                          })
                        }
                        className="relative w-full py-2.5 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-indigo-500/30 transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                        Chat with Support / Admin
                        {hasAdminUnread && (
                          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeChat && currentUser && (
        <SpaceChatModal
          spaceId={activeChat.spaceId}
          spaceTitle={activeChat.spaceTitle}
          currentUser={currentUser}
          recipientId={activeChat.recipientId}
          recipientName={activeChat.recipientName}
          channelType={activeChat.channelType}
          bookingId={activeChat.bookingId}
          onClose={() => {
            setActiveChat(null);
            if (currentUser?.id) {
              fetchUnreadCounts(currentUser.id, bookings);
            }
          }}
        />
      )}
    </div>
  );
}