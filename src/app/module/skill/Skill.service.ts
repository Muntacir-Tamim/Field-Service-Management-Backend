import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IRequestUser } from "../auth/auth.interface";
import { AuditLogServices } from "../audit-log/audit-log.service";

interface ISkillPayload {
  name: string;
  category: string;
  description?: string;
}

const createSkill = async (payload: ISkillPayload, user: IRequestUser) => {
  const exists = await prisma.skill.findUnique({
    where: { name: payload.name },
  });
  if (exists) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A skill with this name already exists",
    );
  }

  const created = await prisma.skill.create({ data: payload });

  void AuditLogServices.record({
    action: "SKILL_CREATED",
    entityType: "Skill",
    entityId: created.id,
    description: `Skill "${created.name}" created`,
    actor: user,
    newValue: { name: created.name, category: created.category },
  });

  return created;
};

const getAllSkills = async (query: {
  category?: string;
  searchTerm?: string;
}) => {
  return prisma.skill.findMany({
    where: {
      ...(query.category
        ? { category: { equals: query.category, mode: "insensitive" } }
        : {}),
      ...(query.searchTerm
        ? { name: { contains: query.searchTerm, mode: "insensitive" } }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
};

const updateSkill = async (
  skillId: string,
  payload: Partial<ISkillPayload>,
  user: IRequestUser,
) => {
  const skill = await prisma.skill.findUnique({ where: { id: skillId } });
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

  return updated;
};

const deleteSkill = async (skillId: string, user: IRequestUser) => {
  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    include: { _count: { select: { technicians: true } } },
  });
  if (!skill) throw new AppError(httpStatus.NOT_FOUND, "Skill Not Found");

  if (skill._count.technicians > 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Cannot delete: ${skill._count.technicians} technician(s) use this skill`,
    );
  }

  await prisma.skill.delete({ where: { id: skillId } });

  void AuditLogServices.record({
    action: "SKILL_DELETED",
    entityType: "Skill",
    entityId: skillId,
    description: `Skill "${skill.name}" deleted`,
    actor: user,
    oldValue: { name: skill.name, category: skill.category },
  });

  return null;
};

export const SkillServices = {
  createSkill,
  getAllSkills,
  updateSkill,
  deleteSkill,
};
