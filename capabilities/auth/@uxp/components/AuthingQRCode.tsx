import { useStore } from "zustand";
import { useState, useEffect, useRef } from "react";
import { mcpMesh } from "@sdppp/ps-uxp/src/mesh/mesh";

export function AuthingQRCode() {
    return <div className="p-6 rounded-lg shadow-lg w-full mx-auto">
        <div className="text-center mb-6">
            <h2 style={{ color: 'var(--uxp-host-text-color)' }} className="text-2xl font-bold mb-4">微信登录</h2>
        </div>
        <div className="flex justify-center">
            <AuthingQRCodeLogic />
        </div>
    </div>;
}


function AuthingQRCodeLogic() {
    const sdkNode = mcpMesh.getNode('sdk');
    const isLogin = useStore(sdkNode.store, (state) => (state as any).isLogin)
    const requestingLogin = useStore(
        mcpMesh.store,
        (state) => (state as any).requestingLogin ?? false
    )
    const [qrcodeURL, setQrcodeURL] = useState<string>('')
    const [prevRequestingLogin, setPrevRequestingLogin] = useState<boolean>(false)
    const [qrStatus, setQrStatus] = useState<'loading' | 'ready' | 'scanned' | 'expired' | 'error' | 'cancel'>('loading')
    const pollIdRef = useRef(0)

    // 提取公共样式
    const buttonStyle = {
        backgroundColor: 'var(--uxp-host-widget-hover-background-color)',
        color: 'var(--uxp-host-text-color)',
        border: '1px solid var(--uxp-host-border-color)'
    }

    const containerStyle = {
        backgroundColor: 'var(--uxp-host-background-color)'
    }

    const iconContainerStyle = {
        backgroundColor: 'var(--uxp-host-widget-hover-background-color)'
    }

    const textColorStyle = {
        color: 'var(--uxp-host-text-color)'
    }

    const secondaryTextColorStyle = {
        color: 'var(--uxp-host-text-color-secondary)'
    }

    // 提取公共图标容器组件
    const StatusIcon = ({ children }: { children: React.ReactNode }) => (
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={iconContainerStyle}>
            <svg className="w-8 h-8" style={textColorStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {children}
            </svg>
        </div>
    )

    // 提取二维码生成和轮询逻辑
    const generateAndPollQRCode = async () => { 
        const pollId = ++pollIdRef.current
        setQrStatus('loading')
        setQrcodeURL('')
        try { 
            let response: any = await sdkNode.actions.authLoginByQRCode({});
            if (pollIdRef.current !== pollId) {
                return;
            }
            setQrcodeURL(response.qrcodeURL);
            setQrStatus(response.status as any);

            while (!['success', 'cancel', 'expired', 'error'].includes(response.status)) {
                if (pollIdRef.current !== pollId) {
                    return;
                }
                response = await sdkNode.actions.authLoginByQRCode({ sessionId: response.sessionId });
                if (pollIdRef.current !== pollId) {
                    return;
                }
                setQrcodeURL(response.qrcodeURL);
                setQrStatus(response.status as any);
            }

            if (pollIdRef.current === pollId) {
                mcpMesh.store.setState({ requestingLogin: false });
            }
        } catch (error) {
            if (pollIdRef.current !== pollId) {
                return;
            }
            console.error('Failed to generate QR code:', error);
            setQrStatus('error');
            mcpMesh.store.setState({ requestingLogin: false });
        }
    }

    useEffect(() => {
        if (!isLogin && requestingLogin && !prevRequestingLogin) {
            generateAndPollQRCode()
        }
        setPrevRequestingLogin(requestingLogin)
    }, [isLogin, requestingLogin]);

    useEffect(() => {
        if (!requestingLogin) {
            pollIdRef.current += 1;
        }
        return () => {
            pollIdRef.current += 1;
        };
    }, [requestingLogin]);

    const handleRefresh = () => {
        generateAndPollQRCode()
    }

    const renderQRContent = () => {
        switch (qrStatus) {
            case 'loading':
                return (
                    <div className="w-64 h-64 rounded-lg flex items-center justify-center" style={containerStyle}>
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--uxp-host-text-color)' }}></div>
                            <p style={secondaryTextColorStyle}>正在生成二维码...</p>
                        </div>
                    </div>
                )
            case 'ready':
                return (
                    <div className="w-64 h-64 rounded-lg flex items-center justify-center" style={containerStyle}>
                        <img src={qrcodeURL} alt="qrcode" className="w-full h-full" />
                    </div>
                )
            case 'scanned':
                return (
                    <div className="w-64 h-64 rounded-lg flex items-center justify-center" style={containerStyle}>
                        <div className="text-center">
                            <StatusIcon>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </StatusIcon>
                            <p style={textColorStyle} className="font-medium mb-2">已扫描</p>
                            <p style={secondaryTextColorStyle} className="text-sm">请在手机上确认登录</p>
                        </div>
                    </div>
                )
            case 'expired':
                return (
                    <div className="w-64 h-64 rounded-lg flex items-center justify-center" style={containerStyle}>
                        <div className="text-center">
                            <StatusIcon>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </StatusIcon>
                            <p style={textColorStyle} className="font-medium mb-2">二维码已过期</p>
                            <p style={secondaryTextColorStyle} className="text-sm mb-4">请点击刷新重新生成</p>
                            <button
                                onClick={handleRefresh}
                                style={buttonStyle}
                                className="px-4 py-2 rounded-lg transition-colors hover:opacity-80 text-sm"
                            >
                                刷新二维码
                            </button>
                        </div>
                    </div>
                )
            case 'error':
                return (
                    <div className="w-64 h-64 rounded-lg flex items-center justify-center" style={containerStyle}>
                        <div className="text-center">
                            <StatusIcon>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </StatusIcon>
                            <p style={textColorStyle} className="font-medium mb-2">生成失败</p>
                            <p style={secondaryTextColorStyle} className="text-sm mb-4">请检查网络连接后重试</p>
                            <button
                                onClick={handleRefresh}
                                style={buttonStyle}
                                className="px-4 py-2 rounded-lg transition-colors hover:opacity-80 text-sm"
                            >
                                重新生成
                            </button>
                        </div>
                    </div>
                )
            case 'cancel':
                return (
                    <div className="w-64 h-64 rounded-lg flex items-center justify-center" style={containerStyle}>
                        <div className="text-center">
                            <StatusIcon>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </StatusIcon>
                            <p style={textColorStyle} className="font-medium mb-2">已取消</p>
                            <p style={secondaryTextColorStyle} className="text-sm mb-4">扫码登录已取消</p>
                            <button
                                onClick={handleRefresh}
                                style={buttonStyle}
                                className="px-4 py-2 rounded-lg transition-colors hover:opacity-80 text-sm"
                            >
                                重新扫码
                            </button>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    return renderQRContent()
}
