import httpStatus from "http-status";
import { cacheDeleteByPrefix, cacheGetOrSet } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import { AuditLogServices } from "../audit-log/audit-log.service";

const SKILLS_CACHE_PREFIX = "skills:list:";
const SKILLS_CACHE_TTL = 300; // 5 minutes

interface ISkillPayload {
  name: string;
  category: string;
  description?: string;
}

const createSkill = async (payload: ISkillPayload, user: IRequestUser) => {
  // name is unique in the DB, so a soft-deleted skill with the same name is brought back
  const exists = await prisma.skill.findUnique({
    where: { name: payload.name },
  });

  if (exists && !exists.isDeleted) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A skill with this name already exists",
    );
  }

  const created = exists
    ? await prisma.skill.update({
        where: { id: exists.id },
        data: { ...payload, isDeleted: false, deletedAt: null },
      })
    : await prisma.skill.create({ data: payload });

  void AuditLogServices.record({
    action: "SKILL_CREATED",
    entityType: "Skill",
    entityId: created.id,
    description: exists
      ? `Skill "${created.name}" restored`
      : `Skill "${created.name}" created`,
    actor: user,
    newValue: { name: created.name, category: created.category },
  });

  await cacheDeleteByPrefix(SKILLS_CACHE_PREFIX);

  return created;
};

const getAllSkills = async (query: {
  category?: string;
  searchTerm?: string;
}) => {
  const key = `${SKILLS_CACHE_PREFIX}${(query.category ?? "").toLowerCase()}:${(query.searchTerm ?? "").toLowerCase()}`;

  return cacheGetOrSet(key, SKILLS_CACHE_TTL, () =>
    prisma.skill.findMany({
      where: {
        isDeleted: false,
        ...(query.category
          ? { category: { equals: query.category, mode: "insensitive" } }
          : {}),
        ...(query.searchTerm
          ? { name: { contains: query.searchTerm, mode: "insensitive" } }
          : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  );
};

const updateSkill = async (
  skillId: string,
  payload: Partial<ISkillPayload>,
  user: IRequestUser,
) => {
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, isDeleted: false },
  });
  if (!skill) throw new AppError(httpStatus.NOT_FOUND, "Skill Not Found");

  if (payload.name && payload.name !== skill.name) {
    const duplicate = await prisma.skill.findUnique({
      where: { name: payload.name },
    });
    if (duplicate) {
      throw new AppError(
        httpStatus.CONFLICT,
        "A skill with this name already exists",
      );
    }
  }

  const updated = await prisma.skill.update({
    where: { id: skillId },
    data: payload,
  });

  void AuditLogServices.record({
    action: "SKILL_UPDATED",
    entityType: "Skill",
    entityId: skillId,
    description: `Skill "${skill.name}" updated`,
    actor: user,
    oldValue: {
      name: skill.name,
      category: skill.category,
      description: skill.description ?? null,
    },
    newValue: {
      name: updated.name,
      category: updated.category,
      description: updated.description ?? null,
    },
  });

  await cacheDeleteByPrefix(SKILLS_CACHE_PREFIX);

  return updated;
};

// Soft delete
const deleteSkill = async (skillId: string, user: IRequestUser) => {
  const skill = await prisma.skill.findFirst({
    where: { id: skillId, isDeleted: false },
    include: { _count: { select: { technicians: true } } },
  });
  if (!skill) throw new AppError(httpStatus.NOT_FOUND, "Skill Not Found");

  if (skill._count.technicians > 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Cannot delete: ${skill._count.technicians} technician(s) use this skill`,
    );
  }

  await prisma.skill.update({
    where: { id: skillId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  void AuditLogServices.record({
    action: "SKILL_DELETED",
    entityType: "Skill",
    entityId: skillId,
    description: `Skill "${skill.name}" soft deleted`,
    actor: user,
    oldValue: { name: skill.name, category: skill.category, isDeleted: false },
    newValue: { isDeleted: true },
  });

  await cacheDeleteByPrefix(SKILLS_CACHE_PREFIX);

  return null;
};

export const SkillServices = {
  createSkill,
  getAllSkills,
  updateSkill,
  deleteSkill,
};
