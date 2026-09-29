import { Priority } from "../../../generated/prisma/enums";

export interface ICreateServiceRequestPayload {
  title: string;
  description: string;
  priority?: Priority;
  preferredDate?: string;
  address: string;
  city: string;
}

export interface IReviewServiceRequestPayload {
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}

export interface IServiceRequestQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  priority?: string;
  city?: string;
}
