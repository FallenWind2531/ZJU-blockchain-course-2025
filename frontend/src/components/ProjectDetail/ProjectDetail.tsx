import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Card, 
  Row, 
  Col, 
  Button, 
  Progress, 
  Tag, 
  Typography, 
  Space, 
  Input, 
  Radio, 
  message, 
  Modal, 
  Descriptions,
  Table,
  Tabs,
  Statistic,
  Divider
} from 'antd';
import { 
  ArrowLeftOutlined, 
  ShoppingCartOutlined, 
  CrownOutlined, 
  ClockCircleOutlined,
  DollarOutlined,
  BookOutlined,
  FireOutlined
} from '@ant-design/icons';
import { web3Service } from '../../services/Web3Service';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface Project {
  id: number;
  title: string;
  description: string;
  options: string[];
  totalPrizePool: string;
  endTime: number;
  isActive: boolean;
  isFinished: boolean;
  winningOption: number;
  creator: string;
  createTime: number;
  betAmounts?: string[];
}

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const [betAmount, setBetAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'eth' | 'token'>('token');
  const [buyModalVisible, setBuyModalVisible] = useState<boolean>(false);
  const [sellOrders, setSellOrders] = useState<any[]>([]);
  const [userTickets, setUserTickets] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadProjectDetail();
      loadSellOrders();
      loadUserTickets();
    }
  }, [id]);

  const loadProjectDetail = async () => {
    setLoading(true);
    try {
      const projectData = await web3Service.getProject(parseInt(id!)) as any;
      const betAmounts = await web3Service.getProjectBetAmounts(parseInt(id!));
      
      if (projectData) {
        setProject({
          id: parseInt(id!),
          title: projectData.title,
          description: projectData.description,
          options: projectData.options,
          totalPrizePool: web3Service.getWeb3()?.utils.fromWei(projectData.totalPrizePool, 'ether') || '0',
          endTime: Number(projectData.endTime),
          isActive: projectData.isActive,
          isFinished: projectData.isFinished,
          winningOption: parseInt(projectData.winningOption),
          creator: projectData.creator,
          createTime: Number(projectData.createTime),
          betAmounts: betAmounts
        });
      }
    } catch (error) {
      console.error('加载项目详情失败:', error);
      message.error('加载项目详情失败');
    }
    setLoading(false);
  };

  const loadSellOrders = async () => {
    try {
      const orders = await web3Service.getActiveSellOrders(parseInt(id!));
      setSellOrders(orders);
    } catch (error) {
      console.error('加载订单簿失败:', error);
    }
  };

  const loadUserTickets = async () => {
    const account = web3Service.getCurrentAccount();
    if (!account) return;
    
    try {
      const tickets = await web3Service.getUserTickets(account);
      const projectTickets = tickets.filter(ticket => parseInt(ticket.projectId) === parseInt(id!));
      setUserTickets(projectTickets);
    } catch (error) {
      console.error('加载用户彩票失败:', error);
    }
  };

  const handleBuyTicket = async () => {
    if (!betAmount || parseFloat(betAmount) <= 0) {
      message.error('请输入有效的投注金额');
      return;
    }

    try {
      let success = false;
      
      success = await web3Service.buyTicket(parseInt(id!), selectedOption, betAmount);

      if (success) {
        message.success('购买彩票成功！');
        setBuyModalVisible(false);
        setBetAmount('');
        loadProjectDetail();
        loadUserTickets();
      } else {
        message.error('购买失败！');
      }
    } catch (error) {
      message.error('购买失败！');
    }
  };

  const handleBuyFromOrder = async (orderId: number, price: string) => {
    try {
      const success = await web3Service.buyFromOrder(orderId, price);
      if (success) {
        message.success('购买成功！');
        loadSellOrders();
        loadUserTickets();
      } else {
        message.error('购买失败！');
      }
    } catch (error) {
      message.error('购买失败！');
    }
  };

  const formatTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = endTime - now;
    
    if (timeLeft <= 0) return '已结束';
    
    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
    
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分钟`;
    return `${minutes}分钟`;
  };

  const getTotalBets = () => {
    if (!project?.betAmounts) return 0;
    return project.betAmounts.reduce((total, amount) => total + parseFloat(amount), 0);
  };

  const getOptionPercentage = (optionIndex: number) => {
    if (!project?.betAmounts) return 0;
    const total = getTotalBets();
    if (total === 0) return 0;
    return (parseFloat(project.betAmounts[optionIndex]) / total) * 100;
  };

  const orderColumns = [
    {
      title: '彩票ID',
      dataIndex: 'ticketId',
      key: 'ticketId',
    },
    {
      title: '价格 (ETH)',
      dataIndex: 'price',
      key: 'price',
      render: (price: string) => `${parseFloat(price).toFixed(4)} ETH`,
    },
    {
      title: '卖家',
      dataIndex: 'seller',
      key: 'seller',
      render: (seller: string) => `${seller.substring(0, 6)}...${seller.substring(seller.length - 4)}`,
    },
    {
      title: '操作',
      key: 'action',
      render: (record: any) => (
        <Button 
          type="primary" 
          size="small"
          onClick={() => handleBuyFromOrder(record.orderId, record.price)}
        >
          购买
        </Button>
      ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>;
  }

  if (!project) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>项目不存在</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/">
          <Button icon={<ArrowLeftOutlined />}>返回项目列表</Button>
        </Link>
      </div>

      <Card>
        <Row gutter={[24, 24]}>
          <Col span={16}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={2}>{project.title}</Title>
                <Space>
                  <Tag color={project.isFinished ? 'gold' : project.isActive ? 'green' : 'red'}>
                    {project.isFinished ? '已结束' : project.isActive ? '进行中' : '已暂停'}
                  </Tag>
                  {project.isFinished && (
                    <Tag color="purple" icon={<CrownOutlined />}>
                      获胜选项: {project.options[project.winningOption]}
                    </Tag>
                  )}
                </Space>
              </div>

              <Paragraph>{project.description}</Paragraph>

              <Descriptions bordered>
                <Descriptions.Item label="奖池金额">{parseFloat(project.totalPrizePool).toFixed(0)} LT积分</Descriptions.Item>
                <Descriptions.Item label="总投注">{getTotalBets().toFixed(0)} LT积分</Descriptions.Item>
                <Descriptions.Item label="剩余时间">
                  <ClockCircleOutlined /> {formatTimeRemaining(project.endTime)}
                </Descriptions.Item>
                <Descriptions.Item label="创建者" span={3}>
                  {project.creator.substring(0, 6)}...{project.creator.substring(project.creator.length - 4)}
                </Descriptions.Item>
              </Descriptions>

              <div>
                <Title level={4}>投注选项</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {project.options.map((option, index) => (
                    <Card key={index} size="small" style={{ width: '100%' }}>
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Text strong>{option}</Text>
                        </Col>
                        <Col>
                          <Space>
                            <Text type="secondary">
                              {parseFloat(project.betAmounts?.[index] || '0').toFixed(0)} LT积分 ({getOptionPercentage(index).toFixed(1)}%)
                            </Text>
                            <Progress 
                              percent={getOptionPercentage(index)} 
                              size="small" 
                              style={{ width: '100px' }}
                            />
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </Space>
              </div>
            </Space>
          </Col>

          <Col span={8}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card title="💰 快速投注">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>选择选项:</Text>
                    <Radio.Group 
                      value={selectedOption} 
                      onChange={(e) => setSelectedOption(e.target.value)}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      <Space direction="vertical">
                        {project.options.map((option, index) => (
                          <Radio key={index} value={index}>{option}</Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  </div>

                  <Button 
                    type="primary" 
                    size="large" 
                    block
                    icon={<ShoppingCartOutlined />}
                    disabled={!project.isActive || project.isFinished}
                    onClick={() => setBuyModalVisible(true)}
                  >
                    {project.isFinished ? '竞猜已结束' : !project.isActive ? '竞猜已暂停' : '立即投注'}
                  </Button>
                </Space>
              </Card>

              <Card title="📊 统计信息">
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="总奖池"
                      value={parseFloat(project.totalPrizePool)}
                      precision={0}
                      suffix="LT积分"
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="总投注"
                      value={getTotalBets()}
                      precision={0}
                      suffix="LT积分"
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Col>
                </Row>
              </Card>

              <Link to={`/orderbook/${project.id}`}>
                <Button block icon={<BookOutlined />}>
                  查看订单簿
                </Button>
              </Link>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: '24px' }}>
        <Tabs>
          <TabPane tab="二级市场" key="market">
            <Table 
              columns={orderColumns}
              dataSource={sellOrders}
              size="small"
              pagination={false}
              locale={{ emptyText: '暂无售卖订单' }}
            />
          </TabPane>
          <TabPane tab="我的彩票" key="tickets">
            {userTickets.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {userTickets.map((ticket, index) => (
                  <Card key={index} size="small">
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Text>票号: #{ticket.tokenId}</Text><br />
                        <Text type="secondary">选项: {project.options[ticket.optionId]}</Text><br />
                        <Text type="secondary">投注: {parseFloat(web3Service.getWeb3()?.utils.fromWei(ticket.betAmount, 'ether') || '0').toFixed(0)} LT积分</Text>
                      </Col>
                      <Col>
                        {project.isFinished ? (
                          parseInt(ticket.optionId) === project.winningOption ? (
                            <Tag color="gold" icon={<CrownOutlined />}>
                              已中奖 - 奖金已自动发放
                            </Tag>
                          ) : (
                            <Tag color="red">未中奖</Tag>
                          )
                        ) : (
                          <Button 
                            size="small" 
                            onClick={() => {
                              // 导航到用户资料页面的彩票管理
                              window.location.href = '/profile#tickets';
                            }}
                          >
                            出售
                          </Button>
                        )}
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Space>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Text type="secondary">您还没有购买此项目的彩票</Text>
              </div>
            )}
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="购买彩票"
        open={buyModalVisible}
        onCancel={() => setBuyModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setBuyModalVisible(false)}>
            取消
          </Button>,
          <Button key="buy" type="primary" onClick={handleBuyTicket}>
            确认购买
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>选择的选项:</Text>
            <div style={{ marginTop: '8px' }}>
              <Tag color="blue">{project.options[selectedOption]}</Tag>
            </div>
          </div>

          <div>
            <Text strong>支付方式:</Text>
            <div style={{ marginTop: '8px' }}>
              <Tag color="blue">仅支持LT积分代币投注</Tag>
            </div>
          </div>

          <div>
            <Text strong>投注金额:</Text>
            <Input
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="输入投注金额"
              suffix="LT积分"
              style={{ marginTop: '8px' }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default ProjectDetail;