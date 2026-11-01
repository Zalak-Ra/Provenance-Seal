# Provenance Seal

Ethereum records for product registration, custody transfer, and paid verification. A customer can scan a QR code and read the history that authorized wallets wrote. A matching record shows that the history was not edited after the fact. It does not prove that the physical item is genuine, because a QR code can be copied onto another object.

## Problem

Products pass through manufacturers, distributors, and retailers. A shared spreadsheet can be edited, and a customer cannot tell who held an item. This project puts registration, custody changes, and paid verification checks on a local Ethereum chain so those entries are shared and tamper-evident.

## Features

- Wallet connection with MetaMask, including account changes, network changes, rejected requests, and a block on the wrong network.
- Owner-managed manufacturer, distributor, and retailer roles.
- Product registration with a deterministic `keccak256` identifier. The raw serial is not stored.
- Custody transfer from manufacturer to distributor, then distributor to retailer.
- QR codes that open a verification link.
- Camera scan, image upload, and pasted identifiers.
- A payable `verifyProduct` function. The initial fee is 0.001 test ETH, separate from gas.
- Owner fee updates and withdrawal.
- REST API for products, history, events, participants, and scan analytics.
- Repeated scans can be flagged. A flag is a lead, not proof of counterfeiting.

## Technology

| Piece | Choice |
| --- | --- |
| Chain | Ethereum-compatible Ganache, chain id 1337 |
| Contracts | Solidity 0.8.20, Truffle 5.11.5 |
| Wallet | MetaMask |
| Frontend | React 18, Vite |
| Chain library | ethers.js v6 |
| API | Node.js, Express |
| Scans | JSON file under `backend/data/` |
| Database | None. MongoDB is optional and not used. |

## Prerequisites

- Node.js 20 or newer. This repository was verified on Node.js 24.19.0. Ganache prints a µWS binary warning on Node 24 and continues with its JavaScript server.
- npm.
- A Chromium browser with the MetaMask extension for the wallet steps.
- Git, if you want version control.

Windows CMD and PowerShell use the same `npm` commands below. Where a shell variable differs, both forms are shown. On Linux and macOS the `npm` commands are unchanged; use `export NAME=value` instead of the Windows variable syntax.

## Install the tools

Install Node.js from [https://nodejs.org](https://nodejs.org). Confirm it:

```powershell
node -v
npm -v
```

CMD uses the same two commands.

## Folder structure

```text
fake-product-blockchain/
  contracts/          ProductAuthentication.sol, RoleRegistry.sol
  migrations/         Truffle deployment
  test/               Truffle contract tests
  backend/src/        Express API, chain reads, scan analytics
  frontend/src/       React dashboards
  scripts/            ABI sync and the Ganache integration flow
  docs/               Requirements, architecture, development guide, report
  truffle-config.js
  .env.example
```

## Environment variables

```powershell
copy .env.example .env
```

CMD:

```cmd
copy .env.example .env
```

Leave secrets out of this file. Do not put a private key or a recovery phrase in it. The API reads the contract address from `deployment.json` after migration when `CONTRACT_ADDRESS` is empty.

| Variable | Purpose |
| --- | --- |
| `GANACHE_RPC_URL` | Default `http://127.0.0.1:8545` |
| `CHAIN_ID` | Default `1337` |
| `CONTRACT_ADDRESS` | Optional override of `deployment.json` |
| `PORT` | API port, default `4000` |
| `CORS_ORIGIN` | Default `http://localhost:5173` |
| `SCAN_WINDOW_MS` | Short window for repeated scans |
| `SCAN_DAY_MS` | Window for reported regions |
| `SUSPICIOUS_RECENT_SCANS` | Default `3` |
| `SUSPICIOUS_DISTINCT_CLIENTS` | Default `3` |

The frontend uses the API at `/api`. Optional Vite fallbacks, only if the API is down, are `VITE_EXPECTED_CHAIN_ID` and `VITE_RPC_URL` in `frontend/.env`.

## Install dependencies

From the project root:

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
```

The same three commands work in CMD. Truffle and Ganache print deprecation warnings. Do not run `npm audit fix --force`; it would replace the pinned toolchain.

## Ganache

In one terminal:

```powershell
npm run ganache
```

Ganache listens on `http://127.0.0.1:8545`, chain id 1337. It prints ten accounts with 1000 test ETH and a development mnemonic. Those keys are public development keys. Import one into MetaMask only for this local network. Never send real ETH to them, and never paste them into source files.

On Node 24 you will see `Cannot find module '../binaries/uws_win32_x64_137.node'`. Ganache then says it is falling back to a Node.js implementation. The RPC server still starts.

## MetaMask

1. Install MetaMask in the browser.
2. Add a network:
   - Name: `Ganache Local`
   - RPC: `http://127.0.0.1:8545`
   - Chain id: `1337`
   - Currency symbol: `ETH`
3. Import the first Ganache account if you want the contract owner. The app can also add this network when you choose **Switch to Ganache**.
4. Import a later account for the manufacturer, distributor, retailer, or customer. Use a different account for each role. One address has one role.

## Truffle

`truffle-config.js` points the `development` network at `127.0.0.1:8545`, network id `1337`, Solidity `0.8.20`.

## Compile

```powershell
npm run compile
```

This writes build artifacts and copies the ABI to `frontend/public/abi/`.

## Deploy

Ganache must already be running.

```powershell
npm run migrate
```

Migration deploys `ProductAuthentication` with a verification fee of 0.001 ETH. It writes `deployment.json` and copies that file plus the ABI into `frontend/public/`. The deploying account is the contract owner.

`npx truffle test` also uses this Ganache and runs migrations, which replaces `deployment.json`. After a test run, execute `npm run migrate` again before using the UI.

## Backend

In a second terminal:

```powershell
npm run backend
```

The API listens on `http://127.0.0.1:4000`. Check it:

```powershell
curl http://127.0.0.1:4000/api/health
```

CMD can use the same `curl` if curl.exe is available. PowerShell can also use `Invoke-RestMethod http://127.0.0.1:4000/api/health`.

## Frontend

In a third terminal:

```powershell
npm run frontend
```

Open `http://127.0.0.1:5173/`.

## Connect a wallet

Open **Wallet** and choose **Connect wallet**. Approve the request in MetaMask. The header shows the account, the role, the test balance, and either `Ganache Local (1337)` or `Unsupported network`. Rejecting the prompt leaves the wallet disconnected. Transactions are refused until the network is Ganache.

## Register a product

1. As the owner, open **Admin** and set another account's role to Manufacturer.
2. Switch MetaMask to that manufacturer account.
3. Open **Register**. Enter a name, batch, and serial.
4. Confirm the transaction. The QR code appears only after Ganache returns a successful receipt.

The serial is hashed in the contract. Do not put a person's name or contact details in the form.

## Transfer custody

1. Authorize a distributor and a retailer from **Admin**.
2. As the manufacturer, open **Transfer**. Pass the serial or product id and the distributor address.
3. Switch to the distributor account and transfer that product to the retailer address.

The contract rejects a stranger, a skipped step, the zero address, and a transfer from the retailer. The retailer is the last custodian in this version.

## QR verification

Open **Verify** or **Scan QR**. You can paste the serial, the `0x` product id, or the verification link. You can also start the camera or upload a QR image. The page reads the Ganache record. Looking it up does not pay the verification fee.

## ETH payment

On **Verify**, **Verify and pay test ETH** sends `verifyProduct` with the configured fee. MetaMask also shows a separate gas fee. A short payment or an overpayment is rejected and does not increase the verification count. The owner withdraws collected fees from **Admin**.

## Testing

Start Ganache first for the contract tests.

```powershell
npm test
npm run test:backend
npm run test:frontend
npm run test:integration
```

`npm test` is the Truffle suite against Ganache. `test:integration` starts its own Ganache on port 8546, deploys a fresh contract, runs the custody and payment flow, and calls the API. It does not replace the app on port 8545.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `Couldn't connect to node http://127.0.0.1:8545` | Start `npm run ganache` and leave that terminal open. |
| µWS binary warning | Expected on Node 24. Continue if the RPC line says it is listening. |
| API status `degraded` or contract address empty | Run `npm run migrate`. |
| UI says the ABI was not found | Run `npm run compile` or `npm run migrate`. |
| MetaMask is on the wrong network | Use **Switch to Ganache**. The app will not send the transaction. |
| Nonce errors after many tests | Restart Ganache, then `npm run migrate` again. |
| Camera will not start | Upload the QR image or paste the verification link. |

## Security

- The contract enforces roles, payment, and custody. The buttons do not.
- No private key belongs in the frontend, the API, or git. `.env` is ignored.
- Verification fees use `call` plus a reentrancy guard. Direct ETH transfers are rejected.
- Scan analytics store hashes, not raw client ids.
- This contract has not had a third-party production audit. Use Ganache test ETH only.

## Further reading

- [docs/PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)
- [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md)

## Future improvements

- A second on-chain role for one company that both manufactures and distributes.
- Custody after the retailer, if a later release needs it.
- MongoDB for scan analytics when more than one API process is required.
- A published audit before any network other than local Ganache.
