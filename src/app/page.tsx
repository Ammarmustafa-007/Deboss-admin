"use client";

import Image from "next/image";
import { ArrowRight, Check, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useApi } from "@/lib/api";
import { warmWorkspace } from "@/lib/loaders";
import { GlobeCanvas } from "@/components/login/globe-canvas";
import { introKey } from "@/components/app/intro";
import { cn } from "@/lib/cn";

const inputClass = "h-[52px] w-full rounded-control border border-[#DDD6C8] bg-white pl-11 pr-12 text-sm text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#A39D90] hover:border-[#BFB7A6] focus:border-brand focus:shadow-[0_0_0_4px_rgba(247,148,29,.15),0_8px_24px_-10px_rgba(247,148,29,.5)] focus-visible:outline-none disabled:opacity-60";

export default function SignInPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApi();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: boolean; password?: boolean }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const signInFlight = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signInFlight.current) return;
    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    const passwordOk = password.length > 0;
    setFieldErrors({ email: !emailOk, password: !passwordOk });
    if (!emailOk) return emailRef.current?.focus();
    if (!passwordOk) return passwordRef.current?.focus();

    signInFlight.current = true;
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return setError(authError.message);
      setSuccess(true);
      // The /app frame reads this once to play the globe intro instead of a plain loading fade.
      try { window.sessionStorage.setItem(introKey, "1"); } catch { /* storage unavailable */ }
      // Load the profile and first screen's data while the globe moves to the center,
      // so /app opens with everything cached. At least 0.5 s so the move is visible; never more than 2.5 s.
      const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
      // Start from an empty cache so nothing from a previous account is reused.
      queryClient.clear();
      await Promise.all([wait(500), Promise.race([warmWorkspace(queryClient, supabase, api), wait(2500)])]);
      router.push("/app");
    } catch {
      setError("We could not verify your sign-in. Please try again.");
    } finally {
      signInFlight.current = false;
      setLoading(false);
    }
  }

  const trackSpotlight = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };
  const trackCaps = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);
  const busy = loading || success;

  return <main className="relative min-h-screen overflow-x-hidden bg-[#09090a] text-white">
    <div className={"login-background"} />
    <GlobeCanvas className="login-globe" layout={success ? "center" : "side"} fast={success} />
    <div className={cn("relative z-10 mx-auto grid min-h-screen max-w-[1440px] gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,.85fr)] lg:gap-14 lg:px-14 lg:py-8", success && "login-leave")}>
      <header className={cn("flex items-center justify-between lg:col-span-2", "login-reveal")} style={{ ["--k" as string]: 0 }}>
        <Image src="/brand/deboss-logo-horizontal.png" alt="DEBOSS GLOBAL" width={800} height={186} priority className="h-9 w-auto sm:h-10" />
        <p className={cn("hidden items-center gap-2.5 rounded-full border border-white/10 bg-white/[.04] px-3.5 py-1.5 text-xs text-[#A8A49B] backdrop-blur-md md:flex", "login-status")}>Secure command center · All systems normal</p>
      </header>

      <section className="self-center pb-6 pt-2 lg:pb-10">
        <h1 className={cn("max-w-[12em] text-[clamp(38px,5.4vw,76px)] font-bold leading-[1.02] tracking-[-0.035em]", "login-headline", "login-reveal")} style={{ ["--k" as string]: 1 }}>Move the operation with complete clarity.</h1>
        <p className={cn("mt-5 max-w-[30em] text-base text-[#A8A49B] sm:text-[17px]", "login-reveal")} style={{ ["--k" as string]: 2 }}>A focused workspace for the people keeping customers, carriers, dispatch and revenue in motion.</p>
      </section>

      <section onPointerMove={trackSpotlight} className={cn("self-center rounded-[24px] p-6 text-ink sm:p-9", "login-card", "login-reveal")} style={{ ["--k" as string]: 2 }}>
        <span aria-hidden className="absolute right-6 top-6 grid h-11 w-11 place-items-center rounded-control border border-brand/35 bg-brand/12 text-[#C76A00] sm:right-8 sm:top-8"><LockKeyhole size={20} /></span>
        <h2 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[30px]">Welcome back.</h2>
        <p className="mt-1.5 text-sm text-[#6B665C]">Sign in to your operations workspace.</p>

        <form className="mt-7 flex flex-col gap-[18px]" onSubmit={signIn} noValidate>
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="email" className="text-[13px] font-medium text-[#3A372F]">Work email</label>
            <div className={cn("group relative", fieldErrors.email && "login-shake")}>
              <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8479] transition-colors group-focus-within:text-brand" />
              <input ref={emailRef} id="email" disabled={busy} autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: false })); }} type="email" placeholder="admin@debossglobal.com" aria-invalid={fieldErrors.email || undefined} className={cn(inputClass, fieldErrors.email && "border-danger shadow-[0_0_0_4px_rgba(244,63,110,.13)]")} />
            </div>
            {fieldErrors.email && <p className="text-xs text-[#D12A55]">Enter your work email, like name@debossglobal.com.</p>}
          </div>

          <div className="flex flex-col gap-[7px]">
            <label htmlFor="password" className="flex justify-between text-[13px] font-medium text-[#3A372F]">Password {capsLock && <span className="font-normal text-[#C76A00]">Caps Lock is on</span>}</label>
            <div className={cn("group relative", fieldErrors.password && "login-shake")}>
              <KeyRound size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8479] transition-colors group-focus-within:text-brand" />
              <input ref={passwordRef} id="password" disabled={busy} autoComplete="current-password" value={password} onKeyUp={trackCaps} onKeyDown={trackCaps} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: false })); }} type={visible ? "text" : "password"} placeholder="Enter your password" aria-invalid={fieldErrors.password || undefined} className={cn(inputClass, fieldErrors.password && "border-danger shadow-[0_0_0_4px_rgba(244,63,110,.13)]")} />
              <button disabled={busy} type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Hide password" : "Show password"} className={cn("absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-control transition-colors hover:bg-black/[.06] hover:text-ink", visible ? "text-brand" : "text-[#8A8479]")}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {fieldErrors.password && <p className="text-xs text-[#D12A55]">Enter your password.</p>}
          </div>

          {error && <p role="alert" className="rounded-control border border-danger/30 bg-danger/[.07] px-3.5 py-2.5 text-[13px] text-[#B0173F]">{error}</p>}

          <button disabled={busy} aria-busy={loading || undefined} className={cn("group flex h-[54px] items-center justify-center gap-3 rounded-control text-[15px] font-semibold transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 active:scale-[.98] disabled:hover:translate-y-0", success ? "bg-gradient-to-br from-success to-[#3DDC84] text-white" : "bg-gradient-to-br from-brand to-brand-soft text-ink shadow-[0_14px_30px_-12px_rgba(247,148,29,.8),inset_0_1px_#fff6] hover:shadow-[0_20px_38px_-12px_rgba(247,148,29,.9),inset_0_1px_#fff6]", "login-submit")}>
            {success ? <><Check size={18} />Welcome back. Opening your workspace…</> : loading ? <><LoaderCircle size={18} className="animate-spin" />Verifying access…</> : <>Enter operations workspace<ArrowRight size={20} className="transition-transform group-hover:translate-x-1" /></>}
          </button>

          <p className="flex items-center gap-2 text-xs text-[#6B665C]"><ShieldCheck size={14} className="shrink-0" />Your access is provisioned by DEBOSS administration.</p>
        </form>
      </section>
    </div>
  </main>;
}
