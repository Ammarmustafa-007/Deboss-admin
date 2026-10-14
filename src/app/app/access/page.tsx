"use client";

import { LoaderCircle, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const root = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function DepartmentAccessPanel({ embedded = false }: { embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<any>();
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");

  const api = async (path: string, init?: RequestInit) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    return fetch(`${root}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
  };
  const load = async () => {
    const response = await api("/api/v1/brokerage/department-users");
    const body = await response.json();
    if (response.ok) setData(body); else setMessage(body.error ?? "Unable to load departmental Agents.");
  };
  useEffect(() => { void load(); }, []);

  const setActive = async (user: any, is_active: boolean) => {
    if (saving) return;
    setSaving(user.id);
    const response = await api(`/api/v1/brokerage/department-users/${user.id}`, { method: "PATCH", body: JSON.stringify({ is_active }) });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setMessage(body.error ?? "Unable to update Agent access.");
    setMessage(is_active ? "Agent login restored." : "Agent login revoked.");
    await load();
  };

  if (!data) return <main className="grid min-h-[360px] place-items-center bg-[#f5f4f0]"><LoaderCircle className="animate-spin text-[#f59a18]"/></main>;
  const agents = data.users.filter((user: any) => user.role === "AGENT");
  return <main className={`${embedded ? "" : "min-h-screen p-5 lg:p-10"} bg-[#f5f4f0] text-[#191816]`}><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Department manager controls</p><h1 className="mt-2 text-3xl font-semibold">Agent access</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">Every active Agent receives the standard workflow for this department automatically. Team-only and managerial actions are delegated from Teams &amp; leads when an Agent is selected as a Team Lead.</p></div><ShieldCheck className="shrink-0 text-[#f59a18]"/></div>{message && <p role="status" className="mt-5 rounded-md border border-[#f59a18]/30 bg-[#fff1dc] px-4 py-3 text-sm text-[#7c4400]">{message}</p>}<section className="mt-7 grid gap-4 lg:grid-cols-2"><article className="rounded-lg border border-black/8 bg-[#191816] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#f59a18]">Automatic baseline</p><h2 className="mt-2 text-lg font-semibold">No checkbox is needed for normal work.</h2><p className="mt-3 text-sm leading-6 text-white/60">Sales Agents create and work their own leads, activities, customers, quotes, and personal reports. Operations Agents work assigned shipments, update lifecycle status, record shipment finance, upload documents, add comments, and raise exceptions.</p></article><article className="rounded-lg border border-black/8 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#a65c00]">Delegated uplift</p><h2 className="mt-2 text-lg font-semibold">Team Lead is additive.</h2><p className="mt-3 text-sm leading-6 text-black/55">Promote an existing Agent in Teams &amp; leads to grant selected team visibility or managerial actions. This never removes their own standard Agent workflow.</p></article></section><div className="mt-5 space-y-3">{agents.map((user: any) => <article key={user.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-black/8 bg-white p-5"><div className="flex min-w-0 items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}><UserRoundCheck size={18}/></span><div className="min-w-0"><p className="font-semibold">{user.full_name}</p><p className="truncate text-sm text-black/50">{user.email}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{user.is_active ? "Standard Agent access active" : "Login revoked"}</p></div></div><button disabled={saving === user.id} onClick={() => void setActive(user, !user.is_active)} className="h-9 rounded-md border border-black/10 px-3 text-xs font-bold disabled:opacity-50">{saving === user.id ? "Saving..." : user.is_active ? "Revoke login" : "Restore login"}</button></article>)}{!agents.length && <p className="rounded-lg border border-black/8 bg-white p-8 text-sm text-black/50">Create departmental Agents from Super Admin Users before managing access.</p>}</div></div></main>;
}

export default function DepartmentAccessPage() { return <DepartmentAccessPanel />; }
