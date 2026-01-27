import { BaseDialog } from "./BaseDialog"
import { useStore } from "zustand"
import { useEffect, useState } from "react"
import { AuthingQRCode } from "./AuthingQRCode";
import { t } from '@sdppp/common';
import { mcpMesh } from "@sdppp/ps-uxp/src/mesh/mesh";

export function AuthingLoginDialog() {
    const sdkNode = mcpMesh.getNode('sdk');
    const requestingLogin = useStore(
        mcpMesh.store,
        (state) => (state as any).requestingLogin ?? false
    )
    const isLogin = useStore(sdkNode.store, (state) => (state as any).isLogin)
    const isGuest = useStore(sdkNode.store, (state) => (state as any).isGuest)
    const token = useStore(sdkNode.store, (state) => (state as any).token)
    const userInfo = useStore(sdkNode.store, (state) => (state as any).userInfo)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loginError, setLoginError] = useState('')
    const [loginLoading, setLoginLoading] = useState(false)

    // 根据token获取用户信息
    useEffect(() => {
        if (isLogin && token && !userInfo) {
            sdkNode.actions.authGetUserProfile({ token }).catch(() => {})
        }
    }, [isLogin, token, userInfo])

    const handleLogout = () => {
        sdkNode.actions.authLogout({}).catch(() => {});
    }

    const handleEmailLogin = async () => {
        if (!email || !password) {
            setLoginError('请输入邮箱和密码');
            return;
        }

        setLoginLoading(true);
        setLoginError('');
        try {
            await sdkNode.actions.authLogin({
                passwordPayload: {
                    email,
                    password,
                }
            } as any);

            mcpMesh.store.setState({ requestingLogin: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : '登录失败';
            setLoginError(message);
        } finally {
            setLoginLoading(false);
        }
    }

    return (
        <BaseDialog className="w-[48rem] h-[32rem]" show={requestingLogin} setShow={() => {
            mcpMesh.store.setState({ requestingLogin: false })
        }}>
            {
                isLogin || isGuest ? (
                    <div className="p-6 rounded-lg shadow-lg w-full mx-auto">
                        <div className="text-center mb-6">
                            <h2 style={{ color: 'var(--uxp-host-text-color)' }} className="text-2xl font-bold mb-2">{t('auth.login_success')}</h2>
                            <div style={{ color: 'var(--uxp-host-text-color-secondary)' }}>
                                {isGuest ? <p className="mb-1">{t('auth.guest_login_success')}</p> : userInfo?.username && (
                                    <p className="mb-1">{t('auth.username_label', { username: userInfo.username })}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <button
                                onClick={handleLogout}
                                style={{
                                    backgroundColor: 'var(--uxp-host-widget-hover-background-color)',
                                    color: 'var(--uxp-host-text-color)',
                                    border: '1px solid var(--uxp-host-border-color)'
                                }}
                                className="px-6 py-2 rounded-lg transition-colors hover:opacity-80"
                            >
                                {t('auth.logout')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full w-full gap-6 p-6">
                        <div
                            className="flex w-1/2 flex-col justify-center rounded-lg border p-6"
                            style={{
                                borderColor: 'var(--uxp-host-border-color)',
                                backgroundColor: 'var(--uxp-host-background-color)'
                            }}
                        >
                            <div className="mb-6 text-center">
                                <h2 style={{ color: 'var(--uxp-host-text-color)' }} className="text-xl font-bold mb-2">邮箱登录</h2>
                                <p style={{ color: 'var(--uxp-host-text-color-secondary)' }} className="text-sm">使用邮箱和密码登录</p>
                            </div>
                            <sp-textfield
                                label="邮箱"
                                type="email"
                                value={email}
                                placeholder="name@example.com"
                                onInput={(event: any) => setEmail(event.currentTarget.value)}
                                class="mb-4 w-full"
                            ></sp-textfield>
                            <sp-textfield
                                label="密码"
                                type="password"
                                value={password}
                                placeholder="请输入密码"
                                onInput={(event: any) => setPassword(event.currentTarget.value)}
                                class="mb-4 w-full"
                            ></sp-textfield>
                            {loginError ? (
                                <div className="mb-3 text-sm" style={{ color: '#e76f51' }}>{loginError}</div>
                            ) : null}
                            <sp-action-button
                                onClick={handleEmailLogin}
                                class="px-4 py-2 rounded text-sm font-medium w-full"
                                disabled={loginLoading}
                            >
                                {loginLoading ? '登录中...' : '登录'}
                            </sp-action-button>
                        </div>
                        <div className="flex w-1/2 items-center justify-center rounded-lg border"
                            style={{
                                borderColor: 'var(--uxp-host-border-color)',
                                backgroundColor: 'var(--uxp-host-background-color)'
                            }}
                        >
                            <div className="w-full">
                                <AuthingQRCode />
                            </div>
                        </div>
                    </div>
                )
            }
        </BaseDialog>
    )
}
