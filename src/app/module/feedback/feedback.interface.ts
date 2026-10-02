export interface ICreateFeedbackPayload {
  serviceRequestId: string;
  rating: number;
  comment?: string;
}

export interface IUpdateFeedbackPayload {
  rating?: number;
  comment?: string;
}

export interface IFeedbackQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  rating?: string;
  technicianId?: string;
}
