// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LotteryToken.sol";
import "./LotteryTicket.sol";

/**
 * @title AdvancedLottery
 * @dev 进阶去中心化彩票系统主合约
 */
contract AdvancedLottery is Ownable, ReentrancyGuard {
    LotteryToken public lotteryToken;
    LotteryTicket public lotteryTicket;
    
    // 竞猜项目结构
    struct Project {
        string title;
        string description;
        string[] options;
        uint256 totalPrizePool;
        uint256 endTime;
        bool isActive;
        bool isFinished;
        uint256 winningOption;
        address creator;
        uint256 createTime;
        bool prizeDistributed;  // 奖金是否已分发
    }
    
    // 订单簿结构
    struct SellOrder {
        uint256 ticketId;
        uint256 price;
        address seller;
        bool isActive;
    }
    
    // 项目相关
    mapping(uint256 => Project) public projects;
    mapping(uint256 => mapping(uint256 => uint256)) public optionBetAmounts; // projectId => optionId => totalAmount
    mapping(uint256 => uint256[]) public projectTickets; // projectId => ticketIds[]
    uint256 public projectCounter;
    
    // 订单簿相关
    mapping(uint256 => SellOrder) public sellOrders; // orderId => SellOrder
    mapping(uint256 => uint256[]) public projectSellOrders; // projectId => orderIds[]
    mapping(uint256 => uint256) public ticketActiveOrders; // ticketId => orderId (0表示没有活跃订单)
    uint256 public orderCounter;
    
    // 事件
    event ProjectCreated(uint256 indexed projectId, string title, address creator);
    event TicketPurchased(uint256 indexed projectId, uint256 indexed ticketId, uint256 optionId, uint256 amount, address buyer);
    event ProjectFinished(uint256 indexed projectId, uint256 winningOption);
    event PrizeClaimed(uint256 indexed projectId, uint256 indexed ticketId, uint256 amount, address winner);
    event SellOrderCreated(uint256 indexed orderId, uint256 indexed ticketId, uint256 price, address seller);
    event TicketSold(uint256 indexed orderId, uint256 indexed ticketId, address from, address to, uint256 price);
    event EthClaimed(address user, uint256 amount);
    event PrizeDistributionDebug(uint256 projectId, uint256 totalPrizePool, uint256 totalWinningAmount, uint256 contractBalance);
    
    constructor(address _lotteryToken, address _lotteryTicket) Ownable(msg.sender) {
        lotteryToken = LotteryToken(_lotteryToken);
        lotteryTicket = LotteryTicket(_lotteryTicket);
    }
    
    /**
     * @dev 创建竞猜项目
     */
    function createProject(
        string memory _title,
        string memory _description,
        string[] memory _options,
        uint256 _prizePool,
        uint256 _duration
    ) external onlyOwner {
        require(_options.length >= 2, "At least 2 options required");
        require(_prizePool > 0, "Prize pool must be greater than 0");
        
        // 公证人必须转入初始奖金到合约
        require(lotteryToken.transferFrom(msg.sender, address(this), _prizePool), "Failed to transfer initial prize pool");
        
        uint256 projectId = projectCounter++;
        
        projects[projectId] = Project({
            title: _title,
            description: _description,
            options: _options,
            totalPrizePool: _prizePool,
            endTime: block.timestamp + _duration,
            isActive: true,
            isFinished: false,
            winningOption: 0,
            creator: msg.sender,
            createTime: block.timestamp,
            prizeDistributed: false
        });
        
        emit ProjectCreated(projectId, _title, msg.sender);
    }
    

    
    /**
     * @dev 购买彩票（使用LT代币）
     */
    function buyTicket(uint256 _projectId, uint256 _optionId, uint256 _amount) external nonReentrant {
        Project storage project = projects[_projectId];
        require(project.isActive && !project.isFinished, "Project not active");
        require(block.timestamp < project.endTime, "Project ended");
        require(_optionId < project.options.length, "Invalid option");
        require(_amount > 0, "Amount must be greater than 0");
        
        // 转移LT代币到合约
        require(lotteryToken.transferFrom(msg.sender, address(this), _amount), "Token transfer failed");
        
        // 铸造NFT彩票
        uint256 ticketId = lotteryTicket.mintTicket(msg.sender, _projectId, _optionId, _amount);
        
        // 更新统计和奖池
        optionBetAmounts[_projectId][_optionId] += _amount;
        project.totalPrizePool += _amount;  // 累积到奖池
        projectTickets[_projectId].push(ticketId);
        
        emit TicketPurchased(_projectId, ticketId, _optionId, _amount, msg.sender);
    }
    
    /**
     * @dev 创建售卖订单
     */
    function createSellOrder(uint256 _ticketId, uint256 _price) external {
        require(lotteryTicket.ownerOf(_ticketId) == msg.sender, "Not ticket owner");
        
        // 检查合约是否被授权转移NFT
        require(lotteryTicket.getApproved(_ticketId) == address(this) || lotteryTicket.isApprovedForAll(msg.sender, address(this)), "Contract not authorized to transfer NFT");
        
        LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket.getTicketInfo(_ticketId);
        Project storage project = projects[ticketInfo.projectId];
        require(project.isActive && !project.isFinished, "Project not active");
        
        // 检查是否已有活跃订单
        uint256 existingOrderId = ticketActiveOrders[_ticketId];
        if (existingOrderId != 0 && sellOrders[existingOrderId].isActive) {
            // 更新现有订单的价格
            sellOrders[existingOrderId].price = _price;
            emit SellOrderCreated(existingOrderId, _ticketId, _price, msg.sender);
            return;
        }
        
        uint256 orderId = orderCounter++;
        
        sellOrders[orderId] = SellOrder({
            ticketId: _ticketId,
            price: _price,
            seller: msg.sender,
            isActive: true
        });
        
        // 更新活跃订单映射
        ticketActiveOrders[_ticketId] = orderId;
        
        projectSellOrders[ticketInfo.projectId].push(orderId);
        
        emit SellOrderCreated(orderId, _ticketId, _price, msg.sender);
    }
    
    /**
     * @dev 购买彩票（从订单簿）
     */
    function buyFromOrder(uint256 _orderId) external payable nonReentrant {
        SellOrder storage order = sellOrders[_orderId];
        require(order.isActive, "Order not active");
        require(msg.value >= order.price, "Insufficient payment");
        
        LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket.getTicketInfo(order.ticketId);
        Project storage project = projects[ticketInfo.projectId];
        require(project.isActive && !project.isFinished, "Project not active");
        
        address seller = order.seller;
        uint256 ticketId = order.ticketId;
        uint256 price = order.price;
        
        // 取消订单
        order.isActive = false;
        
        // 清除活跃订单映射
        ticketActiveOrders[ticketId] = 0;
        
        // 检查卖方仍然是NFT的所有者
        require(lotteryTicket.ownerOf(ticketId) == seller, "Seller is no longer the owner");
        
        // 检查合约是否被授权转移NFT
        require(lotteryTicket.getApproved(ticketId) == address(this) || lotteryTicket.isApprovedForAll(seller, address(this)), "Contract not authorized to transfer NFT");
        
        // 转移NFT
        lotteryTicket.transferFrom(seller, msg.sender, ticketId);
        
        // 支付给卖方
        payable(seller).transfer(price);
        
        // 退还多余资金
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit TicketSold(_orderId, ticketId, seller, msg.sender, price);
    }
    
    /**
     * @dev 取消售卖订单
     */
    function cancelSellOrder(uint256 _orderId) external {
        SellOrder storage order = sellOrders[_orderId];
        require(order.seller == msg.sender, "Not order owner");
        require(order.isActive, "Order not active");
        
        order.isActive = false;
        
        // 清除活跃订单映射
        ticketActiveOrders[order.ticketId] = 0;
    }
    
    /**
     * @dev 结束竞猜项目并公布结果，自动分发奖金给获胜者
     */
    function finishProject(uint256 _projectId, uint256 _winningOption) external onlyOwner {
        Project storage project = projects[_projectId];
        require(project.isActive && !project.isFinished, "Invalid project state");
        require(_winningOption < project.options.length, "Invalid winning option");
        
        project.isFinished = true;
        project.isActive = false;
        project.winningOption = _winningOption;
        
        // 自动分发奖金给获胜者
        _distributePrizes(_projectId, _winningOption);
        
        emit ProjectFinished(_projectId, _winningOption);
    }
    
    /**
     * @dev 内部函数：分发奖金给获胜彩票持有者
     */
    function _distributePrizes(uint256 _projectId, uint256 _winningOption) internal {
        Project storage project = projects[_projectId];
        
        // 防止重复分发奖金
        if (project.prizeDistributed) {
            return;
        }
        
        uint256[] memory tickets = projectTickets[_projectId];
        uint256 totalWinningAmount = optionBetAmounts[_projectId][_winningOption];
        uint256 contractBalance = lotteryToken.balanceOf(address(this));
        
        // 合约余额不足时，使用实际合约余额作为可分发奖金
        uint256 availablePrizePool = contractBalance > project.totalPrizePool ? project.totalPrizePool : contractBalance;
        
        // 发出调试事件
        emit PrizeDistributionDebug(_projectId, availablePrizePool, totalWinningAmount, contractBalance);
        
        if (totalWinningAmount == 0) {
            // 没有人投注获胜选项，奖池归公证人
            project.prizeDistributed = true;
            return;
        }
        
        // 遍历所有彩票，为获胜者分发奖金
        for (uint256 i = 0; i < tickets.length; i++) {
            uint256 ticketId = tickets[i];
            LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket.getTicketInfo(ticketId);
            
            if (ticketInfo.optionId == _winningOption) {
                // 使用实际可用奖池计算奖金
                uint256 prizeAmount = (ticketInfo.betAmount * availablePrizePool) / totalWinningAmount;
                
                // 获取彩票当前持有者
                address winner = lotteryTicket.ownerOf(ticketId);
                
                // 发放奖金（LT代币）
                if (prizeAmount > 0 && lotteryToken.balanceOf(address(this)) >= prizeAmount) {
                    lotteryToken.transfer(winner, prizeAmount);
                    emit PrizeClaimed(_projectId, ticketId, prizeAmount, winner);
                }
            }
        }
        
        // 标记奖金已分发
        project.prizeDistributed = true;
    }
    

    
    /**
     * @dev 获取项目信息
     */
    function getProject(uint256 _projectId) external view returns (Project memory) {
        return projects[_projectId];
    }
    
    /**
     * @dev 获取项目的所有选项投注金额
     */
    function getProjectBetAmounts(uint256 _projectId) external view returns (uint256[] memory) {
        Project memory project = projects[_projectId];
        uint256[] memory amounts = new uint256[](project.options.length);
        
        for (uint256 i = 0; i < project.options.length; i++) {
            amounts[i] = optionBetAmounts[_projectId][i];
        }
        
        return amounts;
    }
    
    /**
     * @dev 获取项目的售卖订单
     */
    function getProjectSellOrders(uint256 _projectId) external view returns (uint256[] memory) {
        return projectSellOrders[_projectId];
    }
    
    /**
     * @dev 获取活跃的售卖订单（返回订单ID和订单信息）
     */
    function getActiveSellOrders(uint256 _projectId) external view returns (uint256[] memory orderIds, SellOrder[] memory orders) {
        uint256[] memory allOrderIds = projectSellOrders[_projectId];
        uint256 activeCount = 0;
        
        // 计算活跃订单数量
        for (uint256 i = 0; i < allOrderIds.length; i++) {
            if (sellOrders[allOrderIds[i]].isActive) {
                activeCount++;
            }
        }
        
        // 构造活跃订单数组
        orderIds = new uint256[](activeCount);
        orders = new SellOrder[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < allOrderIds.length; i++) {
            if (sellOrders[allOrderIds[i]].isActive) {
                orderIds[index] = allOrderIds[i];
                orders[index] = sellOrders[allOrderIds[i]];
                index++;
            }
        }
        
        return (orderIds, orders);
    }
    
    receive() external payable {}
}