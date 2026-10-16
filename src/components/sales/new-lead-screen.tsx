"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { money, dateTimeLabel } from "@/lib/format";
import { useBrokerage } from "@/components/app/brokerage-context";
import { Card, EmptyState, PageHeader } from "@/components/ui/surface";
import { Stepper } from "@/components/ui/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useSalesAction } from "@/components/sales/use-sales-action";
import type { Lead } from "@/components/sales/model";

const blank = { company_name: "", contact_name: "", contact_email: "", contact_phone: "", source: "", estimated_monthly_value: "", next_follow_up_at: "" };

export function NewLeadScreen() {
  const router = useRouter();
  const { manager } = useBrokerage();
  const { run, busy } = useSalesAction();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(blank);
  const firstStep = useRef<HTMLFormElement>(null);
  const set = (field: keyof typeof blank) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  if (manager) return <EmptyState title="Leads are created by Sales agents" body="Managers review and approve the work on each lead." action={<LinkButton href="/app/sales" variant="ink">Back to pipeline</LinkButton>} className="mt-10" />;

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (firstStep.current?.reportValidity()) setStep(1);
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const result = await run<{ lead?: Lead }>("create-lead", "/api/v1/brokerage/leads", "POST", {
      ...form,
      estimated_monthly_value: form.estimated_monthly_value ? Number(form.estimated_monthly_value) : undefined,
      next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : undefined,
    }, "Lead created and added to the pipeline.");
    if (!result) return;
    setForm(blank);
    setStep(0);
    router.push(result.lead?.id ? `/app/sales/leads/${result.lead.id}` : "/app/sales");
  };

  const creating = busy("create-lead");

  return <div className="mx-auto max-w-3xl space-y-6 animate-rise">
    <PageHeader title="New lead" crumbs={[{ label: "Sales", href: "/app/sales" }, { label: "New lead" }]} />
    <Card className="overflow-hidden">
      <div className="border-b border-line-soft bg-[#FBFAF7] px-6 py-5"><Stepper steps={[{ label: "Company & contact" }, { label: "Pipeline details" }]} current={step} className="mx-auto max-w-sm" /></div>

      {step === 0 && <form ref={firstStep} onSubmit={next} className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Company name" required autoFocus value={form.company_name} onChange={(event) => set("company_name")(event.target.value)} wrapperClassName="sm:col-span-2" />
          <TextField label="Contact name" required value={form.contact_name} onChange={(event) => set("contact_name")(event.target.value)} />
          <TextField label="Contact email" type="email" value={form.contact_email} onChange={(event) => set("contact_email")(event.target.value)} />
          <TextField label="Phone" value={form.contact_phone} onChange={(event) => set("contact_phone")(event.target.value)} />
        </div>
        <div className="mt-7 flex justify-between gap-3">
          <LinkButton href="/app/sales" variant="ghost">Cancel</LinkButton>
          <Button type="submit" variant="ink">Continue<ArrowRight size={16} /></Button>
        </div>
      </form>}

      {step === 1 && <form onSubmit={create} className="p-6">
        <div className="mb-5 flex items-center gap-3 rounded-[12px] bg-canvas px-4 py-3 text-sm">
          <Check size={16} className="shrink-0 text-success" />
          <p className="min-w-0 flex-1 truncate"><b>{form.company_name}</b> · {form.contact_name}{form.contact_email ? ` · ${form.contact_email}` : ""}</p>
          <button type="button" onClick={() => setStep(0)} className="text-xs font-semibold text-brand-deep hover:underline">Edit</button>
        </div>
        <fieldset disabled={creating} className="grid gap-4 sm:grid-cols-2">
          <TextField label="Source" value={form.source} onChange={(event) => set("source")(event.target.value)} />
          <TextField label="Estimated monthly value" type="number" min="0" value={form.estimated_monthly_value} onChange={(event) => set("estimated_monthly_value")(event.target.value)} hint={form.estimated_monthly_value ? money(form.estimated_monthly_value) : undefined} />
          <TextField label="Next follow-up" type="datetime-local" value={form.next_follow_up_at} onChange={(event) => set("next_follow_up_at")(event.target.value)} hint={form.next_follow_up_at ? dateTimeLabel(new Date(form.next_follow_up_at).toISOString()) : undefined} wrapperClassName="sm:col-span-2" />
        </fieldset>
        <div className="mt-7 flex justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep(0)} disabled={creating}><ArrowLeft size={16} />Back</Button>
          <Button type="submit" variant="primary" pending={creating} pendingLabel="Creating lead…">Create lead</Button>
        </div>
      </form>}
    </Card>
  </div>;
}
