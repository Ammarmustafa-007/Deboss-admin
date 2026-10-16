"use client";

import type { Building2 } from "lucide-react";

export function Metric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | number }) { return <div className="rounded-lg border border-black/8 bg-white p-5"><Icon size={18} className="text-brand-deep" /><p className="mt-5 text-2xl font-semibold">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-black/40">{label}</p></div>; }
