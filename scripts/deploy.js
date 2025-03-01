const hre = require("hardhat");

async function main() {

  const Betting = await hre.ethers.getContractFactory("PariMutuelBetting");
  const betting = await Betting.deploy();

  console.log(
    `Betting contract deployed to ${await betting.getAddress()}`
  );
  
  // Verify the smart contract using hardhat 
  await hre.run("verify:verify", {
    address: await betting.getAddress(),                // "0xc15D1a1259652A930ec8d3752e5cF85a88FFA6A7"
    constructorArguments: [],
  });

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
