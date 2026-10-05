import { prisma } from "../../lib/prisma";
import { NotificationServices } from "./notification.service";

const { notify, notifyUsers, notifyManagement } = NotificationServices;

const fmtDate = (d: Date) =>
  d.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  });

const safe =
  <A extends unknown[]>(name: string, fn: (...args: A) => Promise<void>) =>
  async (...args: A): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      console.error(`[notification:${name}] failed:`, error);
    }
  };

const loadServiceRequest = (id: string) =>
  prisma.serviceRequest.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      rejectionReason: true,
      customer: { select: { userId: true, name: true } },
    },
  });

const loadAssignment = (id: string) =>
  prisma.assignment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      confirmedAt: true,
      cancelReason: true,
      cancelledBy: true,
      technician: { select: { id: true, userId: true, name: true } },
      serviceRequest: {
        select: {
          id: true,
          title: true,
          customer: { select: { userId: true, name: true } },
        },
      },
    },
  });

const loadPayment = (id: string) =>
  prisma.payment.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      currency: true,
      dueDate: true,
      refundReason: true,
      workOrder: {
        select: {
          assignment: {
            select: {
              serviceRequest: {
                select: {
                  id: true,
                  title: true,
                  customer: { select: { userId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

const serviceRequestCreated = safe(
  "serviceRequestCreated",
  async (serviceRequestId: string) => {
    const sr = await loadServiceRequest(serviceRequestId);
    if (!sr) return;

    await notifyManagement({
      type: "SERVICE_REQUEST_CREATED",
      title: "New service request",
      message: `${sr.customer.name} submitted a new request: "${sr.title}".`,
      entityType: "ServiceRequest",
      entityId: sr.id,
    });
  },
);

const serviceRequestReviewed = safe(
  "serviceRequestReviewed",
  async (serviceRequestId: string) => {
    const sr = await loadServiceRequest(serviceRequestId);
    if (!sr) return;

    const base = {
      entityType: "ServiceRequest",
      entityId: sr.id,
    };

    if (sr.status === "UNDER_REVIEW") {
      await notify({
        ...base,
        userId: sr.customer.userId,
        type: "SERVICE_REQUEST_UNDER_REVIEW",
        title: "Your request is under review",
        message: `A admin has started reviewing "${sr.title}".`,
      });
    } else if (sr.status === "APPROVED") {
      await notify({
        ...base,
        userId: sr.customer.userId,
        type: "SERVICE_REQUEST_APPROVED",
        title: "Your request was approved",
        message: `"${sr.title}" has been approved. A technician will be assigned soon.`,
        sendEmail: true,
      });
    } else if (sr.status === "REJECTED") {
      await notify({
        ...base,
        userId: sr.customer.userId,
        type: "SERVICE_REQUEST_REJECTED",
        title: "Your request was rejected",
        message: `"${sr.title}" was rejected.${
          sr.rejectionReason ? ` Reason: ${sr.rejectionReason}` : ""
        }`,
        sendEmail: true,
      });
    }
  },
);

const serviceRequestCancelled = safe(
  "serviceRequestCancelled",
  async (serviceRequestId: string) => {
    const sr = await loadServiceRequest(serviceRequestId);
    if (!sr) return;

    await notifyManagement({
      type: "SERVICE_REQUEST_CANCELLED",
      title: "Service request cancelled",
      message: `${sr.customer.name} cancelled the request "${sr.title}".`,
      entityType: "ServiceRequest",
      entityId: sr.id,
    });
  },
);

const assignmentCreated = safe(
  "assignmentCreated",
  async (assignmentId: string) => {
    const a = await loadAssignment(assignmentId);
    if (!a) return;

    await notify({
      userId: a.technician.userId,
      type: "ASSIGNMENT_CREATED",
      title: "New job assigned to you",
      message: `"${a.serviceRequest.title}" on ${fmtDate(a.scheduledStart)}. Please confirm or decline.`,
      entityType: "Assignment",
      entityId: a.id,
      sendEmail: true,
    });
  },
);

const assignmentConfirmed = safe(
  "assignmentConfirmed",
  async (assignmentId: string) => {
    const a = await loadAssignment(assignmentId);
    if (!a) return;

    await notify({
      userId: a.serviceRequest.customer.userId,
      type: "ASSIGNMENT_CONFIRMED",
      title: "Your visit is confirmed",
      message: `${a.technician.name} will visit on ${fmtDate(a.scheduledStart)} for "${a.serviceRequest.title}".`,
      entityType: "Assignment",
      entityId: a.id,
      sendEmail: true,
    });

    await notifyManagement({
      type: "ASSIGNMENT_CONFIRMED",
      title: "Technician confirmed the visit",
      message: `${a.technician.name} confirmed "${a.serviceRequest.title}" for ${fmtDate(a.scheduledStart)}.`,
      entityType: "Assignment",
      entityId: a.id,
    });
  },
);

const assignmentCancelled = safe(
  "assignmentCancelled",
  async (assignmentId: string) => {
    const a = await loadAssignment(assignmentId);
    if (!a) return;

    const canceller = a.cancelledBy
      ? await prisma.user.findUnique({
          where: { id: a.cancelledBy },
          select: { role: true },
        })
      : null;

    const reason = a.cancelReason ? ` Reason: ${a.cancelReason}` : "";

    if (canceller?.role === "TECHNICIAN") {
      await notifyManagement({
        type: "ASSIGNMENT_CANCELLED",
        title: "Technician cancelled an assignment",
        message: `${a.technician.name} cancelled "${a.serviceRequest.title}". It needs a new technician.${reason}`,
        entityType: "Assignment",
        entityId: a.id,
      });
    } else {
      await notify({
        userId: a.technician.userId,
        type: "ASSIGNMENT_CANCELLED",
        title: "Assignment cancelled",
        message: `Your visit for "${a.serviceRequest.title}" on ${fmtDate(a.scheduledStart)} was cancelled.${reason}`,
        entityType: "Assignment",
        entityId: a.id,
        sendEmail: true,
      });
    }

    if (a.confirmedAt) {
      await notify({
        userId: a.serviceRequest.customer.userId,
        type: "ASSIGNMENT_CANCELLED",
        title: "Your visit was cancelled",
        message: `The visit for "${a.serviceRequest.title}" on ${fmtDate(a.scheduledStart)} was cancelled. We will arrange a new time.`,
        entityType: "Assignment",
        entityId: a.id,
        sendEmail: true,
      });
    }
  },
);

const assignmentRescheduled = safe(
  "assignmentRescheduled",
  async (oldAssignmentId: string, newAssignmentId: string) => {
    const [oldA, newA] = await Promise.all([
      loadAssignment(oldAssignmentId),
      loadAssignment(newAssignmentId),
    ]);
    if (!oldA || !newA) return;

    await notify({
      userId: newA.technician.userId,
      type: "ASSIGNMENT_RESCHEDULED",
      title: "Visit rescheduled — please confirm",
      message: `"${newA.serviceRequest.title}" is now on ${fmtDate(newA.scheduledStart)}. Please confirm the new time.`,
      entityType: "Assignment",
      entityId: newA.id,
      sendEmail: true,
    });

    if (oldA.technician.userId !== newA.technician.userId) {
      await notify({
        userId: oldA.technician.userId,
        type: "ASSIGNMENT_CANCELLED",
        title: "Assignment removed",
        message: `"${oldA.serviceRequest.title}" was reassigned to another technician.`,
        entityType: "Assignment",
        entityId: oldA.id,
      });
    }

    if (oldA.confirmedAt) {
      await notify({
        userId: newA.serviceRequest.customer.userId,
        type: "ASSIGNMENT_RESCHEDULED",
        title: "Your visit was rescheduled",
        message: `The visit for "${newA.serviceRequest.title}" moved to ${fmtDate(newA.scheduledStart)}. We will confirm once the technician accepts.`,
        entityType: "Assignment",
        entityId: newA.id,
        sendEmail: true,
      });
    }
  },
);

const visitReminder = safe("visitReminder", async (assignmentId: string) => {
  const a = await loadAssignment(assignmentId);
  if (!a) return;

  const message = `Visit for "${a.serviceRequest.title}" starts at ${fmtDate(a.scheduledStart)}.`;

  await notifyUsers([a.technician.userId, a.serviceRequest.customer.userId], {
    type: "VISIT_REMINDER",
    title: "Upcoming visit reminder",
    message,
    entityType: "Assignment",
    entityId: a.id,
    sendEmail: true,
    dedupe: true,
  });
});

const workOrderStatusChanged = safe(
  "workOrderStatusChanged",
  async (workOrderId: string) => {
    const wo = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        status: true,
        assignment: {
          select: {
            technician: { select: { userId: true, name: true } },
            serviceRequest: {
              select: {
                id: true,
                title: true,
                customer: { select: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!wo) return;

    const { technician, serviceRequest } = wo.assignment;
    const customerId = serviceRequest.customer.userId;
    const base = { entityType: "WorkOrder", entityId: wo.id };

    switch (wo.status) {
      case "TECHNICIAN_EN_ROUTE":
        await notify({
          ...base,
          userId: customerId,
          type: "TECHNICIAN_EN_ROUTE",
          title: "Technician is on the way",
          message: `${technician.name} is heading to you for "${serviceRequest.title}".`,
          sendEmail: true,
        });
        break;

      case "ARRIVED":
        await notify({
          ...base,
          userId: customerId,
          type: "TECHNICIAN_ARRIVED",
          title: "Technician has arrived",
          message: `${technician.name} arrived for "${serviceRequest.title}".`,
        });
        break;

      case "IN_PROGRESS":
        await notify({
          ...base,
          userId: customerId,
          type: "WORK_STARTED",
          title: "Work has started",
          message: `${technician.name} started working on "${serviceRequest.title}".`,
        });
        break;

      case "COMPLETED":
        await notify({
          ...base,
          userId: customerId,
          type: "WORK_COMPLETED",
          title: "Work completed",
          message: `${technician.name} finished "${serviceRequest.title}". It is now being verified.`,
        });
        await notifyManagement({
          ...base,
          type: "WORK_COMPLETED",
          title: "Work ready for verification",
          message: `${technician.name} completed "${serviceRequest.title}". Please review and verify.`,
        });
        break;

      case "VERIFIED":
        await notify({
          ...base,
          userId: customerId,
          type: "WORK_VERIFIED",
          title: "Work verified",
          message: `"${serviceRequest.title}" has been verified. Your invoice will follow shortly.`,
        });
        await notify({
          ...base,
          userId: technician.userId,
          type: "WORK_VERIFIED",
          title: "Your work was verified",
          message: `The admin verified your work on "${serviceRequest.title}".`,
        });
        break;

      default:
        break;
    }
  },
);

const invoiceCreated = safe("invoiceCreated", async (paymentId: string) => {
  const p = await loadPayment(paymentId);
  if (!p) return;
  const sr = p.workOrder.assignment.serviceRequest;

  const due = p.dueDate ? ` Due by ${fmtDate(p.dueDate)}.` : "";
  await notify({
    userId: sr.customer.userId,
    type: "INVOICE_CREATED",
    title: "New invoice",
    message: `Invoice ${p.invoiceNumber} for "${sr.title}": ${p.currency} ${p.totalAmount.toFixed(2)}.${due}`,
    entityType: "Payment",
    entityId: p.id,
    sendEmail: true,
  });
});

const paymentReceived = safe("paymentReceived", async (paymentId: string) => {
  const p = await loadPayment(paymentId);
  if (!p) return;
  const sr = p.workOrder.assignment.serviceRequest;

  await notify({
    userId: sr.customer.userId,
    type: "PAYMENT_RECEIVED",
    title: "Payment received",
    message: `We received ${p.currency} ${p.totalAmount.toFixed(2)} for invoice ${p.invoiceNumber}. Thank you! Please leave your feedback.`,
    entityType: "Payment",
    entityId: p.id,
    sendEmail: true,
    dedupe: true,
  });

  await notifyManagement({
    type: "PAYMENT_RECEIVED",
    title: "Payment received",
    message: `Invoice ${p.invoiceNumber} paid: ${p.currency} ${p.totalAmount.toFixed(2)}.`,
    entityType: "Payment",
    entityId: p.id,
  });
});

const paymentRefunded = safe("paymentRefunded", async (paymentId: string) => {
  const p = await loadPayment(paymentId);
  if (!p) return;
  const sr = p.workOrder.assignment.serviceRequest;

  await notify({
    userId: sr.customer.userId,
    type: "PAYMENT_REFUNDED",
    title: "Payment refunded",
    message: `Invoice ${p.invoiceNumber} (${p.currency} ${p.totalAmount.toFixed(2)}) was refunded.${
      p.refundReason ? ` Reason: ${p.refundReason}` : ""
    }`,
    entityType: "Payment",
    entityId: p.id,
    sendEmail: true,
  });
});

const feedbackReceived = safe(
  "feedbackReceived",
  async (feedbackId: string) => {
    const f = await prisma.customerFeedback.findUnique({
      where: { id: feedbackId },
      select: {
        id: true,
        rating: true,
        customer: { select: { name: true } },
        serviceRequest: {
          select: {
            id: true,
            title: true,
            assignments: {
              where: { status: "CONFIRMED" },
              select: { technician: { select: { userId: true, name: true } } },
              take: 1,
            },
          },
        },
      },
    });
    if (!f) return;

    const technician = f.serviceRequest.assignments[0]?.technician;

    if (technician) {
      await notify({
        userId: technician.userId,
        type: "FEEDBACK_RECEIVED",
        title: "New customer feedback",
        message: `${f.customer.name} rated "${f.serviceRequest.title}" ${f.rating}/5.`,
        entityType: "Feedback",
        entityId: f.id,
      });
    }

    if (f.rating <= 2) {
      await notifyManagement({
        type: "FEEDBACK_RECEIVED",
        title: "Low rating alert",
        message: `${f.customer.name} gave ${f.rating}/5 for "${f.serviceRequest.title}"${
          technician ? ` (technician: ${technician.name})` : ""
        }.`,
        entityType: "Feedback",
        entityId: f.id,
      });
    }
  },
);

const technicianApplicationSubmitted = safe(
  "technicianApplicationSubmitted",
  async (technicianId: string) => {
    const t = await prisma.technician.findUnique({
      where: { id: technicianId },
      select: { id: true, name: true },
    });
    if (!t) return;

    await notifyManagement({
      type: "TECHNICIAN_APPLICATION_SUBMITTED",
      title: "New technician application",
      message: `${t.name} applied to become a technician. Please review.`,
      entityType: "Technician",
      entityId: t.id,
    });
  },
);

const technicianApplicationReviewed = safe(
  "technicianApplicationReviewed",
  async (technicianId: string) => {
    const t = await prisma.technician.findUnique({
      where: { id: technicianId },
      select: {
        id: true,
        userId: true,
        verificationStatus: true,
        rejectionReason: true,
      },
    });
    if (!t) return;

    const approved = t.verificationStatus === "APPROVED";
    await notify({
      userId: t.userId,
      type: "TECHNICIAN_APPLICATION_REVIEWED",
      title: approved ? "Application approved" : "Application rejected",
      message: approved
        ? "Your technician application was approved. You can now receive jobs."
        : `Your technician application was rejected.${
            t.rejectionReason ? ` Reason: ${t.rejectionReason}` : ""
          }`,
      entityType: "Technician",
      entityId: t.id,
    });
  },
);

export const NotificationEvents = {
  serviceRequestCreated,
  serviceRequestReviewed,
  serviceRequestCancelled,
  assignmentCreated,
  assignmentConfirmed,
  assignmentCancelled,
  assignmentRescheduled,
  visitReminder,
  workOrderStatusChanged,
  invoiceCreated,
  paymentReceived,
  paymentRefunded,
  feedbackReceived,
  technicianApplicationSubmitted,
  technicianApplicationReviewed,
};
