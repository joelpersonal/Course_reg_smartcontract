// Deploy to any network:  RPC_URL=<url> PRIVATE_KEY=<key> node scripts/deploy.js
const { ethers } = require("ethers");
const artifact = require("../build/CourseRegistration.json");

(async () => {
  const { RPC_URL, PRIVATE_KEY } = process.env;
  if (!RPC_URL || !PRIVATE_KEY) throw new Error("Set RPC_URL and PRIVATE_KEY environment variables");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  const receipt = await contract.deploymentTransaction().wait();
  console.log("Contract address :", await contract.getAddress());
  console.log("Tx hash          :", receipt.hash);
  console.log("Block            :", receipt.blockNumber);
  console.log("Gas used         :", receipt.gasUsed.toString());
})();
