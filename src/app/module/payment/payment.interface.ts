export interface ICreateInvoicePayload {
  workOrderId: string;
  discount?: number; // flat amount in BDT
  taxPercent?: number; // overrides TAX_RATE_PERCENT from .env
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
  from?: string; // createdAt >= from
  to?: string; // createdAt <= to
}
