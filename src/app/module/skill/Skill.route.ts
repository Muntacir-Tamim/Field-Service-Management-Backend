import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SkillController } from "./Skill.controller";
import { CreateSkillZodSchema, UpdateSkillZodSchema } from "./Skill.validation";

const router = Router();

const MANAGEMENT = [Role.ADMIN] as const;

router.get("/", SkillController.getAllSkills);

router.post(
  "/",
  auth(...MANAGEMENT),
  validateRequest(CreateSkillZodSchema),
  SkillController.createSkill,
);

router.patch(
  "/:skillId",
  auth(...MANAGEMENT),
  validateRequest(UpdateSkillZodSchema),
  SkillController.updateSkill,
);

router.delete("/:skillId", auth(...MANAGEMENT), SkillController.deleteSkill);

export const SkillRoutes = router;
