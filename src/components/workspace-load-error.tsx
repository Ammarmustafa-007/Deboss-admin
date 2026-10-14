"use client";

import { AlertCircle, LogOut, RefreshCw } from "lucide-react";

export function WorkspaceLoadError({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#090909] p-6 text-center text-white"><section className="w-full max-w-md border border-white/10 bg-[#121210] p-8 shadow-2xl"><span className="mx-auto grid h-11 w-11 place-items-center rounded-md bg-[#f59a18] text-black"><AlertCircle size={20}/></span><p className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-[#f59a18]">Workspace unavailable</p><h1 className="mt-3 text-2xl font-semibold">We could not finish loading your account.</h1><p className="mt-3 text-sm leading-6 text-white/55">{message}</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><button onClick={onRetry} className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#f59a18] text-sm font-bold text-black"><RefreshCw size={16}/>Try again</button><button onClick={onSignOut} className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/15 text-sm font-bold text-white/70 hover:bg-white/5"><LogOut size={16}/>Sign out</button></div></section></main>;
}
