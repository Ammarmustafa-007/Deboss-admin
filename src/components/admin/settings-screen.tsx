"use client";

import { LoaderCircle } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { PasswordField } from "@/components/admin/parts";

export function SettingsScreen() {
  const supabase = useMemo(() => createClient(), []);
  const notify = useToast();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (form.password.length < 8) return notify("Password must contain at least 8 characters.", "error");
    if (form.password !== form.confirm) return notify("Password confirmation does not match.", "error");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) notify(error.message, "error");
      else { setForm({ password: "", confirm: "" }); notify("Your password has been updated securely."); }
    } finally { setBusy(false); }
  }

  return <form onSubmit={changePassword} className="max-w-lg rounded-lg border border-black/8 bg-white p-6"><h2 className="text-lg font-semibold">Change password</h2><fieldset disabled={busy} className="mt-6 space-y-4 disabled:opacity-50"><PasswordField label="New password" value={form.password} visible={visible} onVisibility={() => setVisible(!visible)} onChange={(password) => setForm({ ...form, password })} /><PasswordField label="Confirm password" value={form.confirm} visible={visible} onVisibility={() => setVisible(!visible)} onChange={(confirm) => setForm({ ...form, confirm })} /><button disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-bold text-black disabled:opacity-60">{busy && <LoaderCircle size={16} className="animate-spin" />}{busy ? "Saving password..." : "Save new password"}</button></fieldset></form>;
}
