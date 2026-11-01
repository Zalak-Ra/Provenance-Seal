import { describe, expect, it } from "vitest";
import {
  explainError,
  generateProductId,
  networkStatus,
  parseChainId,
  parseQrPayload,
  resolveProductId,
  validateAddress,
  validateRegistration
} from "./format";

describe("network and wallet helpers", () => {
  it("treats a missing chain and a non-Ganache chain as unsupported", () => {
    expect(networkStatus(null).ok).toBe(false);
    expect(networkStatus(1).label).toMatch(/Unsupported network/);
    expect(networkStatus(1337).ok).toBe(true);
    expect(networkStatus(1337).label).toMatch(/Ganache Local/);
  });

  it("parses MetaMask chain ids and rejected signatures", () => {
    expect(parseChainId("0x539")).toBe(1337);
    expect(explainError({ code: 4001 })).toMatch(/rejected/i);
  });
});

describe("product identifiers", () => {
  it("hashes a serial the same way twice and reads ids from links", () => {
    const first = generateProductId("SN-1001");
    const second = generateProductId("SN-1001");
    expect(first).toBe(second);
    expect(first).toMatch(/^0x[0-9a-f]{64}$/);
    expect(resolveProductId(`http://localhost:5173/verify?pid=${first}`)).toBe(first);
    expect(parseQrPayload(`seal ${first}`)).toBe(first);
    expect(parseQrPayload("not a product code")).toBeNull();
  });

  it("rejects empty registration fields and invalid addresses", () => {
    const errors = validateRegistration({ name: "", batchNumber: "", serialNumber: "" });
    expect(errors.name).toBeTruthy();
    expect(errors.batchNumber).toBeTruthy();
    expect(errors.serialNumber).toBeTruthy();
    expect(validateAddress("0x1111111111111111111111111111111111111111")).toBe(true);
    expect(validateAddress("not-an-address")).toBe(false);
    expect(() => generateProductId("")).toThrow(/Invalid serial number/);
  });
});
