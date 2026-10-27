"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { responseData } from "@/lib/api";
import { useOptionalBrokerage } from "@/components/app/brokerage-context";

/** Chat data: the inbox comes from the API; messages arrive live through Supabase Realtime. */

export type ChatMember = { id: string; full_name: string; role: string | null; chat_role: "ADMIN" | "MEMBER"; last_read_at: string };
export type ChatMessage = {
  id: string; conversation_id: string; sender_id: string; body: string; created_at: string; pending?: boolean; failed?: boolean;
  /** Client-only: a stable render key (the optimistic id) and whether it arrived live, so it animates in once. */
  key?: string; fresh?: boolean;
};
export type Conversation = {
  id: string; kind: "DIRECT" | "GROUP"; team_id: string | null; name: string; photo_url: string | null;
  last_message: ChatMessage | null; last_message_at: string; unread: number; my_role: "ADMIN" | "MEMBER";
  members: ChatMember[]; other: ChatMember | null;
};
export type Contact = { id: string; full_name: string; role: string; department: string | null };
export type Inbox = { me: string; conversations: Conversation[]; contacts: Contact[]; unread: number };

export const inboxKey = ["chat", "inbox"] as const;

export function useInbox(enabled = true) {
  const brokerage = useOptionalBrokerage();
  return useQuery({
    queryKey: inboxKey,
    queryFn: async () => responseData<Inbox>(await brokerage!.api("/api/v1/chat/inbox")),
    enabled: enabled && Boolean(brokerage),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

/** Every new message the viewer may read (row-level security filters the stream to their conversations). */
export function useChatStream(onMessage: (message: ChatMessage) => void, enabled = true) {
  const handler = useRef(onMessage);
  useEffect(() => { handler.current = onMessage; }, [onMessage]);
  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const channel = supabase.channel(`chat-stream-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => handler.current(payload.new as ChatMessage))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [enabled]);
}

/** Unread count for the sidebar badge, kept live. */
export function useChatUnread(enabled: boolean) {
  const queryClient = useQueryClient();
  const inbox = useInbox(enabled);
  useChatStream(() => { void queryClient.invalidateQueries({ queryKey: inboxKey }); }, enabled);
  return inbox.data?.unread ?? 0;
}

/** "Someone is typing…" for one conversation, over a private Realtime broadcast channel (members only, see migration 017). */
export function useTyping(conversationId: string, me: string, myName: string) {
  const supabase = useMemo(() => createClient(), []);
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // A private channel checks membership at join, so the signed-in token must be on the socket first.
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase.channel(`typing:${conversationId}`, { config: { private: true, broadcast: { self: false } } })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload.user_id === me) return;
          setTyping((current) => ({ ...current, [payload.user_id]: { name: payload.name, until: Date.now() + 3500 } }));
        })
        .subscribe();
      channelRef.current = channel;
    });
    const sweep = setInterval(() => setTyping((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value.until > Date.now()))), 1000);
    return () => { cancelled = true; clearInterval(sweep); if (channel) void supabase.removeChannel(channel); channelRef.current = null; setTyping({}); };
  }, [conversationId, me, supabase]);
  const notify = () => {
    if (Date.now() - lastSent.current < 1500) return;
    lastSent.current = Date.now();
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { user_id: me, name: myName } });
  };
  return { typingNames: Object.values(typing).map((value) => value.name), notify };
}

/** Sends straight to the database (row-level security checks membership), so it shows up instantly for everyone. */
export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("chat_messages").insert({ conversation_id: conversationId, sender_id: senderId, body }).select().single();
  if (error) throw new Error(error.message.includes("row-level security") ? "You can't send messages in this conversation." : error.message);
  return data as ChatMessage;
}

export async function markRead(conversationId: string) {
  const supabase = createClient();
  await supabase.rpc("mark_chat_read", { conversation: conversationId });
}
