export type TGender = "MALE" | "FEMALE" | "OTHER";

export interface ICustomerProfilePayload {
  name?: string;
  contactNumber?: string;
  gender?: TGender;
  address?: string;
  city?: string;
}

export interface ITechnicianProfilePayload {
  name?: string;
  contactNumber?: string;
  gender?: TGender;
  address?: string;
  bio?: string;
  experienceYears?: number;
}

export interface IAdminProfilePayload {
  name?: string;
  contactNumber?: string;
  department?: string;
}

export type TUpdateProfilePayload =
  | ICustomerProfilePayload
  | ITechnicianProfilePayload
  | IAdminProfilePayload;
