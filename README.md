# Polygon ID Basic Identity Authentication Flow

This repository contains a working implementation of a basic identity authentication flow using the **Polygon ID JS SDK** (`@0xpolygonid/js-sdk`).

## Objective
The objective of this project is to implement a robust zero-knowledge identity authentication flow, demonstrating how an identity can be created, requested for authentication, and how the identity handles that request by generating an `Authorization Response Message` leveraging the AuthV2 zero-knowledge circuit.

## Features Completed
1. **Initialize Polygon ID SDK:** InMemory Wallets, Storages, and Proof Services are initialized (`src/walletSetup.js`).
2. **Create Identity:** A new standard Polygon ID identity is generated with cryptographic keys (`identityWallet.createIdentity`).
3. **Retrieve Identifier (DID):** Accesses and reports the genesis DID of the created identity.
4. **Obtain iden3Message:** A mock Authorization Request message (`AUTHORIZATION_REQUEST_MESSAGE_TYPE`) is generated from a mock 'Issuer' identity.
5. **Authenticate Identity:** The `AuthHandler` and `PackageManager` are used to generate a valid `AuthorizationResponseMessage` with the user's private key and AuthV2 ZK Circuits.
6. **Remove Identity:** Handled structurally by the in-memory clearing lifecycle.

## Requirements
- **Node.js**: v18 or newer recommended.
- **Memory**: The AuthV2 circuit proving process is memory intensive and can take considerable RAM/CPU.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Download Required ZKP Circuits**
   The zero-knowledge proving requires the actual Polygon ID cryptographic circuits (AuthV2). To download and extract them, run:
   ```bash
   curl -LO https://circuits.privado.id/latest.zip
   unzip latest.zip -d circuits
   rm latest.zip
   ```
   *(Note: The provided implementation expects the extracted circuits to reside in `./circuits/` such that `./circuits/authV2/` exists).*

3. **Run the Demonstration**
   Execute the authentication flow:
   ```bash
   npm start
   ```

## Explanation of Authentication Flow

In the Polygon ID ecosystem, "Authentication" does not mean passing a plain password or even just a standard digital signature. It leverages **Zero-Knowledge Proofs (ZKPs)** through the `AuthV2` circuit.

1. **Issuer Requests Authentication:** An authorization request message (structured as a standard `iden3Message`) is constructed by a verifier or an issuer. It includes a `callbackUrl` and a challenge `message`.
2. **User Handles Request:** The User's `IdentityWallet` receives the `authRequest`.
3. **ZKP Generation:** Using the associated private keys (managed by the `KMS`), the `ProofService` binds the inputs to the `AuthV2` zero-knowledge circuit.
4. **Proof & Response:** The `AuthHandler` produces an `Authorization Response Message` containing a cryptographic ZKP payload that proves ownership of the credential and genesis states without revealing the bare private key on the broader network explicitly.

## Security Considerations

1. **Storage Mechanisms:** This implementation utilizes `InMemoryDataSource` and `InMemoryPrivateKeyStore`. In a production application, keys MUST be stored in secure modules like AWS KMS, hardware wallets, or secure enclaves. Identifiers and state Merkle trees should be stored in persistent databases (like MongoDB) and periodically backed up to maintain cryptographic states.
2. **RHS & Onchain Fallbacks:** The provided configuration routes Revocations via `RHS_URL`. For absolute security against single data availability failures, an implementation should rely fully on-chain or employ redundant reverse-hash-services.
3. **Replay Attacks:** The `thid` (thread id) and messages in real flows should be checked to prevent replay attacks. A verifier receiving the Auth ZKP response must validate that the proof timestamp and thread IDs correspond to a relatively recent, known request.

## Project Structure
- `src/walletSetup.js` - Contains SDK configuration functions, registering resolvers, instantiating Proof Services and ZKP package managers.
- `src/auth.js` - Contains the main sequential steps that orchestrate the authentication assignment.
