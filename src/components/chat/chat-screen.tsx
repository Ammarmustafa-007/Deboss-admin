"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCheck, ImagePlus, MessageSquarePlus, MessagesSquare, Search, Send, Settings2, Smile, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { errorMessage, responseData } from "@/lib/api";
import { useSession } from "@/components/app/session";
import { Avatar, Card, EmptyState, Skeleton } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { TextField, controlClass } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { inboxKey, markRead, sendMessage, useChatApi, useChatStream, useInbox, useTyping, type ChatMessage, type Conversation } from "@/components/chat/chat-data";

const emojis = ["😀", "😂", "😊", "😍", "👍", "👏", "🙏", "🎉", "🔥", "✅", "❌", "⚠️", "🚚", "📦", "📞", "💰", "⏰", "📍", "🤝", "👀", "😅", "😢", "😡", "❤️"];

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function dayLabel(value: string) {
  const date = new Date(value); const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function listTime(value: string) {
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString() ? timeLabel(value) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChatAvatar({ conversation, size = "md" }: { conversation: Pick<Conversation, "kind" | "name" | "photo_url">; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11" : "h-10 w-10";
  if (conversation.photo_url) return <span className={cn("shrink-0 overflow-hidden rounded-full bg-line-soft", box)}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={conversation.photo_url} alt="" className="h-full w-full object-cover" /></span>;
  if (conversation.kind === "CHANNEL") return <span className={cn("grid shrink-0 place-items-center rounded-[12px] bg-brand-tint text-[15px] font-bold text-brand-deep", box)}>#</span>;
  if (conversation.kind === "GROUP") return <span className={cn("grid shrink-0 place-items-center rounded-full bg-aqua/15 text-aqua", box)}><UsersRound size={18} /></span>;
  return <Avatar name={conversation.name} className={box} />;
}

/** Inbox and conversation. On wide screens they sit side by side, like a desktop chat app; on phones one at a time. */
export function ChatScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get("c");
  const inbox = useInbox();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const conversations = useMemo(() => inbox.data?.conversations ?? [], [inbox.data]);
  const active = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const open = useCallback((id: string | null) => router.replace(id ? `/app/chat?c=${id}` : "/app/chat", { scroll: false }), [router]);
  useChatStream(() => { void queryClient.invalidateQueries({ queryKey: inboxKey }); });

  const term = search.trim().toLowerCase();
  // Company channels stay pinned at the top (Announcements, Quotes, Updates), then everything else by latest message.
  const channelOrder = { ANNOUNCEMENTS: 0, QUOTES: 1, UPDATES: 2 } as const;
  const visible = conversations.filter((conversation) => !term || conversation.name.toLowerCase().includes(term))
    .sort((left, right) => (left.channel_key ? channelOrder[left.channel_key] : 9) - (right.channel_key ? channelOrder[right.channel_key] : 9));

  return <div className="animate-rise">
    <Card className="grid h-[calc(100dvh-140px)] min-h-[520px] overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={cn("flex min-h-0 flex-col border-line-soft lg:border-r", active && "hidden lg:flex")}>
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
          <h1 className="text-lg font-bold">Chat</h1>
          <Button size="sm" variant="ink" icon={<MessageSquarePlus size={14} />} onClick={() => setPicking(true)} disabled={!inbox.data?.contacts.length}>New message</Button>
        </div>
        <div className="relative px-4 pb-3"><Search size={15} className="absolute left-7 top-1/2 -translate-y-1/2 -mt-1.5 text-muted" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" aria-label="Search chats" className={cn(controlClass, "h-10 pl-9")} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line-soft">
          {inbox.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-14" />)}</div>
            : inbox.isError ? <EmptyState icon={MessagesSquare} title="Chat unavailable" body={errorMessage(inbox.error)} />
            : visible.length ? <ul>{visible.map((conversation) => <li key={conversation.id}><button type="button" onClick={() => open(conversation.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#FAF8F4]", conversation.id === activeId && "bg-brand-tint/60")}>
              <ChatAvatar conversation={conversation} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold">{conversation.name}</span><span className="shrink-0 text-[11px] text-muted">{listTime(conversation.last_message_at)}</span></span>
                <span className="flex items-center justify-between gap-2"><span className={cn("truncate text-[13px]", conversation.unread ? "font-semibold text-ink" : "text-muted")}>{conversation.last_message ? `${conversation.last_message.sender_id === inbox.data!.me ? "You: " : conversation.kind === "GROUP" ? `${conversation.members.find((member) => member.id === conversation.last_message!.sender_id)?.full_name.split(" ")[0] ?? ""}: ` : ""}${conversation.last_message.body}` : conversation.kind === "GROUP" ? `${conversation.members.length} members` : "Say hello"}</span>
                  {conversation.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-ink">{conversation.unread}</span>}</span>
              </span>
            </button></li>)}</ul>
            : <EmptyState icon={MessagesSquare} title={term ? "No chats match" : "No chats yet"} body={!term ? "Start a message with a manager, or talk with your team in its group." : undefined} />}
        </div>
      </aside>
      <section className={cn("min-h-0", !active && "hidden lg:block")}>
        {active && inbox.data ? <ConversationPane key={active.id} conversation={active} me={inbox.data.me} onBack={() => open(null)} />
          : <div className="grid h-full place-items-center"><EmptyState icon={MessagesSquare} title="Select a chat" body="Pick a conversation on the left, or start a new message." /></div>}
      </section>
    </Card>
    {picking && inbox.data && <NewMessage contacts={inbox.data.contacts} onClose={() => setPicking(false)} onOpen={(id) => { setPicking(false); open(id); }} />}
  </div>;
}

function ConversationPane({ conversation, me, onBack }: { conversation: Conversation; me: string; onBack: () => void }) {
  const { api } = useChatApi();
  const { profile } = useSession();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [settings, setSettings] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const { typingNames, notify } = useTyping(conversation.id, me, profile.full_name);
  const nameOf = useMemo(() => new Map(conversation.members.map((member) => [member.id, member.full_name])), [conversation.members]);
  const others = conversation.members.filter((member) => member.id !== me);

  const load = useCallback(async (before?: string) => {
    try {
      const page = await responseData<{ messages: ChatMessage[]; has_more: boolean }>(await api(`/api/v1/chat/conversations/${conversation.id}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`));
      setMessages((current) => before ? [...page.messages, ...current] : page.messages);
      setHasMore(page.has_more);
    } catch (problem) { setError(errorMessage(problem)); } finally { setLoading(false); }
  }, [api, conversation.id]);

  useEffect(() => { queueMicrotask(() => void load()); void markRead(conversation.id).then(() => queryClient.invalidateQueries({ queryKey: inboxKey })); }, [conversation.id, load, queryClient]);

  // Live messages for this conversation (others' and our own from other tabs).
  useChatStream((message) => {
    if (message.conversation_id !== conversation.id) return;
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      // Our own message echoed back before the send call returned: settle the optimistic bubble in place (no second animation).
      const echo = current.findIndex((item) => item.pending && item.body === message.body && item.sender_id === message.sender_id);
      if (echo >= 0) return current.map((item, index) => index === echo ? { ...message, key: item.key ?? item.id, fresh: true } : item);
      return [...current, { ...message, fresh: true }];
    });
    if (message.sender_id !== me) void markRead(conversation.id);
  });

  useEffect(() => { const box = scroller.current; if (box && atBottom.current) box.scrollTop = box.scrollHeight; }, [messages, typingNames.length]);

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const temp: ChatMessage = { id: `temp-${Date.now()}`, conversation_id: conversation.id, sender_id: me, body, created_at: new Date().toISOString(), pending: true, fresh: true };
    setMessages((current) => [...current, temp]); setDraft(""); setShowEmojis(false); atBottom.current = true;
    try {
      const saved = await sendMessage(conversation.id, me, body);
      setMessages((current) => current.some((item) => item.id === saved.id) ? current.filter((item) => item.id !== temp.id) : current.map((item) => item.id === temp.id ? { ...saved, key: temp.id, fresh: true } : item));
      void queryClient.invalidateQueries({ queryKey: inboxKey });
    } catch (problem) {
      setMessages((current) => current.map((item) => item.id === temp.id ? { ...item, pending: false, failed: true } : item));
      setError(errorMessage(problem));
    }
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } };
  // Double tick once every other member has read up to the message.
  const readByAll = (message: ChatMessage) => others.length > 0 && others.every((member) => new Date(member.last_read_at).getTime() >= new Date(message.created_at).getTime());

  return <div className="flex h-full min-h-0 flex-col">
    <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
      <button type="button" onClick={onBack} aria-label="Back to chats" className="grid h-9 w-9 place-items-center rounded-control text-muted hover:bg-black/[.05] lg:hidden"><ArrowLeft size={18} /></button>
      <ChatAvatar conversation={conversation} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{conversation.name}</p>
        <p className="truncate text-xs text-muted">{typingNames.length ? <span className="text-brand-deep">{typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…</span> : conversation.kind === "GROUP" ? conversation.members.map((member) => member.id === me ? "You" : member.full_name.split(" ")[0]).join(", ") : conversation.other?.role === "MANAGER" ? "Manager" : "Agent"}</p>
      </div>
      {conversation.kind === "CHANNEL" && <span className="text-xs text-muted">{conversation.members.length} members</span>}
      {conversation.kind === "GROUP" && <Button size="sm" variant="ghost" icon={<Settings2 size={15} />} onClick={() => setSettings(true)}>{conversation.my_role === "ADMIN" ? "Group settings" : "Group info"}</Button>}
    </header>
    <div ref={scroller} onScroll={(event) => { const box = event.currentTarget; atBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; }} className="min-h-0 flex-1 overflow-y-auto bg-[#FBFAF7] px-4 py-4">
      {loading ? <div className="space-y-3">{[0, 1, 2].map((index) => <Skeleton key={index} className={cn("h-10 w-2/3", index % 2 && "ml-auto")} />)}</div> : <>
        {hasMore && <div className="mb-3 text-center"><Button size="sm" variant="ghost" onClick={() => { atBottom.current = false; void load(messages[0]?.created_at); }}>Load earlier messages</Button></div>}
        {!messages.length && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello 👋</p>}
        <ol className="space-y-1.5">{messages.map((message, index) => {
          const mine = message.sender_id === me;
          const day = dayLabel(message.created_at); const showDay = index === 0 || day !== dayLabel(messages[index - 1].created_at);
          const firstOfRun = index === 0 || messages[index - 1].sender_id !== message.sender_id || showDay;
          // System updates posted into a channel read as a centred card, not a person's bubble.
          if (message.kind === "EVENT") return <li key={message.key ?? message.id}>
            {showDay && <p className="my-3 text-center"><span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-muted shadow-sm">{day}</span></p>}
            <div className={cn("mx-auto my-2 flex max-w-[88%] items-start gap-2.5 rounded-[14px] border border-line-soft bg-white px-3.5 py-2.5 text-[13px] shadow-sm", message.fresh && "animate-pop")}>
              <span className="min-w-0 flex-1"><span className="block whitespace-pre-wrap break-words leading-relaxed">{message.body}</span><span className="mt-0.5 block text-[10px] text-muted">{nameOf.get(message.sender_id) ?? "DEBOSS"} · {timeLabel(message.created_at)}</span></span>
            </div>
          </li>;
          return <li key={message.key ?? message.id}>
            {showDay && <p className="my-3 text-center"><span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-muted shadow-sm">{day}</span></p>}
            <div className={cn("flex", mine ? "justify-end" : "justify-start", firstOfRun && "mt-2")}>
              <div className={cn("max-w-[78%] rounded-[16px] px-3.5 py-2 text-sm shadow-sm transition-opacity", mine ? "rounded-br-[6px] bg-brand text-ink" : "rounded-bl-[6px] bg-white", message.fresh && (mine ? "origin-bottom-right animate-msg-out" : "origin-bottom-left animate-msg-in"), message.pending && "opacity-80", message.failed && "ring-2 ring-danger/60 animate-shake")}>
                {!mine && conversation.kind !== "DIRECT" && firstOfRun && <p className="mb-0.5 text-xs font-semibold text-aqua">{nameOf.get(message.sender_id) ?? "Former member"}</p>}
                <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
                <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-ink/60" : "text-muted")}>{message.failed ? "Not sent" : timeLabel(message.created_at)}{mine && !message.failed && (message.pending ? <Check size={12} className="opacity-50" /> : readByAll(message) ? <CheckCheck size={13} className="text-[#1d6fd8]" /> : <Check size={12} />)}</p>
              </div>
            </div>
          </li>;
        })}</ol>
        {typingNames.length > 0 && <div className="mt-2 flex items-end gap-2 animate-msg-in origin-bottom-left" aria-live="polite">
          <span className="flex h-8 items-center gap-1 rounded-[16px] rounded-bl-[6px] bg-white px-3.5 shadow-sm" aria-label={`${typingNames.join(", ")} typing`}>{[0, 1, 2].map((dot) => <span key={dot} className="h-1.5 w-1.5 rounded-full bg-ink/45 animate-typing-dot" style={{ animationDelay: `${dot * 150}ms` }} />)}</span>
          {conversation.kind === "GROUP" && <span className="pb-1 text-[11px] text-muted">{typingNames.join(", ")}</span>}
        </div>}
      </>}
    </div>
    {error && <p className="border-t border-danger/20 bg-danger/[.05] px-4 py-2 text-xs text-[#A5183F]">{error} <button type="button" className="ml-2 underline" onClick={() => setError(undefined)}>Dismiss</button></p>}
    {conversation.can_post === false ? <p className="border-t border-line-soft bg-[#FAF8F4] px-4 py-3 text-center text-xs text-muted">Only managers and the Super Admin post in {conversation.name}.</p> :
    <form onSubmit={send} className="relative flex items-end gap-2 border-t border-line-soft bg-white px-3 py-3">
      {showEmojis && <div className="absolute bottom-full left-3 mb-2 grid origin-bottom-left grid-cols-8 gap-1 rounded-[14px] border border-line bg-white p-2 shadow-lg animate-pop">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => setDraft((current) => current + emoji)} className="grid h-9 w-9 place-items-center rounded-lg text-lg transition hover:scale-110 hover:bg-black/[.05] active:scale-95">{emoji}</button>)}</div>}
      <button type="button" onClick={() => setShowEmojis((value) => !value)} aria-label="Emojis" className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-control text-muted hover:bg-black/[.05]", showEmojis && "bg-black/[.05] text-ink")}><Smile size={20} /></button>
      <textarea value={draft} onChange={(event) => { setDraft(event.target.value); notify(); }} onKeyDown={onKey} rows={1} maxLength={4000} placeholder="Type a message" aria-label="Message" className={cn(controlClass, "max-h-32 min-h-10 resize-none py-2.5")} />
      <Button type="submit" variant="primary" icon={<Send size={15} />} disabled={!draft.trim()} className="h-10 shrink-0">Send</Button>
    </form>}
    {settings && <GroupSettings conversation={conversation} me={me} onClose={() => setSettings(false)} />}
  </div>;
}

function NewMessage({ contacts, onClose, onOpen }: { contacts: { id: string; full_name: string; role: string; department: string | null }[]; onClose: () => void; onOpen: (id: string) => void }) {
  const { api, report } = useChatApi();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string>();
  const term = search.trim().toLowerCase();
  const list = contacts.filter((contact) => !term || `${contact.full_name} ${contact.department ?? ""}`.toLowerCase().includes(term));
  const start = async (id: string) => {
    setBusy(id);
    try { const { conversation_id } = await responseData<{ conversation_id: string }>(await api("/api/v1/chat/direct", { method: "POST", body: JSON.stringify({ user_id: id }) }));
      // A new conversation isn't in the cached inbox yet; refresh it before opening.
      await queryClient.refetchQueries({ queryKey: inboxKey });
      onOpen(conversation_id); }
    catch (error) { report(errorMessage(error), "error"); } finally { setBusy(undefined); }
  };
  return <Modal open onClose={onClose} title="New message" subtitle="Message a manager directly. Talk with other agents in your team group.">
    <div className="space-y-3">
      <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search people" className={cn(controlClass, "h-10 pl-9")} /></div>
      <ul className="max-h-[50vh] divide-y divide-line-soft overflow-y-auto rounded-[12px] border border-line-soft">{list.map((contact) => <li key={contact.id}><button type="button" disabled={Boolean(busy)} onClick={() => void start(contact.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#FAF8F4] disabled:opacity-60">
        <Avatar name={contact.full_name} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{contact.full_name}</span><span className="block truncate text-xs text-muted">{contact.role === "MANAGER" ? "Manager" : "Agent"}{contact.department ? ` · ${contact.department}` : ""}</span></span>
        {busy === contact.id && <span className="text-xs text-muted">Opening…</span>}
      </button></li>)}{!list.length && <li className="p-6 text-center text-sm text-muted">Nobody matches.</li>}</ul>
    </div>
  </Modal>;
}

/** The admin (the team's manager) renames the group and sets its photo; members follow the team. */
function GroupSettings({ conversation, me, onClose }: { conversation: Conversation; me: string; onClose: () => void }) {
  const { api, report } = useChatApi();
  const queryClient = useQueryClient();
  const admin = conversation.my_role === "ADMIN";
  const [name, setName] = useState(conversation.name);
  const [saving, setSaving] = useState(false);
  const save = async (patch: { name?: string; photo_url?: string | null }, success: string) => {
    setSaving(true);
    try { await responseData(await api(`/api/v1/chat/groups/${conversation.id}`, { method: "PATCH", body: JSON.stringify(patch) })); await queryClient.invalidateQueries({ queryKey: inboxKey }); report(success); }
    catch (error) { report(errorMessage(error), "error"); } finally { setSaving(false); }
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return report("Use a JPG, PNG or WebP image.", "error");
    if (file.size > 2 * 1024 * 1024) return report("The photo must be 2 MB or smaller.", "error");
    setSaving(true);
    try {
      const slot = await uploadGroupPhoto(api, file);
      await save({ photo_url: slot }, "Group photo updated.");
    } catch (error) { report(errorMessage(error), "error"); setSaving(false); }
  };
  return <Modal open onClose={onClose} dismissible={!saving} title={admin ? "Group settings" : "Group info"} subtitle={`${conversation.members.length} members`}>
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <ChatAvatar conversation={conversation} size="lg" />
        {admin && <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-control border border-line px-3 py-2 text-sm font-medium hover:border-brand", saving && "pointer-events-none opacity-60")}><ImagePlus size={15} />Change photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} /></label>}
      </div>
      {admin && <form onSubmit={(event) => { event.preventDefault(); if (name.trim().length >= 2 && name.trim() !== conversation.name) void save({ name: name.trim() }, "Group renamed."); }} className="flex items-end gap-2">
        <TextField label="Group name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} wrapperClassName="flex-1" />
        <Button type="submit" variant="ink" pending={saving} disabled={name.trim().length < 2 || name.trim() === conversation.name}>Save</Button>
      </form>}
      <div>
        <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Members</p>{admin && conversation.team_id && <Link href={`/app/teams/${conversation.team_id}`} className="text-xs font-semibold text-brand-deep hover:underline">Add or remove members</Link>}</div>
        <ul className="divide-y divide-line-soft rounded-[12px] border border-line-soft">{conversation.members.map((member) => <li key={member.id} className="flex items-center gap-3 px-3 py-2.5"><Avatar name={member.full_name} /><span className="min-w-0 flex-1 truncate text-sm font-medium">{member.id === me ? "You" : member.full_name}</span>{member.chat_role === "ADMIN" && <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-[#7C4400]">Admin</span>}</li>)}</ul>
        <p className="mt-2 text-xs text-muted">Members follow the team. Nobody can leave a group; the admin manages it.</p>
      </div>
    </div>
  </Modal>;
}

/** Uploads a group photo and returns its public address. Also used by the team form. */
export async function uploadGroupPhoto(api: ReturnType<typeof useChatApi>["api"], file: File) {
  const slot = await responseData<{ signed_url: string; public_url: string }>(await api("/api/v1/chat/photo-upload-url", { method: "POST", body: JSON.stringify({ content_type: file.type, file_size: file.size }) }));
  const put = await fetch(slot.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("The photo could not be uploaded.");
  return slot.public_url;
}
