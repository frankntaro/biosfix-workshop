import PDFDocument from "pdfkit";

function money(n) {
  return `TZS ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Streams a printable invoice for a job (customer, device, charges, payments). */
export function renderJobInvoicePdf(job, stream) {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(stream);

  doc.fontSize(20).fillColor("#0369a1").text("BIOSFIX TECHNOLOGY", { align: "center" });
  doc.moveDown(0.25);
  doc.fontSize(11).fillColor("#334155").text("Computer & laptop repair workshop", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor("#0f172a").text("Invoice / receipt", { align: "center" });
  doc.moveDown(1.2);

  doc.fontSize(10).fillColor("#000000");
  doc.text(`Job number: ${job.jobNumber}`);
  doc.text(`Received: ${new Date(job.receivedAt).toLocaleString()}`);
  if (job.completedAt) doc.text(`Completed: ${new Date(job.completedAt).toLocaleString()}`);
  doc.text(`Status: ${job.status}`);
  doc.moveDown(0.75);

  doc.fontSize(11).fillColor("#0f172a").text("Customer");
  doc.moveDown(0.2);
  doc.fontSize(10).text(job.customer.name);
  doc.text(job.customer.phone);
  if (job.customer.email) doc.text(job.customer.email);
  if (job.customer.address) doc.text(job.customer.address);
  doc.moveDown(0.75);

  doc.fontSize(11).text("Device");
  doc.moveDown(0.2);
  doc.fontSize(10).text(`${job.device.brand} ${job.device.model}`);
  if (job.device.serialNumber) doc.text(`Serial: ${job.device.serialNumber}`);
  if (job.device.conditionNotes) {
    doc.moveDown(0.25);
    doc.fontSize(9).fillColor("#475569").text(`Condition on intake: ${job.device.conditionNotes}`, { width: 500 });
    doc.fillColor("#000000");
  }
  doc.moveDown(0.75);

  doc.fontSize(11).text("Problem reported");
  doc.moveDown(0.2);
  doc.fontSize(10).text(job.problemDescription || "—", { width: 500 });
  doc.moveDown(0.9);

  const labor = Number(job.laborCost);
  const parts = Number(job.partsCost);
  const total = labor + parts;
  const paid = (job.payments || []).reduce((s, p) => s + Number(p.amount), 0);

  doc.fontSize(11).text("Charges");
  doc.moveDown(0.2);
  doc.fontSize(10);
  doc.text(`Labor: ${money(labor)}`);
  doc.text(`Parts: ${money(parts)}`);
  doc.moveDown(0.25);
  doc.fontSize(11).text(`Total (labor + parts): ${money(total)}`);
  doc.text(`Amount paid: ${money(paid)}`);
  doc.text(`Balance due: ${money(Math.max(0, total - paid))}`);

  if (job.payments?.length) {
    doc.moveDown(0.75);
    doc.fontSize(11).text("Payment history");
    doc.moveDown(0.2);
    doc.fontSize(9);
    for (const p of job.payments) {
      doc.text(`${new Date(p.recordedAt).toLocaleString()} · ${p.method} · ${money(p.amount)}`);
    }
  }

  if (job.status === "DELIVERED" && job.deliveredAt) {
    doc.moveDown(0.75);
    doc.fontSize(11).text("Collection");
    doc.moveDown(0.2);
    doc.fontSize(10);
    doc.text(`Delivered: ${new Date(job.deliveredAt).toLocaleString()}`);
    if (job.collectedByName) doc.text(`Collected by: ${job.collectedByName} · ${job.collectedByPhone || ""}`);
    if (job.collectionSignature) {
      doc.moveDown(0.25);
      doc.fontSize(9).fillColor("#475569").text("Signature / confirmation on file.", { width: 500 });
      const sig = String(job.collectionSignature);
      const preview = sig.length > 500 ? `${sig.slice(0, 500)}…` : sig;
      doc.text(preview, { width: 500 });
      doc.fillColor("#000000");
    }
  }

  doc.moveDown(2);
  doc.fontSize(9).fillColor("#64748b").text("Thank you for choosing BIOSFIX TECHNOLOGY.", { align: "center" });
  doc.text("This document is generated from the workshop management system.", { align: "center" });

  doc.end();
}
