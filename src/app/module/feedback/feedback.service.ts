import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import { NotificationEvents } from "../notification/notification.events";
import { AuditLogServices } from "../audit-log/audit-log.service";
import type {
  ICreateFeedbackPayload,
  IFeedbackQuery,
  IUpdateFeedbackPayload,
} from "./feedback.interface";

const MANAGEMENT_ROLES = ["MANAGER"];
const SORTABLE_FIELDS = ["createdAt", "rating"];

const feedbackInclude = {
  customer: {
    select: {
      id: true,
      name: true,
      user: { select: { imageUrl: true } },
    },
  },
  serviceRequest: {
    select: {
      id: true,
      title: true,
      city: true,
      assignments: {
        where: { status: "CONFIRMED" as const },
        select: { technician: { select: { id: true, name: true } } },
        take: 1,
      },
    },
  },
} satisfies Prisma.CustomerFeedbackInclude;

const getPagination = (query: IFeedbackQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const getSorting = (query: IFeedbackQuery) => {
  const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
    ? (query.sortBy as string)
    : "createdAt";
  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";
  return {
    [sortBy]: sortOrder,
  } as Prisma.CustomerFeedbackOrderByWithRelationInput;
};

const technicianWhere = (
  technicianId: string,
): Prisma.CustomerFeedbackWhereInput => ({
  serviceRequest: {
    assignments: { some: { technicianId, status: "CONFIRMED" } },
  },
});

const paginateFeedbacks = async (
  baseConditions: Prisma.CustomerFeedbackWhereInput[],
  query: IFeedbackQuery,
) => {
  const { page, limit, skip } = getPagination(query);
  const conditions = [...baseConditions];

  const rating = Number(query.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
    conditions.push({ rating });
  }

  const where: Prisma.CustomerFeedbackWhereInput = { AND: conditions };

  const [data, total] = await Promise.all([
    prisma.customerFeedback.findMany({
      where,
      take: limit,
      skip,
      orderBy: getSorting(query),
      include: feedbackInclude,
    }),
    prisma.customerFeedback.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getCustomerOrThrow = async (userId: string) => {
  const customer = await prisma.customer.findUnique({ where: { userId } });
  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer Profile Not Found");
  }
  return customer;
};

const getTechnicianOrThrow = async (userId: string) => {
  const technician = await prisma.technician.findUnique({ where: { userId } });
  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found");
  }
  return technician;
};

const createFeedback = async (
  payload: ICreateFeedbackPayload,
  user: IRequestUser,
) => {
  const customer = await getCustomerOrThrow(user.userId);

  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: { id: payload.serviceRequestId, isDeleted: false },
    select: { id: true, customerId: true, status: true },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
  }

  if (serviceRequest.customerId !== customer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only give feedback on your own service requests",
    );
  }

  if (serviceRequest.status !== "COMPLETED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Feedback can only be given after the service is completed and paid. Current status: ${serviceRequest.status}`,
    );
  }

  const existing = await prisma.customerFeedback.findUnique({
    where: { serviceRequestId: serviceRequest.id },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already given feedback for this service request",
    );
  }

  try {
    const feedback = await prisma.customerFeedback.create({
      data: {
        rating: payload.rating,
        comment: payload.comment ?? null,
        customerId: customer.id,
        serviceRequestId: serviceRequest.id,
      },
      include: feedbackInclude,
    });

    void NotificationEvents.feedbackReceived(feedback.id);

    return feedback;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        "You have already given feedback for this service request",
      );
    }
    throw error;
  }
};

const updateMyFeedback = async (
  feedbackId: string,
  payload: IUpdateFeedbackPayload,
  user: IRequestUser,
) => {
  const customer = await getCustomerOrThrow(user.userId);

  const feedback = await prisma.customerFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, customerId: true },
  });

  if (!feedback) {
    throw new AppError(httpStatus.NOT_FOUND, "Feedback Not Found");
  }

  if (feedback.customerId !== customer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You can only update your own feedback",
    );
  }

  return prisma.customerFeedback.update({
    where: { id: feedbackId },
    data: {
      ...(payload.rating !== undefined ? { rating: payload.rating } : {}),
      ...(payload.comment !== undefined ? { comment: payload.comment } : {}),
    },
    include: feedbackInclude,
  });
};

const deleteFeedback = async (feedbackId: string, user: IRequestUser) => {
  const feedback = await prisma.customerFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, customerId: true },
  });

  if (!feedback) {
    throw new AppError(httpStatus.NOT_FOUND, "Feedback Not Found");
  }

  if (!MANAGEMENT_ROLES.includes(user.role)) {
    const customer = await getCustomerOrThrow(user.userId);
    if (feedback.customerId !== customer.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only delete your own feedback",
      );
    }
  }

  await prisma.customerFeedback.delete({ where: { id: feedbackId } });

  void AuditLogServices.record({
    action: "FEEDBACK_DELETED",
    entityType: "CustomerFeedback",
    entityId: feedbackId,
    description: `Feedback deleted by ${user.role}`,
    actor: user,
    metadata: { customerId: feedback.customerId },
  });

  return { id: feedbackId };
};

const getMyFeedbacks = async (query: IFeedbackQuery, user: IRequestUser) => {
  const customer = await getCustomerOrThrow(user.userId);
  return paginateFeedbacks([{ customerId: customer.id }], query);
};

const getAllFeedbacks = async (query: IFeedbackQuery) => {
  const conditions: Prisma.CustomerFeedbackWhereInput[] = [];
  if (query.technicianId) {
    conditions.push(technicianWhere(query.technicianId));
  }
  return paginateFeedbacks(conditions, query);
};

const getFeedbackByServiceRequest = async (
  serviceRequestId: string,
  user: IRequestUser,
) => {
  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: { id: serviceRequestId, isDeleted: false },
    select: { id: true, customerId: true },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
  }

  if (user.role === "CUSTOMER") {
    const customer = await getCustomerOrThrow(user.userId);
    if (serviceRequest.customerId !== customer.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can only view feedback of your own service requests",
      );
    }
  } else if (user.role === "TECHNICIAN") {
    const technician = await getTechnicianOrThrow(user.userId);
    const worked = await prisma.assignment.findFirst({
      where: {
        serviceRequestId,
        technicianId: technician.id,
        status: "CONFIRMED",
      },
      select: { id: true },
    });
    if (!worked) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You were not assigned to this service request",
      );
    }
  }

  const feedback = await prisma.customerFeedback.findUnique({
    where: { serviceRequestId },
    include: feedbackInclude,
  });

  if (!feedback) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "No feedback has been given for this service request yet",
    );
  }

  return feedback;
};

const getTechnicianRatingSummary = async (technicianId: string) => {
  const where = technicianWhere(technicianId);

  const [aggregate, grouped] = await Promise.all([
    prisma.customerFeedback.aggregate({
      where,
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.customerFeedback.groupBy({
      by: ["rating"],
      where,
      _count: { rating: true },
    }),
  ]);

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of grouped) {
    distribution[row.rating] = row._count.rating;
  }

  return {
    averageRating: aggregate._avg.rating
      ? Number(aggregate._avg.rating.toFixed(2))
      : 0,
    totalFeedbacks: aggregate._count.rating,
    distribution,
  };
};

const getTechnicianFeedbacks = async (
  technicianId: string,
  query: IFeedbackQuery,
) => {
  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, isDeleted: false },
    select: { id: true, name: true },
  });

  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found");
  }

  const [list, summary] = await Promise.all([
    paginateFeedbacks([technicianWhere(technicianId)], query),
    getTechnicianRatingSummary(technicianId),
  ]);

  return { ...list, summary, technician };
};

const getMyTechnicianFeedbacks = async (
  query: IFeedbackQuery,
  user: IRequestUser,
) => {
  const technician = await getTechnicianOrThrow(user.userId);
  return getTechnicianFeedbacks(technician.id, query);
};

export const FeedbackServices = {
  createFeedback,
  updateMyFeedback,
  deleteFeedback,
  getMyFeedbacks,
  getAllFeedbacks,
  getFeedbackByServiceRequest,
  getTechnicianFeedbacks,
  getMyTechnicianFeedbacks,
};
