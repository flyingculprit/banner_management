'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface NotificationContextType {
  unreadTotal: number;
  unreadBySpace: { [spaceId: string]: number };
  unreadByBooking: { [bookingId: string]: number };
  unreadByChannel: { [channel: string]: number };
  refreshUnread: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  unreadTotal: 0,
  unreadBySpace: {},
  unreadByBooking: {},
  unreadByChannel: {},
  refreshUnread: async () => {},
});

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unreadTotal, setUnreadTotal] = useState<number>(0);
  const [unreadBySpace, setUnreadBySpace] = useState<{ [spaceId: string]: number }>({});
  const [unreadByBooking, setUnreadByBooking] = useState<{ [bookingId: string]: number }>({});
  const [unreadByChannel, setUnreadByChannel] = useState<{ [channel: string]: number }>({});

  const fetchUnreadCounts = useCallback(async (userId: string, userRole?: string) => {
    if (!userId) return;

    let query = supabase
      .from('space_chat_messages')
      .select('id, space_id, booking_id, channel_type, sender_id, receiver_id, is_read')
      .eq('is_read', false)
      .neq('sender_id', userId);

    if (userRole === 'admin') {
      query = query.or(`receiver_id.eq.${userId},channel_type.eq.advertiser_admin,channel_type.eq.owner_admin`);
    } else {
      query = query.or(`receiver_id.eq.${userId},receiver_id.is.null`);
    }

    const { data: messages } = await query;

    if (messages) {
      setUnreadTotal(messages.length);

      const bySpace: { [key: string]: number } = {};
      const byBooking: { [key: string]: number } = {};
      const byChannel: { [key: string]: number } = {};

      messages.forEach((msg) => {
        if (msg.space_id) bySpace[msg.space_id] = (bySpace[msg.space_id] || 0) + 1;
        if (msg.booking_id) byBooking[msg.booking_id] = (byBooking[msg.booking_id] || 0) + 1;
        if (msg.channel_type) byChannel[msg.channel_type] = (byChannel[msg.channel_type] || 0) + 1;
      });

      setUnreadBySpace(bySpace);
      setUnreadByBooking(byBooking);
      setUnreadByChannel(byChannel);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const user = session.user;
        setCurrentUser(user);
        fetchUnreadCounts(user.id, user.user_metadata?.role);
      }
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const user = session.user;
        setCurrentUser(user);
        fetchUnreadCounts(user.id, user.user_metadata?.role);
      } else {
        setCurrentUser(null);
        setUnreadTotal(0);
        setUnreadBySpace({});
        setUnreadByBooking({});
        setUnreadByChannel({});
      }
    });

    const channelId = `global-notif-${Date.now()}`;
    const realtimeChannel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'space_chat_messages' },
        () => {
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) fetchUnreadCounts(user.id, user.user_metadata?.role);
          });
        }
      )
      .subscribe();

    return () => {
      authSub.subscription.unsubscribe();
      supabase.removeChannel(realtimeChannel);
    };
  }, [fetchUnreadCounts]);

  return (
    <NotificationContext.Provider
      value={{
        unreadTotal,
        unreadBySpace,
        unreadByBooking,
        unreadByChannel,
        refreshUnread: async () => {
          if (currentUser) {
            await fetchUnreadCounts(currentUser.id, currentUser.user_metadata?.role);
          }
        },
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);