import fs from "fs/promises";
import path from "path";
import { config } from "../config/index.js";

let cache = null;
let dataFileOverride = null;
let writeChain = Promise.resolve();

function dataFile() {
  return dataFileOverride || config.dataFile;
}

export function setScanDataFile(filePath) {
  dataFileOverride = filePath;
  cache = null;
  writeChain = Promise.resolve();
}

export async function readScans() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    cache = JSON.parse(raw);
    if (!Array.isArray(cache.scans)) cache = { scans: [] };
  } catch {
    cache = { scans: [] };
  }
  return cache;
}

export async function addScan(entry) {
  writeChain = writeChain.then(async () => {
    const data = await readScans();
    data.scans.push(entry);
    if (data.scans.length > 5000) {
      data.scans = data.scans.slice(-5000);
    }
    await fs.mkdir(path.dirname(dataFile()), { recursive: true });
    await fs.writeFile(dataFile(), JSON.stringify(data, null, 2));
    cache = data;
  });
  await writeChain;
}

export async function scansForProduct(productId) {
  const data = await readScans();
  const key = productId.toLowerCase();
  return data.scans.filter((scan) => scan.productId === key);
}
