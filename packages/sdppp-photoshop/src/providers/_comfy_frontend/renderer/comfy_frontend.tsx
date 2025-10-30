import { QuestionCircleOutlined } from '@ant-design/icons';
import { sdpppSDK, useTranslation } from '@sdppp/common';
import { loadRemoteConfig } from '@sdppp/vite-remote-config-loader';
import { WidgetableProvider } from '@sdppp/widgetable-ui';
import { Alert, Button, Flex, Input, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { UploadPassProvider } from '../../base/upload-pass-context';
import { createImageMaskWidgetRegistry } from '../../base/widgetable-image-mask/widgetable-widgets';
import { ComfyCloudRecommendBanner } from './cloud_recommend';
import { WorkflowListProvider } from './comfy_frontend';
import './comfy_frontend.less';
import { ComfyFrontendRendererContent } from './components';

declare const SDPPP_VERSION: string;

export function ComfyFrontendRenderer() {
    const { t, language } = useTranslation()
    const comfyURL = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyURL);
    const comfyWebviewLoading = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyWebviewLoading);
    const comfyWebviewLoadError = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyWebviewLoadError);
    const [currentInputURL, setCurrentInputURL] = useState<string>('');
    useEffect(() => {
        if (comfyURL) {
            setCurrentInputURL(comfyURL);
        }
    }, [comfyURL]);

    return (
        <>
            <Flex gap={8} align="center">
                <Tooltip title={t('comfy.help_tooltip', { defaultMessage: 'How to use?' })} placement="left">
                    <Button
                        type="text"
                        size="small"
                        icon={<QuestionCircleOutlined />}
                        onClick={async () => {
                            const banners = loadRemoteConfig('banners');
                            const comfyURL = banners.find((banner: any) => banner.type === 'comfy_tutorial' && banner.locale == language)?.link;
                            sdpppSDK.plugins.photoshop.openExternalLink({ url: comfyURL })
                        }}
                        style={{ color: 'var(--sdppp-host-text-color-secondary)' }}
                    />
                </Tooltip>
                <Input
                    value={currentInputURL}
                    onChange={(e) => setCurrentInputURL(e.target.value)}
                />
                {!comfyURL || comfyWebviewLoading || comfyWebviewLoadError || currentInputURL !== comfyURL ?
                    <Button type="primary" onClick={() => {
                        sdpppSDK.plugins.photoshop.setComfyWebviewURL({ url: currentInputURL });
                    }}>
                        {t('comfy.connect')}
                    </Button> : null
                }
            </Flex>
            {(!comfyURL || comfyWebviewLoading || comfyWebviewLoadError || currentInputURL !== comfyURL) && <ComfyCloudRecommendBanner />}
            <WorkflowListProvider>
                <ComfyFrontendContent />
            </WorkflowListProvider>
        </>
    )
}

// 将这个函数转换为 hook，避免在 render 中重复调用
function useComfyConnectStatus() {

    const { t } = useTranslation()
    const comfyWebviewConnectStatus = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyWebviewConnectStatus);
    const comfyWebviewLoadError = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyWebviewLoadError);
    const comfyWebviewLoading = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyWebviewLoading);
    const comfyHTTPCode = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyHTTPCode);
    const comfyWebviewVersion = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyWebviewVersion);
    const comfyWSState = useStore(sdpppSDK.stores.ComfyStore, (state) => state.comfyWSState);

    let statusText = ''
    let statusTextType: 'warning' | 'error' | 'info' | 'empty' = 'empty'
    let showRenderer = false

    if (comfyHTTPCode !== 200) {
        statusText = t('comfy.load_failed', { code: translateHTTPCode(comfyHTTPCode, t) })
        statusTextType = 'error'
    } else if (comfyWebviewLoadError) {
        statusText = comfyWebviewLoadError
        statusTextType = 'error'
    } else if (comfyWebviewLoading) {
        statusText = t('comfy.loading')
        statusTextType = 'info'
    } else if (comfyWebviewConnectStatus === 'connecting') {
        statusText = t('comfy.channel_connecting')
        statusTextType = 'info'
    } else if (comfyWSState === 'reconnecting') {
        statusText = t('comfy.server_reconnecting')
        statusTextType = 'warning'
    } else {
        showRenderer = true
    }
    if (comfyHTTPCode === 200 && (!comfyWebviewVersion || comfyWebviewVersion != SDPPP_VERSION)) {
        statusText += (statusText ? ' | ' : '') + t('comfy.version_mismatch', { comfyVersion: comfyWebviewVersion, pluginVersion: SDPPP_VERSION })
        statusTextType = statusTextType == 'error' ? 'error' : 'warning'
    }

    return {
        statusText,
        statusTextType,
        showRenderer
    }
}

export function ComfyFrontendContent() {

    const comfyURL = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyURL);
    const { statusText, statusTextType, showRenderer } = useComfyConnectStatus();

    if (!comfyURL) return null;

    return (
        // This Provider is used to provide the context for the WorkflowEditApiFormat
        // 这个Provider是必须的，因为WorkflowEditApiFormat需要使用WidgetableProvider
        <UploadPassProvider
            uploader={async (uploadInput, signal) => {
                // Check if already aborted
                if (signal?.aborted) {
                    throw new DOMException('Upload aborted', 'AbortError');
                }
                const { name } = await sdpppSDK.plugins.photoshop.uploadComfyImage({ uploadInput, overwrite: true });
                return name;
            }}
        >
        <WidgetableProvider widgetRegistry={createImageMaskWidgetRegistry()}>
            {statusTextType === 'empty' ? null :
                <Alert message={statusText} type={statusTextType} />}
            {showRenderer && comfyURL && <ComfyFrontendRendererContent />}
        </WidgetableProvider>
        </UploadPassProvider>
    )
}


function translateHTTPCode(code: number, t: any) {
    switch (code) {
        case 200:
            return '';
        case 404:
            return t('http.404');
        case 401:
            return t('http.401');
        case 403:
            return t('http.403');
        case 408:
            return t('http.408');
        case 500:
            return t('http.500');
        case 501:
            return t('http.501');
        case 502:
            return t('http.502');
        case 503:
            return t('http.503');
        case 504:
            return t('http.504');
        default:
            return t('http.unknown', { code });
    }
}
