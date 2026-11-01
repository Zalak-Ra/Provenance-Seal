const ProductAuthentication = artifacts.require("ProductAuthentication");
const ReentrancyAttacker = artifacts.require("ReentrancyAttacker");

const FEE = web3.utils.toWei("0.001", "ether");
const STATUS = { None: 0, WithManufacturer: 1, WithDistributor: 2, WithRetailer: 3 };
const ROLE = { None: 0, Manufacturer: 1, Distributor: 2, Retailer: 3 };
const ACTION = { Register: 1, Transfer: 2, Verify: 3 };

async function assertRevert(promise, fragment) {
  try {
    await promise;
  } catch (error) {
    assert(
      error.message.includes(fragment),
      `Expected revert containing "${fragment}", received "${error.message}"`
    );
    return;
  }
  assert.fail(`Expected revert containing "${fragment}"`);
}

/**
 * Ganache 7 on Node 24 confirms the revert (status 0) but Web3 does not always
 * include the Solidity reason for custom errors or for eth_sendTransaction.
 * Callers of this helper must assert the chain state that the revert protects.
 */
async function assertReverted(promise) {
  try {
    await promise;
  } catch (error) {
    assert(
      /revert|status 0|status": false|Custom error/i.test(error.message),
      `Expected a reverted transaction, received "${error.message}"`
    );
    return;
  }
  assert.fail("Expected the transaction to revert");
}

function productIdFromSerial(serialNumber) {
  const encoded = web3.eth.abi.encodeParameters(["string"], [serialNumber]);
  return web3.utils.keccak256(encoded);
}

contract("ProductAuthentication", (accounts) => {
  const [owner, manufacturer, distributor, retailer, customer, stranger] = accounts;
  let auth;

  beforeEach(async () => {
    auth = await ProductAuthentication.new(FEE);
    await auth.setParticipantRole(manufacturer, ROLE.Manufacturer, { from: owner });
    await auth.setParticipantRole(distributor, ROLE.Distributor, { from: owner });
    await auth.setParticipantRole(retailer, ROLE.Retailer, { from: owner });
  });

  async function registerSample(serial = "SN-1001") {
    const tx = await auth.registerProduct("Cedar Soap", "BATCH-7", serial, { from: manufacturer });
    const productId = productIdFromSerial(serial);
    return { tx, productId };
  }

  it("deploys and initializes the owner and verification fee", async () => {
    assert.equal(await auth.owner(), owner);
    assert.equal((await auth.getVerificationFee()).toString(), FEE);
    assert.equal((await auth.verificationFee()).toString(), FEE);
    assert.equal((await auth.getContractBalance()).toString(), "0");
    assert.equal((await auth.totalProducts()).toString(), "0");
  });

  it("rejects a zero or excessive initial fee", async () => {
    await assertRevert(ProductAuthentication.new(0), "Initial verification fee must be greater than zero");
    await assertRevert(
      ProductAuthentication.new(web3.utils.toWei("2", "ether")),
      "Initial verification fee exceeds safety cap"
    );
  });

  it("lets only the owner authorize participants and records the role", async () => {
    assert.equal((await auth.getParticipantRole(manufacturer)).toString(), String(ROLE.Manufacturer));
    assert.equal((await auth.getParticipantRole(stranger)).toString(), String(ROLE.None));

    const tx = await auth.setParticipantRole(stranger, ROLE.Retailer, { from: owner });
    assert.ok(tx.logs.some((log) => log.event === "ParticipantRoleUpdated"));
    assert.equal((await auth.getParticipantRole(stranger)).toString(), String(ROLE.Retailer));

    await assertRevert(
      auth.setParticipantRole(stranger, ROLE.Manufacturer, { from: customer }),
      "Caller is not the contract owner"
    );
    await assertRevert(auth.setParticipantRole("0x0000000000000000000000000000000000000000", ROLE.Manufacturer), "Invalid address");
    await assertRevert(auth.setParticipantRole(stranger, 9, { from: owner }), "Invalid role");
    await assertRevert(
      auth.setParticipantRole(stranger, ROLE.Retailer, { from: owner }),
      "Role is unchanged"
    );
  });

  it("returns the participant list including a later revocation", async () => {
    await auth.setParticipantRole(manufacturer, ROLE.None, { from: owner });
    const result = await auth.getParticipants();
    assert.equal(result[0].length, 3);
    const index = result[0].findIndex((address) => address.toLowerCase() === manufacturer.toLowerCase());
    assert.notEqual(index, -1);
    assert.equal(result[1][index].toString(), String(ROLE.None));
  });

  it("generates a deterministic product id with keccak256(abi.encode(serial))", async () => {
    const serial = "SN-1001";
    const expected = productIdFromSerial(serial);
    const actual = await auth.generateProductId(serial);
    assert.equal(actual, expected);
    const again = await auth.generateProductId(serial);
    assert.equal(again, expected);
    await assertRevert(auth.generateProductId(""), "Invalid serial number");
  });

  it("registers a product for an authorized manufacturer", async () => {
    const { tx, productId } = await registerSample();
    assert.ok(tx.logs.some((log) => log.event === "ProductRegistered"));
    assert.equal(tx.logs[0].args.productId, productId);
    assert.equal(tx.logs[0].args.manufacturer, manufacturer);

    const product = await auth.getProduct(productId);
    assert.equal(product.name, "Cedar Soap");
    assert.equal(product.batchNumber, "BATCH-7");
    assert.equal(product.manufacturer, manufacturer);
    assert.equal(product.currentCustodian, manufacturer);
    assert.equal(product.exists, true);
    assert.equal(product.status.toString(), String(STATUS.WithManufacturer));
    assert.equal(product.verificationCount.toString(), "0");
    assert.ok(Number(product.registeredAt) > 0);
    assert.equal(await auth.productExists(productId), true);
    assert.equal((await auth.totalProducts()).toString(), "1");

    const history = await auth.getHistory(productId);
    assert.equal(history.length, 1);
    assert.equal(history[0].action.toString(), String(ACTION.Register));
    assert.equal(history[0].to, manufacturer);
  });

  it("rejects duplicate registration and invalid product input", async () => {
    await registerSample("SN-DUP");
    await assertRevert(
      auth.registerProduct("Cedar Soap", "BATCH-7", "SN-DUP", { from: manufacturer }),
      "Product already registered"
    );
    await assertRevert(auth.registerProduct("", "BATCH-7", "SN-NEW", { from: manufacturer }), "Invalid product name");
    await assertRevert(auth.registerProduct("Cedar Soap", "", "SN-NEW", { from: manufacturer }), "Invalid batch number");
    await assertRevert(
      auth.registerProduct("Cedar Soap", "BATCH-7", "", { from: manufacturer }),
      "Invalid serial number"
    );
  });

  it("rejects registration from a wallet that is not a manufacturer", async () => {
    await assertRevert(
      auth.registerProduct("Cedar Soap", "BATCH-7", "SN-NOPE", { from: distributor }),
      "Caller is not an authorized manufacturer"
    );
    await assertRevert(
      auth.registerProduct("Cedar Soap", "BATCH-7", "SN-NOPE", { from: stranger }),
      "Caller is not an authorized manufacturer"
    );
  });

  it("transfers custody from manufacturer to distributor to retailer and keeps history", async () => {
    const { productId } = await registerSample("SN-MOVE");

    const toDistributor = await auth.transferCustody(productId, distributor, { from: manufacturer });
    assert.ok(toDistributor.logs.some((log) => log.event === "CustodyTransferred"));
    assert.equal(toDistributor.logs[0].args.from, manufacturer);
    assert.equal(toDistributor.logs[0].args.to, distributor);

    let product = await auth.getProduct(productId);
    assert.equal(product.currentCustodian, distributor);
    assert.equal(product.status.toString(), String(STATUS.WithDistributor));

    const toRetailer = await auth.transferCustody(productId, retailer, { from: distributor });
    assert.equal(toRetailer.logs[0].args.to, retailer);

    product = await auth.getProduct(productId);
    assert.equal(product.currentCustodian, retailer);
    assert.equal(product.status.toString(), String(STATUS.WithRetailer));
    assert.equal(product.manufacturer, manufacturer);

    const history = await auth.getHistory(productId);
    assert.equal(history.length, 3);
    assert.equal(history[1].action.toString(), String(ACTION.Transfer));
    assert.equal(history[2].from, distributor);
    assert.equal(history[2].to, retailer);
  });

  it("rejects unauthorized, skipped, and invalid transfers", async () => {
    const { productId } = await registerSample("SN-LOCK");

    await assertRevert(auth.transferCustody(productId, distributor, { from: stranger }), "Caller is not the current custodian");
    await assertRevert(auth.transferCustody(productId, retailer, { from: manufacturer }), "Receiver must be an authorized distributor");
    await assertRevert(
      auth.transferCustody(productId, "0x0000000000000000000000000000000000000000", { from: manufacturer }),
      "Invalid receiver"
    );
    await assertRevert(auth.transferCustody(productId, manufacturer, { from: manufacturer }), "Cannot transfer to self");

    const missing = productIdFromSerial("SN-MISSING");
    await assertRevert(auth.transferCustody(missing, distributor, { from: manufacturer }), "Product does not exist");

    await auth.transferCustody(productId, distributor, { from: manufacturer });
    await assertRevert(
      auth.transferCustody(productId, retailer, { from: manufacturer }),
      "Caller is not the current custodian"
    );
    await assertRevert(
      auth.transferCustody(productId, manufacturer, { from: distributor }),
      "Receiver must be an authorized retailer"
    );

    await auth.transferCustody(productId, retailer, { from: distributor });
    await assertRevert(
      auth.transferCustody(productId, distributor, { from: retailer }),
      "Caller is not authorized to transfer custody"
    );
  });

  it("accepts the exact verification fee, counts verifications, and emits ProductVerified", async () => {
    const { productId } = await registerSample("SN-PAY");
    const before = web3.utils.toBN(await web3.eth.getBalance(auth.address));

    const tx = await auth.verifyProduct(productId, { from: customer, value: FEE });
    assert.ok(tx.logs.some((log) => log.event === "ProductVerified"));
    assert.equal(tx.logs[0].args.verifier, customer);
    assert.equal(tx.logs[0].args.feePaid.toString(), FEE);
    assert.equal(tx.logs[0].args.verificationCount.toString(), "1");

    const after = web3.utils.toBN(await web3.eth.getBalance(auth.address));
    assert.equal(after.sub(before).toString(), FEE);

    const product = await auth.getProduct(productId);
    assert.equal(product.verificationCount.toString(), "1");
    assert.equal(product.currentCustodian, manufacturer);

    await auth.verifyProduct(productId, { from: stranger, value: FEE });
    const counted = await auth.getProduct(productId);
    assert.equal(counted.verificationCount.toString(), "2");

    const history = await auth.getHistory(productId);
    assert.equal(history[history.length - 1].action.toString(), String(ACTION.Verify));
    assert.equal(history[history.length - 1].actor, stranger);
  });

  it("rejects incorrect verification payments and unknown products", async () => {
    const { productId } = await registerSample("SN-BADPAY");
    const shortPayment = web3.utils.toWei("0.0001", "ether");
    const highPayment = web3.utils.toWei("0.002", "ether");

    await assertRevert(auth.verifyProduct(productId, { from: customer, value: shortPayment }), "Incorrect verification fee");
    await assertRevert(auth.verifyProduct(productId, { from: customer, value: highPayment }), "Incorrect verification fee");
    await assertRevert(auth.verifyProduct(productId, { from: customer, value: 0 }), "Incorrect verification fee");

    const product = await auth.getProduct(productId);
    assert.equal(product.verificationCount.toString(), "0");
    assert.equal((await auth.getContractBalance()).toString(), "0");

    const missing = productIdFromSerial("SN-ABSENT");
    assert.equal(await auth.productExists(missing), false);
    await assertRevert(auth.getProduct(missing), "Product does not exist");
    await assertRevert(auth.getHistory(missing), "Product does not exist");
    await assertRevert(auth.verifyProduct(missing, { from: customer, value: FEE }), "Product does not exist");
  });

  it("lets the owner change the fee within the safety cap", async () => {
    const nextFee = web3.utils.toWei("0.002", "ether");
    const tx = await auth.updateVerificationFee(nextFee, { from: owner });
    assert.ok(tx.logs.some((log) => log.event === "VerificationFeeUpdated"));
    assert.equal(tx.logs[0].args.oldFee.toString(), FEE);
    assert.equal(tx.logs[0].args.newFee.toString(), nextFee);
    assert.equal((await auth.getVerificationFee()).toString(), nextFee);

    const { productId } = await registerSample("SN-NEWFEE");
    await assertRevert(auth.verifyProduct(productId, { from: customer, value: FEE }), "Incorrect verification fee");
    await auth.verifyProduct(productId, { from: customer, value: nextFee });
    assert.equal((await auth.getProduct(productId)).verificationCount.toString(), "1");

    await assertRevert(auth.updateVerificationFee(nextFee, { from: owner }), "Fee is unchanged");
    await assertRevert(auth.updateVerificationFee(0, { from: owner }), "Fee must be greater than zero");
    await assertRevert(
      auth.updateVerificationFee(web3.utils.toWei("1.1", "ether"), { from: owner }),
      "Fee exceeds safety cap"
    );
    await assertRevert(
      auth.updateVerificationFee(FEE, { from: customer }),
      "Caller is not the contract owner"
    );
  });

  it("lets only the owner withdraw collected fees", async () => {
    const { productId } = await registerSample("SN-CASH");
    await auth.verifyProduct(productId, { from: customer, value: FEE });
    assert.equal((await auth.getContractBalance()).toString(), FEE);

    await assertRevert(auth.withdraw(customer, FEE, { from: customer }), "Caller is not the contract owner");
    await assertRevert(auth.withdraw(owner, 0, { from: owner }), "Withdrawal amount must be greater than zero");
    await assertRevert(
      auth.withdraw("0x0000000000000000000000000000000000000000", FEE, { from: owner }),
      "Invalid recipient"
    );
    await assertRevert(
      auth.withdraw(owner, web3.utils.toWei("1", "ether"), { from: owner }),
      "Insufficient contract balance"
    );

    const tx = await auth.withdraw(owner, FEE, { from: owner });
    assert.ok(tx.logs.some((log) => log.event === "FeesWithdrawn"));
    assert.equal(tx.logs[0].args.to, owner);
    assert.equal(tx.logs[0].args.amount.toString(), FEE);
    assert.equal((await auth.getContractBalance()).toString(), "0");
  });

  it("blocks the owner contract from re-entering withdraw", async () => {
    const attacker = await ReentrancyAttacker.new(FEE);
    const owned = await ProductAuthentication.at(await attacker.auth());
    const serial = "SN-REENTER";
    await attacker.prepare("Cedar Soap", "BATCH-7", serial);
    const productId = productIdFromSerial(serial);

    await attacker.fundVerification(productId, { value: FEE });
    await attacker.fundVerification(productId, { value: FEE });
    const balanceBefore = (await owned.getContractBalance()).toString();

    await assertReverted(attacker.attack(FEE));
    assert.equal((await owned.getContractBalance()).toString(), balanceBefore);
    assert.equal((await attacker.calls()).toString(), "0");
  });

  it("rejects direct ETH transfers that skip verifyProduct", async () => {
    await assertReverted(web3.eth.sendTransaction({ from: customer, to: auth.address, value: FEE }));
    assert.equal((await auth.getContractBalance()).toString(), "0");
  });
});
