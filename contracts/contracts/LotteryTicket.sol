// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LotteryTicket
 * @dev ERC721合约，代表彩票凭证
 */
contract LotteryTicket is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // 彩票信息
    struct TicketInfo {
        uint256 projectId;
        uint256 optionId;
        uint256 betAmount;
        address originalBuyer;
        uint256 purchaseTime;
    }
    
    mapping(uint256 => TicketInfo) public ticketInfo;
    mapping(uint256 => mapping(address => bool)) public projectNotaries; // 项目ID => 公证人地址 => 是否授权
    mapping(address => bool) public globalMinters; // 全局铸造权限
    
    constructor() ERC721("LotteryTicket", "TICKET") Ownable(msg.sender) {}

    /**
     * @dev 铸造新的彩票NFT
     */
    function mintTicket(
        address to,
        uint256 projectId,
        uint256 optionId,
        uint256 betAmount
    ) external returns (uint256) {
        require(
            projectNotaries[projectId][msg.sender] || 
            msg.sender == owner() || 
            projectNotaries[projectId][owner()] ||
            globalMinters[msg.sender], 
            "Not authorized"
        );
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _mint(to, tokenId);
        
        ticketInfo[tokenId] = TicketInfo({
            projectId: projectId,
            optionId: optionId,
            betAmount: betAmount,
            originalBuyer: to,
            purchaseTime: block.timestamp
        });
        
        return tokenId;
    }

    /**
     * @dev 授权项目公证人
     */
    function authorizeNotary(uint256 projectId, address notary) external onlyOwner {
        projectNotaries[projectId][notary] = true;
    }

    /**
     * @dev 设置全局铸造权限
     */
    function setGlobalMinter(address minter, bool authorized) external onlyOwner {
        globalMinters[minter] = authorized;
    }

    /**
     * @dev 获取彩票信息
     */
    function getTicketInfo(uint256 tokenId) external view returns (TicketInfo memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return ticketInfo[tokenId];
    }

    /**
     * @dev 批量获取用户的彩票
     */
    function getTicketsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokens = new uint256[](balance);
        uint256 index = 0;
        
        for (uint256 i = 0; i < _tokenIdCounter; i++) {
            if (_ownerOf(i) == owner) {
                tokens[index] = i;
                index++;
            }
        }
        
        return tokens;
    }

    // Override required functions
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}