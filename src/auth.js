const {
    core,
    CircuitId,
    AuthHandler,
    PROTOCOL_CONSTANTS,
    CredentialStatusType
} = require('@0xpolygonid/js-sdk');

const {
    initInMemoryDataStorageAndWallets,
    initCircuitStorage,
    initProofService,
    initPackageManager
} = require('./walletSetup');

const path = require('path');

// Amoy Network Settings
const RPC_URL = "https://rpc-amoy.polygon.technology";
const CONTRACT_ADDRESS = "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124";
const CHAIN_ID = 80002;
const RHS_URL = "https://rhs-staging.polygonid.me";
const CIRCUITS_PATH = path.join(__dirname, '../circuits');

async function main() {
    try {
        // 1. Initialize Polygon ID SDK Storage and Wallets
        console.log("1. Initializing Polygon ID SDK...");
        const config = { rpcUrl: RPC_URL, contractAddress: CONTRACT_ADDRESS, chainId: CHAIN_ID };
        const { dataStorage, credentialWallet, identityWallet } = await initInMemoryDataStorageAndWallets(config);

        // Initialize required services for ZKP Authentication
        console.log("-> Initializing Circuit Storage and Proof Service...");
        const circuitStorage = initCircuitStorage(CIRCUITS_PATH);
        const proofService = initProofService(
            identityWallet,
            credentialWallet,
            dataStorage.states,
            circuitStorage
        );

        // 2. Create an Identity for a wallet
        console.log("\n2. Creating Identity...");
        const defaultIdentityCreationOptions = {
            method: core.DidMethod.PolygonId,
            blockchain: core.Blockchain.Polygon,
            networkId: core.NetworkId.Amoy,
            revocationOpts: {
                type: CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
                id: RHS_URL
            }
        };

        // User Identity
        const { did, credential } = await identityWallet.createIdentity({ ...defaultIdentityCreationOptions });

        // 3. Retrieve the Identifier (DID) from the created Identity
        console.log("\n3. Retrieving Identifier (DID)...");
        const identifier = did.string();
        console.log("-> User Identity DID:", identifier);

        // Issuer Identity (to request authentication)
        console.log("-> Creating Issuer Identity...");
        const { did: issuerDID } = await identityWallet.createIdentity({ ...defaultIdentityCreationOptions });
        console.log("-> Issuer Identity DID:", issuerDID.string());

        // 4. Obtain an iden3Message from an Issuer (mock or static message acceptable)
        console.log("\n4. Obtaining an iden3Message from an Issuer...");
        const messageId = 'fe6354fe-3db2-48c2-a779-e39c2dda8d90';

        const authRequest = {
            id: messageId,
            thid: messageId,
            typ: PROTOCOL_CONSTANTS.MediaType.PlainMessage,
            from: issuerDID.string(),
            type: PROTOCOL_CONSTANTS.PROTOCOL_MESSAGE_TYPE.AUTHORIZATION_REQUEST_MESSAGE_TYPE,
            body: {
                callbackUrl: 'http://localhost:8080/callback',
                message: 'Authenticate to access the portal',
                reason: 'Basic authentication request'
            }
        };

        // Encode the iden3Message
        const authRawRequest = new TextEncoder().encode(JSON.stringify(authRequest));
        console.log("-> Created iden3Message (Authorization Request)");

        // 5. Authenticate the Identity using: Identifier, iden3Message, Private Key
        console.log("\n5. Authenticating Identity...");

        let authV2Data;
        try {
            authV2Data = await circuitStorage.loadCircuitData(CircuitId.AuthV2);
            console.log("-> AuthV2 Circuit Data loaded correctly.");
        } catch (err) {
            console.error("-> Failed to load AuthV2 circuit data. Make sure circuits are downloaded into the /circuits folder.");
            throw err;
        }

        // Initialize package manager
        const packageManager = await initPackageManager(
            authV2Data,
            proofService.generateAuthV2Inputs.bind(proofService),
            proofService.verifyState.bind(proofService)
        );

        const authHandler = new AuthHandler(packageManager, proofService);

        console.log("-> Generating ZKP Authorization Response message by authenticating against the request...");
        const authHandlerResponse = await authHandler.handleAuthorizationRequest(did, authRawRequest);
        console.log("\n-> Authentication Response fully generated!");
        console.log("-> Generated Token Length:", JSON.stringify(authHandlerResponse).length, "bytes");

        // 6. Remove the Identity (optional/if required)
        console.log("\n6. Removing Identity (Conceptual)...");
        console.log("-> Identity removal generally involves deleting keys from the KeyStore (KMS)");
        console.log("   and clearing associated data from the data storage layers.");
        console.log("-> Done implicitly here as the process will exit and wipe InMemory storages.\n");

        console.log("=== Authentication Flow Completed Successfully ===");

    } catch (error) {
        console.error("Error in authentication flow:", error);
        process.exit(1);
    }
}

main();
