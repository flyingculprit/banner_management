'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolvedRecipientId, setResolvedRecipientId] = useState<string | null>(
    recipientId && recipientId !== 'admin' ? recipientId : null
  );
  const [resolvedRecipientName, setResolvedRecipientName] = useState<string | null>(
    recipientName || null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const buildConvoKey = useCallback(() => {
    if (channelType === 'owner_admin') {
      return `owner_admin_${spaceId}`;
    }
    if (channelType === 'advertiser_admin') {
      return bookingId ? `adv_admin_booking_${bookingId}` : `adv_admin_${spaceId}`;
    }
    if (channelType === 'advertiser_owner') {
      return bookingId ? `adv_owner_booking_${bookingId}` : `space_chat_${spaceId}`;
    }
    return `space_chat_${spaceId}`;
  }, [channelType, spaceId, bookingId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

const markMessagesAsRead = useCallback(
    async (convoKey: string) => {
      if (!currentUser?.id) return;

      // 1. Primary update matching specific conversation_key
      await supabase
        .from('space_chat_messages')
        .update({ is_read: true })
        .eq('conversation_key', convoKey)
        .neq('sender_id', currentUser.id)
        .eq('is_read', false);

      // 2. Comprehensive update matching space_id and channel_type (handles both booking and non-booking threads)
      if (spaceId && channelType) {
        await supabase
          .from('space_chat_messages')
          .update({ is_read: true })
          .eq('space_id', spaceId)
          .eq('channel_type', channelType)
          .neq('sender_id', currentUser.id)
          .eq('is_read', false);
      }
    },
    [currentUser?.id, spaceId, channelType]
  );

  useEffect(() => {
    if (!currentUser?.id) return;

    let isSubscribed = true;
    let channel: any = null;

    const setupChat = async () => {
      setLoading(true);
      let targetId = recipientId && recipientId !== 'admin' ? recipientId : null;
      let targetName = recipientName;

      // 1. Resolve Admin UUID if chatting with admin/support
      if (channelType === 'advertiser_admin' || recipientId === 'admin') {
        const { data: adminUser } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();

        if (adminUser) {
          targetId = adminUser.id;
          targetName = adminUser.full_name || 'Platform Admin';
        }
      }
      // 2. Resolve target ID for owner_admin conversations
      else if (channelType === 'owner_admin') {
        const { data: spaceData } = await supabase
          .from('spaces')
          .select('owner_id, profiles:owner_id(full_name)')
          .eq('id', spaceId)
          .single();

        if (currentUser?.id === spaceData?.owner_id) {
          const { data: adminUser } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'admin')
            .limit(1)
            .maybeSingle();

          targetId = adminUser?.id || null;
          targetName = adminUser?.full_name || 'Admin Support';
        } else {
          targetId = spaceData?.owner_id || null;
          targetName = (spaceData?.profiles as any)?.full_name || 'Board Owner';
        }
      }

      if (!isSubscribed) return;
      setResolvedRecipientId(targetId || null);
      setResolvedRecipientName(targetName || null);

      const convoKey = buildConvoKey();

      // Fetch message history strictly isolated by channel_type
      let query = supabase
        .from('space_chat_messages')
        .select('*, profiles:sender_id(full_name, role)')
        .eq('channel_type', channelType);

      if (bookingId) {
        query = query.or(`conversation_key.eq.${convoKey},booking_id.eq.${bookingId}`);
      } else {
        query = query.eq('conversation_key', convoKey);
      }

      const { data } = await query.order('created_at', { ascending: true });

      if (isSubscribed && data) {
        setMessages(data);
      }

      await markMessagesAsRead(convoKey);

      if (isSubscribed) setLoading(false);
      scrollToBottom();

      // Realtime listener isolated by conversation key and channel_type
      const topic = `modal_${channelType}_${convoKey.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
      channel = supabase
        .channel(topic)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'space_chat_messages',
          },
          async (payload: any) => {
            const isMatchChannel = payload.new.channel_type === channelType;
            const isMatchConvo =
              payload.new.conversation_key === convoKey ||
              (bookingId && payload.new.booking_id === bookingId && isMatchChannel);

            if (!isMatchChannel || !isMatchConvo) return;

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

              if (payload.new.sender_id !== currentUser?.id) {
                await supabase
                  .from('space_chat_messages')
                  .update({ is_read: true })
                  .eq('id', payload.new.id);
              }
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
  }, [
    spaceId,
    channelType,
    bookingId,
    recipientId,
    currentUser?.id,
    recipientName,
    buildConvoKey,
    markMessagesAsRead,
  ]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser?.id) return;

    let targetReceiverId = resolvedRecipientId;

    if (!targetReceiverId || targetReceiverId === 'admin') {
      const { data: adminUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();
      targetReceiverId = adminUser?.id || null;
    }

    const text = newMessage;
    setNewMessage('');
    const convoKey = buildConvoKey();

    const { error } = await supabase.from('space_chat_messages').insert({
      space_id: spaceId,
      sender_id: currentUser.id,
      receiver_id: targetReceiverId,
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
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              {channelType.includes('admin') ? (
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              ) : (
                <User className="w-4 h-4 text-indigo-400" />
              )}
              <h3 className="font-bold text-white text-xs sm:text-sm">
                {resolvedRecipientName ? `Chat with ${resolvedRecipientName}` : 'Billboard Chat Channel'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{spaceTitle}</p>
          </div>
          <button
            onClick={async () => {
              await markMessagesAsRead(buildConvoKey());
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
              Private channel initialized. Send a message to start conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUser?.id;
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