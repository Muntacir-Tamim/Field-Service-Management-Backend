import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

interface ISkillPayload {
  name: string;
  category: string;
  description?: string;
}

const createSkill = async (payload: ISkillPayload) => {
  const exists = await prisma.skill.findUnique({
    where: { name: payload.name },
  });
  if (exists) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A skill with this name already exists",
    );
  }
  return prisma.skill.create({ data: payload });
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

  return prisma.skill.update({ where: { id: skillId }, data: payload });
};

const deleteSkill = async (skillId: string) => {
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
  return null;
};

export const SkillServices = {
  createSkill,
  getAllSkills,
  updateSkill,
  deleteSkill,
};
