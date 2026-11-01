# Project requirements

## Overview

Provenance Seal is an Ethereum DApp for product registration, supply-chain custody, and QR verification. Manufacturers register products. Distributors and retailers record hand-offs. Customers read the record and may pay a test-ETH fee to log a verification. Ganache is the chain. MetaMask signs user transactions.

## Problem statement

Products move through several parties before a customer sees them. During that movement:

1. Counterfeit goods can enter the chain of custody.
2. Ordinary databases can be edited without a shared history.
3. Customers cannot independently read the recorded history.
4. Origin and custody can be hard to reconstruct.
5. A QR code can be copied and stuck on another item.

A blockchain record makes the written history tamper-evident. It does not inspect the physical object. A valid QR code does not by itself mean the item is genuine.

## Objectives

- Record product identity, batch, manufacturer, custodian, and status on an Ethereum-compatible contract.
- Let the contract owner authorize manufacturers, distributors, and retailers.
- Move custody one authorized step at a time and keep the history.
- Let a customer verify a product from a QR code and, separately, pay the configured fee.
- Flag repeated or geographically inconsistent scans without calling that proof of counterfeiting.
- Keep authorization in the contract, not only in the React app.

## Functional requirements

| ID | Requirement | Implementation |
| --- | --- | --- |
| FR-01 | Wallet connection, account and network changes, rejection, unsupported networks | `WalletContext` and the Wallet page |
| FR-02 | Manufacturer registration with serial, name, batch, manufacturer, time, custodian, status; no duplicates | `registerProduct` |
| FR-03 | Deterministic id from `keccak256` and unambiguous encoding | `generateProductId` uses `abi.encode` |
| FR-04 | Custodian and receiver checks, events, retained history | `transferCustody` |
| FR-05 | Existence, manufacturer, batch, custodian, registration, history, incomplete-history notes | Verify page and `RecordPanel` |
| FR-06 | QR generation, scan, lookup, result, invalid QR | `QrPanel`, `Scanner` |
| FR-07 | Registration, transfer, verification, and status history | Contract history plus events |
| FR-08 | Payable verification, configurable 0.001 ETH fee, exact payment, count, owner withdrawal | `verifyProduct`, `updateVerificationFee`, `withdraw` |
| FR-09 | Repeated scans, frequency, client-reported regions, without a counterfeit verdict | `backend/src/services/analytics.js` |
| FR-10 | The five required events, plus fee withdrawal, monitored by the API | Contract events and `eventMonitor.js` |

## Non-functional requirements

- Solidity 0.8.20, Ganache, Truffle, React, Node.js, and ethers.js stay in place.
- Local test ETH only. No mainnet deployment is required.
- Inputs are checked in the contract, the API, and the forms.
- The API must not present a read as a confirmed transaction.
- Documentation must match the commands that were run.

## Technical requirements

- Ethereum JSON-RPC at `http://127.0.0.1:8545`, chain id 1337.
- Truffle migrations deploy the contract and write `deployment.json`.
- The React app loads the ABI and address from the API, with static files as a fallback.
- REST endpoints live under `/api`.
- Scan storage is a local JSON file. The chain remains the authority for products and custody.

## Blockchain requirements

- One `ProductAuthentication` contract, inheriting `RoleRegistry`.
- Roles: none, manufacturer, distributor, retailer. The deployer is the owner.
- Product status moves from manufacturer to distributor to retailer.
- Events are the audit log. On-chain history entries mirror registration, transfer, and verification.
- `block.timestamp` is an audit clock only.

## Smart contract requirements

The contract demonstrates a constructor, state-changing functions, `require`, a payable function, view functions, a pure function, events, structs, mappings, modifiers, `msg.sender`, `msg.value`, `block.timestamp`, `keccak256`, `address payable`, a guarded ETH withdrawal, and custom errors.

Required functions:

- `registerProduct`
- `transferCustody`
- `verifyProduct`
- `getProduct`, `getHistory`, `productExists`
- `updateVerificationFee`, `getVerificationFee`
- `setParticipantRole`, `getParticipantRole`
- `withdraw`, `getContractBalance`
- `generateProductId`

## User roles

| Role | Can do |
| --- | --- |
| Owner | Deploy, set roles, set the fee, withdraw ETH, read events |
| Manufacturer | Register products and transfer them to an authorized distributor |
| Distributor | Transfer products they hold to an authorized retailer |
| Retailer | Receive products and read records. This version does not transfer further |
| Customer | Read records, scan QR codes, pay the verification fee |

A wallet has one participant role. The owner may also be a participant only if a role is assigned to the owner address.

## System workflows

1. Owner deploys the contract through Truffle.
2. Owner authorizes a manufacturer, a distributor, and a retailer.
3. Manufacturer registers a product. The app shows a QR code after the receipt succeeds.
4. Manufacturer transfers custody to the distributor.
5. Distributor transfers custody to the retailer.
6. Customer scans the QR code and reads the record.
7. Customer submits `verifyProduct` with the exact fee. The contract emits `ProductVerified`.
8. The API records scans and may mark the pattern suspicious.
9. Owner withdraws the collected fee.

Unauthorized registration, duplicate serials, skipped transfers, wrong payment amounts, and non-owner withdrawals are rejected.

## Security requirements

- Authorization is enforced in Solidity.
- Duplicate product ids are rejected.
- Payment must equal the current fee. The fee cannot be zero or above 1 ETH.
- Withdrawal checks the recipient, the amount, and the balance, then uses `call` inside a reentrancy guard.
- Historical transfers stay in storage and events.
- Serial numbers are hashed. Personal data does not belong in product fields.
- No private keys or mnemonics are stored in the repository.
- Scan client ids and remote addresses are hashed before they are written.
- The project must not claim a production audit.

## Assumptions

- One Ganache instance on port 8545 is the shared development chain.
- MetaMask is available in the user's browser. Automated runs in this workspace cannot click the extension.
- A company uses a separate wallet for each role.
- Region values are optional and are whatever the browser sends. They are not a GPS proof.
- MongoDB is unnecessary for a single local API process.
- The retailer is the final custodian.

## Unresolved questions

- Should a later version allow one wallet to hold more than one role?
- Should custody continue past the retailer to a specific customer wallet?
- When scan volume outgrows one JSON file, which MongoDB deployment should own that store?
- Who pays for a third-party audit if this leaves the classroom network?
