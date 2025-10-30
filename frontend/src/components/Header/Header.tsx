import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Badge, Dropdown, Space, Typography, message } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeOutlined, 
  UserOutlined, 
  WalletOutlined, 
  BookOutlined,
  GiftOutlined,
  CrownOutlined 
} from '@ant-design/icons';
import { web3Service } from '../../services/Web3Service';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  account: string | null;
  isConnected: boolean;
  isNotary: boolean;
  onConnect: () => void;
}

const Header: React.FC<HeaderProps> = ({ account, isConnected, isNotary, onConnect }) => {
  const location = useLocation();
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [hasClaimedTokens, setHasClaimedTokens] = useState<boolean>(false);

  useEffect(() => {
    if (account) {
      loadBalances();
      checkClaimStatus();
    }
  }, [account]);

  const loadBalances = async () => {
    if (!account) return;
    
    try {
      const ethBal = await web3Service.getEthBalance(account);
      const tokenBal = await web3Service.getTokenBalance(account);
      setEthBalance(ethBal);
      setTokenBalance(tokenBal);
    } catch (error) {
      console.error('加载余额失败:', error);
    }
  };

  const checkClaimStatus = async () => {
    if (!account) return;
    
    try {
      const tokensClaimed = await web3Service.hasClaimedTokens(account);
      setHasClaimedTokens(tokensClaimed);
    } catch (error) {
      console.error('检查领取状态失败:', error);
    }
  };

  const handleClaimTokens = async () => {
    try {
      const success = await web3Service.claimTokens();
      if (success) {
        message.success('领取1000个积分代币成功！');
        loadBalances();
        checkClaimStatus();
      } else {
        message.error('领取失败！');
      }
    } catch (error) {
      message.error('领取失败！');
    }
  };

  const menuItems = [
    {
      key: isNotary ? '/notary' : '/',
      icon: isNotary ? <CrownOutlined /> : <HomeOutlined />,
      label: <Link to={isNotary ? "/notary" : "/"}>{isNotary ? '管理面板' : '首页'}</Link>,
    },
    ...(isNotary ? [{
      key: '/projects',
      icon: <HomeOutlined />,
      label: <Link to="/projects">竞猜大厅</Link>,
    }] : []),
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">个人中心</Link>,
    }
  ];

  const walletMenu = {
    items: [
      {
        key: 'eth-balance',
        label: (
          <Space direction="vertical" style={{ padding: '8px 0' }}>
            <Text strong>ETH余额: {parseFloat(ethBalance).toFixed(4)}</Text>
            <Text strong>LOTTERY余额: {parseFloat(tokenBalance).toFixed(2)}</Text>
            {isNotary && <Text style={{ color: '#722ed1' }}>👑 公证人身份</Text>}
          </Space>
        ),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'claim-tokens',
        label: (
          <Button 
            type="primary" 
            size="small" 
            icon={<CrownOutlined />}
            disabled={hasClaimedTokens}
            onClick={handleClaimTokens}
            block
          >
            {hasClaimedTokens ? '已领取代币' : '领取1000积分'}
          </Button>
        ),
      }
    ],
  };

  return (
    <AntHeader style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '0 24px',
      background: '#001529'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', marginRight: '32px' }}>
          🎲 去中心化彩票系统
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ minWidth: 200, background: 'transparent' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isConnected ? (
          <>
            <Dropdown menu={walletMenu} placement="bottomRight">
              <Button 
                type="primary" 
                icon={<WalletOutlined />}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <Badge 
                  count={!hasClaimedTokens ? '!' : 0} 
                  size="small"
                >
                  <span style={{ marginLeft: '4px' }}>
                    {account?.substring(0, 6)}...{account?.substring(account.length - 4)}
                  </span>
                </Badge>
              </Button>
            </Dropdown>
          </>
        ) : (
          <Button 
            type="primary" 
            icon={<WalletOutlined />}
            onClick={onConnect}
          >
            连接钱包
          </Button>
        )}
      </div>
    </AntHeader>
  );
};

export default Header;