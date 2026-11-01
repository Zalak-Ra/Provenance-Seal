import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { setClient } from "../src/blockchain/client.js";
import { setScanDataFile } from "../src/services/scanStore.js";
import { HttpError } from "../src/utils/httpError.js";

const PRODUCT = `0x${"ab".repeat(32)}`;
const OTHER = `0x${"cd".repeat(32)}`;
const WALLET = `0x${"11".repeat(20)}`;
const CONTRACT = `0x${"22".repeat(20)}`;

function chainClient(overrides = {}) {
  return {
    async getNetworkStatus() {
      return {
        connected: true,
        chainId: 1337,
        expectedChainId: 1337,
        supportedNetwork: true,
        blockNumber: 8,
        contractAddress: CONTRACT,
        verificationFeeWei: "1000000000000000"
      };
    },
    getArtifact() {
      return { abi: [{ type: "function", name: "getProduct" }] };
    },
    resolveAddress() {
      return CONTRACT;
    },
    async productExists(productId) {
      return productId.toLowerCase() === PRODUCT;
    },
    async getProduct(productId) {
      if (productId.toLowerCase() !== PRODUCT) {
        throw new HttpError(404, "Product is not registered on the blockchain.");
      }
      return {
        name: "Cedar Soap",
        batchNumber: "BATCH-7",
        productId: PRODUCT,
        manufacturer: WALLET,
        currentCustodian: WALLET,
        registeredAt: 1700000000,
        verificationCount: 1,
        exists: true,
        status: 1,
        statusName: "With manufacturer"
      };
    },
    async getHistory(productId) {
      if (productId.toLowerCase() !== PRODUCT) {
        throw new HttpError(404, "Product is not registered on the blockchain.");
      }
      return [
        {
          actor: WALLET,
          from: "0x0000000000000000000000000000000000000000",
          to: WALLET,
          timestamp: 1700000000,
          action: 1,
          actionName: "Registered"
        }
      ];
    },
    async getParticipant(address) {
      return { address, role: 1, roleName: "Manufacturer", isOwner: false };
    },
    async getEvents() {
      return [
        {
          name: "ProductRegistered",
          blockNumber: 2,
          transactionHash: `0x${"aa".repeat(32)}`,
          logIndex: 0,
          args: { productId: PRODUCT, manufacturer: WALLET }
        }
      ];
    },
    ...overrides
  };
}

const dataFile = path.join(os.tmpdir(), `product-auth-scans-${process.pid}.json`);
setScanDataFile(dataFile);
setClient(chainClient());
const app = createApp();

test("health reports a reachable chain", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.blockchain.contractAddress, CONTRACT);
});

test("health reports an unreachable chain", async () => {
  setClient({
    async getNetworkStatus() {
      throw new HttpError(503, "Blockchain RPC is not reachable.");
    }
  });
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 503);
  assert.match(response.body.error, /not reachable/i);
  setClient(chainClient());
});

test("public config exposes the ABI and not a private key", async () => {
  const response = await request(app).get("/api/config");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.abi));
  assert.equal(response.body.contractAddress, CONTRACT);
  assert.equal(response.body.privateKey, undefined);
  assert.equal(response.body.mnemonic, undefined);
});

test("product, history, and read-only verify endpoints", async () => {
  const product = await request(app).get(`/api/products/${PRODUCT}`);
  assert.equal(product.status, 200);
  assert.equal(product.body.product.name, "Cedar Soap");

  const history = await request(app).get(`/api/products/${PRODUCT}/history`);
  assert.equal(history.status, 200);
  assert.equal(history.body.source, "blockchain");
  assert.equal(history.body.history[0].actionName, "Registered");

  const verify = await request(app).get(`/api/products/${PRODUCT}/verify`);
  assert.equal(verify.status, 200);
  assert.equal(verify.body.paymentSubmitted, false);
  assert.equal(verify.body.recordFound, true);
  assert.match(verify.body.note, /does not call verifyProduct/i);
});

test("unknown and malformed product ids are rejected", async () => {
  const missing = await request(app).get(`/api/products/${OTHER}`);
  assert.equal(missing.status, 404);

  const malformed = await request(app).get("/api/products/not-an-id");
  assert.equal(malformed.status, 400);

  const badHistory = await request(app).get(`/api/products/${OTHER}/history`);
  assert.equal(badHistory.status, 404);
});

test("events and participants", async () => {
  const events = await request(app).get("/api/events");
  assert.equal(events.status, 200);
  assert.equal(events.body.events[0].name, "ProductRegistered");

  const filtered = await request(app).get(`/api/events?productId=${PRODUCT}`);
  assert.equal(filtered.status, 200);
  assert.equal(filtered.body.events.length, 1);

  const badFilter = await request(app).get("/api/events?productId=bad");
  assert.equal(badFilter.status, 400);

  const participant = await request(app).get(`/api/participants/${WALLET}`);
  assert.equal(participant.status, 200);
  assert.equal(participant.body.roleName, "Manufacturer");

  const badAddress = await request(app).get("/api/participants/0x1234");
  assert.equal(badAddress.status, 400);
});

test("scan analytics flags repeated scans and keeps payment off-chain", async () => {
  const bodies = [
    { productId: PRODUCT, clientId: "client-a", region: "India" },
    { productId: PRODUCT, clientId: "client-b", region: "India" },
    { productId: PRODUCT, clientId: "client-c", region: "Singapore" }
  ];
  for (const body of bodies) {
    const response = await request(app).post("/api/products/scan").send(body);
    assert.equal(response.status, 201);
    assert.equal(response.body.paymentSubmitted, false);
    assert.equal(response.body.found, true);
  }

  const scans = await request(app).get(`/api/products/${PRODUCT}/scans`);
  assert.equal(scans.status, 200);
  assert.equal(scans.body.scans.length, 3);
  assert.equal(scans.body.assessment.level, "suspicious");
  assert.equal(scans.body.scans[0].clientHashPrefix.length, 10);
  assert.equal(JSON.stringify(scans.body).includes("client-a"), false);
});

test("a scan of an unregistered product does not pretend the product exists", async () => {
  const response = await request(app).post("/api/products/scan").send({ productId: OTHER, clientId: "client-z" });
  assert.equal(response.status, 404);
  assert.equal(response.body.found, false);
  assert.ok(response.body.assessment);
});

test("chain read failures stay visible", async () => {
  setClient(
    chainClient({
      async getProduct() {
        throw new HttpError(502, "Could not read the product from the contract.");
      }
    })
  );
  const response = await request(app).get(`/api/products/${PRODUCT}`);
  assert.equal(response.status, 502);
  setClient(chainClient());
});

test("cleanup scan fixture", () => {
  fs.rmSync(dataFile, { force: true });
});
