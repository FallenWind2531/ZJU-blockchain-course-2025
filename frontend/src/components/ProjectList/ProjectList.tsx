import React, { useState, useEffect } from 'react';
import { Card, List, Button, Tag, Progress, Space, Typography, Row, Col, message, Spin } from 'antd';
import { Link } from 'react-router-dom';
import { 
  EyeOutlined, 
  ShoppingCartOutlined, 
  ClockCircleOutlined,
  CrownOutlined,
  FireOutlined 
} from '@ant-design/icons';
import { web3Service } from '../../services/Web3Service';

const { Title, Text, Paragraph } = Typography;
const { Meta } = Card;

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

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const projectCount = await web3Service.getProjectCount();
      const projectsData: Project[] = [];

      for (let i = 0; i < projectCount; i++) {
        const project = await web3Service.getProject(i) as any;
        const betAmounts = await web3Service.getProjectBetAmounts(i);
        
        if (project) {
          projectsData.push({
            id: i,
            title: project.title,
            description: project.description,
            options: project.options,
            totalPrizePool: web3Service.getWeb3()?.utils.fromWei(project.totalPrizePool, 'ether') || '0',
            endTime: Number(project.endTime),
            isActive: project.isActive,
            isFinished: project.isFinished,
            winningOption: parseInt(project.winningOption),
            creator: project.creator,
            createTime: parseInt(project.createTime),
            betAmounts: betAmounts
          });
        }
      }

      setProjects(projectsData);
    } catch (error) {
      console.error('加载项目失败:', error);
      message.error('加载项目失败');
    }
    setLoading(false);
  };

  const formatTimeRemaining = (endTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = endTime - now;
    
    if (timeLeft <= 0) {
      return '已结束';
    }
    
    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days}天 ${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  const getTotalBets = (betAmounts: string[] = []) => {
    return betAmounts.reduce((total, amount) => total + parseFloat(amount), 0);
  };

  const getProjectStatus = (project: Project) => {
    if (project.isFinished) {
      return <Tag color="gold" icon={<CrownOutlined />}>已结束</Tag>;
    } else if (project.isActive) {
      const now = Math.floor(Date.now() / 1000);
      if (project.endTime > now) {
        return <Tag color="green" icon={<FireOutlined />}>进行中</Tag>;
      } else {
        return <Tag color="orange" icon={<ClockCircleOutlined />}>待开奖</Tag>;
      }
    } else {
      return <Tag color="red">已暂停</Tag>;
    }
  };

  const getPopularityLevel = (totalBets: number) => {
    if (totalBets > 50) return { level: '火爆', color: '#ff4d4f' };
    if (totalBets > 20) return { level: '热门', color: '#fa8c16' };
    if (totalBets > 5) return { level: '普通', color: '#52c41a' };
    return { level: '冷门', color: '#1890ff' };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>正在加载竞猜项目...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <Title level={2}>🎯 竞猜项目大厅</Title>
        <Paragraph type="secondary">
          选择您感兴趣的竞猜项目，购买彩票参与预测，赢取丰厚奖池！
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        {projects.map((project) => {
          const totalBets = getTotalBets(project.betAmounts);
          const popularity = getPopularityLevel(totalBets);
          
          return (
            <Col xs={24} sm={12} lg={8} key={project.id}>
              <Card
                hoverable
                actions={[
                  <Link to={`/project/${project.id}`} key="view">
                    <Button type="primary" icon={<EyeOutlined />}>
                      查看详情
                    </Button>
                  </Link>,
                  <Link to={`/project/${project.id}`} key="bet">
                    <Button type="default" icon={<ShoppingCartOutlined />}>
                      立即投注
                    </Button>
                  </Link>
                ]}
                cover={
                  <div style={{ 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    height: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px'
                  }}>
                    🎲
                  </div>
                }
              >
                <Meta
                  title={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong ellipsis style={{ maxWidth: '70%' }}>
                          {project.title}
                        </Text>
                        {getProjectStatus(project)}
                      </div>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text ellipsis>{project.description}</Text>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Text strong style={{ color: '#1890ff' }}>
                          奖池: {parseFloat(project.totalPrizePool).toFixed(0)} LT积分
                        </Text>
                        <Tag color={popularity.color}>
                          {popularity.level}
                        </Tag>
                      </div>

                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          <ClockCircleOutlined /> 剩余时间: {formatTimeRemaining(project.endTime)}
                        </Text>
                      </div>

                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          总投注: {totalBets.toFixed(0)} LT积分
                        </Text>
                        <Progress 
                          percent={Math.min((totalBets / parseFloat(project.totalPrizePool)) * 100, 100)} 
                          size="small" 
                          showInfo={false}
                          style={{ marginTop: '4px' }}
                        />
                      </div>

                      <div style={{ marginTop: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          选项数量: {project.options.length} 个
                        </Text>
                      </div>
                    </Space>
                  }
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      {projects.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Text type="secondary">暂无竞猜项目</Text>
        </div>
      )}
    </div>
  );
};

export default ProjectList;