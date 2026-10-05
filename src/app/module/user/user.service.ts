import httpStatus from "http-status";
import type { UploadApiResponse } from "cloudinary";
import type { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { AuditLogServices } from "../audit-log/audit-log.service";
import type { IRequestUser } from "../auth/auth.interface";
import { TUpdateProfilePayload } from "./user.interface";

const getMyProfile = async (user: IRequestUser) => {
  const record = await prisma.user.findUnique({
    where: { id: user.userId },
    omit: { password: true, imagePublicId: true },
    include: {
      customer: true,
      technician: {
        include: {
          skills: {
            include: {
              skill: { select: { id: true, name: true, category: true } },
            },
          },
        },
      },
      admin: true,
    },
  });

  if (!record || record.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // role onujayi shudhu nijer profile ta "profile" key te dibe
  const { customer, technician, admin, ...base } = record;
  return { ...base, profile: customer ?? technician ?? admin ?? null };
};

const updateMyProfile = async (
  user: IRequestUser,
  payload: TUpdateProfilePayload,
) => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: user.userId },
      include: { customer: true, technician: true, admin: true },
    });

    if (!existing || existing.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const roleProfile =
      user.role === Role.CUSTOMER
        ? existing.customer
        : user.role === Role.TECHNICIAN
          ? existing.technician
          : existing.admin;

    if (!roleProfile) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        `${user.role} profile not found for this account`,
      );
    }

    // Ager value (users.name + role table field) ek jaygay
    const before: Record<string, unknown> = {
      ...(roleProfile as Record<string, unknown>),
      name: existing.name,
    };

    // shudhu jegulo sotti change hocche segulo rakho
    const changes = Object.fromEntries(
      Object.entries(payload).filter(
        ([key, value]) => value !== undefined && before[key] !== value,
      ),
    );

    if (Object.keys(changes).length === 0) return; // kichu change hoyni

    const { name, ...roleFields } = changes as { name?: string } & Record<
      string,
      unknown
    >;

    // users.name ar role table er name duto-ei sync rakhte hobe
    if (name !== undefined) {
      await tx.user.update({ where: { id: user.userId }, data: { name } });
    }

    const roleData = { ...roleFields, ...(name !== undefined && { name }) };

    if (user.role === Role.CUSTOMER) {
      await tx.customer.update({
        where: { id: roleProfile.id },
        data: roleData as Prisma.CustomerUpdateInput,
      });
    } else if (user.role === Role.TECHNICIAN) {
      await tx.technician.update({
        where: { id: roleProfile.id },
        data: roleData as Prisma.TechnicianUpdateInput,
      });
    } else {
      await tx.admin.update({
        where: { id: roleProfile.id },
        data: roleData as Prisma.AdminUpdateInput,
      });
    }

    const oldValue = Object.fromEntries(
      Object.keys(changes).map((key) => [key, before[key] ?? null]),
    );

    await AuditLogServices.record(
      {
        action: "USER_PROFILE_UPDATED",
        entityType: "User",
        entityId: user.userId,
        description: `${user.role} "${user.email}" updated own profile`,
        actor: user,
        oldValue: oldValue as Prisma.InputJsonValue,
        newValue: changes as Prisma.InputJsonValue,
        metadata: { fields: Object.keys(changes) },
      },
      tx,
    );
  });

  return getMyProfile(user);
};

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { imagePublicId: true, imageUrl: true },
  });

  const cloudinaryResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { resource_type: "image", folder: "profile-images" },
          (error, result) => {
            if (error) return reject(error);
            if (!result) {
              return reject(new Error("No result returned from Cloudinary"));
            }
            resolve(result);
          },
        )
        .end(buffer);
    },
  );

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      imageUrl: cloudinaryResult.secure_url,
      imagePublicId: cloudinaryResult.public_id,
    },
    omit: { password: true },
  });

  if (currentUser?.imagePublicId && currentUser.imageUrl) {
    await cloudinary.uploader.destroy(currentUser.imagePublicId);
  }

  return updatedUser;
};

export const UserServices = {
  getMyProfile,
  updateMyProfile,
  uploadProfileImage,
};
