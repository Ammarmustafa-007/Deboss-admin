"use client";

import { KeyRound } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/app/session";
import { Avatar, Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/field";

export function SettingsScreen() {
  const supabase = useMemo(() => createClient(), []);
  const notify = useToast();
  const { profile } = useSession();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const mismatch = form.confirm.length > 0 && form.password !== form.confirm;

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

  return <div className="mx-auto max-w-2xl space-y-6 animate-rise">
    <PageHeader title="Settings" />
    <Card className="flex items-center gap-4 p-5">
      <Avatar name={profile.full_name} className="h-12 w-12 text-sm" />
      <div className="min-w-0"><p className="truncate font-semibold">{profile.full_name}</p><p className="truncate text-sm text-muted">{profile.email}</p></div>
    </Card>
    <Card>
      <CardHeader title="Change password" />
      <form onSubmit={changePassword} className="p-5">
        <fieldset disabled={busy} className="space-y-4">
          <PasswordInput label="New password" required minLength={8} autoComplete="new-password" hint="At least 8 characters." value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <PasswordInput label="Confirm password" required minLength={8} autoComplete="new-password" error={mismatch ? "Passwords don't match." : undefined} value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} />
        </fieldset>
        <div className="mt-6 flex justify-end"><Button type="submit" variant="primary" icon={<KeyRound size={16} />} pending={busy} pendingLabel="Saving password…" disabled={!form.password || !form.confirm}>Save new password</Button></div>
      </form>
    </Card>
  </div>;
}
