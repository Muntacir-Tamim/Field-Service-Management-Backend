export interface ICreateAssignmentPayload {
  serviceRequestId: string;
  technicianId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  notes?: string;
}

export interface IRescheduleAssignmentPayload {
  scheduledStart: Date;
  scheduledEnd: Date;
  technicianId?: string; // optional: change technician while rescheduling
  reason?: string;
  notes?: string;
}

export interface ICancelAssignmentPayload {
  reason: string;
}

export interface IAssignmentQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  technicianId?: string;
  serviceRequestId?: string;
  from?: string; // scheduledStart >= from
  to?: string; // scheduledStart <= to
}

export interface IAvailableTechnicianQuery {
  scheduledStart?: string;
  scheduledEnd?: string;
  skillId?: string;
}
