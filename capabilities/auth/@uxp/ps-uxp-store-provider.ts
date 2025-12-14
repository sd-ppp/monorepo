// 蜂鸟登录Provider插件入口文件
// 这个文件会被通用插件系统自动发现和加载
// 约定：必须导出 execute 函数

import { PSUXPInternalStore } from '@sdppp/ps-uxp/src/logics/PSUXPInternalStore';
import { SDPPPLoginProvider } from './src/SDPPPLoginProvider';
import { mcpMesh } from '@sdppp/ps-uxp/src/mesh/mesh';
import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';
/**
 * 插件执行函数 - 通用插件系统约定接口
 */
export async function execute() {
  const tenantid = mcpMesh.store.getState().sdpppX.tenantid
  if (!tenantid) {
    return
  }
  const tenantInfo = loadRemoteConfig('tenant');

  if (tenantInfo.name_chn) { 
    PSUXPInternalStore.setState({
      headerTitle: tenantInfo.name_chn
    });
  }
  
  if (!tenantInfo.authing_id) {
    throw new Error('tenantInfo.authing_id is required');
  }
  // 创建并设置蜂鸟登录Provider
  const provider = new SDPPPLoginProvider(tenantInfo.authing_id);
  PSUXPInternalStore.setState({
    loginProvider: provider,
  });

  console.log('🐦 登录Provider已设置');
}