import { format } from "date-fns";
import type { Response } from "express";
import PDFDocument from "pdfkit";
import { InvoiceView } from "./payment.service";

const bdt = (value: string) =>
  `BDT ${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const streamInvoicePdf = (invoice: InvoiceView, res: Response) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${invoice.invoiceNumber}.pdf"`,
  );
  doc.pipe(res);

  const request = invoice.workOrder.assignment.serviceRequest;
  const customer = request.customer;
  const left = 50;
  const right = 545;

  doc.fontSize(22).font("Helvetica-Bold").text("INVOICE", left, 50);
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Invoice No: ${invoice.invoiceNumber}`, left, 55, {
      align: "right",
    })
    .text(`Date: ${format(invoice.createdAt, "dd MMM yyyy")}`, {
      align: "right",
    })
    .text(`Status: ${invoice.status}`, { align: "right" });
  if (invoice.dueDate) {
    doc.text(`Due: ${format(invoice.dueDate, "dd MMM yyyy")}`, {
      align: "right",
    });
  }

  doc.moveDown(2);
  const topY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11).text("Bill To", left, topY);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(customer.name)
    .text(customer.email)
    .text(customer.contactNumber ?? "");

  doc.font("Helvetica-Bold").fontSize(11).text("Service", 300, topY);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(request.title, 300)
    .text(`${request.address}, ${request.city}`, 300)
    .text(`Technician: ${invoice.workOrder.assignment.technician.name}`, 300);

  doc.moveDown(3);
  let y = Math.max(doc.y, topY + 90);

  const row = (
    cols: [string, string, string, string],
    bold = false,
    shaded = false,
  ) => {
    if (shaded) doc.rect(left, y - 4, right - left, 20).fill("#f0f0f0");
    doc
      .fillColor("#000")
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(10);
    doc.text(cols[0], left + 5, y, { width: 230 });
    doc.text(cols[1], 290, y, { width: 50, align: "right" });
    doc.text(cols[2], 345, y, { width: 90, align: "right" });
    doc.text(cols[3], 440, y, { width: 100, align: "right" });
    y += 20;
  };

  row(["Description", "Qty", "Unit", "Amount"], true, true);

  for (const part of invoice.workOrder.parts) {
    row([
      part.name,
      String(part.quantity),
      bdt(part.unitCost.toFixed(2)),
      bdt(part.totalCost.toFixed(2)),
    ]);
  }

  const hours = Number(invoice.breakdown.laborHours);
  row([
    "Labor",
    String(hours),
    hours > 0
      ? bdt((Number(invoice.breakdown.laborCost) / hours).toFixed(2))
      : "-",
    bdt(invoice.breakdown.laborCost),
  ]);

  y += 10;
  doc.moveTo(300, y).lineTo(right, y).stroke();
  y += 10;

  const totalLine = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10);
    doc.text(label, 300, y, { width: 130 });
    doc.text(value, 430, y, { width: 115, align: "right" });
    y += bold ? 24 : 18;
  };

  totalLine("Subtotal", bdt(invoice.breakdown.subtotal));
  totalLine("Discount", `- ${bdt(invoice.breakdown.discount)}`);
  totalLine("Tax", bdt(invoice.breakdown.taxAmount));
  totalLine("Total", bdt(invoice.breakdown.totalAmount), true);

  if (invoice.status === "PAID" && invoice.paidAt) {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        `Paid on ${format(invoice.paidAt, "dd MMM yyyy")} via ${invoice.method}` +
          (invoice.transactionId ? ` (TrxID: ${invoice.transactionId})` : ""),
        left,
        y + 10,
      );
  }

  if (invoice.notes) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`Notes: ${invoice.notes}`, left, y + 40, { width: right - left });
  }

  doc.end();
};
