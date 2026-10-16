"use client";

import { MessageSquare } from "lucide-react";


export function Metric({ icon: Icon, label, value }: { icon?: any; label: string; value: string | number }) { return <div className="rounded-lg border border-black/8 bg-white p-5">{Icon && <Icon size={18} className="text-brand-deep"/>}<p className={`${Icon ? "mt-4" : ""} text-2xl font-semibold`}>{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{label}</p></div>; }
export function Empty({ title, copy }: { title: string; copy: string }) { return <div className="p-10 text-center"><MessageSquare className="mx-auto text-brand-deep" size={22}/><h3 className="mt-3 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/50">{copy}</p></div>; }
export function DetailSkeleton() { return <div className="animate-pulse p-5"><div className="h-5 w-40 rounded bg-black/[.06]"/><div className="mt-3 h-3 w-64 rounded bg-black/[.06]"/><div className="mt-8 grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-10 rounded bg-black/[.05]"/>)}</div></div>; }
export function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value ?? 0)); }
export function message(error: unknown) { return error instanceof Error ? error.message : "The request could not be completed."; }
