const {
    BjjProvider,
    CredentialStorage,
    IdentityStorage,
    IdentityWallet,
    InMemoryDataSource,
    InMemoryMerkleTreeStorage,
    InMemoryPrivateKeyStore,
    KMS,
    KmsKeyType,
    EthStateStorage,
    defaultEthConnectionConfig,
    CredentialWallet,
    CredentialStatusPublisherRegistry,
    Iden3SmtRhsCredentialStatusPublisher,
    CredentialStatusType,
    FSCircuitStorage,
    ProofService,
    PackageManager,
    ZKPPacker,
    PlainPacker,
    DataPrepareHandlerFunc,
    VerificationHandlerFunc,
    CredentialStatusResolverRegistry,
    IssuerResolver,
    RHSResolver,
    OnChainResolver,
    AgentResolver
} = require('@0xpolygonid/js-sdk');

const { proving } = require('@iden3/js-jwz');

function initInMemoryDataStorage(config) {
    const conf = {
        ...defaultEthConnectionConfig,
        contractAddress: config.contractAddress,
        url: config.rpcUrl,
        chainId: config.chainId
    };

    const dataStorage = {
        credential: new CredentialStorage(new InMemoryDataSource()),
        identity: new IdentityStorage(
            new InMemoryDataSource(),
            new InMemoryDataSource()
        ),
        mt: new InMemoryMerkleTreeStorage(40),
        states: new EthStateStorage(conf)
    };

    return dataStorage;
}

function initCredentialWallet(dataStorage, config) {
    const conf = {
        ...defaultEthConnectionConfig,
        contractAddress: config.contractAddress,
        url: config.rpcUrl,
        chainId: config.chainId
    };

    const resolvers = new CredentialStatusResolverRegistry();
    resolvers.register(CredentialStatusType.SparseMerkleTreeProof, new IssuerResolver());
    resolvers.register(
        CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
        new RHSResolver(dataStorage.states)
    );
    resolvers.register(
        CredentialStatusType.Iden3OnchainSparseMerkleTreeProof2023,
        new OnChainResolver([conf])
    );
    resolvers.register(CredentialStatusType.Iden3commRevocationStatusV1, new AgentResolver());

    return new CredentialWallet(dataStorage, resolvers);
}

async function initInMemoryDataStorageAndWallets(config) {
    const dataStorage = initInMemoryDataStorage(config);
    const credentialWallet = initCredentialWallet(dataStorage, config);

    const memoryKeyStore = new InMemoryPrivateKeyStore();
    const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);

    const kms = new KMS();
    kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);

    const credentialStatusPublisherRegistry = new CredentialStatusPublisherRegistry();
    credentialStatusPublisherRegistry.register(
        CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
        new Iden3SmtRhsCredentialStatusPublisher()
    );

    const identityWallet = new IdentityWallet(kms, dataStorage, credentialWallet, {
        credentialStatusPublisherRegistry
    });

    return {
        dataStorage,
        credentialWallet,
        identityWallet,
        kms
    };
}

function initCircuitStorage(circuitsFolder) {
    return new FSCircuitStorage({
        dirname: circuitsFolder
    });
}

function initProofService(
    identityWallet,
    credentialWallet,
    stateStorage,
    circuitStorage
) {
    return new ProofService(identityWallet, credentialWallet, circuitStorage, stateStorage, {
        ipfsGatewayURL: 'https://ipfs.io'
    });
}

function initPackageManager(
    circuitData,
    prepareFn,
    stateVerificationFn
) {
    const authInputsHandler = new DataPrepareHandlerFunc(prepareFn);
    const verificationFn = new VerificationHandlerFunc(stateVerificationFn);
    const mapKey = proving.provingMethodGroth16AuthV2Instance.methodAlg.toString();

    const verificationParamMap = new Map([
        [
            mapKey,
            {
                key: circuitData.verificationKey,
                verificationFn
            }
        ]
    ]);

    const provingParamMap = new Map();
    provingParamMap.set(mapKey, {
        dataPreparer: authInputsHandler,
        provingKey: circuitData.provingKey,
        wasm: circuitData.wasm
    });

    const mgr = new PackageManager();
    const packer = new ZKPPacker(provingParamMap, verificationParamMap);
    const plainPacker = new PlainPacker();
    mgr.registerPackers([packer, plainPacker]);

    return mgr;
}

module.exports = {
    initInMemoryDataStorageAndWallets,
    initInMemoryDataStorage,
    initCircuitStorage,
    initProofService,
    initPackageManager,
    initCredentialWallet
};
