// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LotteryToken
 * @dev ERC20代币合约，用于彩票系统的积分代币
 */
contract LotteryToken is ERC20, Ownable {
    mapping(address => bool) public hasClaimed;
    uint256 public constant CLAIM_AMOUNT = 1000 * 10**18; // 每次领取1000个代币
    
    constructor() ERC20("LotteryToken", "LOTTERY") Ownable(msg.sender) {}

    /**
     * @dev 普通用户领取代币（每个地址只能领取一次）
     */
    function claimTokens() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, CLAIM_AMOUNT);
    }

    /**
     * @dev 公证人可以铸造任意数量的代币
     */
    function mintTokens(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev 检查地址是否已经领取过代币
     */
    function hasClaimedTokens(address user) external view returns (bool) {
        return hasClaimed[user];
    }
}