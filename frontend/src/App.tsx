import React, { useState, useEffect } from 'react';
import { Layout, message, ConfigProvider } from 'antd';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import zhCN from 'antd/locale/zh_CN';
import Header from './components/Header/Header';
import ProjectList from './components/ProjectList/ProjectList';
import ProjectDetail from './components/ProjectDetail/ProjectDetail';
import UserProfile from './components/UserProfile/UserProfile';
import OrderBook from './components/OrderBook/OrderBook';
import NotaryPanel from './components/NotaryPanel/NotaryPanel';
import { web3Service } from './services/Web3Service';
import './App.css';

const { Content } = Layout;

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isNotary, setIsNotary] = useState<boolean>(false);

  useEffect(() => {
    initializeApp();
    setupEventListeners();
  }, []);

  const initializeApp = async () => {
    setLoading(true);
    try {
      if (web3Service.isMetaMaskInstalled()) {
        const connected = await web3Service.initWeb3();
        if (connected) {
          const currentAccount = web3Service.getCurrentAccount();
          setAccount(currentAccount);
          setIsConnected(true);
          
          // 检查公证人身份
          const notaryStatus = await web3Service.isCurrentAccountNotary();
          setIsNotary(notaryStatus);
          
          // 启动事件监听
          await web3Service.listenToDebugEvents();
          
          message.success('MetaMask连接成功！');
        }
      } else {
        message.error('请先安装MetaMask钱包！');
      }
    } catch (error) {
      console.error('初始化应用失败:', error);
      message.error('应用初始化失败，请刷新页面重试');
    }
    setLoading(false);
  };

  const setupEventListeners = () => {
    // 监听账户变化
    web3Service.onAccountsChanged(async (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null);
        setIsConnected(false);
        setIsNotary(false);
        message.warning('MetaMask已断开连接');
      } else {
        setAccount(accounts[0]);
        setIsConnected(true);
        
        // 检查新账户的公证人身份
        const notaryStatus = await web3Service.isCurrentAccountNotary();
        setIsNotary(notaryStatus);
        
        message.info('账户已切换');
      }
    });

    // 监听网络变化
    web3Service.onChainChanged((chainId: string) => {
      message.info('网络已切换，请刷新页面');
      window.location.reload();
    });
  };

  const connectWallet = async () => {
    const connected = await web3Service.initWeb3();
    if (connected) {
      const currentAccount = web3Service.getCurrentAccount();
      setAccount(currentAccount);
      setIsConnected(true);
      
      // 检查公证人身份
      const notaryStatus = await web3Service.isCurrentAccountNotary();
      setIsNotary(notaryStatus);
      
      message.success('钱包连接成功！');
    } else {
      message.error('钱包连接失败！');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        正在加载...
      </div>
    );
  }

  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <Header 
            account={account} 
            isConnected={isConnected} 
            isNotary={isNotary}
            onConnect={connectWallet} 
          />
          <Content style={{ padding: '20px' }}>
            <Routes>
              <Route path="/" element={isNotary ? <NotaryPanel account={account} /> : <ProjectList />} />
              <Route path="/projects" element={<ProjectList />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/profile" element={<UserProfile account={account} />} />
              <Route path="/orderbook/:projectId" element={<OrderBook />} />
              <Route path="/notary" element={isNotary ? <NotaryPanel account={account} /> : <ProjectList />} />
            </Routes>
          </Content>
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

export default App;
