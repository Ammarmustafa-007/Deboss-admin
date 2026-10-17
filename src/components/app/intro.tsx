"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { GlobeCanvas } from "@/components/login/globe-canvas";

/** Set by the login page right before it navigates into /app. Read once. */
export const introKey = "deboss.intro";

type Intro = { reveal: () => void; entering: boolean };
const IntroContext = createContext<Intro>({ reveal: () => undefined, entering: false });

/**
 * Covers /app with the spinning globe while the session and workspace load.
 * After a fresh sign-in the globe dives toward the viewer and the dashboard plays its entrance;
 * on a plain reload it simply fades away.
 */
export function IntroProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");
  const [dive, setDive] = useState(false);
  const [entering, setEntering] = useState(false);
  const revealed = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const reveal = useCallback(() => {
    if (revealed.current) return;
    revealed.current = true;
    let fromLogin = false;
    try { fromLogin = window.sessionStorage.getItem(introKey) === "1"; window.sessionStorage.removeItem(introKey); } catch { /* storage unavailable */ }
    const later = (ms: number, work: () => void) => timers.current.push(window.setTimeout(work, ms));
    if (fromLogin) {
      setDive(true);
      setEntering(true);
      later(60, () => setPhase("leaving"));
      later(700, () => setPhase("done"));
      later(1500, () => setEntering(false));
    } else {
      setPhase("leaving");
      later(350, () => setPhase("done"));
    }
  }, []);

  return <IntroContext.Provider value={{ reveal, entering }}>
    {children}
    {phase !== "done" && <div aria-hidden={phase === "leaving"} className={cn("fixed inset-0 z-[70] overflow-hidden bg-[#09090a] transition-opacity ease-out", phase === "leaving" ? (dive ? "pointer-events-none opacity-0 duration-[600ms]" : "pointer-events-none opacity-0 duration-300") : "opacity-100")}>
      <div className="login-background" />
      <GlobeCanvas layout={dive ? "dive" : "center"} fast />
      <p className={cn("absolute inset-x-0 bottom-10 z-10 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/45 transition-opacity duration-300", dive && "opacity-0")}>Opening your workspace</p>
    </div>}
  </IntroContext.Provider>;
}

export function useIntro() {
  return useContext(IntroContext);
}

/** Lifts the intro overlay once whatever renders this is on screen (the app shell, or an error screen). */
export function RevealIntro() {
  const { reveal } = useIntro();
  useEffect(() => { reveal(); }, [reveal]);
  return null;
}

/** Plain dark backdrop shown under the overlay while data loads. */
export function IntroBackdrop() {
  return <div className="min-h-screen bg-[#09090a]" />;
}
