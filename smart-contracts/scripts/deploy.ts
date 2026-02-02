import { ethers } from "hardhat";

async function main() {
    const feeAddress = process.env.NEXT_PUBLIC_FEE_ADDRESS;

    if (!feeAddress) {
        console.error("Error: NEXT_PUBLIC_FEE_ADDRESS not set in environment");
        process.exit(1);
    }

    console.log("Deploying TipSplitter...");
    console.log("Admin (Deployer):", (await ethers.getSigners())[0].address);
    console.log("Initial Fee Address:", feeAddress);
    console.log("Initial Fee:", "100 BPS (1%)");

    const TipSplitter = await ethers.getContractFactory("TipSplitter");
    const tipSplitter = await TipSplitter.deploy(feeAddress, 100); // 100 BPS = 1%

    await tipSplitter.waitForDeployment();

    const address = await tipSplitter.getAddress();

    console.log("--- Deployment Successful ---");
    console.log("Contract Address:", address);
    console.log("\nVerify with:");
    console.log(`npx hardhat verify --network <network> ${address} ${feeAddress} 100`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
