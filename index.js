require('dotenv').config();
const { createSmartAccountClient } = require("permissionless");
const { toSafeSmartAccount } = require("permissionless/accounts");
const { createPimlicoClient } = require("permissionless/clients/pimlico");
const { createPublicClient, http, parseEther } = require("viem");
const { base } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");

// --- CONFIGURATION ---
const PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const RPC_URL = "https://mainnet.base.org"; 
const PAYMASTER_URL = process.env.COINBASE_PAYMASTER_URL;

// EntryPoint v0.7 (Current Standard)
const ENTRYPOINT_ADDRESS_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  if (!PRIVATE_KEY || !PAYMASTER_URL) throw new Error("Check .env file!");

  console.log("--------------------------------------------------");
  console.log("🚀 Starting Gasless Script (SAFE Mode with EntryPoint v0.7)...");

  // 1. Setup Public Client
  const publicClient = createPublicClient({
    transport: http(RPC_URL),
    chain: base,
  });

  // 2. Setup Signer
  const signer = privateKeyToAccount(PRIVATE_KEY);

  // 3. Setup Paymaster Client (Coinbase-compatible)
  const pimlicoClient = createPimlicoClient({
    transport: http(PAYMASTER_URL),
    entryPoint: {
      address: ENTRYPOINT_ADDRESS_V07,
      version: "0.7",
    },
  });

  // 4. Create the Smart Account (SAFE IMPLEMENTATION)
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [signer],
    threshold: 1,
    version: "1.4.1",
    entryPoint: {
      address: ENTRYPOINT_ADDRESS_V07,
      version: "0.7",
    },
  });

  console.log(`🔑 EOA Signer:         ${signer.address}`);
  console.log(`🤖 Smart Account:      ${safeAccount.address}`);

  if (safeAccount.address === "0x0000000000000000000000000000000000000000") {
    throw new Error("❌ Smart Account failed to initialize (Address is 0x0)");
  }

  // 5. Create the Smart Account Client (WITHOUT custom gas estimation)
  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: base,
    bundlerTransport: http(PAYMASTER_URL), 
    paymaster: pimlicoClient,
    // ✅ REMOVED: Custom gas estimation that calls Pimlico-specific methods
  });

  // 6. EXECUTE
  console.log("💸 Sending 0 ETH transaction (Gasless)...");

  const txHash = await smartAccountClient.sendTransaction({
    to: signer.address, 
    value: parseEther("0"),
    data: "0x", 
  });

  console.log(`✅ Success! Transaction Sponsored by Coinbase.`);
  console.log(`🔗 Explorer: https://basescan.org/tx/${txHash}`);
}

main().catch((err) => {
    console.error("❌ Failed:");
    console.error(err);
});