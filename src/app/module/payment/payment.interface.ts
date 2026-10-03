export interface ICreateInvoicePayload {
  workOrderId: string;
  discount?: number;
  taxPercent?: number;
  dueDate?: Date;
  notes?: string;
}

export interface IInitiatePaymentPayload {
  paymentId: string;
}

export interface ICashPaymentPayload {
  notes?: string;
}

export interface IRefundPayload {
  reason: string;
}

export interface IInvoiceQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  from?: string;
  to?: string;
}
