const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const artifactPath = path.join(root, "build", "contracts", "ProductAuthentication.json");

if (!fs.existsSync(artifactPath)) {
  console.error("Missing Truffle artifact. Run: npx truffle compile");
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const abiFile = { contractName: artifact.contractName, abi: artifact.abi };
const abiDir = path.join(root, "frontend", "public", "abi");
fs.mkdirSync(abiDir, { recursive: true });
fs.writeFileSync(path.join(abiDir, "ProductAuthentication.json"), JSON.stringify(abiFile, null, 2));

const deploymentPath = path.join(root, "deployment.json");
if (fs.existsSync(deploymentPath)) {
  const deployment = fs.readFileSync(deploymentPath);
  fs.writeFileSync(path.join(root, "frontend", "public", "deployment.json"), deployment);
  console.log("Synced ABI and deployment.json");
} else {
  console.log("Synced ABI. deployment.json is not present yet. Migrate against Ganache to create it.");
}
