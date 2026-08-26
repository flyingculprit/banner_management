'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/context/NotificationContext';
import { X, Send, Loader2 } from 'lucide-react';

interface SpaceChatModalProps {
  spaceId: string;
  spaceTitle: string;
  currentUser: any;
  channelType: 'owner_admin' | 'advertiser_owner' | 'advertiser_admin';
  bookingId?: string;
  onClose: () => void;
}

export default function SpaceChatModal({
  spaceId,
  spaceTitle,
  currentUser,
  channelType,
  bookingId,
  onClose,
}: SpaceChatModalProps) {
  const { refreshUnread } = useNotifications();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    let query = supabase
      .from('space_chat_messages')
      .select('*, profiles:sender_id(full_name, role)')
      .eq('space_id', spaceId)
      .eq('channel_type', channelType);

    if (bookingId) {
      query = query.eq('booking_id', bookingId);
    }

    const fetchMessages = async () => {
      setLoading(true);
      const { data } = await query.order('created_at', { ascending: true });
      if (data) setMessages(data);

      // Mark unread messages sent by others as read
      await supabase
        .from('space_chat_messages')
        .update({ is_read: true })
        .eq('space_id', spaceId)
        .eq('channel_type', channelType)
        .neq('sender_id', currentUser.id);

      await refreshUnread();
      setLoading(false);
      scrollToBottom();
    };

    fetchMessages();

    // Subscribe to WebSocket Realtime updates
    const channelName = `chat-${spaceId}-${channelType}-${bookingId || 'main'}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'space_chat_messages',
          filter: `space_id=eq.${spaceId}`,
        },
        async (payload) => {
          if (payload.new.channel_type === channelType) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, role')
              .eq('id', payload.new.sender_id)
              .single();

            const incoming = { ...payload.new, profiles: profile };
            setMessages((prev) => [...prev, incoming]);

            if (payload.new.sender_id !== currentUser.id) {
              await supabase
                .from('space_chat_messages')
                .update({ is_read: true })
                .eq('id', payload.new.id);

              await refreshUnread();
            }
            scrollToBottom();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, channelType, bookingId, currentUser.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const text = newMessage;
    setNewMessage('');

    const { error } = await supabase.from('space_chat_messages').insert({
      space_id: spaceId,
      sender_id: currentUser.id,
      message: text,
      channel_type: channelType,
      booking_id: bookingId || null,
      is_read: false,
    });

    if (error) {
      alert('Failed to send message: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[85vh] sm:h-[520px]">
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-xs sm:text-base">
              {channelType === 'owner_admin' && 'Owner ↔ Admin Verification Chat'}
              {channelType === 'advertiser_owner' && 'Advertiser ↔ Board Owner Chat'}
              {channelType === 'advertiser_admin' && 'Advertiser ↔ Support Admin Chat'}
            </h3>
            <p className="text-[11px] text-slate-400 line-clamp-1">{spaceTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading discussion...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
              No previous messages. Start the conversation below.
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUser.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] text-slate-400 mb-1 px-1">
                    {msg.profiles?.full_name || 'User'} ({msg.profiles?.role?.toUpperCase()})
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                    }`}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-2.5 sm:p-3 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            required
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </form>
      </div>
    </div>
  );
}