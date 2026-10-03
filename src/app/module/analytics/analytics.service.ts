import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
  AssignmentStatus,
  PaymentStatus,
  ServiceRequestStatus,
  TechnicianVerificationStatus,
  WorkOrderStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import type { IAnalyticsQuery } from "./analytics.interface";

// "Completed job" = work order the technician finished (COMPLETED) or the manager verified (VERIFIED)
const DONE_WORK_ORDER_STATUSES: WorkOrderStatus[] = ["COMPLETED", "VERIFIED"];
const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["PENDING", "CONFIRMED"];
const LEADERBOARD_SORT_FIELDS = [
  "completedJobs",
  "averageRating",
  "laborHours",
];

type DateRange = { from?: Date; to?: Date };

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const parseDate = (value: string, label: string, endOfDay = false) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(httpStatus.BAD_REQUEST, `${label} is not a valid date`);
  }
  // "2026-10-31" as `to` should include the whole day
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

const parseRange = (query: IAnalyticsQuery): DateRange => {
  const from = query.from ? parseDate(query.from, "from") : undefined;
  const to = query.to ? parseDate(query.to, "to", true) : undefined;

  if (from && to && from > to) {
    throw new AppError(httpStatus.BAD_REQUEST, "from must be before to");
  }
  return { from, to };
};

const dateFilter = (range: DateRange): Prisma.DateTimeFilter | undefined => {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
};

const num = (value: { toNumber: () => number } | null | undefined) =>
  value ? value.toNumber() : 0;

const round2 = (value: number) => Math.round(value * 100) / 100;

// every status shows up in the response, even when its count is 0
const toStatusMap = <T extends string>(
  keys: readonly T[],
  rows: { status: T; _count: { _all: number } }[],
) => {
  const map = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
    T,
    number
  >;
  for (const row of rows) {
    map[row.status] = row._count._all;
  }
  return map;
};

const sumValues = (map: Record<string, number>) =>
  Object.values(map).reduce((total, value) => total + value, 0);

// ─────────────────────────────────────────────
// TECHNICIAN: single technician stats
// completed jobs / labor hours -> filtered by workOrder.completedAt
// rating                       -> filtered by feedback.createdAt
// assignments / work-order status counts -> filtered by createdAt
// ─────────────────────────────────────────────
const getTechnicianStats = async (technicianId: string, range: DateRange) => {
  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, isDeleted: false },
    select: {
      id: true,
      name: true,
      isAvailable: true,
      experienceYears: true,
      verificationStatus: true,
    },
  });

  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found");
  }

  const completedAt = dateFilter(range);
  const createdAt = dateFilter(range);

  const doneWhere: Prisma.WorkOrderWhereInput = {
    status: { in: DONE_WORK_ORDER_STATUSES },
    assignment: { technicianId },
    ...(completedAt ? { completedAt } : {}),
  };

  // Feedback has no technicianId. Technician = CONFIRMED assignment of the service request.
  const feedbackWhere: Prisma.CustomerFeedbackWhereInput = {
    serviceRequest: {
      assignments: { some: { technicianId, status: "CONFIRMED" } },
    },
    ...(createdAt ? { createdAt } : {}),
  };

  const [done, workOrdersByStatus, assignmentsByStatus, rating, ratingGroups] =
    await Promise.all([
      prisma.workOrder.aggregate({
        where: doneWhere,
        _count: { _all: true },
        _sum: { laborHours: true },
      }),
      prisma.workOrder.groupBy({
        by: ["status"],
        where: {
          assignment: { technicianId },
          ...(createdAt ? { createdAt } : {}),
        },
        _count: { _all: true },
      }),
      prisma.assignment.groupBy({
        by: ["status"],
        where: { technicianId, ...(createdAt ? { createdAt } : {}) },
        _count: { _all: true },
      }),
      prisma.customerFeedback.aggregate({
        where: feedbackWhere,
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.customerFeedback.groupBy({
        by: ["rating"],
        where: feedbackWhere,
        _count: { _all: true },
      }),
    ]);

  const upcomingVisits = await prisma.assignment.count({
    where: {
      technicianId,
      status: { in: ACTIVE_ASSIGNMENT_STATUSES },
      scheduledStart: { gte: new Date() },
    },
  });

  const completedJobs = done._count._all;
  const totalLaborHours = num(done._sum.laborHours);

  const distribution: Record<string, number> = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  };
  for (const group of ratingGroups) {
    distribution[String(group.rating)] = group._count._all;
  }

  const assignmentStatus = toStatusMap(
    Object.values(AssignmentStatus),
    assignmentsByStatus,
  );
  const totalAssignments = sumValues(assignmentStatus);

  return {
    technician,
    range: { from: range.from ?? null, to: range.to ?? null },
    jobs: {
      completed: completedJobs,
    },
    laborHours: {
      total: round2(totalLaborHours),
      averagePerJob:
        completedJobs > 0 ? round2(totalLaborHours / completedJobs) : 0,
    },
    rating: {
      average: rating._avg.rating === null ? null : round2(rating._avg.rating),
      totalReviews: rating._count._all,
      distribution,
    },
    assignments: {
      total: totalAssignments,
      byStatus: assignmentStatus,
      cancellationRate:
        totalAssignments > 0
          ? round2((assignmentStatus.CANCELLED / totalAssignments) * 100)
          : 0,
      upcomingVisits,
    },
    workOrders: {
      byStatus: toStatusMap(Object.values(WorkOrderStatus), workOrdersByStatus),
    },
  };
};

const getMyStats = async (query: IAnalyticsQuery, user: IRequestUser) => {
  const technician = await prisma.technician.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });

  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found");
  }

  return getTechnicianStats(technician.id, parseRange(query));
};

const getSingleTechnicianStats = async (
  technicianId: string,
  query: IAnalyticsQuery,
) => getTechnicianStats(technicianId, parseRange(query));

// ─────────────────────────────────────────────
// MANAGER: technician leaderboard (approved technicians only)
// ─────────────────────────────────────────────
const getTechnicianLeaderboard = async (query: IAnalyticsQuery) => {
  const range = parseRange(query);
  const completedAt = dateFilter(range);
  const createdAt = dateFilter(range);

  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
    50,
  );
  const sortBy = LEADERBOARD_SORT_FIELDS.includes(query.sortBy ?? "")
    ? (query.sortBy as string)
    : "completedJobs";

  const technicians = await prisma.technician.findMany({
    where: { isDeleted: false, verificationStatus: "APPROVED" },
    select: {
      id: true,
      name: true,
      isAvailable: true,
      experienceYears: true,
      user: { select: { imageUrl: true } },
    },
  });

  const technicianIds = technicians.map((technician) => technician.id);

  const [workOrders, feedbacks] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        status: { in: DONE_WORK_ORDER_STATUSES },
        assignment: { technicianId: { in: technicianIds } },
        ...(completedAt ? { completedAt } : {}),
      },
      select: {
        laborHours: true,
        assignment: { select: { technicianId: true } },
      },
    }),
    prisma.customerFeedback.findMany({
      where: {
        serviceRequest: {
          assignments: {
            some: { technicianId: { in: technicianIds }, status: "CONFIRMED" },
          },
        },
        ...(createdAt ? { createdAt } : {}),
      },
      select: {
        rating: true,
        serviceRequest: {
          select: {
            assignments: {
              where: { status: "CONFIRMED" },
              select: { technicianId: true },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const jobMap = new Map<string, { completed: number; hours: number }>();
  for (const workOrder of workOrders) {
    const id = workOrder.assignment.technicianId;
    const entry = jobMap.get(id) ?? { completed: 0, hours: 0 };
    entry.completed += 1;
    entry.hours += num(workOrder.laborHours);
    jobMap.set(id, entry);
  }

  const ratingMap = new Map<string, { sum: number; count: number }>();
  for (const feedback of feedbacks) {
    const id = feedback.serviceRequest.assignments[0]?.technicianId;
    if (!id) continue;
    const entry = ratingMap.get(id) ?? { sum: 0, count: 0 };
    entry.sum += feedback.rating;
    entry.count += 1;
    ratingMap.set(id, entry);
  }

  const rows = technicians.map((technician) => {
    const jobs = jobMap.get(technician.id);
    const ratings = ratingMap.get(technician.id);

    return {
      technicianId: technician.id,
      name: technician.name,
      imageUrl: technician.user.imageUrl,
      isAvailable: technician.isAvailable,
      experienceYears: technician.experienceYears,
      completedJobs: jobs?.completed ?? 0,
      laborHours: round2(jobs?.hours ?? 0),
      averageRating: ratings ? round2(ratings.sum / ratings.count) : null,
      totalReviews: ratings?.count ?? 0,
    };
  });

  rows.sort((a, b) => {
    if (sortBy === "averageRating") {
      // technicians without reviews go to the bottom
      const diff = (b.averageRating ?? -1) - (a.averageRating ?? -1);
      return diff !== 0 ? diff : b.totalReviews - a.totalReviews;
    }
    if (sortBy === "laborHours") return b.laborHours - a.laborHours;
    return b.completedJobs - a.completedJobs;
  });

  return {
    range: { from: range.from ?? null, to: range.to ?? null },
    sortBy,
    totalTechnicians: rows.length,
    data: rows.slice(0, limit),
  };
};

// ─────────────────────────────────────────────
// MANAGER: dashboard stats (all counts use createdAt for the optional range)
// ─────────────────────────────────────────────
const getDashboardStats = async (query: IAnalyticsQuery) => {
  const range = parseRange(query);
  const createdAt = dateFilter(range);
  const created = createdAt ? { createdAt } : {};

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const [
    serviceRequestsByStatus,
    assignmentsByStatus,
    workOrdersByStatus,
    paymentsByStatus,
    collected,
    outstanding,
    refunded,
    techniciansByVerification,
    availableTechnicians,
    totalCustomers,
    feedback,
    approvedWaitingForAssignment,
    visitsToday,
  ] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ["status"],
      where: { isDeleted: false, ...created },
      _count: { _all: true },
    }),
    prisma.assignment.groupBy({
      by: ["status"],
      where: created,
      _count: { _all: true },
    }),
    prisma.workOrder.groupBy({
      by: ["status"],
      where: created,
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["status"],
      where: created,
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: "PAID", ...created },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "UNPAID", ...created },
      _sum: { totalAmount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "REFUNDED", ...created },
      _sum: { refundAmount: true },
    }),
    prisma.technician.groupBy({
      by: ["verificationStatus"],
      where: { isDeleted: false },
      _count: { _all: true },
    }),
    prisma.technician.count({
      where: {
        isDeleted: false,
        verificationStatus: "APPROVED",
        isAvailable: true,
      },
    }),
    prisma.customer.count({ where: { isDeleted: false } }),
    prisma.customerFeedback.aggregate({
      where: created,
      _avg: { rating: true },
      _count: { _all: true },
    }),
    // approved requests that still have no active assignment (manager must act)
    prisma.serviceRequest.count({
      where: {
        isDeleted: false,
        status: "APPROVED",
        assignments: { none: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } } },
      },
    }),
    prisma.assignment.count({
      where: {
        status: { in: ACTIVE_ASSIGNMENT_STATUSES },
        scheduledStart: { gte: startOfToday, lte: endOfToday },
      },
    }),
  ]);

  const serviceRequests = toStatusMap(
    Object.values(ServiceRequestStatus),
    serviceRequestsByStatus,
  );
  const assignments = toStatusMap(
    Object.values(AssignmentStatus),
    assignmentsByStatus,
  );
  const workOrders = toStatusMap(
    Object.values(WorkOrderStatus),
    workOrdersByStatus,
  );
  const payments = toStatusMap(Object.values(PaymentStatus), paymentsByStatus);
  const technicians = toStatusMap(
    Object.values(TechnicianVerificationStatus),
    techniciansByVerification.map((row) => ({
      status: row.verificationStatus,
      _count: row._count,
    })),
  );

  return {
    range: { from: range.from ?? null, to: range.to ?? null },
    serviceRequests: {
      total: sumValues(serviceRequests),
      byStatus: serviceRequests,
    },
    assignments: { total: sumValues(assignments), byStatus: assignments },
    workOrders: { total: sumValues(workOrders), byStatus: workOrders },
    payments: {
      total: sumValues(payments),
      byStatus: payments,
      amounts: {
        collected: round2(num(collected._sum.totalAmount)),
        outstanding: round2(num(outstanding._sum.totalAmount)),
        refunded: round2(num(refunded._sum.refundAmount)),
      },
    },
    technicians: {
      total: sumValues(technicians),
      byVerification: technicians,
      availableNow: availableTechnicians,
    },
    customers: { total: totalCustomers },
    feedback: {
      totalReviews: feedback._count._all,
      averageRating:
        feedback._avg.rating === null ? null : round2(feedback._avg.rating),
    },
    // quick "what needs my attention" numbers for the manager
    needsAttention: {
      pendingServiceRequests: serviceRequests.PENDING,
      underReviewServiceRequests: serviceRequests.UNDER_REVIEW,
      approvedWaitingForAssignment,
      workOrdersAwaitingVerification: workOrders.COMPLETED,
      unpaidInvoices: payments.UNPAID,
      pendingTechnicianApplications: technicians.PENDING,
      visitsToday,
    },
  };
};

export const AnalyticsServices = {
  getMyStats,
  getSingleTechnicianStats,
  getTechnicianLeaderboard,
  getDashboardStats,
};
