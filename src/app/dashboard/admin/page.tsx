'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import SpaceChatModal from '@/components/SpaceChatModal';
import { Layers, Clock, CheckCircle, Users, IndianRupee, MessageSquare, Bell } from 'lucide-react';

export default function AdminOverviewPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalSpaces: 0,
    pendingSpaces: 0,
    activeAds: 0,
    totalAdvertisers: 0,
    totalOwners: 0,
    totalRevenue: 0,
  });

  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeChatSpace, setActiveChatSpace] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      const { data: profiles } = await supabase.from('profiles').select('role');
      const { data: spaces } = await supabase.from('spaces').select('*, profiles:owner_id(full_name)');
      const { data: bookings } = await supabase.from('bookings').select('total_amount, status');

      const owners = profiles?.filter((p) => p.role === 'owner').length || 0;
      const advertisers = profiles?.filter((p) => p.role === 'advertiser').length || 0;
      const pending = spaces?.filter((s) => s.status === 'pending').length || 0;
      const active = bookings?.filter((b) => b.status === 'active').length || 0;
      const revenue = bookings?.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0) || 0;

      setStats({
        totalSpaces: spaces?.length || 0,
        pendingSpaces: pending,
        activeAds: active,
        totalAdvertisers: advertisers,
        totalOwners: owners,
        totalRevenue: revenue,
      });

      // Fetch unread messages as admin notifications
      const { data: recentMsgs } = await supabase
        .from('space_chat_messages')
        .select('*, spaces(area, city), profiles:sender_id(full_name, role)')
        .eq('is_read', false)
        .neq('sender_id', user?.id || '')
        .order('created_at', { ascending: false })
        .limit(6);

      setNotifications(recentMsgs || []);
    }

    loadData();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Platform Performance Overview</h1>
      <p className="text-xs text-slate-400 mb-8">Summary of registered spaces, bookings, and active campaigns.</p>

      {/* Stats Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <Layers className="w-4 h-4 text-indigo-400" /> Total Listed Spaces
          </div>
          <div className="text-2xl font-bold text-white mt-3">{stats.totalSpaces}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <Clock className="w-4 h-4 text-amber-400" /> Pending Space Approvals
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-3">{stats.pendingSpaces}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Active Rented Campaigns
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-3">{stats.activeAds}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <Users className="w-4 h-4 text-cyan-400" /> Registered Advertisers
          </div>
          <div className="text-2xl font-bold text-cyan-400 mt-3">{stats.totalAdvertisers}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <Users className="w-4 h-4 text-purple-400" /> Registered Board Owners
          </div>
          <div className="text-2xl font-bold text-purple-400 mt-3">{stats.totalOwners}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center gap-3 text-slate-400 text-xs">
            <IndianRupee className="w-4 h-4 text-emerald-400" /> Total Platform Volume
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-3">₹{stats.totalRevenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Live Chat Notification Activity Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-white text-base">Unread Chat Inquiries & Clarifications</h2>
        </div>

        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No unread chat inquiries. All discussions are up to date.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{n.profiles?.full_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 uppercase font-mono">
                      {n.profiles?.role}
                    </span>
                    <span className="text-xs text-indigo-400">• {n.spaces?.area}, {n.spaces?.city}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-1">{n.message}</p>
                </div>

                <button
                  onClick={() =>
                    setActiveChatSpace({
                      id: n.space_id,
                      area: n.spaces?.area,
                      city: n.spaces?.city,
                      channel_type: n.channel_type,
                    })
                  }
                  className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Respond
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeChatSpace && currentUser && (
        <SpaceChatModal
          spaceId={activeChatSpace.id}
          spaceTitle={`${activeChatSpace.area}, ${activeChatSpace.city}`}
          currentUser={currentUser}
          channelType={activeChatSpace.channel_type || 'owner_admin'}
          onClose={() => setActiveChatSpace(null)}
        />
      )}
    </div>
  );
}