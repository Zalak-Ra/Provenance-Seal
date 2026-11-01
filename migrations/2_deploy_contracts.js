const fs = require("fs");
const path = require("path");
const ProductAuthentication = artifacts.require("ProductAuthentication");

/**
 * Deploys ProductAuthentication with a 0.001 ETH verification fee.
 * The fee is a contract payment, separate from gas.
 */
module.exports = async function (deployer) {
  const initialFee = web3.utils.toWei("0.001", "ether");
  await deployer.deploy(ProductAuthentication, initialFee);
  const instance = await ProductAuthentication.deployed();

  const deployment = {
    address: instance.address,
    networkId: String(await web3.eth.net.getId()),
    chainId: String(await web3.eth.getChainId()),
    verificationFeeWei: initialFee,
    updatedAt: new Date().toISOString()
  };

  const destination = path.join(__dirname, "..", "deployment.json");
  fs.writeFileSync(destination, JSON.stringify(deployment, null, 2));
  console.log("ProductAuthentication deployed at", instance.address);
};
