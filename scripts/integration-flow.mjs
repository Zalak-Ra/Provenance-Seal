/**
 * End-to-end check against a real Ganache instance.
 * This is not a mocked chain. Truffle unit tests remain in test/product_authentication.test.js.
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import ganache from "ganache";
import { ethers } from "ethers";
import { createApp } from "../backend/src/app.js";
import { BlockchainClient, setClient } from "../backend/src/blockchain/client.js";
import { setScanDataFile } from "../backend/src/services/scanStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactPath = path.join(root, "build", "contracts", "ProductAuthentication.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameAddress(left, right) {
  return ethers.getAddress(left) === ethers.getAddress(right);
}

function errorText(error) {
  return [
    error?.shortMessage,
    error?.reason,
    error?.revert?.name,
    error?.message,
    error?.error?.message,
    error?.info?.error?.message
  ]
    .filter(Boolean)
    .join(" ");
}

async function expectRevert(promise, fragment) {
  try {
    const result = await promise;
    if (result && typeof result.wait === "function") {
      const receipt = await result.wait();
      assert(receipt.status === 0, `Expected "${fragment}", but the transaction was confirmed`);
      return;
    }
  } catch (error) {
    const text = errorText(error);
    assert(text.includes(fragment), `Expected "${fragment}" in "${text}"`);
    return;
  }
  throw new Error(`Expected revert containing "${fragment}"`);
}

const steps = [];
function pass(name) {
  steps.push(name);
  console.log(`PASS  ${name}`);
}

const ganacheServer = ganache.server({
  wallet: { deterministic: true, totalAccounts: 10 },
  chain: { chainId: 1337, networkId: 1337 },
  logging: { quiet: true }
});

let httpServer;

try {
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Compile first: npx truffle compile");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  await ganacheServer.listen(8546);
  pass("Ganache accepted connections on 127.0.0.1:8546");

  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8546");
  const accounts = await provider.send("eth_accounts", []);
  const owner = await provider.getSigner(accounts[0]);
  const manufacturer = await provider.getSigner(accounts[1]);
  const distributor = await provider.getSigner(accounts[2]);
  const retailer = await provider.getSigner(accounts[3]);
  const customer = await provider.getSigner(accounts[4]);
  const stranger = await provider.getSigner(accounts[5]);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
  const fee = ethers.parseEther("0.001");
  const deployed = await factory.deploy(fee);
  await deployed.waitForDeployment();
  const address = await deployed.getAddress();
  pass(`Deployed ProductAuthentication at ${address}`);

  const contract = deployed;
  assert((await contract.getVerificationFee()) === fee, "Initial fee mismatch");
  assert(sameAddress(await contract.owner(), accounts[0]), "Owner mismatch");
  pass("Constructor set the owner and the 0.001 ETH fee");

  const roleTx = await contract.setParticipantRole(accounts[1], 1);
  await roleTx.wait();
  await (await contract.setParticipantRole(accounts[2], 2)).wait();
  await (await contract.setParticipantRole(accounts[3], 3)).wait();
  pass("Owner authorized a manufacturer, distributor, and retailer");

  const serial = "SN-INTEGRATION-1";
  const expectedId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string"], [serial]));
  const registerTx = await contract.connect(manufacturer).registerProduct("Cedar Soap", "BATCH-7", serial);
  const registerReceipt = await registerTx.wait();
  assert(registerReceipt.status === 1, "Registration was not confirmed");
  const registered = contract.interface.parseLog(registerReceipt.logs.find((log) => {
    try {
      return contract.interface.parseLog(log).name === "ProductRegistered";
    } catch {
      return false;
    }
  }));
  assert(registered.args.productId === expectedId, "Event product id does not match the pure function");
  pass("Manufacturer registered a product and ProductRegistered was confirmed");

  await expectRevert(
    contract.connect(manufacturer).registerProduct.staticCall("Cedar Soap", "BATCH-7", serial),
    "Product already registered"
  );
  pass("Duplicate registration was rejected");

  await expectRevert(
    contract.connect(stranger).transferCustody.staticCall(expectedId, accounts[2]),
    "Caller is not the current custodian"
  );
  pass("Unauthorized transfer was rejected");

  const toDistributor = await contract.connect(manufacturer).transferCustody(expectedId, accounts[2]);
  const distributorReceipt = await toDistributor.wait();
  assert(distributorReceipt.status === 1, "Distributor transfer was not confirmed");
  const toRetailer = await contract.connect(distributor).transferCustody(expectedId, accounts[3]);
  const retailerReceipt = await toRetailer.wait();
  assert(retailerReceipt.status === 1, "Retailer transfer was not confirmed");
  const moved = await contract.getProduct(expectedId);
  assert(sameAddress(moved.currentCustodian, accounts[3]), "Retailer is not the custodian");
  pass("Custody moved from manufacturer to distributor to retailer");

  await expectRevert(
    contract.connect(customer).verifyProduct.staticCall(expectedId, { value: ethers.parseEther("0.0001") }),
    "Incorrect verification fee"
  );
  const verifyTx = await contract.connect(customer).verifyProduct(expectedId, { value: fee });
  const verifyReceipt = await verifyTx.wait();
  assert(verifyReceipt.status === 1, "Verification was not confirmed");
  const verifiedEvents = await contract.queryFilter(contract.filters.ProductVerified(), 0);
  assert(verifiedEvents.length === 1, "ProductVerified was not found");
  assert(sameAddress(verifiedEvents[0].args.verifier, accounts[4]), "Verifier address mismatch");
  const afterVerify = await contract.getProduct(expectedId);
  assert(afterVerify.verificationCount === 1n, "Verification count was not updated");
  pass("Customer paid 0.001 ETH and ProductVerified was confirmed");

  const withdrawTx = await contract.withdraw(accounts[0], fee);
  const withdrawReceipt = await withdrawTx.wait();
  assert(withdrawReceipt.status === 1, "Withdrawal was not confirmed");
  assert((await contract.getContractBalance()) === 0n, "Contract balance was not withdrawn");
  await expectRevert(
    contract.connect(customer).withdraw.staticCall(accounts[4], 1n),
    "Caller is not the contract owner"
  );
  pass("Owner withdrew fees and a non-owner was rejected");

  const client = new BlockchainClient({
    rpcUrl: "http://127.0.0.1:8546",
    chainId: 1337,
    address,
    artifact
  });
  setClient(client);
  setScanDataFile(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "integration-scans-")), "scans.json"));

  const app = createApp();
  httpServer = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  const base = `http://127.0.0.1:${httpServer.address().port}`;

  const health = await fetch(`${base}/api/health`);
  const healthBody = await health.json();
  assert(health.status === 200, "Health endpoint failed");
  assert(healthBody.blockchain.contractAddress === address, "Health returned the wrong contract");
  pass("Backend health read the Ganache deployment");

  const productResponse = await fetch(`${base}/api/products/${expectedId}`);
  const productBody = await productResponse.json();
  assert(productResponse.status === 200, "Product API failed");
  assert(productBody.product.name === "Cedar Soap", "API product name mismatch");
  assert(productBody.product.verificationCount === 1, "API verification count mismatch");

  const historyResponse = await fetch(`${base}/api/products/${expectedId}/history`);
  const historyBody = await historyResponse.json();
  assert(historyBody.history.length === 4, `Expected 4 history entries, got ${historyBody.history.length}`);
  pass("Backend product and history endpoints match the chain");

  const eventsResponse = await fetch(`${base}/api/events?productId=${expectedId}`);
  const eventsBody = await eventsResponse.json();
  const names = eventsBody.events.map((event) => event.name);
  assert(names.includes("ProductRegistered"), "API missed ProductRegistered");
  assert(names.includes("CustodyTransferred"), "API missed CustodyTransferred");
  assert(names.includes("ProductVerified"), "API missed ProductVerified");
  pass("Backend event endpoint returned the confirmed logs");

  for (const body of [
    { productId: expectedId, clientId: "desk-a", region: "India" },
    { productId: expectedId, clientId: "desk-b", region: "India" },
    { productId: expectedId, clientId: "desk-c", region: "Singapore" }
  ]) {
    const scanResponse = await fetch(`${base}/api/products/scan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    assert(scanResponse.status === 201, `Scan failed with ${scanResponse.status}`);
  }
  const scanList = await (await fetch(`${base}/api/products/${expectedId}/scans`)).json();
  assert(scanList.assessment.level === "suspicious", "Suspicious scan pattern was not flagged");
  pass("Repeated scans were flagged without calling them proof of counterfeiting");

  const missing = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["SN-DOES-NOT-EXIST"]));
  const missingResponse = await fetch(`${base}/api/products/${missing}`);
  assert(missingResponse.status === 404, "Unknown product should be a 404");
  pass("Unknown product lookup returned 404");

  console.log(`\nIntegration completed: ${steps.length} checks passed.`);
} catch (error) {
  console.error("\nFAIL ", error);
  process.exitCode = 1;
} finally {
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await ganacheServer.close();
}
