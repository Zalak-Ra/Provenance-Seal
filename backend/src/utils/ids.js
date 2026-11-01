import { createHash } from "crypto";
import { HttpError } from "./httpError.js";

export function assertProductId(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new HttpError(400, "Product identifier must be a 32-byte 0x-prefixed hex value.");
  }
  return value;
}

export function assertAddress(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new HttpError(400, "Wallet address must be a 20-byte 0x-prefixed hex value.");
  }
  return value;
}

export function normalizeRegion(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9 .,_-]{1,40}$/.test(value)) {
    throw new HttpError(400, "Region must be a short place name, or omitted.");
  }
  return value.trim();
}

export function hashValue(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function revertText(error) {
  return [error?.shortMessage, error?.reason, error?.message].filter(Boolean).join(" ");
}
