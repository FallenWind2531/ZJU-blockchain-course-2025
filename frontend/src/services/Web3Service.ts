import Web3 from 'web3';
import { CONTRACT_ADDRESSES, LOTTERY_TOKEN_ABI, LOTTERY_TICKET_ABI, ADVANCED_LOTTERY_ABI } from '../contracts/config';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export class Web3Service {
  private web3: Web3 | null = null;
  private accounts: string[] = [];
  private networkId: number | null = null;

  // 初始化Web3连接
  async initWeb3(): Promise<boolean> {
    try {
      if (window.ethereum) {
        this.web3 = new Web3(window.ethereum);
        
        // 请求用户授权
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // 获取账户
        this.accounts = await this.web3.eth.getAccounts();
        
        // 获取网络ID
        this.networkId = Number(await this.web3.eth.net.getId());
        
        console.log('Web3 initialized successfully');
        console.log('Accounts:', this.accounts);
        console.log('Network ID:', this.networkId);
        
        return true;
      } else {
        console.error('Please install MetaMask!');
        return false;
      }
    } catch (error) {
      console.error('Error initializing Web3:', error);
      return false;
    }
  }

  // 检查MetaMask是否已安装
  isMetaMaskInstalled(): boolean {
    return typeof window.ethereum !== 'undefined';
  }

  // 获取当前账户
  getCurrentAccount(): string | null {
    return this.accounts.length > 0 ? this.accounts[0] : null;
  }

  // 获取所有账户
  getAccounts(): string[] {
    return this.accounts;
  }

  // 获取Web3实例
  getWeb3(): Web3 | null {
    return this.web3;
  }

  // 获取合约实例
  getLotteryTokenContract() {
    if (!this.web3) throw new Error('Web3 not initialized');
    return new this.web3.eth.Contract(LOTTERY_TOKEN_ABI as any, CONTRACT_ADDRESSES.LotteryToken);
  }

  getLotteryTicketContract() {
    if (!this.web3) throw new Error('Web3 not initialized');
    return new this.web3.eth.Contract(LOTTERY_TICKET_ABI as any, CONTRACT_ADDRESSES.LotteryTicket);
  }

  getAdvancedLotteryContract() {
    if (!this.web3) throw new Error('Web3 not initialized');
    return new this.web3.eth.Contract(ADVANCED_LOTTERY_ABI as any, CONTRACT_ADDRESSES.AdvancedLottery);
  }

  // 获取ETH余额
  async getEthBalance(address: string): Promise<string> {
    if (!this.web3) throw new Error('Web3 not initialized');
    const balance = await this.web3.eth.getBalance(address);
    return this.web3.utils.fromWei(balance, 'ether');
  }

  // 获取ERC20代币余额
  async getTokenBalance(address: string): Promise<string> {
    try {
      const contract = this.getLotteryTokenContract();
      const balance = await contract.methods.balanceOf(address).call();
      return this.web3!.utils.fromWei(balance as any, 'ether');
    } catch (error) {
      console.error('Error getting token balance:', error);
      return '0';
    }
  }

  // 领取ERC20代币
  async claimTokens(): Promise<boolean> {
    try {
      const contract = this.getLotteryTokenContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      await contract.methods.claimTokens().send({ from: account });
      console.log('Tokens claimed successfully');
      return true;
    } catch (error) {
      console.error('Error claiming tokens:', error);
      return false;
    }
  }

  // 检查是否已领取代币
  async hasClaimedTokens(address: string): Promise<boolean> {
    try {
      const contract = this.getLotteryTokenContract();
      return await contract.methods.hasClaimedTokens(address).call();
    } catch (error) {
      console.error('Error checking token claim status:', error);
      return false;
    }
  }

  // 获取项目信息
  async getProject(projectId: number) {
    try {
      const contract = this.getAdvancedLotteryContract();
      return await contract.methods.getProject(projectId).call() as any;
    } catch (error) {
      console.error('Error getting project:', error);
      return null;
    }
  }

  // 获取项目数量
  async getProjectCount(): Promise<number> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const count = await contract.methods.projectCounter().call();
      return parseInt(count as any);
    } catch (error) {
      console.error('Error getting project count:', error);
      return 0;
    }
  }

  // 获取项目投注金额
  async getProjectBetAmounts(projectId: number): Promise<string[]> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const amounts = await contract.methods.getProjectBetAmounts(projectId).call();
      return (amounts as any[]).map((amount: string) => this.web3!.utils.fromWei(amount, 'ether'));
    } catch (error) {
      console.error('Error getting project bet amounts:', error);
      return [];
    }
  }

  // 使用LT代币购买彩票
  async buyTicket(projectId: number, optionId: number, amount: string): Promise<boolean> {
    try {
      const tokenContract = this.getLotteryTokenContract();
      const lotteryContract = this.getAdvancedLotteryContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      const tokenAmount = this.web3!.utils.toWei(amount, 'ether');

      // 先授权代币
      await tokenContract.methods.approve(CONTRACT_ADDRESSES.AdvancedLottery, tokenAmount).send({ from: account });
      
      // 再购买彩票
      await lotteryContract.methods.buyTicket(projectId, optionId, tokenAmount).send({ from: account });
      
      console.log('Ticket purchased successfully');
      return true;
    } catch (error) {
      console.error('Error buying ticket:', error);
      return false;
    }
  }

  // 获取用户的彩票
  async getUserTickets(address: string): Promise<any[]> {
    try {
      const contract = this.getLotteryTicketContract();
      const ticketIds = await contract.methods.getTicketsByOwner(address).call() as any[];
      
      const tickets = [];
      for (const ticketId of ticketIds) {
        const ticketInfo = await contract.methods.getTicketInfo(ticketId).call() as any;
        tickets.push({
          tokenId: ticketId,
          ...ticketInfo
        });
      }
      
      return tickets;
    } catch (error) {
      console.error('Error getting user tickets:', error);
      return [];
    }
  }

  // 创建售卖订单
  async createSellOrder(ticketId: number, price: string): Promise<boolean> {
    try {
      const lotteryContract = this.getAdvancedLotteryContract();
      const ticketContract = this.getLotteryTicketContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      // 检查当前授权状态
      const currentApproved = await ticketContract.methods.getApproved(ticketId).call();
      console.log('Current approved address for ticket:', ticketId, 'is:', currentApproved);
      
      // 先授权NFT给合约
      await ticketContract.methods.approve(CONTRACT_ADDRESSES.AdvancedLottery, ticketId).send({ from: account });
      
      // 验证授权成功
      const newApproved = await ticketContract.methods.getApproved(ticketId).call();
      console.log('New approved address for ticket:', ticketId, 'is:', newApproved);

      const priceInWei = this.web3!.utils.toWei(price, 'ether');
      await lotteryContract.methods.createSellOrder(ticketId, priceInWei).send({ from: account });
      
      console.log('Sell order created successfully');
      return true;
    } catch (error) {
      console.error('Error creating sell order:', error);
      return false;
    }
  }

  // 检查彩票是否有活跃订单
  async getTicketActiveOrder(ticketId: number): Promise<number> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const orderId = await contract.methods.ticketActiveOrders(ticketId).call() as any;
      return parseInt(orderId);
    } catch (error) {
      console.error('Error getting ticket active order:', error);
      return 0;
    }
  }

  // 取消售卖订单
  async cancelSellOrder(orderId: number): Promise<boolean> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      await contract.methods.cancelSellOrder(orderId).send({ from: account });
      
      console.log('Sell order cancelled successfully');
      return true;
    } catch (error) {
      console.error('Error cancelling sell order:', error);
      return false;
    }
  }

  // 从订单簿购买彩票
  async buyFromOrder(orderId: number, price: string): Promise<boolean> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      // 获取订单详情用于调试
      console.log('=== 开始购买订单 ===');
      console.log('订单ID:', orderId);
      console.log('价格:', price);
      console.log('买家账户:', account);
      
      const order = await contract.methods.sellOrders(orderId).call() as any;
      console.log('订单详情:', {
        ticketId: order.ticketId,
        price: order.price,
        seller: order.seller,
        isActive: order.isActive
      });
      
      // 检查NFT授权状态
      const ticketContract = this.getLotteryTicketContract();
      const approvedAddress = await ticketContract.methods.getApproved(order.ticketId).call() as string;
      console.log('NFT授权地址:', approvedAddress);
      console.log('合约地址:', CONTRACT_ADDRESSES.AdvancedLottery);
      console.log('是否已授权给合约:', approvedAddress.toLowerCase() === CONTRACT_ADDRESSES.AdvancedLottery.toLowerCase());

      const priceInWei = this.web3!.utils.toWei(price, 'ether');
      console.log('支付金额(wei):', priceInWei);
      
      await contract.methods.buyFromOrder(orderId).send({ 
        from: account, 
        value: priceInWei 
      });
      
      console.log('Ticket bought from order successfully');
      return true;
    } catch (error) {
      console.error('Error buying from order:', error);
      return false;
    }
  }

  // 获取活跃的售卖订单
  async getActiveSellOrders(projectId: number): Promise<any[]> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const result = await contract.methods.getActiveSellOrders(projectId).call() as any;
      
      const orderIds = result[0] || result.orderIds || [];
      const orders = result[1] || result.orders || [];
      
      return orders.map((order: any, index: number) => ({
        orderId: parseInt(orderIds[index]),  // 使用真实的订单ID
        ticketId: order.ticketId,
        price: this.web3!.utils.fromWei(order.price, 'ether'),
        seller: order.seller,
        isActive: order.isActive
      }));
    } catch (error) {
      console.error('Error getting active sell orders:', error);
      return [];
    }
  }



  // 监听账户变化
  onAccountsChanged(callback: (accounts: string[]) => void) {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        this.accounts = accounts;
        callback(accounts);
      });
    }
  }

  // 监听网络变化
  onChainChanged(callback: (chainId: string) => void) {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId: string) => {
        this.networkId = parseInt(chainId, 16);
        callback(chainId);
      });
    }
  }

  // 获取合约的owner（公证人）
  async getContractOwner(): Promise<string | null> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const owner = await contract.methods.owner().call() as string;
      return owner;
    } catch (error) {
      console.error('Error getting contract owner:', error);
      return null;
    }
  }

  // 检查当前账户是否为公证人
  async isCurrentAccountNotary(): Promise<boolean> {
    try {
      const owner = await this.getContractOwner();
      const currentAccount = this.getCurrentAccount();
      if (!owner || !currentAccount) return false;
      return owner.toLowerCase() === currentAccount.toLowerCase();
    } catch (error) {
      console.error('Error checking notary status:', error);
      return false;
    }
  }
  // =================== 公证人专属功能 ===================

  // 创建竞猜项目
  async createProject(
    title: string, 
    description: string, 
    options: string[], 
    prizePool: string, 
    duration: number
  ): Promise<boolean> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const tokenContract = this.getLotteryTokenContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      // 将积分转换为wei单位（18位小数）
      const prizePoolWei = this.web3!.utils.toWei(prizePool, 'ether');
      
      // 步骤1: 检查公证人的LT余额
      const balance = await tokenContract.methods.balanceOf(account).call() as string;
      if (BigInt(balance) < BigInt(prizePoolWei)) {
        throw new Error(`余额不足！需要 ${prizePool} LT，当前余额 ${this.web3!.utils.fromWei(balance, 'ether')} LT`);
      }
      
      // 步骤2: 授权合约使用公证人的LT代币
      console.log('授权合约使用LT代币...');
      await tokenContract.methods.approve(
        CONTRACT_ADDRESSES.AdvancedLottery, 
        prizePoolWei
      ).send({ from: account });
      
      // 将小时转换为秒
      const durationInSeconds = duration * 3600;
      
      // 步骤3: 创建项目（合约会自动转移LT代币）
      console.log('创建项目...');
      await contract.methods.createProject(
        title, 
        description, 
        options, 
        prizePoolWei, 
        durationInSeconds
      ).send({ from: account });
      
      console.log('Project created successfully');
      return true;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // 结束项目并宣布获胜选项
  async finishProject(projectId: number, winningOption: number): Promise<boolean> {
    try {
      const contract = this.getAdvancedLotteryContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      await contract.methods.finishProject(projectId, winningOption).send({ from: account });
      
      console.log('Project finished successfully');
      return true;
    } catch (error) {
      console.error('Error finishing project:', error);
      return false;
    }
  }



  // 铸造代币给指定地址
  async mintTokens(toAddress: string, amount: string): Promise<boolean> {
    try {
      const contract = this.getLotteryTokenContract();
      const account = this.getCurrentAccount();
      if (!account) throw new Error('No account connected');

      const amountWei = this.web3!.utils.toWei(amount, 'ether');
      await contract.methods.mintTokens(toAddress, amountWei).send({ from: account });
      
      console.log('Tokens minted successfully');
      return true;
    } catch (error) {
      console.error('Error minting tokens:', error);
      return false;
    }
  }

  // 获取合约ETH余额
  async getContractEthBalance(): Promise<string> {
    try {
      if (!this.web3) throw new Error('Web3 not initialized');
      const balance = await this.web3.eth.getBalance(CONTRACT_ADDRESSES.AdvancedLottery);
      return this.web3.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting contract ETH balance:', error);
      return '0';
    }
  }

  // 监听合约调试事件
  async listenToDebugEvents(): Promise<void> {
    try {
      const contract = this.getAdvancedLotteryContract();
      
      // 监听奖金分发调试事件
      const subscription1 = await contract.events.PrizeDistributionDebug({
        fromBlock: 'latest'
      });
      
      subscription1.on('data', (event: any) => {
        console.log('🎯 奖金分发调试信息:', {
          项目ID: event.returnValues.projectId,
          总奖池: this.web3!.utils.fromWei(event.returnValues.totalPrizePool, 'ether') + ' LT',
          获胜投注总额: this.web3!.utils.fromWei(event.returnValues.totalWinningAmount, 'ether') + ' LT',
          合约余额: this.web3!.utils.fromWei(event.returnValues.contractBalance, 'ether') + ' LT',
          区块号: event.blockNumber,
          交易哈希: event.transactionHash
        });
      });

      subscription1.on('error', (error: any) => {
        console.error('监听调试事件出错:', error);
      });

      // 监听奖金领取事件
      const subscription2 = await contract.events.PrizeClaimed({
        fromBlock: 'latest'
      });

      subscription2.on('data', (event: any) => {
        console.log('💰 奖金发放成功:', {
          项目ID: event.returnValues.projectId,
          彩票ID: event.returnValues.ticketId,
          获奖金额: this.web3!.utils.fromWei(event.returnValues.amount, 'ether') + ' LT',
          获奖者: event.returnValues.winner,
          区块号: event.blockNumber,
          交易哈希: event.transactionHash
        });
      });

      subscription2.on('error', (error: any) => {
        console.error('监听奖金事件出错:', error);
      });

      console.log('✅ 开始监听合约调试事件...');
      
    } catch (error) {
      console.error('启动事件监听失败:', error);
    }
  }
}

// 创建单例实例
export const web3Service = new Web3Service();