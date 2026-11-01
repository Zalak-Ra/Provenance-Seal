# Development guide

## Process

1. Inspect the repository before editing it.
2. Keep Solidity on 0.8.20 and the Ganache, Truffle, React, and Node.js stack.
3. Compile, migrate to a running Ganache, then start the API and the Vite app.
4. Run the Truffle, backend, frontend, and integration suites.
5. Update the docs when a command or a limit changes.

`npx truffle test` uses the `development` network in `truffle-config.js`. Start Ganache first. The test run executes migrations and rewrites `deployment.json`. Run `npm run migrate` again before returning to the UI.

## File responsibilities

| Path | Responsibility |
| --- | --- |
| `contracts/RoleRegistry.sol` | Owner and participant roles |
| `contracts/ProductAuthentication.sol` | Products, custody, fees, verification |
| `contracts/Migrations.sol` | Truffle migration marker |
| `contracts/test/ReentrancyAttacker.sol` | Test-only withdrawal attacker |
| `migrations/2_deploy_contracts.js` | Deploy with 0.001 ETH and write `deployment.json` |
| `test/product_authentication.test.js` | Contract unit tests |
| `scripts/sync-abi.js` | Publish ABI and deployment to the frontend |
| `scripts/integration-flow.mjs` | Ephemeral Ganache, contract flow, and API checks |
| `backend/src/blockchain/client.js` | Read-only ethers client |
| `backend/src/services/analytics.js` | Scan scoring |
| `backend/src/services/scanStore.js` | JSON persistence |
| `backend/src/services/eventMonitor.js` | Event polling |
| `frontend/src/context/WalletContext.jsx` | MetaMask |
| `frontend/src/services/contract.js` | ABI loading and contract objects |
| `frontend/src/pages/*` | Role dashboards and customer flows |

## Smart contract functions

| Function | Kind | Who |
| --- | --- | --- |
| constructor | once | Deployer becomes owner. Fee is the constructor argument |
| `generateProductId` | pure | Anyone. Hashes the serial |
| `setParticipantRole` | write | Owner |
| `registerProduct` | write | Manufacturer |
| `transferCustody` | write | Current custodian, one legal step |
| `verifyProduct` | payable | Any wallet, exact fee |
| `updateVerificationFee` | write | Owner |
| `withdraw` | write | Owner |
| `getProduct`, `getHistory` | view | Anyone, product must exist |
| `productExists`, `getVerificationFee`, `getContractBalance`, `getParticipantRole`, `getParticipants` | view | Anyone |

Action codes in history: 1 registered, 2 custody transferred, 3 verified.

Status codes: 0 none, 1 with manufacturer, 2 with distributor, 3 with retailer.

## Solidity concepts

Constructor. `RoleRegistry` stores `msg.sender` as `owner`. `ProductAuthentication` requires a positive fee at or below `MAX_VERIFICATION_FEE` and stores it. The deployment script passes `0.001 ether`.

Functions. Registration, transfer, verification, history, fees, roles, and withdrawal are listed above.

`require` is used where a failed check should roll the transaction back:

| Check | Why it is required |
| --- | --- |
| Initial fee is positive and capped | A free or unbounded fee would break the payment rule |
| Caller is the owner | Role changes, fee changes, and withdrawal move authority or ETH |
| Account is not the zero address | A zero role target or recipient is not a wallet |
| Role value is inside the enum | An out-of-range cast must not grant access |
| Role is actually changing | Avoid a no-op write |
| Serial length is 1 to 128 | An empty serial would be a shared id |
| Name and batch are non-empty and bounded | Keep storage bounded and reject blank products |
| Product is not already registered | The same serial must not create a second record |
| Caller is a manufacturer | Registration is not a public function |
| Product exists | Transfers, payment, and detail reads need a real id |
| Receiver is not zero and not the sender | Custody must move to a real, different wallet |
| Caller is the current custodian | Another wallet must not move the product |
| Manufacturer sends only to a distributor, and only from manufacturer status | Stops skipped or backward steps |
| Distributor sends only to a retailer, and only from distributor status | Same custody rule |
| Other roles cannot transfer | The retailer is the final custodian here |
| `msg.value` equals `verificationFee` | Underpayment and overpayment are not verifications |
| New fee is positive, capped, and different | Protects later payers and avoids a useless write |
| Withdrawal recipient, amount, and balance are valid | Prevents stuck or oversized withdrawals |
| Bare `receive` always fails | ETH must arrive through `verifyProduct` so it is counted |

Payable. `verifyProduct` is `payable`. The fee is not gas. Gas is paid by the transaction on top of `msg.value`.

View. `getProduct`, `productExists`, `getHistory`, `getVerificationFee`, `getContractBalance`, `getParticipantRole`, and `getParticipants` do not write.

Pure. `generateProductId` hashes `abi.encode(serialNumber)`. `abi.encode` keeps a length prefix so the id is an unambiguous commitment to that string. The raw serial is not stored.

Events. `ProductRegistered`, `CustodyTransferred`, `ProductVerified`, `VerificationFeeUpdated`, and `ParticipantRoleUpdated` are indexed for the product, the accounts, or the owner. `FeesWithdrawn` records withdrawals.

Other concepts. `Product` and `HistoryEntry` are structs. Products and history use mappings. Modifiers are `onlyOwner`, `onlyManufacturer`, `existingProduct`, and `nonReentrant`. `msg.sender` is the actor. `msg.value` is the verification payment. `block.timestamp` stamps history and is not used as randomness. `withdraw` takes `address payable`. The ETH send uses `call` and reverts with `EthTransferFailed` when the recipient rejects it. `ReentrancyBlocked` stops a recipient from calling `withdraw` again during the send.

## Backend modules

Configuration reads `.env` from the repository root. The blockchain client resolves the address from `CONTRACT_ADDRESS`, then `deployment.json`, then the artifact network map. Controllers validate ids and addresses before calling the client. `recordProductScan` checks `productExists` on the chain, hashes the client id and remote address, and stores the row. `assessScans` returns `none`, `watch`, or `suspicious` plus a disclaimer. The event monitor only logs.

## API endpoints

See the table in `docs/ARCHITECTURE.md`. Handlers return `paymentSubmitted: false` for reads and scans. A 201 from `POST /api/products/scan` means the analytics row was stored. It does not mean a blockchain transaction was sent.

## Frontend components

| Piece | Behavior |
| --- | --- |
| `Layout` | Navigation and wallet chip |
| `HomePage` | What the record can and cannot say |
| `WalletPage` | Connect, disconnect in the page, switch network |
| `AdminPage` | Roles, fee, balance, withdrawal |
| `ManufacturerPage` | Role hint and that wallet's registrations |
| `RegisterForm` | Validation, then `registerProduct`, then QR after receipt |
| `DistributorPage` and `TransferPage` | `transferCustody` |
| `RetailerPage` | Lookup and whether this wallet is the custodian |
| `VerifyPage` | Free read, then optional paid verification |
| `ScanPage` | Camera, file, paste, and scan analytics |
| `HistoryPage` | Timeline from the contract |
| `ActivityPage` | Receipts saved in this browser, plus API events |
| `RecordPanel` | Product fields, incomplete-history notes, disclaimer |
| `TxStatus` | Signing, confirming, confirmed, or failed |

## Wallet integration

`window.ethereum` is required. `eth_requestAccounts` connects. `accountsChanged` and `chainChanged` refresh state. Error code 4001 is shown as a rejected request. `sendContract` throws if the chain id is not 1337, before it builds the transaction. Cleanup uses optional `removeListener` so a disappearing provider does not crash the page.

The product id helper in `frontend/src/utils/format.js` uses the same ABI encoding as `generateProductId`.

## Event monitoring

`startEventMonitor` calls `getEvents(0)` on an interval. The Activity page and the manufacturer dashboard call `GET /api/events`. Confirmed browser transactions are also stored in `localStorage` under `provenance.transactions` after receipt status 1.

## QR verification

`qrcode` draws a PNG of the verification URL. `html5-qrcode` reads the camera or an uploaded image. `parseQrPayload` accepts only a 32-byte hex id. A code without that id is rejected in the page. The lookup then calls the contract. An unknown id renders "No on-chain record" and does not claim the item is counterfeit.

## Testing workflow

Contract tests cover deployment, the constructor, owner control, roles, registration, duplicates, bad input, the product id, transfers, unauthorized transfers, exact and incorrect payment, the verification count, events, fee changes, withdrawal, a reentrancy attempt, and bare ETH.

On Node 24, Web3 sometimes reports a custom-error revert or a bare `eth_sendTransaction` revert without the Solidity string. Those two tests assert that the transaction reverted and that the protected state did not change. The other tests still match the `require` string.

Backend tests use a fake chain client plus the real Express app. They cover health, a down RPC, config, product reads, history, bad ids, events, participants, scan flags, unknown products, and a 502 from the chain. Analytics tests cover a single scan, a repeated client, mixed regions, and old scans.

Frontend tests use Vitest and Testing Library. They cover network labels, rejected signatures, product ids, registration validation, invalid transfer receivers, missing and incomplete records, failed transaction status, camera and bad QR handling, account changes, and a send blocked on chain id 1.

`npm run test:integration` starts Ganache on port 8546. It is a real chain, not a mock. It deploys, authorizes, registers, rejects a duplicate, rejects a bad transfer, moves custody, pays 0.001 ETH, checks `ProductVerified`, withdraws, reads the API, and flags three scans.

## Deployment process

```powershell
npm run ganache
npm run compile
npm run migrate
npm run backend
npm run frontend
```

Use separate terminals. `migrate` resets and redeploys on the development network. The owner is Ganache account 0. Copy the address from `deployment.json` if you need it outside the app. The API and the UI read that file. Do not commit `.env`. `deployment.json` is gitignored because it changes every reset.
