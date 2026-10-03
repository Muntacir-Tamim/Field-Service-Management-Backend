export interface IStartWorkPayload {
  problemFound: string;
  workDescription: string;
}

export interface ICompleteWorkPayload {
  laborHours: number;
  completionNotes: string;
}

export interface IAddPartPayload {
  name: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

export interface IServiceReportPayload {
  summary: string;
  findings: string;
  recommendations?: string;
}

export interface IWorkOrderQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  technicianId?: string;
  serviceRequestId?: string;
  from?: string;
  to?: string;
}
