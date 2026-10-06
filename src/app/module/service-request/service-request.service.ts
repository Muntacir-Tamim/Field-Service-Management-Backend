import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import { AuditLogServices } from "../audit-log/audit-log.service";
import { NotificationEvents } from "../notification/notification.events";
import type {
  ICreateServiceRequestPayload,
  IReviewServiceRequestPayload,
  IServiceRequestQuery,
} from "./service-request.interface";

const createServiceRequest = async (
  payload: ICreateServiceRequestPayload,
  files: Express.Multer.File[],
  user: IRequestUser,
) => {
  const customer = await prisma.customer.findUnique({
    where: { userId: user.userId },
  });

  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer Profile Not Found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const serviceRequest = await tx.serviceRequest.create({
      data: {
        title: payload.title,
        description: payload.description,
        priority: payload.priority ?? "MEDIUM",
        preferredDate: payload.preferredDate
          ? new Date(payload.preferredDate)
          : null,
        address: payload.address,
        city: payload.city,
        status: "PENDING",
        customerId: customer.id,
      },
    });

    if (files && files.length > 0) {
      for (const file of files) {
        const uploadResult = await new Promise<{
          secure_url: string;
          public_id: string;
        }>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "fsm/service-requests", resource_type: "auto" },
            (error, result) => {
              if (error) return reject(error);
              resolve(result as { secure_url: string; public_id: string });
            },
          );
          uploadStream.end(file.buffer);
        });

        await tx.serviceRequestAttachment.create({
          data: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            fileType: file.mimetype,
            fileName: file.originalname,
            serviceRequestId: serviceRequest.id,
          },
        });
      }
    }

    await AuditLogServices.record(
      {
        action: "SERVICE_REQUEST_CREATED",
        entityType: "ServiceRequest",
        entityId: serviceRequest.id,
        description: `Service request "${serviceRequest.title}" created`,
        actor: user,
        newValue: {
          status: serviceRequest.status,
          priority: serviceRequest.priority,
          city: serviceRequest.city,
        },
      },
      tx,
    );

    return await tx.serviceRequest.findUnique({
      where: { id: serviceRequest.id },
      include: {
        attachments: true,
        customer: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
  });

  if (result) void NotificationEvents.serviceRequestCreated(result.id);

  return result;
};

const reviewServiceRequest = async (
  serviceRequestId: string,
  payload: IReviewServiceRequestPayload,
  user: IRequestUser,
) => {
  const admin = await prisma.admin.findUnique({
    where: { userId: user.userId },
  });

  if (!admin) {
    throw new AppError(httpStatus.NOT_FOUND, "Admin Profile Not Found");
  }

  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId, isDeleted: false },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
  }

  if (
    serviceRequest.status !== "PENDING" &&
    serviceRequest.status !== "UNDER_REVIEW"
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot review a request with status: ${serviceRequest.status}`,
    );
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        status: payload.status,
        rejectionReason:
          payload.status === "REJECTED" ? payload.rejectionReason : null,
        reviewedAt: new Date(),
        adminId: admin.id,
      },
      include: {
        customer: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
        admin: {
          select: {
            id: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    await AuditLogServices.record(
      {
        action: "SERVICE_REQUEST_STATUS_CHANGED",
        entityType: "ServiceRequest",
        entityId: serviceRequestId,
        description: `Service request status changed from ${serviceRequest.status} to ${payload.status}`,
        actor: user,
        oldValue: { status: serviceRequest.status },
        newValue: {
          status: payload.status,
          rejectionReason:
            payload.status === "REJECTED"
              ? (payload.rejectionReason ?? null)
              : null,
        },
      },
      tx,
    );

    return updated;
  });

  void NotificationEvents.serviceRequestReviewed(serviceRequestId);

  return updatedRequest;
};

const cancelServiceRequest = async (
  serviceRequestId: string,
  user: IRequestUser,
) => {
  const customer = await prisma.customer.findUnique({
    where: { userId: user.userId },
  });

  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer Profile Not Found");
  }

  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId, isDeleted: false },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
  }

  if (serviceRequest.customerId !== customer.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to cancel this request",
    );
  }

  if (serviceRequest.status === "COMPLETED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot cancel a completed request",
    );
  }

  if (serviceRequest.status === "CANCELLED") {
    throw new AppError(httpStatus.BAD_REQUEST, "Request is already cancelled");
  }

  if (serviceRequest.status === "APPROVED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cannot cancel an approved request. Please contact your admin.",
    );
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: "CANCELLED" },
    });

    await AuditLogServices.record(
      {
        action: "SERVICE_REQUEST_STATUS_CHANGED",
        entityType: "ServiceRequest",
        entityId: serviceRequestId,
        description: `Service request cancelled by customer (was ${serviceRequest.status})`,
        actor: user,
        oldValue: { status: serviceRequest.status },
        newValue: { status: "CANCELLED" },
      },
      tx,
    );

    return updated;
  });
  void NotificationEvents.serviceRequestCancelled(serviceRequestId);

  return updatedRequest;
};

const getMyServiceRequests = async (
  query: IServiceRequestQuery,
  user: IRequestUser,
) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const customer = await prisma.customer.findUnique({
    where: { userId: user.userId },
  });

  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer Profile Not Found");
  }

  const andConditions: Prisma.ServiceRequestWhereInput[] = [
    { customerId: customer.id },
    { isDeleted: false },
  ];

  if (query.status) {
    andConditions.push({
      status: query.status as Prisma.EnumServiceRequestStatusFilter,
    });
  }

  if (query.priority) {
    andConditions.push({
      priority: query.priority as Prisma.EnumPriorityFilter,
    });
  }

  const serviceRequests = await prisma.serviceRequest.findMany({
    where: { AND: andConditions },
    take: limit,
    skip,
    orderBy: { [sortBy]: sortOrder },
    include: {
      attachments: true,
      assignments: {
        where: { status: "CONFIRMED" },
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          technician: {
            select: {
              id: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      },
      feedback: true,
    },
  });

  for (const sr of serviceRequests) {
    if (sr.feedback?.isDeleted) sr.feedback = null;
  }

  const total = await prisma.serviceRequest.count({
    where: { AND: andConditions },
  });

  return {
    data: serviceRequests,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getAllServiceRequests = async (query: IServiceRequestQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";

  const andConditions: Prisma.ServiceRequestWhereInput[] = [
    { isDeleted: false },
  ];

  if (query.status) {
    andConditions.push({
      status: query.status as Prisma.EnumServiceRequestStatusFilter,
    });
  }

  if (query.priority) {
    andConditions.push({
      priority: query.priority as Prisma.EnumPriorityFilter,
    });
  }

  if (query.city) {
    andConditions.push({
      city: { contains: query.city, mode: "insensitive" },
    });
  }

  const serviceRequests = await prisma.serviceRequest.findMany({
    where: { AND: andConditions },
    take: limit,
    skip,
    orderBy: { [sortBy]: sortOrder },
    include: {
      customer: {
        select: {
          id: true,
          contactNumber: true,
          city: true,
          user: { select: { name: true, email: true } },
        },
      },
      admin: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
      attachments: true,
      assignments: {
        select: {
          id: true,
          status: true,
          scheduledStart: true,
        },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const total = await prisma.serviceRequest.count({
    where: { AND: andConditions },
  });

  return {
    data: serviceRequests,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getSingleServiceRequest = async (
  serviceRequestId: string,
  user: IRequestUser,
) => {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId, isDeleted: false },
    include: {
      customer: {
        select: {
          id: true,
          contactNumber: true,
          address: true,
          city: true,
          userId: true,
          user: { select: { name: true, email: true, imageUrl: true } },
        },
      },
      admin: {
        select: {
          id: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      },
      attachments: true,
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          technician: {
            select: {
              id: true,
              user: { select: { name: true, email: true, imageUrl: true } },
              skills: { include: { skill: true } },
            },
          },
          workOrder: true,
        },
      },
      feedback: true,
    },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
  }

  if (serviceRequest.feedback?.isDeleted) serviceRequest.feedback = null;

  // Customer শুধু নিজেরটা দেখতে পারবে
  if (user.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({
      where: { userId: user.userId },
    });
    if (!customer || serviceRequest.customerId !== customer.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this request",
      );
    }
  }

  // Technician শুধু assigned request দেখতে পারবে
  if (user.role === "TECHNICIAN") {
    const technician = await prisma.technician.findUnique({
      where: { userId: user.userId },
    });
    const isAssigned = serviceRequest.assignments.some(
      (a) => a.technicianId === technician?.id,
    );
    if (!isAssigned) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this request",
      );
    }
  }

  return serviceRequest;
};

const markUnderReview = async (
  serviceRequestId: string,
  user: IRequestUser,
) => {
  const admin = await prisma.admin.findUnique({
    where: { userId: user.userId },
  });

  if (!admin) {
    throw new AppError(httpStatus.NOT_FOUND, "admin Profile Not Found");
  }

  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId, isDeleted: false },
  });

  if (!serviceRequest) {
    throw new AppError(httpStatus.NOT_FOUND, "Service Request Not Found");
  }

  if (serviceRequest.status !== "PENDING") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only PENDING requests can be marked as under review",
    );
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        status: "UNDER_REVIEW",
        adminId: admin.id,
      },
    });

    await AuditLogServices.record(
      {
        action: "SERVICE_REQUEST_STATUS_CHANGED",
        entityType: "ServiceRequest",
        entityId: serviceRequestId,
        description:
          "Service request status changed from PENDING to UNDER_REVIEW",
        actor: user,
        oldValue: { status: "PENDING" },
        newValue: { status: "UNDER_REVIEW" },
      },
      tx,
    );

    return updated;
  });

  void NotificationEvents.serviceRequestReviewed(serviceRequestId);

  return updatedRequest;
};

export const ServiceRequestServices = {
  createServiceRequest,
  reviewServiceRequest,
  cancelServiceRequest,
  getMyServiceRequests,
  getAllServiceRequests,
  getSingleServiceRequest,
  markUnderReview,
};
