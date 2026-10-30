import { cash, exitLabel, periodLabel, pkr, roleLabel, shiftPeriod, type PayrollLine } from "@/components/finance/finance-data";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const row = (label: string, value: string, strong = false) => `<tr${strong ? ' class="net"' : ""}><td>${escape(label)}</td><td>${escape(value)}</td></tr>`;

function slip(line: PayrollLine, period: string) {
  const detail = line.detail!;
  const payday = `10 ${periodLabel(shiftPeriod(period, 1))}`;
  return `<section>
    <header><h1>DEBOSS GLOBAL</h1><p>Payslip · ${escape(periodLabel(period))}</p></header>
    <table>
      ${row("Employee", line.full_name)}
      ${row("Role", roleLabel[line.role_key])}
      ${row("Department", line.department_name ?? "—")}
      ${row("Pay date", payday)}
      ${detail.exit_type ? row("Last working day", `${detail.last_working_day} (${exitLabel[detail.exit_type]})`) : ""}
    </table>
    <table>
      ${row("Base salary", pkr(line.base_salary))}
      ${row("Total working days", String(detail.working_days))}
      ${row("Days worked", String(detail.days_worked))}
      ${detail.employed_days < detail.working_days ? row("Base for days employed", pkr(detail.base_earned)) : ""}
      ${row("Leave deductions", `- ${pkr(detail.leave_deduction)}`)}
      ${detail.profit_share_usd ? row(`Profit share (${detail.profit_share_percent}%, ${cash(detail.profit_share_usd)})`, pkr(detail.profit_share_pkr)) : row(`Commission${line.role_key === "BROKERAGE_FRONTER_AGENT" ? "" : ` (${cash(detail.commission_usd)})`}`, pkr(detail.commission_pkr))}
      ${row("Net pay", pkr(detail.net_pay_pkr), true)}
    </table>
    ${detail.usd_to_pkr ? `<p class="rate">USD to PKR rate for the month: ${escape(detail.usd_to_pkr)}</p>` : ""}
  </section>`;
}

/** Prints the payslips, one per sheet, from a hidden frame so a pop-up blocker can't stop it. "Save as PDF" gives the file. */
export function printPayslips(lines: PayrollLine[], period: string) {
  document.querySelector("iframe[data-payslips]")?.remove();
  const frame = document.createElement("iframe");
  frame.dataset.payslips = "";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.append(frame);
  const page = frame.contentWindow!;
  const slips = lines.filter((line) => line.detail);
  page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslips ${escape(period)}</title><style>
    body{font:14px/1.5 system-ui,sans-serif;color:#1F1A14;margin:0}section{max-width:560px;margin:32px auto;padding:0 16px;break-after:page}
    header{border-bottom:3px solid #F7941D;margin-bottom:16px}h1{font-size:20px;margin:0}header p{margin:2px 0 10px;color:#6B6358}
    table{width:100%;border-collapse:collapse;margin-bottom:18px}td{padding:7px 0;border-bottom:1px solid #ECE6DC}td:last-child{text-align:right;font-variant-numeric:tabular-nums}
    .net td{font-weight:700;font-size:16px;border-bottom:0;border-top:2px solid #1F1A14}.rate{color:#6B6358;font-size:12px}
  </style></head><body>${slips.map((line) => slip(line, period)).join("")}</body></html>`);
  page.document.close();
  page.focus();
  page.print();
}
