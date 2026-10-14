"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const signInFlight = useRef(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signInFlight.current) return;
    signInFlight.current = true;
    setError("");
    setLoading(true);
    try {
      const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
      if (authError) return setError(authError.message);
      router.push("/app");
    } catch {
      setError("We could not verify your sign-in. Please try again.");
    } finally {
      signInFlight.current = false;
      setLoading(false);
    }
  }

  return <main className="min-h-screen overflow-hidden bg-[#090909] text-[#f8f7f4] selection:bg-[#f59a18] selection:text-black">
    <div className="grid-noise pointer-events-none fixed inset-0 opacity-40" /><div className="pointer-events-none fixed inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_at_72%_0%,rgba(245,154,24,0.2),transparent_52%)]" />
    <nav className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 lg:px-12"><div className="flex items-center gap-3"><div className="relative h-11 w-11 overflow-hidden rounded-md border border-white/10 bg-black"><Image src="/brand/deboss-mark.png" alt="DEBOSS GLOBAL" fill className="object-cover scale-[1.65]" priority /></div><div><p className="text-sm font-bold tracking-[0.22em]">DEBOSS</p><p className="text-[9px] font-semibold tracking-[0.32em] text-[#f59a18]">GLOBAL OPERATIONS</p></div></div><p className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-white/40 sm:block">Secure command center</p></nav>
    <section className="relative z-10 mx-auto grid min-h-[calc(100vh-92px)] max-w-[1440px] items-center gap-16 px-6 pb-20 lg:grid-cols-[1fr_0.85fr] lg:px-12">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}><p className="mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#f59a18]"><span className="h-px w-8 bg-[#f59a18]" /> Freight intelligence, elevated</p><h1 className="max-w-2xl text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl xl:text-7xl">Move the operation with complete clarity.</h1><p className="mt-7 max-w-xl text-base leading-7 text-white/55 sm:text-lg">A focused workspace for the people keeping customers, carriers, dispatch and revenue in motion.</p></motion.div>
      <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, delay: 0.12 }} className="border border-white/10 bg-[#111110] p-5 shadow-2xl shadow-black/40 sm:p-8"><div className="mb-8 flex items-start justify-between border-b border-white/10 pb-5"><div><p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f59a18]"><Sparkles size={13} /> Secure access</p><h2 className="text-2xl font-semibold">Welcome back.</h2></div><span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-white/60"><LockKeyhole size={16} /></span></div><form className="space-y-5" onSubmit={signIn}><label className="block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.13em] text-white/50">Work email</span><input disabled={loading} required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-sm outline-none transition placeholder:text-white/20 focus:border-[#f59a18] disabled:opacity-55" type="email" placeholder="admin@debossglobal.com" /></label><label className="block"><span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.13em] text-white/50">Password</span><span className="relative block"><input disabled={loading} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 pr-12 text-sm outline-none transition placeholder:text-white/20 focus:border-[#f59a18] disabled:opacity-55" type={visible ? "text" : "password"} placeholder="Enter your password" /><button disabled={loading} type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-white/45 transition hover:text-[#f59a18] disabled:opacity-45">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>{error && <p role="alert" className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</p>}<button disabled={loading} aria-busy={loading || undefined} className="group flex h-12 w-full items-center justify-between rounded-md bg-[#f59a18] px-5 text-sm font-bold text-black transition hover:bg-[#ffb14a] disabled:opacity-60">{loading ? <><span className="flex items-center gap-2"><LoaderCircle size={17} className="animate-spin"/>Verifying access...</span><span className="h-[18px] w-[18px]"/></> : <><span>Enter operations workspace</span><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></>}</button></form><p className="mt-5 flex items-center gap-2 text-[10px] leading-4 text-white/35"><ShieldCheck size={13} className="shrink-0" /> Your access is provisioned by DEBOSS administration.</p></motion.div>
    </section>
  </main>;
}
