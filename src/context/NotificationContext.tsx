'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadBySpace, setUnreadBySpace] = useState<{ [spaceId: string]: number }>({});
  const [unreadByBooking, setUnreadByBooking] = useState<{ [bookingId: string]: number }>({});
  const [unreadByChannel, setUnreadByChannel] = useState<{ [channel: string]: number }>({});

  const fetchUnreadCounts = async (userId: string) => {
    if (!userId) return;

    const { data: messages } = await supabase
      .from('space_chat_messages')
      .select('id, space_id, booking_id, channel_type, sender_id, is_read')
      .eq('is_read', false)
      .neq('sender_id', userId);

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
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchUnreadCounts(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        fetchUnreadCounts(session.user.id);
      } else {
        setCurrentUser(null);
        setUnreadTotal(0);
        setUnreadBySpace({});
        setUnreadByBooking({});
        setUnreadByChannel({});
      }
    });

    // Realtime WebSocket Subscription for Live Chat Alerts
    const channel = supabase
      .channel('global-chat-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'space_chat_messages' },
        () => {
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) fetchUnreadCounts(user.id);
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadTotal,
        unreadBySpace,
        unreadByBooking,
        unreadByChannel,
        refreshUnread: async () => {
          if (currentUser) await fetchUnreadCounts(currentUser.id);
        },
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);