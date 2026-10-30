"use client";

import { CalendarCheck, Lock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAdminAction } from "@/components/admin/admin-data";
import { Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/surface";
import { MonthPicker } from "@/components/finance/month-picker";
import { currentPeriod, useAttendance, type AttendanceStatus } from "@/components/finance/finance-data";

const nextStatus: Record<AttendanceStatus, AttendanceStatus> = { PRESENT: "ABSENT", ABSENT: "LEAVE", LEAVE: "PRESENT" };
const mark: Record<AttendanceStatus, { label: string; className: string; title: string }> = {
  PRESENT: { label: "·", className: "text-muted hover:bg-black/[.04]", title: "Present" },
  ABSENT: { label: "A", className: "bg-danger/15 font-semibold text-danger", title: "Absent" },
  LEAVE: { label: "L", className: "bg-info/15 font-semibold text-info", title: "Approved leave" },
};
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "narrow", timeZone: "UTC" });

/** One row per person, one cell per working day. Everyone is Present unless marked; a click cycles Absent, Leave, Present. */
export function AttendanceScreen() {
  const [period, setPeriod] = useState(currentPeriod);
  const attendance = useAttendance(period);
  const { run, busy } = useAdminAction();
  const data = attendance.data;
  const statusOf = new Map((data?.records ?? []).map((row) => [`${row.user_id}:${row.work_date}`, row.status as AttendanceStatus]));
  const change = (userId: string, date: string, status: AttendanceStatus) => run(`${userId}:${date}`, "/api/v1/attendance", "PUT", { user_id: userId, date, status }, "Attendance saved.", "Unable to save attendance.");

  return <div className="space-y-6 animate-rise">
    <PageHeader title="Attendance" subtitle={`Monday to Friday. ${data?.paid_leaves ?? 1} paid leave a month covers the first absence; further absences are deducted unless marked as leave.`} actions={<MonthPicker value={period} onChange={setPeriod} />} />
    {attendance.isLoading ? <Skeleton className="h-80 rounded-card" />
      : attendance.isError || !data ? <Card><EmptyState icon={CalendarCheck} title="Attendance unavailable" body={attendance.error?.message} /></Card>
      : <>
        {data.locked && <p className="flex items-center gap-2 rounded-card border border-success/30 bg-success/[.06] px-5 py-3.5 text-sm"><Lock size={15} className="text-success" />Payroll for this month is finalized, so attendance can&apos;t be changed.</p>}
        <Card>{data.people.length ? <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-xs text-muted"><th className="sticky left-0 z-10 min-w-48 bg-white px-5 py-2.5 text-left font-medium">Person</th>{data.days.map((day) => <th key={day} className="min-w-8 px-0.5 py-2.5 text-center font-medium"><span className="block">{weekday(day)}</span><span className="block tabular-nums">{Number(day.slice(8))}</span></th>)}<th className="px-3 py-2.5 text-right font-medium">Absent</th><th className="px-4 py-2.5 text-right font-medium">Leave</th></tr></thead>
          <tbody>{data.people.map((person) => {
            const rowDays = data.days.filter((day) => day >= person.joined_on && (!person.last_working_day || day <= person.last_working_day));
            const count = (status: AttendanceStatus) => rowDays.filter((day) => statusOf.get(`${person.id}:${day}`) === status).length;
            return <tr key={person.id} className="border-t border-line-soft">
              <td className="sticky left-0 z-10 bg-white px-5 py-2"><p className="truncate font-semibold">{person.full_name}</p><p className="truncate text-xs text-muted">{person.department_name ?? "—"}</p></td>
              {data.days.map((day) => {
                if (!rowDays.includes(day)) return <td key={day} className="bg-canvas" />;
                const status = statusOf.get(`${person.id}:${day}`) ?? "PRESENT";
                return <td key={day} className="p-0.5 text-center"><button type="button" disabled={data.locked || busy(`${person.id}:${day}`)} onClick={() => change(person.id, day, nextStatus[status])} aria-label={`${person.full_name}, ${day}: ${mark[status].title}`} title={mark[status].title} className={cn("h-8 w-8 rounded-md text-sm transition-colors disabled:cursor-not-allowed", mark[status].className)}>{mark[status].label}</button></td>;
              })}
              <td className="px-3 py-2 text-right tabular-nums">{count("ABSENT")}</td><td className="px-4 py-2 text-right tabular-nums">{count("LEAVE")}</td>
            </tr>;
          })}</tbody>
        </table></div> : <EmptyState icon={CalendarCheck} title="No one to record" body="People appear here once they are in a department." />}</Card>
        <p className="text-xs text-muted"><b>·</b> Present &nbsp; <b>A</b> Absent &nbsp; <b>L</b> Approved leave. Click a day to change it.</p>
      </>}
  </div>;
}
