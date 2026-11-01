# Implementation report

Verified on 31 October 2026 on Windows, Node.js v24.19.0, npm 11.17.0. Ganache, the API, and the Vite app were left running after these checks.

## Implemented

- `RoleRegistry` and `ProductAuthentication` in Solidity 0.8.20, with the constructor, functions, `require`, payable verification, view reads, pure id generation, events, structs, mappings, modifiers, and a guarded withdrawal.
- Truffle migrations that deploy a 0.001 ETH fee and write `deployment.json`.
- React pages for home, wallet, admin, manufacturer, distributor, retailer, registration, transfer, verification, QR scan, history, and activity.
- MetaMask connection, account and chain listeners, rejection handling, and a pre-send network check.
- QR generation after a confirmed registration, plus camera, file, and paste lookup.
- Express API for health, config, products, history, read-only verify, scans, events, and participants.
- Off-chain scan scoring with hashed client ids. Suspicious results include a disclaimer.
- Event polling in the API process.
- Automated contract, API, frontend, and Ganache integration tests.

## Partially implemented

- MetaMask signing is implemented and covered with a simulated provider. This session did not click a real MetaMask extension. The browser automation server was unavailable, so the pages were not exercised by pointer in a browser. The Vite homepage returned HTTP 200, and the dev server proxy returned the live product.
- Geographic signals exist only when the client sends a region string. The browser does not collect GPS.
- One address can hold one role. Combined manufacturer-distributor wallets are not supported.

## Not in this version

- MongoDB. Scans use `backend/data/scans.json`. The chain stays authoritative.
- Mainnet or public testnet deployment.
- A third-party audit.
- Custody transfers after the retailer.
- A pause switch or a multisig owner.

## Compilation

`npm run compile` succeeded.

```text
Compiled successfully using:
   - solc: 0.8.20+commit.a1b79de6.Emscripten.clang
```

## Deployment

Ganache 7.9.2 was started with `npm run ganache` on `127.0.0.1:8545`, chain id 1337. Node 24 printed a missing `uws_win32_x64_137.node` warning. Ganache continued with its JavaScript server and reported `RPC Listening on 127.0.0.1:8545`.

`npm run migrate` succeeded on network `development`.

| Item | Observed value |
| --- | --- |
| Migrations contract | `0x126CF548F9110Ed46FA3021E8AEAaC2Ba4538896` |
| ProductAuthentication | `0x457f0f599CC62A41B221cC94bC9d5Cf0012D21A8` |
| Deploy transaction | `0x984975b873fa7d57779b5e312e3136b8d11af85230bfb5624d362781b5c681ef` |
| Owner | Ganache account 0, `0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1` |
| Fee | 1000000000000000 wei (0.001 ETH) |
| Block gas limit | 30000000 |

Restarting Ganache clears this deployment. Run `npm run migrate` again afterward.

## Live contract workflow

A script signed with the local Ganache development accounts, using explicit nonces, against the deployed address above. Receipts were checked for status 1.

| Step | Result |
| --- | --- |
| Authorize distributor and retailer | Confirmed |
| Register `Cedar Soap`, batch `BATCH-7`, serial `SN-LIVE-1001` | Confirmed |
| Duplicate registration | Rejected with `Product already registered` |
| Transfer to distributor, then retailer | Confirmed. Status 3, custodian `0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d` |
| Transfer from an unauthorized wallet | Rejected with `Caller is not the current custodian` |
| Verify with 1 wei | Rejected with `Incorrect verification fee` |
| Verify with 0.001 ETH | Confirmed. `ProductVerified` in the receipt block. Count 1 |
| Verification transaction | `0x271cddc6714f679a566ff9961b6edd27d50d102ebcdba40a74712699b60757fc` |
| Owner withdrawal | Confirmed. Contract balance returned to 0 |
| Withdrawal transaction | `0xb406b42f8220657ddeaa9e02b8821e9f79182433e2229435eee61dc54306faae` |
| History length | 4: registered, two transfers, verified |

Product id: `0xdfecd5cb3b723dd1c728c216daa81d10f8858299d8c2e620913df0c35fa6be63`.

`GET /api/products/{id}` returned `Cedar Soap`, `With retailer`, verification count 1. Three `POST /api/products/scan` calls ended at level `suspicious` with `paymentSubmitted: false`. The Vite proxy at `http://127.0.0.1:5173/api/products/{id}` returned the same product and that scan level. `GET /api/health` reported chain id 1337 and the deployed address.

## Automated tests

| Suite | Command | Result |
| --- | --- | --- |
| Contracts | `npx truffle test` | 16 passing |
| Backend | `npm test` in `backend` | 14 passing |
| Frontend | `npm test` in `frontend` | 12 passing |
| Integration | `npm run test:integration` | 15 checks passed on Ganache port 8546 |
| Production bundle | `npm run build` in `frontend` | Built. Vite warned that the main chunk is larger than 500 kB |

The integration flow deployed its own contract, so those transactions are not the ones in the table above. Both runs used Ganache rather than a mocked ledger.

## Frontend integration

Pages, forms, wallet listeners, QR failure handling, and transaction failure text are covered by Vitest. The dev server serves the app and proxies contract reads. A human still needs MetaMask to submit a new transaction from the browser. That click-through was not performed here.

## Backend integration

The API process is connected to Ganache. It served the deployed product, history, config ABI (31 entries), and scan scores. It does not send transactions.

## Security review

This is an engineering review of the code that was run, not a production audit.

| Topic | Finding |
| --- | --- |
| Unauthorized registration and transfer | Rejected by modifiers and custodian checks. Covered by tests |
| Duplicate ids | Rejected. Covered on the deployed contract |
| Payment | Exact `msg.value` required. Overpayment is rejected rather than accepted |
| Withdrawal | Balance, recipient, and amount are checked. `nonReentrant` plus `call`. The attacker contract's withdrawal reverted and the balance stayed |
| Bare ETH | `receive` reverts. The transaction status was 0 and the balance stayed 0. Web3 did not echo the reason string |
| Reentrancy | State stays unchanged when the recipient reenters. No external call except the withdrawal |
| Timestamp | Used as an audit clock only |
| Privacy | Serial is hashed. Scan client ids and addresses are hashed. No keys in source |
| Fee changes | Capped at 1 ETH. Collected balance is not redirected by a fee change |
| QR and scans | Copying a code is still possible. Region strings are client-supplied and the scorer says they can be spoofed |
| Dependencies | Truffle pulls in old transitive packages. `npm audit fix --force` was not run, because it would break the pinned stack |
| Node 24 | Ganache's native µWS binary for ABI 137 is absent. The JavaScript server worked |

## Known limitations

- `truffle test` migrates onto the Ganache used by the UI and can replace `deployment.json`. Migrate again after tests.
- Ethers nonce reads lagged Ganache during a burst of sequential transactions from account 0. The live script passed an explicit pending nonce. MetaMask manages nonces for browser users.
- History arrays grow with every verification. A heavily verified product costs more gas to read and append.
- The retailer cannot transfer custody onward.
- Scan analytics are local to one API process and one JSON file.
- The contract has not been independently audited and must stay on local test ETH.
