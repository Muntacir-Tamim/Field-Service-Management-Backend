import type { SkillLevel } from "../../../generated/prisma/enums";

export interface IApplyAsTechnicianPayload {
  name: string;
  email: string;
  password: string;
  technician: {
    contactNumber: string;
    gender?: "MALE" | "FEMALE" | "OTHER";
    address?: string;
    bio?: string;
    experienceYears: number;
  };
  skills: { skillId: string; level?: SkillLevel }[];
}

export interface IVerifyTechnicianEmailPayload {
  email: string;
  otp: string;
}

export interface IResendOtpPayload {
  email: string;
}

export interface IReviewTechnicianPayload {
  verificationStatus: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

export interface IUpdateTechnicianProfilePayload {
  contactNumber?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  address?: string;
  bio?: string;
  experienceYears?: number;
}

export interface IAddSkillPayload {
  skillId: string;
  level?: SkillLevel;
}

export interface ITechnicianQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  searchTerm?: string;
  verificationStatus?: string;
  isAvailable?: string;
  skillId?: string;
}

// "type" (not interface) so it can be saved into a Prisma Json column
export type IStoredFile = {
  url: string;
  publicId: string;
  resourceType: string;
};
