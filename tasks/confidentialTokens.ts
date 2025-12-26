import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:factory-address", "Prints the ConfidentialTokenFactory address").setAction(async function (
  _taskArguments: TaskArguments,
  hre,
) {
  const { deployments } = hre;
  const factoryDeployment = await deployments.get("ConfidentialTokenFactory");
  console.log("ConfidentialTokenFactory address is", factoryDeployment.address);
});

task("task:create-token", "Create a new ERC7984 token")
  .addParam("name", "Token name")
  .addParam("symbol", "Token symbol")
  .addOptionalParam("supply", "Human readable supply, defaults to 10,000,000")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();
    const factoryDeployment = await deployments.get("ConfidentialTokenFactory");
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", factoryDeployment.address);

    const parsedSupply = taskArguments.supply ? BigInt(taskArguments.supply) : BigInt(0);

    const tx = await factory
      .connect(signer)
      .createToken(taskArguments.name as string, taskArguments.symbol as string, parsedSupply);
    console.log("Creating token, tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("Confirmed in block", receipt?.blockNumber);
  });

task("task:buy-token", "Purchase a confidential token with ETH")
  .addParam("token", "Token address")
  .addParam("eth", "ETH amount to spend")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const [signer] = await ethers.getSigners();
    const factoryDeployment = await deployments.get("ConfidentialTokenFactory");
    const factory = await ethers.getContractAt("ConfidentialTokenFactory", factoryDeployment.address);

    const value = ethers.parseEther(taskArguments.eth as string);
    const tx = await factory.connect(signer).buyTokens(taskArguments.token as string, { value });
    console.log("Buying tokens, tx:", tx.hash);
    const receipt = await tx.wait();
    console.log("Confirmed in block", receipt?.blockNumber);
  });
