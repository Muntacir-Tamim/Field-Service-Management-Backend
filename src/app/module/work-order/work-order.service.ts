// import httpStatus from "http-status";
// import { Prisma } from "../../../generated/prisma/client";
// import type { WorkOrderStatus } from "../../../generated/prisma/enums";
// import { cloudinary } from "../../lib/cloudinary";
// import { prisma } from "../../lib/prisma";
// import { AppError } from "../../utils/AppError";
// import type { IRequestUser } from "../auth/auth.interface";
// import type {
//   IAddPartPayload,
//   ICompleteWorkPayload,
//   IServiceReportPayload,
//   IStartWorkPayload,
//   IWorkOrderQuery,
// } from "./work-order.interface";

// type Tx = Prisma.TransactionClient;

// const ALL_STATUSES: WorkOrderStatus[] = [
//   "SCHEDULED",
//   "TECHNICIAN_EN_ROUTE",
//   "ARRIVED",
//   "IN_PROGRESS",
//   "COMPLETED",
//   "VERIFIED",
//   "CANCELLED",
// ];
// const SORTABLE_FIELDS = ["createdAt", "updatedAt", "status"];
// const MAX_ATTACHMENTS_PER_WORK_ORDER = 20;

// // ─────────────────────────────────────────────
// // Reusable includes
// // ─────────────────────────────────────────────
// const assignmentSummary = {
//   select: {
//     id: true,
//     status: true,
//     scheduledStart: true,
//     scheduledEnd: true,
//     actualStart: true,
//     actualEnd: true,
//     technicianId: true,
//     technician: {
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         contactNumber: true,
//         userId: true,
//       },
//     },
//     serviceRequest: {
//       select: {
//         id: true,
//         title: true,
//         description: true,
//         priority: true,
//         status: true,
//         address: true,
//         city: true,
//         customer: {
//           select: { id: true, name: true, contactNumber: true, userId: true },
//         },
//       },
//     },
//   },
// } satisfies Prisma.AssignmentDefaultArgs;

// const workOrderListInclude = {
//   assignment: assignmentSummary,
//   _count: { select: { parts: true, attachments: true } },
// } satisfies Prisma.WorkOrderInclude;

// const workOrderDetailInclude = {
//   assignment: assignmentSummary,
//   parts: { orderBy: { createdAt: "asc" } },
//   attachments: { orderBy: { createdAt: "asc" } },
//   serviceReport: true,
//   payment: {
//     select: {
//       id: true,
//       invoiceNumber: true,
//       status: true,
//       totalAmount: true,
//     },
//   },
// } satisfies Prisma.WorkOrderInclude;

// // ─────────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────────
// const parsePagination = (query: IWorkOrderQuery) => {
//   const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
//   const limit = Math.min(
//     Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
//     100,
//   );
//   const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
//     ? (query.sortBy as string)
//     : "createdAt";
//   const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";
//   return { page, limit, skip: (page - 1) * limit, sortBy, sortOrder };
// };

// const parseDate = (value: string, label: string) => {
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) {
//     throw new AppError(httpStatus.BAD_REQUEST, `${label} is not a valid date`);
//   }
//   return date;
// };

// const buildListFilters = (query: IWorkOrderQuery) => {
//   const and: Prisma.WorkOrderWhereInput[] = [];

//   if (query.status) {
//     if (!ALL_STATUSES.includes(query.status as WorkOrderStatus)) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         `Invalid status. Use one of: ${ALL_STATUSES.join(", ")}`,
//       );
//     }
//     and.push({ status: query.status as WorkOrderStatus });
//   }

//   if (query.technicianId) {
//     and.push({ assignment: { technicianId: query.technicianId } });
//   }

//   if (query.serviceRequestId) {
//     and.push({ assignment: { serviceRequestId: query.serviceRequestId } });
//   }

//   if (query.from) {
//     and.push({
//       assignment: { scheduledStart: { gte: parseDate(query.from, "from") } },
//     });
//   }
//   if (query.to) {
//     and.push({
//       assignment: { scheduledStart: { lte: parseDate(query.to, "to") } },
//     });
//   }

//   return and;
// };

// const getTechnicianOrThrow = async (user: IRequestUser) => {
//   const technician = await prisma.technician.findUnique({
//     where: { userId: user.userId },
//   });
//   if (!technician) {
//     throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found");
//   }
//   return technician;
// };

// // Loads the work order and makes sure it belongs to this technician
// // and its assignment is still CONFIRMED.
// const getOwnedWorkOrderOrThrow = async (
//   workOrderId: string,
//   user: IRequestUser,
//   db: Tx | typeof prisma = prisma,
// ) => {
//   const technician = await getTechnicianOrThrow(user);

//   const workOrder = await db.workOrder.findUnique({
//     where: { id: workOrderId },
//     include: {
//       assignment: {
//         select: { id: true, status: true, technicianId: true },
//       },
//     },
//   });

//   if (!workOrder) {
//     throw new AppError(httpStatus.NOT_FOUND, "Work Order Not Found");
//   }
//   if (workOrder.assignment.technicianId !== technician.id) {
//     throw new AppError(
//       httpStatus.FORBIDDEN,
//       "This work order is not assigned to you",
//     );
//   }
//   if (workOrder.assignment.status !== "CONFIRMED") {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "The assignment for this work order is not active",
//     );
//   }
//   return workOrder;
// };

// const assertStatus = (
//   current: WorkOrderStatus,
//   allowed: WorkOrderStatus | WorkOrderStatus[],
//   action: string,
// ) => {
//   const list = Array.isArray(allowed) ? allowed : [allowed];
//   if (!list.includes(current)) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       `Cannot ${action} when work order status is ${current}. Required: ${list.join(" or ")}`,
//     );
//   }
// };

// type UploadResult = {
//   secure_url: string;
//   public_id: string;
//   resource_type: string;
// };

// const uploadToCloudinary = (file: Express.Multer.File, folder: string) =>
//   new Promise<UploadResult>((resolve, reject) => {
//     const stream = cloudinary.uploader.upload_stream(
//       { folder, resource_type: "auto" },
//       (error, result) => {
//         if (error) return reject(error);
//         if (!result) return reject(new Error("Cloudinary returned no result"));
//         resolve(result as UploadResult);
//       },
//     );
//     stream.end(file.buffer);
//   });

// // best effort: used when the DB write fails after the upload succeeded
// const deleteUploads = async (uploads: UploadResult[]) => {
//   await Promise.allSettled(
//     uploads.map((u) =>
//       cloudinary.uploader.destroy(u.public_id, {
//         resource_type: u.resource_type,
//       }),
//     ),
//   );
// };

// // Move status safely. The "from" status is part of the UPDATE condition,
// // so two clicks at the same time cannot both succeed.
// const changeStatus = async (
//   workOrderId: string,
//   from: WorkOrderStatus,
//   to: WorkOrderStatus,
//   options: {
//     workOrderData?: Prisma.WorkOrderUpdateManyMutationInput;
//     assignmentId?: string;
//     assignmentData?: Prisma.AssignmentUpdateInput;
//     guard?: (tx: Tx) => Promise<void>;
//   } = {},
// ) => {
//   return prisma.$transaction(async (tx) => {
//     if (options.guard) await options.guard(tx);

//     const updated = await tx.workOrder.updateMany({
//       where: { id: workOrderId, status: from },
//       data: { ...options.workOrderData, status: to },
//     });

//     if (updated.count === 0) {
//       throw new AppError(
//         httpStatus.CONFLICT,
//         "Work order was changed by someone else. Please refresh.",
//       );
//     }

//     if (options.assignmentId && options.assignmentData) {
//       await tx.assignment.update({
//         where: { id: options.assignmentId },
//         data: options.assignmentData,
//       });
//     }

//     return tx.workOrder.findUniqueOrThrow({
//       where: { id: workOrderId },
//       include: workOrderDetailInclude,
//     });
//   });
// };

// // ─────────────────────────────────────────────
// // TECHNICIAN: status flow
// //   SCHEDULED -> TECHNICIAN_EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED
// // ─────────────────────────────────────────────
// const markEnRoute = async (workOrderId: string, user: IRequestUser) => {
//   const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
//   assertStatus(workOrder.status, "SCHEDULED", "mark as en route");

//   return changeStatus(workOrderId, "SCHEDULED", "TECHNICIAN_EN_ROUTE");
// };

// const markArrived = async (workOrderId: string, user: IRequestUser) => {
//   const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
//   assertStatus(workOrder.status, "TECHNICIAN_EN_ROUTE", "mark as arrived");

//   return changeStatus(workOrderId, "TECHNICIAN_EN_ROUTE", "ARRIVED");
// };

// const startWork = async (
//   workOrderId: string,
//   payload: IStartWorkPayload,
//   user: IRequestUser,
// ) => {
//   const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
//   assertStatus(workOrder.status, "ARRIVED", "start work");

//   const now = new Date();
//   return changeStatus(workOrderId, "ARRIVED", "IN_PROGRESS", {
//     workOrderData: {
//       problemFound: payload.problemFound,
//       workDescription: payload.workDescription,
//       startedAt: now,
//     },
//     assignmentId: workOrder.assignment.id,
//     assignmentData: { actualStart: now },
//   });
// };

// const completeWork = async (
//   workOrderId: string,
//   payload: ICompleteWorkPayload,
//   file: Express.Multer.File | undefined,
//   user: IRequestUser,
// ) => {
//   const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
//   assertStatus(workOrder.status, "IN_PROGRESS", "complete work");

//   if (file && !file.mimetype.startsWith("image/")) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Completion proof must be an image",
//     );
//   }

//   const uploaded: UploadResult[] = [];
//   try {
//     let completionImageUrl: string | undefined;
//     let completionPublicId: string | undefined;

//     if (file) {
//       const result = await uploadToCloudinary(file, "fsm/work-orders/proof");
//       uploaded.push(result);
//       completionImageUrl = result.secure_url;
//       completionPublicId = result.public_id;
//     }

//     const now = new Date();
//     return await changeStatus(workOrderId, "IN_PROGRESS", "COMPLETED", {
//       workOrderData: {
//         laborHours: new Prisma.Decimal(payload.laborHours),
//         completionNotes: payload.completionNotes,
//         completionImageUrl,
//         completionPublicId,
//         completedAt: now,
//       },
//       assignmentId: workOrder.assignment.id,
//       assignmentData: { actualEnd: now },
//     });
//   } catch (error) {
//     await deleteUploads(uploaded);
//     throw error;
//   }
// };

// // ─────────────────────────────────────────────
// // TECHNICIAN: parts
// // ─────────────────────────────────────────────
// const addPart = async (
//   workOrderId: string,
//   payload: IAddPartPayload,
//   user: IRequestUser,
// ) => {
//   await getOwnedWorkOrderOrThrow(workOrderId, user);

//   return prisma.$transaction(async (tx) => {
//     // re-check the status inside the transaction
//     const current = await tx.workOrder.findUniqueOrThrow({
//       where: { id: workOrderId },
//       select: { status: true },
//     });
//     assertStatus(current.status, "IN_PROGRESS", "add parts");

//     const unitCost = new Prisma.Decimal(payload.unitCost);
//     const totalCost = unitCost.mul(payload.quantity);

//     return tx.workOrderPart.create({
//       data: {
//         workOrderId,
//         name: payload.name,
//         quantity: payload.quantity,
//         unitCost,
//         totalCost,
//         notes: payload.notes,
//       },
//     });
//   });
// };

// const removePart = async (
//   workOrderId: string,
//   partId: string,
//   user: IRequestUser,
// ) => {
//   await getOwnedWorkOrderOrThrow(workOrderId, user);

//   return prisma.$transaction(async (tx) => {
//     const current = await tx.workOrder.findUniqueOrThrow({
//       where: { id: workOrderId },
//       select: { status: true },
//     });
//     assertStatus(current.status, "IN_PROGRESS", "remove parts");

//     const deleted = await tx.workOrderPart.deleteMany({
//       where: { id: partId, workOrderId },
//     });
//     if (deleted.count === 0) {
//       throw new AppError(httpStatus.NOT_FOUND, "Part Not Found");
//     }
//     return { id: partId };
//   });
// };

// // ─────────────────────────────────────────────
// // TECHNICIAN: attachments (before / after photos)
// // ─────────────────────────────────────────────
// const addAttachments = async (
//   workOrderId: string,
//   files: Express.Multer.File[],
//   user: IRequestUser,
// ) => {
//   if (!files || files.length === 0) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       "Please upload at least one file (field name: attachments)",
//     );
//   }

//   const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
//   assertStatus(workOrder.status, ["ARRIVED", "IN_PROGRESS"], "add attachments");

//   const existing = await prisma.workOrderAttachment.count({
//     where: { workOrderId },
//   });
//   if (existing + files.length > MAX_ATTACHMENTS_PER_WORK_ORDER) {
//     throw new AppError(
//       httpStatus.BAD_REQUEST,
//       `A work order can have at most ${MAX_ATTACHMENTS_PER_WORK_ORDER} attachments`,
//     );
//   }

//   const uploaded: UploadResult[] = [];
//   try {
//     for (const file of files) {
//       uploaded.push(await uploadToCloudinary(file, "fsm/work-orders"));
//     }

//     await prisma.$transaction(async (tx) => {
//       const current = await tx.workOrder.findUniqueOrThrow({
//         where: { id: workOrderId },
//         select: { status: true },
//       });
//       assertStatus(
//         current.status,
//         ["ARRIVED", "IN_PROGRESS"],
//         "add attachments",
//       );

//       await tx.workOrderAttachment.createMany({
//         data: uploaded.map((u, i) => ({
//           workOrderId,
//           url: u.secure_url,
//           publicId: u.public_id,
//           fileType: files[i].mimetype,
//           fileName: files[i].originalname,
//         })),
//       });
//     });
//   } catch (error) {
//     await deleteUploads(uploaded);
//     throw error;
//   }

//   return prisma.workOrderAttachment.findMany({
//     where: { workOrderId },
//     orderBy: { createdAt: "asc" },
//   });
// };

// const removeAttachment = async (
//   workOrderId: string,
//   attachmentId: string,
//   user: IRequestUser,
// ) => {
//   const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
//   assertStatus(
//     workOrder.status,
//     ["ARRIVED", "IN_PROGRESS"],
//     "remove attachments",
//   );

//   const attachment = await prisma.workOrderAttachment.findFirst({
//     where: { id: attachmentId, workOrderId },
//   });
//   if (!attachment) {
//     throw new AppError(httpStatus.NOT_FOUND, "Attachment Not Found");
//   }

//   await prisma.workOrderAttachment.delete({ where: { id: attachmentId } });

//   // best effort: DB row is already gone
//   await cloudinary.uploader
//     .destroy(attachment.publicId, {
//       resource_type: attachment.fileType.startsWith("image/") ? "image" : "raw",
//     })
//     .catch(() => undefined);

//   return { id: attachmentId };
// };

// // ─────────────────────────────────────────────
// // TECHNICIAN: service report (create or update)
// // ─────────────────────────────────────────────
// const upsertServiceReport = async (
//   workOrderId: string,
//   payload: IServiceReportPayload,
//   user: IRequestUser,
// ) => {
//   const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
//   assertStatus(
//     workOrder.status,
//     ["IN_PROGRESS", "COMPLETED"],
//     "write the service report",
//   );

//   return prisma.$transaction(async (tx) => {
//     const current = await tx.workOrder.findUniqueOrThrow({
//       where: { id: workOrderId },
//       select: { status: true },
//     });
//     assertStatus(
//       current.status,
//       ["IN_PROGRESS", "COMPLETED"],
//       "write the service report",
//     );

//     return tx.serviceReport.upsert({
//       where: { workOrderId },
//       create: {
//         workOrderId,
//         summary: payload.summary,
//         findings: payload.findings,
//         recommendations: payload.recommendations,
//       },
//       update: {
//         summary: payload.summary,
//         findings: payload.findings,
//         recommendations: payload.recommendations,
//       },
//     });
//   });
// };

// // ─────────────────────────────────────────────
// // MANAGER: verify  (COMPLETED -> VERIFIED)
// //   needs a service report. Invoice step comes after this.
// // ─────────────────────────────────────────────
// const verifyWorkOrder = async (workOrderId: string) => {
//   const workOrder = await prisma.workOrder.findUnique({
//     where: { id: workOrderId },
//     select: { status: true },
//   });
//   if (!workOrder) {
//     throw new AppError(httpStatus.NOT_FOUND, "Work Order Not Found");
//   }
//   assertStatus(workOrder.status, "COMPLETED", "verify");

//   return changeStatus(workOrderId, "COMPLETED", "VERIFIED", {
//     workOrderData: { verifiedAt: new Date() },
//     guard: async (tx) => {
//       const report = await tx.serviceReport.findUnique({
//         where: { workOrderId },
//         select: { id: true },
//       });
//       if (!report) {
//         throw new AppError(
//           httpStatus.BAD_REQUEST,
//           "Service report is missing. The technician must submit it before verification.",
//         );
//       }
//     },
//   });
// };

// // ─────────────────────────────────────────────
// // READ: lists
// // ─────────────────────────────────────────────
// const getAllWorkOrders = async (query: IWorkOrderQuery) => {
//   const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
//   const where: Prisma.WorkOrderWhereInput = { AND: buildListFilters(query) };

//   const [data, total] = await Promise.all([
//     prisma.workOrder.findMany({
//       where,
//       include: workOrderListInclude,
//       orderBy: { [sortBy]: sortOrder },
//       skip,
//       take: limit,
//     }),
//     prisma.workOrder.count({ where }),
//   ]);

//   return {
//     data,
//     meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
//   };
// };

// const getMyWorkOrders = async (query: IWorkOrderQuery, user: IRequestUser) => {
//   const technician = await getTechnicianOrThrow(user);
//   const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);

//   // a technician can only see their own, whatever technicianId is sent
//   const where: Prisma.WorkOrderWhereInput = {
//     AND: [
//       ...buildListFilters({ ...query, technicianId: undefined }),
//       { assignment: { technicianId: technician.id } },
//     ],
//   };

//   const [data, total] = await Promise.all([
//     prisma.workOrder.findMany({
//       where,
//       include: workOrderListInclude,
//       orderBy: { [sortBy]: sortOrder },
//       skip,
//       take: limit,
//     }),
//     prisma.workOrder.count({ where }),
//   ]);

//   return {
//     data,
//     meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
//   };
// };

// // ─────────────────────────────────────────────
// // READ: single + by service request (role-aware)
// // ─────────────────────────────────────────────
// const withPartsTotal = <T extends { parts: { totalCost: Prisma.Decimal }[] }>(
//   workOrder: T,
// ) => ({
//   ...workOrder,
//   partsTotal: workOrder.parts
//     .reduce((sum, p) => sum.add(p.totalCost), new Prisma.Decimal(0))
//     .toFixed(2),
// });

// const canAccess = (
//   workOrder: {
//     assignment: {
//       technician: { userId: string };
//       serviceRequest: { customer: { userId: string } };
//     };
//   },
//   user: IRequestUser,
// ) => {
//   if (user.role === "CUSTOMER") {
//     return workOrder.assignment.serviceRequest.customer.userId === user.userId;
//   }
//   if (user.role === "TECHNICIAN") {
//     return workOrder.assignment.technician.userId === user.userId;
//   }
//   return true; // MANAGER / ADMIN / SUPER_ADMIN
// };

// const getSingleWorkOrder = async (workOrderId: string, user: IRequestUser) => {
//   const workOrder = await prisma.workOrder.findUnique({
//     where: { id: workOrderId },
//     include: workOrderDetailInclude,
//   });

//   // same message for "missing" and "not yours" => no id guessing
//   if (!workOrder || !canAccess(workOrder, user)) {
//     throw new AppError(httpStatus.NOT_FOUND, "Work Order Not Found");
//   }

//   return withPartsTotal(workOrder);
// };

// const getWorkOrdersByServiceRequest = async (
//   serviceRequestId: string,
//   user: IRequestUser,
// ) => {
//   const workOrders = await prisma.workOrder.findMany({
//     where: { assignment: { serviceRequestId } },
//     include: workOrderDetailInclude,
//     orderBy: { createdAt: "desc" },
//   });

//   const visible = workOrders.filter((w) => canAccess(w, user));
//   return visible.map(withPartsTotal);
// };

// export const WorkOrderServices = {
//   markEnRoute,
//   markArrived,
//   startWork,
//   completeWork,
//   addPart,
//   removePart,
//   addAttachments,
//   removeAttachment,
//   upsertServiceReport,
//   verifyWorkOrder,
//   getAllWorkOrders,
//   getMyWorkOrders,
//   getSingleWorkOrder,
//   getWorkOrdersByServiceRequest,
// };

import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import type { WorkOrderStatus } from "../../../generated/prisma/enums";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import { NotificationEvents } from "../notification/notification.events"; // 🔔 NOTIFICATION
import type {
  IAddPartPayload,
  ICompleteWorkPayload,
  IServiceReportPayload,
  IStartWorkPayload,
  IWorkOrderQuery,
} from "./work-order.interface";

type Tx = Prisma.TransactionClient;

const ALL_STATUSES: WorkOrderStatus[] = [
  "SCHEDULED",
  "TECHNICIAN_EN_ROUTE",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "VERIFIED",
  "CANCELLED",
];
const SORTABLE_FIELDS = ["createdAt", "updatedAt", "status"];
const MAX_ATTACHMENTS_PER_WORK_ORDER = 20;

// ─────────────────────────────────────────────
// Reusable includes
// ─────────────────────────────────────────────
const assignmentSummary = {
  select: {
    id: true,
    status: true,
    scheduledStart: true,
    scheduledEnd: true,
    actualStart: true,
    actualEnd: true,
    technicianId: true,
    technician: {
      select: {
        id: true,
        name: true,
        email: true,
        contactNumber: true,
        userId: true,
      },
    },
    serviceRequest: {
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        address: true,
        city: true,
        customer: {
          select: { id: true, name: true, contactNumber: true, userId: true },
        },
      },
    },
  },
} satisfies Prisma.AssignmentDefaultArgs;

const workOrderListInclude = {
  assignment: assignmentSummary,
  _count: { select: { parts: true, attachments: true } },
} satisfies Prisma.WorkOrderInclude;

const workOrderDetailInclude = {
  assignment: assignmentSummary,
  parts: { orderBy: { createdAt: "asc" } },
  attachments: { orderBy: { createdAt: "asc" } },
  serviceReport: true,
  payment: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
    },
  },
} satisfies Prisma.WorkOrderInclude;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const parsePagination = (query: IWorkOrderQuery) => {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
    100,
  );
  const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
    ? (query.sortBy as string)
    : "createdAt";
  const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";
  return { page, limit, skip: (page - 1) * limit, sortBy, sortOrder };
};

const parseDate = (value: string, label: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(httpStatus.BAD_REQUEST, `${label} is not a valid date`);
  }
  return date;
};

const buildListFilters = (query: IWorkOrderQuery) => {
  const and: Prisma.WorkOrderWhereInput[] = [];

  if (query.status) {
    if (!ALL_STATUSES.includes(query.status as WorkOrderStatus)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid status. Use one of: ${ALL_STATUSES.join(", ")}`,
      );
    }
    and.push({ status: query.status as WorkOrderStatus });
  }

  if (query.technicianId) {
    and.push({ assignment: { technicianId: query.technicianId } });
  }

  if (query.serviceRequestId) {
    and.push({ assignment: { serviceRequestId: query.serviceRequestId } });
  }

  if (query.from) {
    and.push({
      assignment: { scheduledStart: { gte: parseDate(query.from, "from") } },
    });
  }
  if (query.to) {
    and.push({
      assignment: { scheduledStart: { lte: parseDate(query.to, "to") } },
    });
  }

  return and;
};

const getTechnicianOrThrow = async (user: IRequestUser) => {
  const technician = await prisma.technician.findUnique({
    where: { userId: user.userId },
  });
  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found");
  }
  return technician;
};

// Loads the work order and makes sure it belongs to this technician
// and its assignment is still CONFIRMED.
const getOwnedWorkOrderOrThrow = async (
  workOrderId: string,
  user: IRequestUser,
  db: Tx | typeof prisma = prisma,
) => {
  const technician = await getTechnicianOrThrow(user);

  const workOrder = await db.workOrder.findUnique({
    where: { id: workOrderId },
    include: {
      assignment: {
        select: { id: true, status: true, technicianId: true },
      },
    },
  });

  if (!workOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "Work Order Not Found");
  }
  if (workOrder.assignment.technicianId !== technician.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "This work order is not assigned to you",
    );
  }
  if (workOrder.assignment.status !== "CONFIRMED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The assignment for this work order is not active",
    );
  }
  return workOrder;
};

const assertStatus = (
  current: WorkOrderStatus,
  allowed: WorkOrderStatus | WorkOrderStatus[],
  action: string,
) => {
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(current)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Cannot ${action} when work order status is ${current}. Required: ${list.join(" or ")}`,
    );
  }
};

type UploadResult = {
  secure_url: string;
  public_id: string;
  resource_type: string;
};

const uploadToCloudinary = (file: Express.Multer.File, folder: string) =>
  new Promise<UploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary returned no result"));
        resolve(result as UploadResult);
      },
    );
    stream.end(file.buffer);
  });

// best effort: used when the DB write fails after the upload succeeded
const deleteUploads = async (uploads: UploadResult[]) => {
  await Promise.allSettled(
    uploads.map((u) =>
      cloudinary.uploader.destroy(u.public_id, {
        resource_type: u.resource_type,
      }),
    ),
  );
};

// Move status safely. The "from" status is part of the UPDATE condition,
// so two clicks at the same time cannot both succeed.
const changeStatus = async (
  workOrderId: string,
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  options: {
    workOrderData?: Prisma.WorkOrderUpdateManyMutationInput;
    assignmentId?: string;
    assignmentData?: Prisma.AssignmentUpdateInput;
    guard?: (tx: Tx) => Promise<void>;
  } = {},
) => {
  const result = await prisma.$transaction(async (tx) => {
    // 🔔 NOTIFICATION (return -> const result =)
    if (options.guard) await options.guard(tx);

    const updated = await tx.workOrder.updateMany({
      where: { id: workOrderId, status: from },
      data: { ...options.workOrderData, status: to },
    });

    if (updated.count === 0) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Work order was changed by someone else. Please refresh.",
      );
    }

    if (options.assignmentId && options.assignmentData) {
      await tx.assignment.update({
        where: { id: options.assignmentId },
        data: options.assignmentData,
      });
    }

    return tx.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      include: workOrderDetailInclude,
    });
  });

  // 🔔 NOTIFICATION: en-route / arrived / started / completed / verified shob ekhan theke jabe
  void NotificationEvents.workOrderStatusChanged(workOrderId);

  return result; // 🔔 NOTIFICATION
};

// ─────────────────────────────────────────────
// TECHNICIAN: status flow
//   SCHEDULED -> TECHNICIAN_EN_ROUTE -> ARRIVED -> IN_PROGRESS -> COMPLETED
// ─────────────────────────────────────────────
const markEnRoute = async (workOrderId: string, user: IRequestUser) => {
  const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
  assertStatus(workOrder.status, "SCHEDULED", "mark as en route");

  return changeStatus(workOrderId, "SCHEDULED", "TECHNICIAN_EN_ROUTE");
};

const markArrived = async (workOrderId: string, user: IRequestUser) => {
  const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
  assertStatus(workOrder.status, "TECHNICIAN_EN_ROUTE", "mark as arrived");

  return changeStatus(workOrderId, "TECHNICIAN_EN_ROUTE", "ARRIVED");
};

const startWork = async (
  workOrderId: string,
  payload: IStartWorkPayload,
  user: IRequestUser,
) => {
  const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
  assertStatus(workOrder.status, "ARRIVED", "start work");

  const now = new Date();
  return changeStatus(workOrderId, "ARRIVED", "IN_PROGRESS", {
    workOrderData: {
      problemFound: payload.problemFound,
      workDescription: payload.workDescription,
      startedAt: now,
    },
    assignmentId: workOrder.assignment.id,
    assignmentData: { actualStart: now },
  });
};

const completeWork = async (
  workOrderId: string,
  payload: ICompleteWorkPayload,
  file: Express.Multer.File | undefined,
  user: IRequestUser,
) => {
  const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
  assertStatus(workOrder.status, "IN_PROGRESS", "complete work");

  if (file && !file.mimetype.startsWith("image/")) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Completion proof must be an image",
    );
  }

  const uploaded: UploadResult[] = [];
  try {
    let completionImageUrl: string | undefined;
    let completionPublicId: string | undefined;

    if (file) {
      const result = await uploadToCloudinary(file, "fsm/work-orders/proof");
      uploaded.push(result);
      completionImageUrl = result.secure_url;
      completionPublicId = result.public_id;
    }

    const now = new Date();
    return await changeStatus(workOrderId, "IN_PROGRESS", "COMPLETED", {
      workOrderData: {
        laborHours: new Prisma.Decimal(payload.laborHours),
        completionNotes: payload.completionNotes,
        completionImageUrl,
        completionPublicId,
        completedAt: now,
      },
      assignmentId: workOrder.assignment.id,
      assignmentData: { actualEnd: now },
    });
  } catch (error) {
    await deleteUploads(uploaded);
    throw error;
  }
};

// ─────────────────────────────────────────────
// TECHNICIAN: parts
// ─────────────────────────────────────────────
const addPart = async (
  workOrderId: string,
  payload: IAddPartPayload,
  user: IRequestUser,
) => {
  await getOwnedWorkOrderOrThrow(workOrderId, user);

  return prisma.$transaction(async (tx) => {
    // re-check the status inside the transaction
    const current = await tx.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      select: { status: true },
    });
    assertStatus(current.status, "IN_PROGRESS", "add parts");

    const unitCost = new Prisma.Decimal(payload.unitCost);
    const totalCost = unitCost.mul(payload.quantity);

    return tx.workOrderPart.create({
      data: {
        workOrderId,
        name: payload.name,
        quantity: payload.quantity,
        unitCost,
        totalCost,
        notes: payload.notes,
      },
    });
  });
};

const removePart = async (
  workOrderId: string,
  partId: string,
  user: IRequestUser,
) => {
  await getOwnedWorkOrderOrThrow(workOrderId, user);

  return prisma.$transaction(async (tx) => {
    const current = await tx.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      select: { status: true },
    });
    assertStatus(current.status, "IN_PROGRESS", "remove parts");

    const deleted = await tx.workOrderPart.deleteMany({
      where: { id: partId, workOrderId },
    });
    if (deleted.count === 0) {
      throw new AppError(httpStatus.NOT_FOUND, "Part Not Found");
    }
    return { id: partId };
  });
};

// ─────────────────────────────────────────────
// TECHNICIAN: attachments (before / after photos)
// ─────────────────────────────────────────────
const addAttachments = async (
  workOrderId: string,
  files: Express.Multer.File[],
  user: IRequestUser,
) => {
  if (!files || files.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Please upload at least one file (field name: attachments)",
    );
  }

  const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
  assertStatus(workOrder.status, ["ARRIVED", "IN_PROGRESS"], "add attachments");

  const existing = await prisma.workOrderAttachment.count({
    where: { workOrderId },
  });
  if (existing + files.length > MAX_ATTACHMENTS_PER_WORK_ORDER) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `A work order can have at most ${MAX_ATTACHMENTS_PER_WORK_ORDER} attachments`,
    );
  }

  const uploaded: UploadResult[] = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadToCloudinary(file, "fsm/work-orders"));
    }

    await prisma.$transaction(async (tx) => {
      const current = await tx.workOrder.findUniqueOrThrow({
        where: { id: workOrderId },
        select: { status: true },
      });
      assertStatus(
        current.status,
        ["ARRIVED", "IN_PROGRESS"],
        "add attachments",
      );

      await tx.workOrderAttachment.createMany({
        data: uploaded.map((u, i) => ({
          workOrderId,
          url: u.secure_url,
          publicId: u.public_id,
          fileType: files[i].mimetype,
          fileName: files[i].originalname,
        })),
      });
    });
  } catch (error) {
    await deleteUploads(uploaded);
    throw error;
  }

  return prisma.workOrderAttachment.findMany({
    where: { workOrderId },
    orderBy: { createdAt: "asc" },
  });
};

const removeAttachment = async (
  workOrderId: string,
  attachmentId: string,
  user: IRequestUser,
) => {
  const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
  assertStatus(
    workOrder.status,
    ["ARRIVED", "IN_PROGRESS"],
    "remove attachments",
  );

  const attachment = await prisma.workOrderAttachment.findFirst({
    where: { id: attachmentId, workOrderId },
  });
  if (!attachment) {
    throw new AppError(httpStatus.NOT_FOUND, "Attachment Not Found");
  }

  await prisma.workOrderAttachment.delete({ where: { id: attachmentId } });

  // best effort: DB row is already gone
  await cloudinary.uploader
    .destroy(attachment.publicId, {
      resource_type: attachment.fileType.startsWith("image/") ? "image" : "raw",
    })
    .catch(() => undefined);

  return { id: attachmentId };
};

// ─────────────────────────────────────────────
// TECHNICIAN: service report (create or update)
// ─────────────────────────────────────────────
const upsertServiceReport = async (
  workOrderId: string,
  payload: IServiceReportPayload,
  user: IRequestUser,
) => {
  const workOrder = await getOwnedWorkOrderOrThrow(workOrderId, user);
  assertStatus(
    workOrder.status,
    ["IN_PROGRESS", "COMPLETED"],
    "write the service report",
  );

  return prisma.$transaction(async (tx) => {
    const current = await tx.workOrder.findUniqueOrThrow({
      where: { id: workOrderId },
      select: { status: true },
    });
    assertStatus(
      current.status,
      ["IN_PROGRESS", "COMPLETED"],
      "write the service report",
    );

    return tx.serviceReport.upsert({
      where: { workOrderId },
      create: {
        workOrderId,
        summary: payload.summary,
        findings: payload.findings,
        recommendations: payload.recommendations,
      },
      update: {
        summary: payload.summary,
        findings: payload.findings,
        recommendations: payload.recommendations,
      },
    });
  });
};

// ─────────────────────────────────────────────
// MANAGER: verify  (COMPLETED -> VERIFIED)
//   needs a service report. Invoice step comes after this.
// ─────────────────────────────────────────────
const verifyWorkOrder = async (workOrderId: string) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { status: true },
  });
  if (!workOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "Work Order Not Found");
  }
  assertStatus(workOrder.status, "COMPLETED", "verify");

  return changeStatus(workOrderId, "COMPLETED", "VERIFIED", {
    workOrderData: { verifiedAt: new Date() },
    guard: async (tx) => {
      const report = await tx.serviceReport.findUnique({
        where: { workOrderId },
        select: { id: true },
      });
      if (!report) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Service report is missing. The technician must submit it before verification.",
        );
      }
    },
  });
};

// ─────────────────────────────────────────────
// READ: lists
// ─────────────────────────────────────────────
const getAllWorkOrders = async (query: IWorkOrderQuery) => {
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);
  const where: Prisma.WorkOrderWhereInput = { AND: buildListFilters(query) };

  const [data, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: workOrderListInclude,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.workOrder.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getMyWorkOrders = async (query: IWorkOrderQuery, user: IRequestUser) => {
  const technician = await getTechnicianOrThrow(user);
  const { page, limit, skip, sortBy, sortOrder } = parsePagination(query);

  // a technician can only see their own, whatever technicianId is sent
  const where: Prisma.WorkOrderWhereInput = {
    AND: [
      ...buildListFilters({ ...query, technicianId: undefined }),
      { assignment: { technicianId: technician.id } },
    ],
  };

  const [data, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: workOrderListInclude,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.workOrder.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─────────────────────────────────────────────
// READ: single + by service request (role-aware)
// ─────────────────────────────────────────────
const withPartsTotal = <T extends { parts: { totalCost: Prisma.Decimal }[] }>(
  workOrder: T,
) => ({
  ...workOrder,
  partsTotal: workOrder.parts
    .reduce((sum, p) => sum.add(p.totalCost), new Prisma.Decimal(0))
    .toFixed(2),
});

const canAccess = (
  workOrder: {
    assignment: {
      technician: { userId: string };
      serviceRequest: { customer: { userId: string } };
    };
  },
  user: IRequestUser,
) => {
  if (user.role === "CUSTOMER") {
    return workOrder.assignment.serviceRequest.customer.userId === user.userId;
  }
  if (user.role === "TECHNICIAN") {
    return workOrder.assignment.technician.userId === user.userId;
  }
  return true; // MANAGER / ADMIN / SUPER_ADMIN
};

const getSingleWorkOrder = async (workOrderId: string, user: IRequestUser) => {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    include: workOrderDetailInclude,
  });

  // same message for "missing" and "not yours" => no id guessing
  if (!workOrder || !canAccess(workOrder, user)) {
    throw new AppError(httpStatus.NOT_FOUND, "Work Order Not Found");
  }

  return withPartsTotal(workOrder);
};

const getWorkOrdersByServiceRequest = async (
  serviceRequestId: string,
  user: IRequestUser,
) => {
  const workOrders = await prisma.workOrder.findMany({
    where: { assignment: { serviceRequestId } },
    include: workOrderDetailInclude,
    orderBy: { createdAt: "desc" },
  });

  const visible = workOrders.filter((w) => canAccess(w, user));
  return visible.map(withPartsTotal);
};

export const WorkOrderServices = {
  markEnRoute,
  markArrived,
  startWork,
  completeWork,
  addPart,
  removePart,
  addAttachments,
  removeAttachment,
  upsertServiceReport,
  verifyWorkOrder,
  getAllWorkOrders,
  getMyWorkOrders,
  getSingleWorkOrder,
  getWorkOrdersByServiceRequest,
};
