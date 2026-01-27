import { Alert, Button, Flex, Form, Input, message, Typography } from 'antd';
import { useStore } from 'zustand';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { sdpppSDK } from '@sdppp/common';
import { authActions } from '../authStore';
import { AuthService } from '../AuthService';
import './Login.less';

const { Text } = Typography;

interface LoginFormValues {
  username: string;
  password: string;
}

interface LoginProps {
  logoUrl?: string;
}

export const Login: React.FC<LoginProps> = ({ logoUrl }) => {
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);
  const loginMessage = useStore(
    sdpppSDK.stores.WebviewStore,
    state => state.loginMessage,
  );

  const handleLogin = async (values: LoginFormValues) => {
    setLoading(true);
    authActions.setLoginMessage('');
    try {
      const result = await AuthService.login({
        passwordPayload: {
          identifier: values.username,
          password: values.password,
        },
      });
      
      authActions.setAuthState({
        isLogin: true,
        token: result.token,
        userInfo: result as any,
        isGuest: false,
      });
      
      message.success('登录成功');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '登录失败';
      authActions.setLoginMessage(errorMsg);
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      authActions.setAuthState({
        isGuest: true,
        isLogin: false,
        token: '',
        userInfo: {},
      });
      message.success('以游客身份登录');
    } catch (error) {
      console.error('[Login] guest login failed', error);
      message.error('游客登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProjectLink = () => {
    sdpppSDK.plugins.photoshop.openExternalLink({
      url: 'https://github.com/zombieyang/sd-ppp',
    });
  };

  return (
    <div className="login-panel">
      {logoUrl && (
        <Flex justify="center" align="center">
          <div style={{ width: 128, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src={logoUrl}
              alt="SD-PPP"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </Flex>
      )}
      <div className="login-form-container">
        {loginMessage ? (
          <Alert className="login-alert" message={loginMessage} type="error" showIcon closable />
        ) : null}
        <Form<LoginFormValues>
          form={form}
          name="sdppp-login"
          onFinish={handleLogin}
          autoComplete="off"
          layout="vertical"
          className="login-form"
        >
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input
              placeholder="请输入用户名"
              size="large"
              className="login-input"
            />
          </Form.Item>
          <Form.Item
            label="登录密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              placeholder="请输入密码"
              size="large"
              className="login-input"
              iconRender={visible => (visible ? <Eye size={16} /> : <EyeOff size={16} />)}
            />
          </Form.Item>
          <Form.Item className="login-button-item">
            <Button
              htmlType="submit"
              loading={loading}
              block
              type="primary"
              size="large"
              className="login-button"
            >
              登录
            </Button>
          </Form.Item>
        </Form>
        <div className="login-tips" style={{textAlign: 'center'}}>
          <Text style={{ color: '#60bdb2' }}>
            注册购买加微信: ccfk2023
          </Text>
        </div>
        <div className="login-footer">
          <Text>
            本插件基于
            <Typography.Link onClick={handleOpenProjectLink}>SD-PPP</Typography.Link>
            定制
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Login;
