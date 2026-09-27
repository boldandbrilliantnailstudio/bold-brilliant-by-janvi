// Customer profile: contact, delivery address and billing details (like Flipkart / Amazon).
import { z } from "zod";

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

const MOBILE_RE = /^[6-9]\d{9}$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const profileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Please enter your full name").max(80),
    phone: z.string().trim().regex(MOBILE_RE, "Enter a valid 10-digit mobile number"),
    altPhone: z.string().trim().refine((v) => v === "" || MOBILE_RE.test(v), "Enter a valid 10-digit mobile number"),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
    addressLine1: z.string().trim().min(3, "Enter your flat / house no. and building").max(150),
    addressLine2: z.string().trim().min(3, "Enter your area, street or locality").max(150),
    landmark: z.string().trim().max(100),
    city: z.string().trim().min(2, "Enter your city").max(60),
    state: z.string().min(1, "Select your state"),
    addressType: z.enum(["Home", "Work"]),
    billingSame: z.boolean(),
    billingName: z.string().trim().max(80),
    billingAddress: z.string().trim().max(300),
    gstin: z.string().trim().toUpperCase().refine((v) => v === "" || GSTIN_RE.test(v), "Enter a valid 15-character GSTIN"),
  })
  .superRefine((v, ctx) => {
    if (v.billingSame) return;
    if (v.billingName.length < 2) ctx.addIssue({ code: "custom", path: ["billingName"], message: "Enter the billing name" });
    if (v.billingAddress.length < 10) ctx.addIssue({ code: "custom", path: ["billingAddress"], message: "Enter the full billing address" });
  });

export type ProfileValues = z.infer<typeof profileSchema>;

export const EMPTY_PROFILE: ProfileValues = {
  fullName: "",
  phone: "",
  altPhone: "",
  pincode: "",
  addressLine1: "",
  addressLine2: "",
  landmark: "",
  city: "",
  state: "",
  addressType: "Home",
  billingSame: true,
  billingName: "",
  billingAddress: "",
  gstin: "",
};

// Formats the DB customer_number as a 6-digit code shown across the site, e.g. 100482.
export const formatCustomerId = (n: number) => String(n).padStart(6, "0");

// Shape of a row in the Supabase `profiles` table.
export type ProfileRow = {
  id: string;
  customer_number: number;
  full_name: string;
  phone: string;
  alt_phone: string | null;
  pincode: string;
  address_line1: string;
  address_line2: string;
  landmark: string | null;
  city: string;
  state: string;
  address_type: string;
  billing_same: boolean;
  billing_name: string | null;
  billing_address: string | null;
  gstin: string | null;
  updated_at?: string;
};

export const fromRow = (r: ProfileRow): ProfileValues => ({
  fullName: r.full_name,
  phone: r.phone,
  altPhone: r.alt_phone ?? "",
  pincode: r.pincode,
  addressLine1: r.address_line1,
  addressLine2: r.address_line2,
  landmark: r.landmark ?? "",
  city: r.city,
  state: r.state,
  addressType: r.address_type === "Work" ? "Work" : "Home",
  billingSame: r.billing_same,
  billingName: r.billing_name ?? "",
  billingAddress: r.billing_address ?? "",
  gstin: r.gstin ?? "",
});

// Never include customer_number when writing: a new row gets one from the database's
// sequence default, and omitting it on update leaves the customer's existing number untouched
// (an upsert only overwrites the columns present in the payload).
export const toRow = (id: string, v: ProfileValues): Omit<ProfileRow, "customer_number"> => ({
  id,
  full_name: v.fullName,
  phone: v.phone,
  alt_phone: v.altPhone || null,
  pincode: v.pincode,
  address_line1: v.addressLine1,
  address_line2: v.addressLine2,
  landmark: v.landmark || null,
  city: v.city,
  state: v.state,
  address_type: v.addressType,
  billing_same: v.billingSame,
  billing_name: v.billingSame ? null : v.billingName,
  billing_address: v.billingSame ? null : v.billingAddress,
  gstin: v.gstin || null,
  updated_at: new Date().toISOString(),
});

export const formatDeliveryAddress = (p: ProfileValues) =>
  [p.addressLine1, p.addressLine2, p.landmark && `Landmark: ${p.landmark}`, `${p.city}, ${p.state} - ${p.pincode}`].filter(Boolean).join(", ");

// Full text saved on each order so the studio has everything needed to ship and bill.
export const formatOrderAddress = (p: ProfileValues) => {
  const lines = [`${formatDeliveryAddress(p)} (${p.addressType})`];
  if (p.altPhone) lines.push(`Alternate phone: +91 ${p.altPhone}`);
  if (!p.billingSame) lines.push(`Billing: ${p.billingName}, ${p.billingAddress}`);
  if (p.gstin) lines.push(`GSTIN: ${p.gstin}`);
  return lines.join("\n");
};
