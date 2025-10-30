import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Deploying Advanced Lottery System contracts...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

  // 1. 部署 LotteryToken (ERC20)
  console.log("\nDeploying LotteryToken...");
  const LotteryToken = await ethers.getContractFactory("LotteryToken");
  const lotteryToken = await LotteryToken.deploy();
  await lotteryToken.deployed();
  console.log("LotteryToken deployed to:", lotteryToken.address);

  // 2. 部署 LotteryTicket (ERC721)
  console.log("\nDeploying LotteryTicket...");
  const LotteryTicket = await ethers.getContractFactory("LotteryTicket");
  const lotteryTicket = await LotteryTicket.deploy();
  await lotteryTicket.deployed();
  console.log("LotteryTicket deployed to:", lotteryTicket.address);

  // 3. 部署 AdvancedLottery 主合约
  console.log("\nDeploying AdvancedLottery...");
  const AdvancedLottery = await ethers.getContractFactory("AdvancedLottery");
  const advancedLottery = await AdvancedLottery.deploy(
    lotteryToken.address,
    lotteryTicket.address
  );
  await advancedLottery.deployed();
  console.log("AdvancedLottery deployed to:", advancedLottery.address);

  // 4. 授权AdvancedLottery合约可以铸造NFT票据
  console.log("\nAuthorizing AdvancedLottery to mint tickets...");
  const authorizeTx = await lotteryTicket.setGlobalMinter(advancedLottery.address, true);
  await authorizeTx.wait();
  console.log("AdvancedLottery authorized as global minter for all projects");

  // 5. 保存部署信息到文件
  const deploymentInfo = {
    network: "ganache",
    deployer: deployer.address,
    contracts: {
      LotteryToken: lotteryToken.address,
      LotteryTicket: lotteryTicket.address,
      AdvancedLottery: advancedLottery.address
    },
    deploymentTime: new Date().toISOString()
  };

  // 确保目录存在
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentDir, "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n=== Deployment Summary ===");
  console.log("LotteryToken (ERC20):", lotteryToken.address);
  console.log("LotteryTicket (ERC721):", lotteryTicket.address);
  console.log("AdvancedLottery (Main):", advancedLottery.address);
  console.log("Deployment info saved to:", path.join(deploymentDir, "deployment.json"));

  // 6. 为公证人铸造LT代币以创建项目
  console.log("\n=== Minting LT Tokens for Project Creation ===");
  const mintAmount = ethers.utils.parseEther("10000"); // 铸造1000个LT给公证人
  await lotteryToken.mintTokens(deployer.address, mintAmount);
  console.log("Minted 10000 LT tokens for deployer");
  
  // 授权合约使用公证人的LT代币
  await lotteryToken.approve(advancedLottery.address, mintAmount);
  console.log("Approved AdvancedLottery to use LT tokens");

  // 7. 创建示例竞猜项目
  console.log("\n=== Creating Sample Projects ===");
  
  // 项目1: NBA MVP竞猜
  const options1 = ["詹姆斯", "库里", "约基奇", "字母哥"];
  const createTx1 = await advancedLottery.createProject(
    "2024 NBA MVP竞猜",
    "预测2024赛季NBA最有价值球员",
    options1,
    ethers.utils.parseEther("100"), // 100 LT奖池
    7 * 24 * 60 * 60 // 7天
  );
  await createTx1.wait();
  console.log("Created project: 2024 NBA MVP竞猜");

  // 项目2: 足球世界杯冠军
  const options2 = ["阿根廷", "巴西", "法国", "英格兰", "西班牙"];
  const createTx2 = await advancedLottery.createProject(
    "世界杯冠军竞猜",
    "预测下届世界杯冠军队伍",
    options2,
    ethers.utils.parseEther("200"), // 200 LT奖池
    30 * 24 * 60 * 60 // 30天
  );
  await createTx2.wait();
  console.log("Created project: 世界杯冠军竞猜");

  console.log("\n🎉 All contracts deployed successfully!");
  console.log("You can now start the frontend application.");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});