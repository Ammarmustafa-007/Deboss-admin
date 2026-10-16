"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { DataList, Field, Select, Submit } from "@/components/admin/parts";
import { useAdminRefresh, useDepartments } from "@/components/admin/admin-data";

const blank = { name: "", business_unit: "BROKERAGE", function: "SALES" };

export function DepartmentsScreen() {
  const supabase = useMemo(() => createClient(), []);
  const notify = useToast();
  const departments = useDepartments();
  const refresh = useAdminRefresh();
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  async function addDepartment(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("departments").insert(form);
      if (error) notify(error.message, "error");
      else { setForm(blank); notify("Department created."); void refresh(); }
    } finally { setBusy(false); }
  }

  const rows = (departments.data ?? []).map((d) => [d.name, d.business_unit, d.function, d.is_active ? "ACTIVE" : "INACTIVE"]);
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
    <form onSubmit={addDepartment} className="rounded-lg bg-ink-soft p-6 text-white"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-brand">New department</p><h2 className="mt-2 text-xl font-semibold">Define its operating lane.</h2><fieldset disabled={busy} className="mt-6 space-y-4 disabled:opacity-50"><Field label="Department name" value={form.name} onChange={(name) => setForm({ ...form, name })} placeholder="Brokerage Sales - East" /><div className="grid grid-cols-2 gap-3"><Select label="Business unit" value={form.business_unit} options={["BROKERAGE", "DISPATCH"]} onChange={(business_unit) => setForm({ ...form, business_unit })} /><Select label="Function" value={form.function} options={["SALES", "OPERATIONS"]} onChange={(functionValue) => setForm({ ...form, function: functionValue })} /></div><Submit busy={busy} label="Create department" loadingLabel="Creating department..." /></fieldset></form>
    <DataList columns={["Name", "Unit", "Function", "Status"]} rows={rows} empty={departments.isError ? departments.error.message : departments.isLoading ? "Loading departments..." : "No departments created yet."} />
  </div>;
}
