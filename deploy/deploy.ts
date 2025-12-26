import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFactory = await deploy("ConfidentialTokenFactory", {
    from: deployer,
    log: true,
  });

  console.log(`ConfidentialTokenFactory contract: `, deployedFactory.address);
};
export default func;
func.id = "deploy_confidential_token_factory"; // id required to prevent reexecution
func.tags = ["ConfidentialTokenFactory"];
