import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialTokenFactory, ConfidentialTokenFactory__factory, ConfidentialERC7984Token } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

const DECIMALS = 1_000_000n;
const TOKENS_PER_ETH = 10_000_000n * DECIMALS;

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFactory() {
  const factory = (await ethers.getContractFactory("ConfidentialTokenFactory")) as ConfidentialTokenFactory__factory;
  const deployed = (await factory.deploy()) as ConfidentialTokenFactory;
  return deployed;
}

describe("ConfidentialTokenFactory", function () {
  let signers: Signers;
  let factory: ConfidentialTokenFactory;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("Skipping factory tests outside of the FHE mock environment");
      this.skip();
    }

    factory = await deployFactory();
  });

  async function deployToken(overrides?: { supply?: bigint }) {
    const tx = await factory
      .connect(signers.deployer)
      .createToken("Nebula Credit", "NEB", overrides?.supply ?? BigInt(0));
    await tx.wait();

    const tokens = await factory.getAllTokens();
    const created = tokens[0];
    const token = (await ethers.getContractAt("ConfidentialERC7984Token", created.token)) as ConfidentialERC7984Token;

    return { token, record: created };
  }

  it("creates tokens with a default capped supply", async function () {
    const { record, token } = await deployToken();

    expect(record.maxSupply).to.equal(10_000_000n * DECIMALS);
    expect(record.mintedSupply).to.equal(0n);
    expect(await token.remainingSupply()).to.equal(record.maxSupply);
  });

  it("quotes and mints tokens for ETH purchases", async function () {
    const { token } = await deployToken({ supply: 20_000_000n });

    const halfEth = ethers.parseEther("0.5");
    const expectedMint = (TOKENS_PER_ETH * halfEth) / ethers.WeiPerEther;

    await expect(factory.connect(signers.alice).buyTokens(await token.getAddress(), { value: halfEth })).to.not.be
      .reverted;

    const mintedSupply = await token.mintedSupply();
    expect(mintedSupply).to.equal(expectedMint);

    const encryptedBalance = await token.confidentialBalanceOf(signers.alice.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      await token.getAddress(),
      signers.alice,
    );

    expect(clearBalance).to.equal(expectedMint);
  });

  it("enforces supply caps during purchases", async function () {
    const { token } = await deployToken({ supply: 1n });
    const tokenAddress = await token.getAddress();

    const oneEth = ethers.parseEther("1");
    await expect(factory.connect(signers.bob).buyTokens(tokenAddress, { value: oneEth })).to.be.revertedWithCustomError(
      factory,
      "InsufficientSupply",
    );
  });
});
