import PDFDocument from "pdfkit";

function money(n) {
  return `TZS ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Workshop summary report for a date range (revenue + job counts). */
export function renderReportsSummaryPdf(meta, stream) {
  const { fromLabel, toLabel, paymentsTotal, paymentCount, jobsCreated, jobsByStatus, completedInRange, technicianRevenue } = meta;
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(stream);

  doc.fontSize(18).fillColor("#0369a1").text("BIOSFIX TECHNOLOGY", { align: "center" });
  doc.moveDown(0.25);
  doc.fontSize(11).fillColor("#334155").text("Workshop management — summary report", { align: "center" });
  doc.moveDown(1);
  doc.fontSize(10).fillColor("#000000");
  doc.text(`Period: ${fromLabel} to ${toLabel} (inclusive)`);
  doc.moveDown(0.75);

  doc.fontSize(12).text("Revenue (payments recorded in period)");
  doc.moveDown(0.2);
  doc.fontSize(10);
  doc.text(`Total payments: ${money(paymentsTotal)}`);
  doc.text(`Payment transactions: ${paymentCount}`);
  doc.moveDown(0.75);

  doc.fontSize(12).text("Jobs opened in period");
  doc.moveDown(0.2);
  doc.fontSize(10);
  doc.text(`New jobs created: ${jobsCreated}`);
  doc.text(`Jobs completed (completed date in period): ${completedInRange}`);
  doc.moveDown(0.5);
  doc.fontSize(11).text("Jobs by status (created in period)");
  doc.moveDown(0.2);
  doc.fontSize(10);
  for (const [k, v] of Object.entries(jobsByStatus || {})) {
    doc.text(`  ${k}: ${v}`);
  }

  if (technicianRevenue?.length) {
    doc.moveDown(0.75);
    doc.fontSize(12).text("Payment share by assigned technician");
    doc.moveDown(0.2);
    doc.fontSize(10);
    for (const row of technicianRevenue) {
      doc.text(`  ${row.name}: ${money(row.amount)} (${row.count} payments)`);
    }
  }

  doc.moveDown(2);
  doc.fontSize(9).fillColor("#64748b").text("Generated from BIOSFIX workshop system.", { align: "center" });
  doc.end();
}
