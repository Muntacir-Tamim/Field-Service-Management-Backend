import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import { Prisma } from "../../../generated/prisma/client";
import type { TechnicianVerificationStatus } from "../../../generated/prisma/enums";
import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import { NotificationEvents } from "../notification/notification.events";
import { AuditLogServices } from "../audit-log/audit-log.service";
import {
  IAddSkillPayload,
  IApplyAsTechnicianPayload,
  IResendOtpPayload,
  IReviewTechnicianPayload,
  IStoredFile,
  ITechnicianQuery,
  IUpdateTechnicianProfilePayload,
  IVerifyTechnicianEmailPayload,
} from "./Technician.interface";

const OTP_EXPIRY_SECONDS = 60 * 60; // 1 hour to verify email
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const STATUSES: TechnicianVerificationStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
];
const SORTABLE_FIELDS = [
  "createdAt",
  "name",
  "experienceYears",
  "verificationStatus",
];

const otpKey = (email: string) => `technician-application-otp:${email}`;
const cooldownKey = (email: string) =>
  `technician-application-cooldown:${email}`;

const technicianInclude = {
  skills: {
    select: {
      level: true,
      certifiedAt: true,
      skill: { select: { id: true, name: true, category: true } },
    },
  },
  user: {
    select: { id: true, emailVerified: true, status: true, imageUrl: true },
  },
} satisfies Prisma.TechnicianInclude;

const uploadBuffer = (file: Express.Multer.File) =>
  new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: "auto", folder: "fsm/technician-applications" },
        (error, result) => {
          if (error) return reject(error);
          if (!result) {
            return reject(
              new AppError(
                httpStatus.INTERNAL_SERVER_ERROR,
                "No result returned from Cloudinary",
              ),
            );
          }
          resolve(result);
        },
      )
      .end(file.buffer);
  });

const toStored = (r: UploadApiResponse): IStoredFile => ({
  url: r.secure_url,
  publicId: r.public_id,
  resourceType: r.resource_type,
});

const destroyFiles = async (
  files: { publicId: string; resourceType?: string }[],
) => {
  await Promise.all(
    files.map(async (f) => {
      const types = f.resourceType ? [f.resourceType] : ["image", "raw"];
      for (const type of types) {
        try {
          await cloudinary.uploader.destroy(f.publicId, {
            resource_type: type,
          });
        } catch (error) {
          console.log("Cloudinary cleanup failed:", f.publicId, error);
        }
      }
    }),
  );
};

const sendTemplateMail = async (
  template: string,
  data: Record<string, unknown>,
  to: string,
  subject: string,
) => {
  const templatePath = path.join(
    process.cwd(),
    `src/app/templates/${template}`,
  );
  const html = await ejs.renderFile(templatePath, data);
  await transporter.sendMail({ from: config.email_sender, to, subject, html });
};

const sendApplicationOtp = async (name: string, email: string) => {
  const otp = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey(email), otp, {
    expiration: { type: "EX", value: OTP_EXPIRY_SECONDS },
  });

  await sendTemplateMail(
    "registration-user-otp.ejs",
    { name, email, otp, expirationMinutes: OTP_EXPIRY_SECONDS / 60 },
    email,
    "Technician Application - Email Verification",
  );
};

const getTechnicianOrThrow = async (user: IRequestUser) => {
  const technician = await prisma.technician.findUnique({
    where: { userId: user.userId },
  });
  if (!technician || technician.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Profile Not Found");
  }
  return technician;
};

const applyAsTechnician = async (
  payload: IApplyAsTechnicianPayload,
  resume: Express.Multer.File | null,
  documents: Express.Multer.File[],
) => {
  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { technician: true },
  });

  if (existingUser) {
    const isAbandonedApplication =
      existingUser.role === Role.TECHNICIAN &&
      !existingUser.emailVerified &&
      existingUser.technician?.verificationStatus === "PENDING";

    if (!isAbandonedApplication) {
      throw new AppError(
        httpStatus.CONFLICT,
        "An account already exists with this email",
      );
    }

    const oldFiles: { publicId: string; resourceType?: string }[] = [];
    if (existingUser.technician?.resumePublicId) {
      oldFiles.push({ publicId: existingUser.technician.resumePublicId });
    }
    const oldDocs = (existingUser.technician?.documents ??
      []) as unknown as IStoredFile[];
    oldFiles.push(...oldDocs);

    await prisma.user.delete({ where: { id: existingUser.id } });
    await destroyFiles(oldFiles);
  }

  const skillIds = payload.skills.map((s) => s.skillId);
  const foundSkills = await prisma.skill.count({
    where: { id: { in: skillIds } },
  });
  if (foundSkills !== skillIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "One or more selected skills are invalid",
    );
  }

  const uploaded: UploadApiResponse[] = [];
  let resumeResult: UploadApiResponse | null = null;
  let documentResults: UploadApiResponse[] = [];

  try {
    if (resume) {
      resumeResult = await uploadBuffer(resume);
      uploaded.push(resumeResult);
    }
    documentResults = await Promise.all(documents.map(uploadBuffer));
    uploaded.push(...documentResults);

    const hashedPassword = await bcrypt.hash(
      payload.password,
      Number(config.bcrypt_salt_rounds),
    );

    const created = await prisma.user.create({
      data: {
        name: payload.name,
        email,
        password: hashedPassword,
        role: Role.TECHNICIAN,
        emailVerified: false,
        needPasswordChange: false,
        technician: {
          create: {
            name: payload.name,
            email,
            ...payload.technician,
            resumeUrl: resumeResult?.secure_url,
            resumePublicId: resumeResult?.public_id,
            documents: documentResults.map(toStored),
            skills: {
              create: payload.skills.map((s) => ({
                skillId: s.skillId,
                level: s.level ?? "INTERMEDIATE",
              })),
            },
          },
        },
      },
      omit: { password: true },
      include: { technician: { include: technicianInclude } },
    });

    try {
      await sendApplicationOtp(payload.name, email);
    } catch (error) {
      console.log("Failed to send technician OTP email:", error);
    }

    return created;
  } catch (error) {
    await destroyFiles(
      uploaded.map((u) => ({
        publicId: u.public_id,
        resourceType: u.resource_type,
      })),
    );
    throw error;
  }
};

const verifyTechnicianEmail = async (
  payload: IVerifyTechnicianEmailPayload,
) => {
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { technician: true },
  });

  if (!user || user.role !== Role.TECHNICIAN || !user.technician) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Technician application not found. Please apply again.",
    );
  }
  if (user.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email already verified");
  }

  const savedOtp = await redisClient.get(otpKey(email));
  if (!savedOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP expired. Please request a new OTP.",
    );
  }
  if (savedOtp !== payload.otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
  }

  await redisClient.del(otpKey(email));

  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true },
    omit: { password: true },
    include: { technician: { include: technicianInclude } },
  });

  void NotificationEvents.technicianApplicationSubmitted(user.technician.id);

  return verified;
};

const resendApplicationOtp = async (payload: IResendOtpPayload) => {
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.role !== Role.TECHNICIAN) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Technician application not found",
    );
  }
  if (user.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email already verified");
  }

  if (await redisClient.get(cooldownKey(email))) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP`,
    );
  }

  await redisClient.set(cooldownKey(email), "1", {
    expiration: { type: "EX", value: OTP_RESEND_COOLDOWN_SECONDS },
  });

  await sendApplicationOtp(user.name, email);
  return null;
};

const reviewTechnician = async (
  technicianId: string,
  payload: IReviewTechnicianPayload,
  reviewer: IRequestUser,
) => {
  const technician = await prisma.technician.findUnique({
    where: { id: technicianId },
    include: { user: { select: { emailVerified: true } } },
  });

  if (!technician) {
    throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found");
  }
  if (technician.isDeleted) {
    throw new AppError(
      httpStatus.GONE,
      "Technician application has been deleted",
    );
  }
  if (!technician.user.emailVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Technician has not verified their email yet. Cannot review.",
    );
  }
  if (technician.verificationStatus === "APPROVED") {
    throw new AppError(httpStatus.CONFLICT, "Technician is already approved");
  }
  if (
    technician.verificationStatus === "REJECTED" &&
    payload.verificationStatus === "REJECTED"
  ) {
    throw new AppError(httpStatus.CONFLICT, "Technician is already rejected");
  }

  const isApproved = payload.verificationStatus === "APPROVED";

  const updated = await prisma.technician.updateMany({
    where: {
      id: technicianId,
      verificationStatus: technician.verificationStatus,
    },
    data: {
      verificationStatus: payload.verificationStatus,
      rejectionReason: isApproved ? null : payload.rejectionReason,
      reviewedBy: reviewer.userId,
      reviewedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Application was reviewed by someone else. Please refresh.",
    );
  }

  void AuditLogServices.record({
    action: "TECHNICIAN_REVIEWED",
    entityType: "Technician",
    entityId: technicianId,
    description: `Technician application ${technician.verificationStatus} → ${payload.verificationStatus}`,
    actor: reviewer,
    oldValue: { verificationStatus: technician.verificationStatus },
    newValue: { verificationStatus: payload.verificationStatus },
    metadata: isApproved
      ? undefined
      : { rejectionReason: payload.rejectionReason ?? null },
  });

  const result = await prisma.technician.findUniqueOrThrow({
    where: { id: technicianId },
    include: technicianInclude,
  });

  try {
    await sendTemplateMail(
      isApproved
        ? "technician-application-approved.ejs"
        : "technician-application-rejected.ejs",
      { name: result.name, reason: result.rejectionReason },
      result.email,
      isApproved
        ? "Your Technician Application Has Been Approved"
        : "Your Technician Application Has Been Rejected",
    );
  } catch (error) {
    console.log("Failed to send technician review email:", error);
  }

  void NotificationEvents.technicianApplicationReviewed(technicianId);

  return result;
};

const getAllTechnicians = async (query: ITechnicianQuery) => {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
    100,
  );
  const sortBy = SORTABLE_FIELDS.includes(query.sortBy ?? "")
    ? (query.sortBy as string)
    : "createdAt";
  const sortOrder: "asc" | "desc" = query.sortOrder === "asc" ? "asc" : "desc";

  const and: Prisma.TechnicianWhereInput[] = [{ isDeleted: false }];

  if (query.verificationStatus) {
    if (
      !STATUSES.includes(
        query.verificationStatus as TechnicianVerificationStatus,
      )
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Invalid verificationStatus. Use: ${STATUSES.join(", ")}`,
      );
    }
    and.push({
      verificationStatus:
        query.verificationStatus as TechnicianVerificationStatus,
    });
  }
  if (query.isAvailable === "true" || query.isAvailable === "false") {
    and.push({ isAvailable: query.isAvailable === "true" });
  }
  if (query.skillId) and.push({ skills: { some: { skillId: query.skillId } } });
  if (query.searchTerm) {
    and.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { email: { contains: query.searchTerm, mode: "insensitive" } },
        { contactNumber: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.TechnicianWhereInput = { AND: and };

  const [data, total] = await Promise.all([
    prisma.technician.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: technicianInclude,
    }),
    prisma.technician.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const getSingleTechnician = async (technicianId: string) => {
  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, isDeleted: false },
    include: technicianInclude,
  });
  if (!technician)
    throw new AppError(httpStatus.NOT_FOUND, "Technician Not Found");
  return technician;
};

const getMyProfile = async (user: IRequestUser) => {
  const technician = await getTechnicianOrThrow(user);
  return prisma.technician.findUniqueOrThrow({
    where: { id: technician.id },
    include: technicianInclude,
  });
};

const updateMyProfile = async (
  user: IRequestUser,
  payload: IUpdateTechnicianProfilePayload,
) => {
  const technician = await getTechnicianOrThrow(user);
  return prisma.technician.update({
    where: { id: technician.id },
    data: payload,
    include: technicianInclude,
  });
};

const updateMyAvailability = async (
  user: IRequestUser,
  isAvailable: boolean,
) => {
  const technician = await getTechnicianOrThrow(user);

  return prisma.technician.update({
    where: { id: technician.id },
    data: { isAvailable },
    select: { id: true, isAvailable: true },
  });
};

const addMySkill = async (user: IRequestUser, payload: IAddSkillPayload) => {
  const technician = await getTechnicianOrThrow(user);

  const skill = await prisma.skill.findUnique({
    where: { id: payload.skillId },
  });
  if (!skill) throw new AppError(httpStatus.NOT_FOUND, "Skill Not Found");

  await prisma.technicianSkill.upsert({
    where: {
      technicianId_skillId: {
        technicianId: technician.id,
        skillId: payload.skillId,
      },
    },
    create: {
      technicianId: technician.id,
      skillId: payload.skillId,
      level: payload.level ?? "INTERMEDIATE",
    },
    update: payload.level ? { level: payload.level } : {},
  });

  return prisma.technicianSkill.findMany({
    where: { technicianId: technician.id },
    select: { level: true, certifiedAt: true, skill: true },
  });
};

const removeMySkill = async (user: IRequestUser, skillId: string) => {
  const technician = await getTechnicianOrThrow(user);

  const mySkills = await prisma.technicianSkill.findMany({
    where: { technicianId: technician.id },
    select: { skillId: true },
  });

  if (!mySkills.some((s) => s.skillId === skillId)) {
    throw new AppError(httpStatus.NOT_FOUND, "You don't have this skill");
  }
  if (mySkills.length === 1) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You must keep at least one skill",
    );
  }

  await prisma.technicianSkill.delete({
    where: { technicianId_skillId: { technicianId: technician.id, skillId } },
  });

  return prisma.technicianSkill.findMany({
    where: { technicianId: technician.id },
    select: { level: true, certifiedAt: true, skill: true },
  });
};

export const TechnicianServices = {
  applyAsTechnician,
  verifyTechnicianEmail,
  resendApplicationOtp,
  reviewTechnician,
  getAllTechnicians,
  getSingleTechnician,
  getMyProfile,
  updateMyProfile,
  updateMyAvailability,
  addMySkill,
  removeMySkill,
};
