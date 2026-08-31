'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/context/NotificationContext';
import { X, Send, Loader2, ShieldCheck, User } from 'lucide-react';

interface SpaceChatModalProps {
  spaceId: string;
  spaceTitle: string;
  currentUser: any;
  recipientId?: string;
  recipientName?: string;
  channelType: 'owner_admin' | 'advertiser_owner' | 'advertiser_admin';
  bookingId?: string;
  onClose: () => void;
}

export default function SpaceChatModal({
  spaceId,
  spaceTitle,
  currentUser,
  recipientId,
  recipientName,
  channelType,
  bookingId,
  onClose,
}: SpaceChatModalProps) {
  const { refreshUnread } = useNotifications();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolvedRecipientId, setResolvedRecipientId] = useState<string | null>(recipientId || null);
  const [resolvedRecipientName, setResolvedRecipientName] = useState<string | null>(recipientName || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const buildConvoKey = (targetRecId: string | null) => {
    if (channelType === 'owner_admin') {
      return `owner_admin_${spaceId}`;
    }
    if (channelType === 'advertiser_admin') {
      const advId = currentUser.user_metadata?.role === 'admin' ? targetRecId : currentUser.id;
      return `advertiser_admin_${spaceId}_${advId}`;
    }
    // advertiser_owner
    if (bookingId) {
      return `adv_owner_booking_${bookingId}`;
    }
    const advId = currentUser.user_metadata?.role === 'owner' ? targetRecId : currentUser.id;
    return `adv_owner_${spaceId}_${advId}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    let isSubscribed = true;
    let channel: any = null;

    const setupChat = async () => {
      setLoading(true);
      let targetId = recipientId;
      let targetName = recipientName;

      // 1. Resolve Recipient if not passed explicitly
      if (!targetId) {
        if (channelType === 'owner_admin') {
          if (currentUser.user_metadata?.role !== 'admin') {
            const { data: adminUser } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle();
            targetId = adminUser?.id;
            targetName = adminUser?.full_name || 'Admin Support';
          } else {
            const { data: spaceData } = await supabase
              .from('spaces')
              .select('owner_id, profiles:owner_id(full_name)')
              .eq('id', spaceId)
              .single();
            targetId = spaceData?.owner_id;
            targetName = (spaceData?.profiles as any)?.full_name || 'Board Owner';
          }
        } else if (channelType === 'advertiser_admin') {
          if (currentUser.user_metadata?.role !== 'admin') {
            const { data: adminUser } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle();
            targetId = adminUser?.id;
            targetName = adminUser?.full_name || 'Admin Support';
          }
        } else if (channelType === 'advertiser_owner') {
          if (currentUser.user_metadata?.role === 'advertiser') {
            const { data: spaceData } = await supabase
              .from('spaces')
              .select('owner_id, profiles:owner_id(full_name)')
              .eq('id', spaceId)
              .single();
            targetId = spaceData?.owner_id;
            targetName = (spaceData?.profiles as any)?.full_name || 'Board Owner';
          }
        }
      }

      if (!isSubscribed) return;
      setResolvedRecipientId(targetId || null);
      setResolvedRecipientName(targetName || null);

      const convoKey = buildConvoKey(targetId || null);

      // 2. Load Existing Messages
      const { data } = await supabase
        .from('space_chat_messages')
        .select('*, profiles:sender_id(full_name, role)')
        .eq('conversation_key', convoKey)
        .order('created_at', { ascending: true });

      if (isSubscribed && data) {
        setMessages(data);
      }

      // 3. Mark unread as read
      await supabase
        .from('space_chat_messages')
        .update({ is_read: true })
        .eq('conversation_key', convoKey)
        .neq('sender_id', currentUser.id);

      await refreshUnread();
      if (isSubscribed) setLoading(false);
      scrollToBottom();

      // 4. Safe Single-Chain Realtime Setup
      const uniqueTopic = `chat_${convoKey}_${Math.random().toString(36).substring(2, 9)}`;
      channel = supabase
        .channel(uniqueTopic)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'space_chat_messages',
            filter: `conversation_key=eq.${convoKey}`,
          },
          async (payload: any) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, role')
              .eq('id', payload.new.sender_id)
              .single();

            const incoming = { ...payload.new, profiles: profile };
            if (isSubscribed) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
            }

            if (payload.new.sender_id !== currentUser.id) {
              await supabase
                .from('space_chat_messages')
                .update({ is_read: true })
                .eq('id', payload.new.id);
              await refreshUnread();
            }
            scrollToBottom();
          }
        )
        .subscribe();
    };

    setupChat();

    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [spaceId, channelType, bookingId, recipientId, currentUser.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    const text = newMessage;
    setNewMessage('');
    const convoKey = buildConvoKey(resolvedRecipientId);

    const { error } = await supabase.from('space_chat_messages').insert({
      space_id: spaceId,
      sender_id: currentUser.id,
      receiver_id: resolvedRecipientId,
      conversation_key: convoKey,
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
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col h-[85vh] sm:h-[540px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              {channelType.includes('admin') ? (
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              ) : (
                <User className="w-4 h-4 text-indigo-400" />
              )}
              <h3 className="font-bold text-white text-xs sm:text-sm">
                {channelType === 'owner_admin' && (resolvedRecipientName ? `Chat with ${resolvedRecipientName}` : 'Owner ↔ Admin Chat')}
                {channelType === 'advertiser_owner' && (resolvedRecipientName ? `Chat with Owner (${resolvedRecipientName})` : 'Advertiser ↔ Owner Chat')}
                {channelType === 'advertiser_admin' && (resolvedRecipientName ? `Support Chat: ${resolvedRecipientName}` : 'Advertiser ↔ Support Admin')}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{spaceTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading private discussion...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
              Private channel initialized. Send a message to start conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUser.id;
              const senderRole = msg.profiles?.role || 'user';
              const senderName = isMe ? 'You' : msg.profiles?.full_name || 'User';

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] text-slate-400 mb-1 px-1">
                    {senderName} ({senderRole.toUpperCase()})
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

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-2.5 sm:p-3 border-t border-slate-800 flex gap-2 bg-slate-950/40">
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