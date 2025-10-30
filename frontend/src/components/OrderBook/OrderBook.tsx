import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Button, 
  Typography, 
  Space, 
  message, 
  Statistic,
  Row,
  Col,
  Tag,
  Divider
} from 'antd';
import { 
  ArrowLeftOutlined, 
  ShoppingCartOutlined,
  DollarOutlined,
  BookOutlined
} from '@ant-design/icons';
import { web3Service } from '../../services/Web3Service';

const { Title, Text } = Typography;

interface SellOrder {
  orderId: number;
  ticketId: string;
  price: string;
  seller: string;
  isActive: boolean;
  ticketInfo?: any;
}

const OrderBook: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [sellOrders, setSellOrders] = useState<SellOrder[]>([]);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (projectId) {
      loadOrderBook();
      loadProject();
    }
  }, [projectId]);

  const loadProject = async () => {
    try {
      const projectData = await web3Service.getProject(parseInt(projectId!)) as any;
      setProject(projectData);
    } catch (error) {
      console.error('加载项目失败:', error);
    }
  };

  const loadOrderBook = async () => {
    setLoading(true);
    try {
      const orders = await web3Service.getActiveSellOrders(parseInt(projectId!));
      
      // 为每个订单加载彩票信息
      const ordersWithTicketInfo = await Promise.all(
        orders.map(async (order, index) => {
          try {
            const ticketContract = web3Service.getLotteryTicketContract();
            const ticketInfo = await ticketContract.methods.getTicketInfo(order.ticketId).call();
            return {
              ...order,
              orderId: index,
              ticketInfo
            };
          } catch (error) {
            return {
              ...order,
              orderId: index
            };
          }
        })
      );
      
      // 首先按选项ID排序，然后同选项内按价格升序排序
      const sortedOrders = ordersWithTicketInfo.sort((a, b) => {
        // 如果有ticketInfo，按选项ID排序
        if (a.ticketInfo && b.ticketInfo) {
          const optionA = parseInt(a.ticketInfo.optionId);
          const optionB = parseInt(b.ticketInfo.optionId);
          
          // 首先按选项ID排序
          if (optionA !== optionB) {
            return optionA - optionB;
          }
          
          // 同选项内按价格升序排序
          return parseFloat(a.price) - parseFloat(b.price);
        }
        
        // 如果没有ticketInfo，只按价格排序
        return parseFloat(a.price) - parseFloat(b.price);
      });
      
      setSellOrders(sortedOrders);
    } catch (error) {
      console.error('加载订单簿失败:', error);
      message.error('加载订单簿失败');
    }
    setLoading(false);
  };

  const handleBuyFromOrder = async (orderId: number, price: string) => {
    try {
      const success = await web3Service.buyFromOrder(orderId, price);
      if (success) {
        message.success('购买成功！');
        loadOrderBook();
      } else {
        message.error('购买失败！');
      }
    } catch (error) {
      message.error('购买失败！');
    }
  };

  const columns = [
    {
      title: '彩票ID',
      dataIndex: 'ticketId',
      key: 'ticketId',
      render: (ticketId: string) => (
        <Text strong>#{ticketId}</Text>
      ),
    },
    {
      title: '选项',
      key: 'option',
      render: (record: SellOrder) => {
        if (record.ticketInfo && project) {
          const optionIndex = parseInt(record.ticketInfo.optionId);
          // 使用不同颜色来区分不同选项
          const colors = ['blue', 'green', 'orange', 'red', 'purple', 'cyan'];
          const color = colors[optionIndex % colors.length];
          return (
            <Tag color={color}>
              选项 {optionIndex + 1}: {project.options[optionIndex]}
            </Tag>
          );
        }
        return <Text type="secondary">加载中...</Text>;
      },
    },
    {
      title: '原投注',
      key: 'originalBet',
      render: (record: SellOrder) => {
        if (record.ticketInfo) {
          const amount = web3Service.getWeb3()?.utils.fromWei(record.ticketInfo.betAmount, 'ether');
          return <Text>{parseFloat(amount || '0').toFixed(0)} LT积分</Text>;
        }
        return <Text type="secondary">加载中...</Text>;
      },
    },
    {
      title: '售价',
      dataIndex: 'price',
      key: 'price',
      render: (price: string) => (
        <Text strong style={{ color: '#52c41a' }}>
          {parseFloat(price).toFixed(4)} ETH
        </Text>
      ),
    },
    {
      title: '卖家',
      dataIndex: 'seller',
      key: 'seller',
      render: (seller: string) => (
        <Text code>
          {seller.substring(0, 6)}...{seller.substring(seller.length - 4)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (record: SellOrder) => {
        const currentAccount = web3Service.getCurrentAccount();
        const isOwnOrder = currentAccount && record.seller.toLowerCase() === currentAccount.toLowerCase();
        
        return (
          <Button 
            type="primary" 
            size="small"
            icon={<ShoppingCartOutlined />}
            disabled={!!isOwnOrder}
            onClick={() => handleBuyFromOrder(record.orderId, record.price)}
          >
            {isOwnOrder ? '自己的订单' : '立即购买'}
          </Button>
        );
      },
    },
  ];

  // 计算统计数据
  const totalOrders = sellOrders.length;
  const averagePrice = sellOrders.length > 0 
    ? sellOrders.reduce((sum, order) => sum + parseFloat(order.price), 0) / sellOrders.length 
    : 0;
  const lowestPrice = sellOrders.length > 0 
    ? Math.min(...sellOrders.map(order => parseFloat(order.price)))
    : 0;
  const highestPrice = sellOrders.length > 0 
    ? Math.max(...sellOrders.map(order => parseFloat(order.price)))
    : 0;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to={`/project/${projectId}`}>
          <Button icon={<ArrowLeftOutlined />}>返回项目详情</Button>
        </Link>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <Title level={3} style={{ marginBottom: '16px' }}>
          <BookOutlined /> 订单簿 - {project?.title || '加载中...'}
        </Title>
        
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="挂单数量"
              value={totalOrders}
              suffix="个"
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="最低价"
              value={lowestPrice}
              precision={4}
              suffix="ETH"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="最高价"
              value={highestPrice}
              precision={4}
              suffix="ETH"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="平均价"
              value={averagePrice}
              precision={4}
              suffix="ETH"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <div style={{ marginBottom: '16px' }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>活跃订单</Title>
            <Tag color="processing">实时更新</Tag>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={sellOrders}
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          locale={{ 
            emptyText: '暂无挂单订单' 
          }}
        />

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical">
            <Text type="secondary">
              💡 提示：购买他人出售的彩票可以获得不同的投注选项和价格优势
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              订单按选项分组，同选项内按价格升序排序
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default OrderBook;