import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  List, 
  Typography, 
  Space, 
  Button, 
  Tag, 
  message,
  Modal,
  Input,
  Tabs
} from 'antd';
import { 
  WalletOutlined, 
  TrophyOutlined, 
  ShoppingOutlined,
  DollarOutlined,
  CrownOutlined,
  FireOutlined
} from '@ant-design/icons';
import { web3Service } from '../../services/Web3Service';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface UserProfileProps {
  account: string | null;
}

interface UserTicket {
  tokenId: string;
  projectId: string;
  optionId: string;
  betAmount: string;
  originalBuyer: string;
  purchaseTime: string;
  projectInfo?: any;
  activeOrderId?: number;
}

const UserProfile: React.FC<UserProfileProps> = ({ account }) => {
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sellModalVisible, setSellModalVisible] = useState<boolean>(false);
  const [sellPrice, setSellPrice] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<UserTicket | null>(null);

  useEffect(() => {
    if (account) {
      loadUserData();
    }
  }, [account]);

  const loadUserData = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      // 加载余额
      const ethBal = await web3Service.getEthBalance(account);
      const tokenBal = await web3Service.getTokenBalance(account);
      setEthBalance(ethBal);
      setTokenBalance(tokenBal);

      // 加载用户彩票
      const tickets = await web3Service.getUserTickets(account);
      
      // 为每张彩票加载项目信息和出售状态
      const ticketsWithProjectInfo = await Promise.all(
        tickets.map(async (ticket: any) => {
          const [projectInfo, activeOrderId] = await Promise.all([
            web3Service.getProject(parseInt(ticket.projectId)),
            web3Service.getTicketActiveOrder(parseInt(ticket.tokenId))
          ]);
          return {
            ...ticket,
            projectInfo,
            activeOrderId: activeOrderId || 0
          };
        })
      );
      
      setUserTickets(ticketsWithProjectInfo);
    } catch (error) {
      console.error('加载用户数据失败:', error);
      message.error('加载用户数据失败');
    }
    setLoading(false);
  };

  const handleSellTicket = (ticket: UserTicket) => {
    setSelectedTicket(ticket);
    setSellModalVisible(true);
  };

  const handleConfirmSell = async () => {
    if (!selectedTicket || !sellPrice || parseFloat(sellPrice) <= 0) {
      message.error('请输入有效的售卖价格');
      return;
    }

    try {
      // 检查彩票是否已有活跃订单
      const activeOrderId = await web3Service.getTicketActiveOrder(parseInt(selectedTicket.tokenId));
      
      if (activeOrderId > 0) {
        // 如果已有活跃订单，不允许出售
        message.error('此彩票已在出售中，请先撤销现有订单');
        setSellModalVisible(false);
        setSellPrice('');
        setSelectedTicket(null);
        return;
      }

      // 没有活跃订单，创建新订单
      const success = await web3Service.createSellOrder(
        parseInt(selectedTicket.tokenId), 
        sellPrice
      );
      
      if (success) {
        message.success('创建售卖订单成功！');
        setSellModalVisible(false);
        setSellPrice('');
        setSelectedTicket(null);
        // 等待一小段时间确保区块链状态更新，然后重新加载数据
        setTimeout(() => {
          loadUserData();
        }, 1000);
      } else {
        message.error('创建售卖订单失败！');
      }
    } catch (error) {
      console.error('售卖操作失败:', error);
      message.error('售卖操作失败！');
    }
  };



  const getTicketStatus = (ticket: UserTicket) => {
    if (!ticket.projectInfo) return <Tag>加载中...</Tag>;
    
    const statusTags = [];
    
    if (ticket.projectInfo.isFinished) {
      if (parseInt(ticket.optionId) === parseInt(ticket.projectInfo.winningOption)) {
        statusTags.push(<Tag key="win" color="gold" icon={<CrownOutlined />}>中奖</Tag>);
      } else {
        statusTags.push(<Tag key="lose" color="red">未中奖</Tag>);
      }
    } else if (ticket.projectInfo.isActive) {
      statusTags.push(<Tag key="active" color="green" icon={<FireOutlined />}>进行中</Tag>);
    } else {
      statusTags.push(<Tag key="paused" color="orange">已暂停</Tag>);
    }
    
    // 添加出售状态标识
    if (ticket.activeOrderId && ticket.activeOrderId > 0) {
      statusTags.push(<Tag key="selling" color="blue">出售中</Tag>);
    }
    
    return <Space>{statusTags}</Space>;
  };

  const handleCancelSell = async (ticket: UserTicket) => {
    if (!ticket.activeOrderId) return;
    
    try {
      const success = await web3Service.cancelSellOrder(ticket.activeOrderId);
      if (success) {
        message.success('撤销出售成功！');
        // 等待一小段时间确保区块链状态更新，然后重新加载数据
        setTimeout(() => {
          loadUserData();
        }, 1000);
      } else {
        message.error('撤销出售失败！');
      }
    } catch (error) {
      console.error('撤销出售失败:', error);
      message.error('撤销出售失败！');
    }
  };

  const getTicketActions = (ticket: UserTicket) => {
    if (!ticket.projectInfo) return [];

    const actions = [];

    if (ticket.projectInfo.isFinished) {
      if (parseInt(ticket.optionId) === parseInt(ticket.projectInfo.winningOption)) {
        actions.push(
          <Tag 
            key="winner" 
            color="gold" 
            icon={<TrophyOutlined />}
          >
            获胜彩票 - 奖金已自动发放
          </Tag>
        );
      }
    } else if (ticket.projectInfo.isActive) {
      if (ticket.activeOrderId && ticket.activeOrderId > 0) {
        // 彩票已在出售，只显示撤销出售按钮
        actions.push(
          <Button 
            key="cancel" 
            size="small"
            type="default"
            danger
            onClick={() => handleCancelSell(ticket)}
          >
            撤销出售
          </Button>
        );
      } else {
        // 彩票未在出售，显示出售按钮
        actions.push(
          <Button 
            key="sell" 
            size="small"
            onClick={() => handleSellTicket(ticket)}
          >
            出售
          </Button>
        );
      }
    }

    return actions;
  };

  if (!account) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text>请先连接钱包</Text>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Title level={2}>个人中心</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="ETH余额"
              value={parseFloat(ethBalance)}
              precision={4}
              valueStyle={{ color: '#3f8600' }}
              prefix={<WalletOutlined />}
              suffix="ETH"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="LT积分代币"
              value={parseFloat(tokenBalance)}
              precision={0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />}
              suffix="LT积分"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="持有彩票"
              value={userTickets.length}
              valueStyle={{ color: '#722ed1' }}
              prefix={<ShoppingOutlined />}
              suffix="张"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs>
          <TabPane tab="我的彩票" key="tickets">
            <List
              loading={loading}
              dataSource={userTickets}
              renderItem={(ticket, index) => (
                <List.Item
                  key={index}
                  actions={getTicketActions(ticket)}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>彩票 #{ticket.tokenId}</Text>
                        {getTicketStatus(ticket)}
                      </Space>
                    }
                    description={
                      <Space direction="vertical">
                        <Text>
                          项目: {ticket.projectInfo?.title || '加载中...'}
                        </Text>
                        <Text>
                          选择: {ticket.projectInfo?.options?.[parseInt(ticket.optionId)] || '加载中...'}
                        </Text>
                        <Text>
                          投注金额: {parseFloat(web3Service.getWeb3()?.utils.fromWei(ticket.betAmount, 'ether') || '0').toFixed(0)} LT积分
                        </Text>
                        <Text type="secondary">
                          购买时间: {new Date(parseInt(ticket.purchaseTime) * 1000).toLocaleString()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: '您还没有购买任何彩票' }}
            />
          </TabPane>

          <TabPane tab="中奖记录" key="winnings">
            <List
              dataSource={userTickets.filter(ticket => 
                ticket.projectInfo?.isFinished && 
                parseInt(ticket.optionId) === parseInt(ticket.projectInfo.winningOption)
              )}
              renderItem={(ticket, index) => (
                <List.Item key={index}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>🏆 中奖彩票 #{ticket.tokenId}</Text>
                        <Tag color="gold">已中奖</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical">
                        <Text>项目: {ticket.projectInfo.title}</Text>
                        <Text>中奖选项: {ticket.projectInfo.options[parseInt(ticket.optionId)]}</Text>
                        <Text style={{ color: '#52c41a' }}>
                          投注金额: {parseFloat(web3Service.getWeb3()?.utils.fromWei(ticket.betAmount, 'ether') || '0').toFixed(0)} LT积分
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: '暂无中奖记录' }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="出售彩票"
        open={sellModalVisible}
        onCancel={() => setSellModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSellModalVisible(false)}>
            取消
          </Button>,
          <Button key="sell" type="primary" onClick={handleConfirmSell}>
            确认出售
          </Button>,
        ]}
      >
        {selectedTicket && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>彩票信息:</Text>
              <div style={{ marginTop: '8px', padding: '12px', background: '#f5f5f5', borderRadius: '6px' }}>
                <Text>彩票编号: #{selectedTicket.tokenId}</Text><br />
                <Text>项目: {selectedTicket.projectInfo?.title}</Text><br />
                <Text>选择: {selectedTicket.projectInfo?.options?.[parseInt(selectedTicket.optionId)]}</Text><br />
                <Text>原投注: {parseFloat(web3Service.getWeb3()?.utils.fromWei(selectedTicket.betAmount, 'ether') || '0').toFixed(0)} LT积分</Text>
              </div>
            </div>

            <div>
              <Text strong>售卖价格 (ETH):</Text>
              <Input
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="输入售卖价格"
                suffix="ETH"
                style={{ marginTop: '8px' }}
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default UserProfile;