// 导入合约 artifacts
import LotteryTokenArtifact from './LotteryToken.json';
import LotteryTicketArtifact from './LotteryTicket.json';
import AdvancedLotteryArtifact from './AdvancedLottery.json';

// 合约ABI和地址配置
export const CONTRACT_ADDRESSES = {
  LotteryToken: "0xeB2f40e4173e06b28975c23Ce622c865396dEcFe",
  LotteryTicket: "0x005D6fF16a5c1c15aaD0736109F02561cC48833D",
  AdvancedLottery: "0xD2Fcd1Bd8Adfad13b7D4b27e66092D1CdC9dd11C"
};

// 使用编译后的真实 ABI
export const LOTTERY_TOKEN_ABI = LotteryTokenArtifact.abi;
export const LOTTERY_TICKET_ABI = LotteryTicketArtifact.abi;
export const ADVANCED_LOTTERY_ABI = AdvancedLotteryArtifact.abi;