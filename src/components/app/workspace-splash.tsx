"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export function WorkspaceSplash() {
  return <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#09090a] text-white">
    <div className="grid-noise pointer-events-none absolute inset-0 opacity-40" />
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[65vh] bg-[radial-gradient(ellipse_at_50%_30%,rgba(247,148,29,0.2),transparent_55%)]" />
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} className="relative z-10 flex flex-col items-center">
      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
        <Image src="/brand/deboss-logo-stacked.png" alt="DEBOSS GLOBAL" width={220} height={174} priority className="h-auto w-[200px]" />
      </motion.div>
      <div className="mt-10 w-56">
        <div className="h-0.5 overflow-hidden rounded-full bg-white/10"><motion.div initial={{ x: "-100%" }} animate={{ x: "200%" }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }} className="h-full w-1/2 rounded-full bg-brand" /></div>
        <p className="mt-4 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">Preparing your workspace</p>
      </div>
    </motion.div>
  </main>;
}
