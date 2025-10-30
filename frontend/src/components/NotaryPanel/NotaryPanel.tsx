import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Tabs, 
  Button, 
  Form, 
  Input, 
  Select, 
  InputNumber,
  Space, 
  Typography, 
  Statistic,
  Row,
  Col,
  Table,
  Modal,
  message,
  Divider,
  Tag,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  CheckCircleOutlined,
  DollarOutlined,
  CrownOutlined,
  BankOutlined,
  GiftOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { web3Service } from '../../services/Web3Service';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface NotaryPanelProps {
  account: string | null;
}

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
}

const NotaryPanel: React.FC<NotaryPanelProps> = ({ account }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [contractEthBalance, setContractEthBalance] = useState<string>('0');
  const [notaryLTBalance, setNotaryLTBalance] = useState<string>('0');
  const [projects, setProjects] = useState<Project[]>([]);
  const [createProjectForm] = Form.useForm();
  const [finishProjectForm] = Form.useForm();
  const [mintTokensForm] = Form.useForm();
  const [ethManageForm] = Form.useForm();
  const [createProjectModalVisible, setCreateProjectModalVisible] = useState<boolean>(false);
  const [finishProjectModalVisible, setFinishProjectModalVisible] = useState<boolean>(false);
  const [currentFinishingProject, setCurrentFinishingProject] = useState<Project | null>(null);

  useEffect(() => {
    if (account) {
      loadDashboardData();
    }
  }, [account]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadContractBalance(),
        loadNotaryLTBalance(),
        loadAllProjects()
      ]);
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
    }
    setLoading(false);
  };

  const loadContractBalance = async () => {
    try {
      const balance = await web3Service.getContractEthBalance();
      setContractEthBalance(balance);
    } catch (error) {
      console.error('获取合约余额失败:', error);
    }
  };

  const loadNotaryLTBalance = async () => {
    try {
      if (account) {
        const balance = await web3Service.getTokenBalance(account);
        setNotaryLTBalance(balance);
      }
    } catch (error) {
      console.error('获取公证人LT余额失败:', error);
    }
  };

  const loadAllProjects = async () => {
    try {
      const projectCount = await web3Service.getProjectCount();
      const projectsData: Project[] = [];

      for (let i = 0; i < projectCount; i++) {
        const project = await web3Service.getProject(i) as any;
        if (project) {
          projectsData.push({
            id: i,
            title: project.title,
            description: project.description,
            options: project.options,
            totalPrizePool: web3Service.getWeb3()?.utils.fromWei(project.totalPrizePool, 'ether') || '0',
            endTime: parseInt(project.endTime),
            isActive: project.isActive,
            isFinished: project.isFinished,
            winningOption: parseInt(project.winningOption),
            creator: project.creator,
            createTime: parseInt(project.createTime)
          });
        }
      }

      setProjects(projectsData);
    } catch (error) {
      console.error('加载项目失败:', error);
    }
  };

  const handleCreateProject = async (values: any) => {
    try {
      setLoading(true);
      const success = await web3Service.createProject(
        values.title,
        values.description,
        values.options,
        values.prizePool.toString(),
        values.duration // 直接传递小时数，让Web3Service处理转换
      );

      if (success) {
        message.success('项目创建成功！');
        createProjectForm.resetFields();
        setCreateProjectModalVisible(false);
        loadAllProjects();
        loadNotaryLTBalance(); // 刷新LT余额
      } else {
        message.error('项目创建失败！');
      }
    } catch (error: any) {
      console.error('创建项目错误:', error);
      
      // 检查是否是余额不足的错误
      if (error?.message && error.message.includes('余额不足')) {
        message.error({
          content: error.message,
          duration: 5,
        });
      } else if (error?.message && error.message.includes('User denied')) {
        message.warning('用户取消了交易');
      } else {
        message.error('项目创建失败！请检查网络连接和账户授权');
      }
    }
    setLoading(false);
  };

  const handleFinishProject = async (values: any) => {
    try {
      setLoading(true);
      const success = await web3Service.finishProject(values.projectId, values.winningOption);

      if (success) {
        message.success('项目结束成功！奖金已自动分发给获胜者！');
        finishProjectForm.resetFields();
        setFinishProjectModalVisible(false);
        setCurrentFinishingProject(null);
        loadAllProjects();
      } else {
        message.error('项目结束失败！');
      }
    } catch (error) {
      message.error('项目结束失败！');
    }
    setLoading(false);
  };

  const handleMintTokens = async (values: any) => {
    try {
      setLoading(true);
      const success = await web3Service.mintTokens(values.address, values.amount.toString());

      if (success) {
        message.success('代币铸造成功！');
        mintTokensForm.resetFields();
        loadNotaryLTBalance(); // 刷新LT余额
      } else {
        message.error('代币铸造失败！');
      }
    } catch (error) {
      message.error('代币铸造失败！');
    }
    setLoading(false);
  };



  const getProjectStatus = (project: Project) => {
    if (project.isFinished) {
      return <Tag color="gold">已结束</Tag>;
    } else if (project.isActive) {
      const now = Math.floor(Date.now() / 1000);
      if (project.endTime > now) {
        return <Tag color="green">进行中</Tag>;
      } else {
        return <Tag color="orange">待结束</Tag>;
      }
    } else {
      return <Tag color="red">已暂停</Tag>;
    }
  };

  const projectColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '项目标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '奖池(LT积分)',
      dataIndex: 'totalPrizePool',
      key: 'totalPrizePool',
      render: (value: string) => `${parseFloat(value).toFixed(0)} LT积分`,
    },
    {
      title: '状态',
      key: 'status',
      render: (record: Project) => getProjectStatus(record),
    },
    {
      title: '选项数',
      key: 'optionCount',
      render: (record: Project) => record.options.length,
    },
    {
      title: '操作',
      key: 'action',
      render: (record: Project) => (
        <Space>
          {!record.isFinished && (
            <Button 
              size="small" 
              type="primary"
              onClick={() => {
                setCurrentFinishingProject(record);
                finishProjectForm.setFieldsValue({ 
                  projectId: record.id,
                  winningOption: undefined 
                });
                setFinishProjectModalVisible(true);
              }}
            >
              结束项目
            </Button>
          )}
          {record.isFinished && (
            <Tag color="purple">
              获胜: {record.options[record.winningOption]}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <Title level={2}>👑 公证人管理面板</Title>
        <Alert
          message="欢迎使用公证人管理系统"
          description="您可以创建竞猜项目、管理资金、铸造代币等操作。请谨慎操作！"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      </div>

      {/* 仪表盘统计 */}
      <Card title="📊 系统概览" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic
              title="公证人LT余额"
              value={parseFloat(notaryLTBalance)}
              precision={2}
              suffix="LT"
              valueStyle={{ color: '#3f8600' }}
              prefix={<BankOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="总项目数"
              value={projects.length}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
              prefix={<BarChartOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="进行中项目"
              value={projects.filter(p => p.isActive && !p.isFinished).length}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="已完成项目"
              value={projects.filter(p => p.isFinished).length}
              suffix="个"
              valueStyle={{ color: '#faad14' }}
            />
          </Col>
        </Row>
      </Card>

      <Tabs defaultActiveKey="projects" type="card">
        {/* 项目管理 */}
        <TabPane tab={<span><BarChartOutlined />项目管理</span>} key="projects">
          <Card title="所有项目" extra={
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setCreateProjectModalVisible(true)}
            >
              创建项目
            </Button>
          }>
            <Table
              columns={projectColumns}
              dataSource={projects}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>

        {/* 代币管理 */}
        <TabPane tab={<span><CrownOutlined />代币管理</span>} key="tokens">
          <Card title="铸造LOTTERY代币">
            <Form 
              form={mintTokensForm}
              onFinish={handleMintTokens}
              layout="inline"
            >
              <Form.Item 
                name="address" 
                label="接收地址"
                rules={[{ required: true, message: '请输入接收地址' }]}
              >
                <Input placeholder="0x..." style={{ width: 300 }} />
              </Form.Item>
              <Form.Item 
                name="amount" 
                label="数量"
                rules={[{ required: true, message: '请输入代币数量' }]}
              >
                <InputNumber min={1} style={{ width: 150 }} />
              </Form.Item>
              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  icon={<GiftOutlined />}
                >
                  铸造代币
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>


      </Tabs>

      {/* 创建项目Modal */}
      <Modal
        title="创建新项目"
        open={createProjectModalVisible}
        onCancel={() => setCreateProjectModalVisible(false)}
        onOk={() => createProjectForm.submit()}
        confirmLoading={loading}
        width={600}
      >
        <Form 
          form={createProjectForm} 
          onFinish={handleCreateProject}
          layout="vertical"
        >
          <Form.Item 
            name="title" 
            label="项目标题"
            rules={[{ required: true, message: '请输入项目标题' }]}
          >
            <Input placeholder="输入竞猜项目标题" />
          </Form.Item>
          <Form.Item 
            name="description" 
            label="项目描述"
            rules={[{ required: true, message: '请输入项目描述' }]}
          >
            <Input.TextArea rows={3} placeholder="输入项目描述" />
          </Form.Item>
          <Form.Item 
            name="options" 
            label="竞猜选项"
            rules={[{ required: true, message: '请输入竞猜选项' }]}
          >
            <Select 
              mode="tags" 
              placeholder="输入选项后按回车添加"
              tokenSeparators={[',']}
            />
          </Form.Item>
          <Form.Item 
            name="prizePool" 
            label="奖池金额 (LT积分)"
            rules={[{ required: true, message: '请输入奖池金额' }]}
          >
            <InputNumber min={1} step={1} style={{ width: '100%' }} placeholder="输入LT积分数量" />
          </Form.Item>
          <Form.Item 
            name="duration" 
            label="持续时间 (小时)"
            rules={[{ required: true, message: '请输入持续时间' }]}
          >
            <InputNumber min={1} max={168} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 结束项目Modal */}
      <Modal
        title="结束项目"
        open={finishProjectModalVisible}
        onCancel={() => setFinishProjectModalVisible(false)}
        onOk={() => finishProjectForm.submit()}
        confirmLoading={loading}
        width={500}
      >
        <Form 
          form={finishProjectForm} 
          onFinish={handleFinishProject}
          layout="vertical"
        >
          <Form.Item name="projectId" hidden>
            <Input />
          </Form.Item>
          
          {currentFinishingProject && (
            <div style={{ marginBottom: 16 }}>
              <p><strong>项目:</strong> {currentFinishingProject.title}</p>
              <p><strong>描述:</strong> {currentFinishingProject.description}</p>
            </div>
          )}

          <Form.Item 
            name="winningOption" 
            label="获胜选项"
            rules={[{ required: true, message: '请选择获胜选项' }]}
          >
            <Select placeholder="选择获胜选项">
              {currentFinishingProject?.options.map((option, index) => (
                <Option key={index} value={index}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default NotaryPanel;