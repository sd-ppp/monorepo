import { sdpppSDK } from '@sdppp/common';
import { useTranslation } from '@sdppp/common/i18n/react';
import { subscribeToRealtimeChanges as resourcingRealtimeSubscriber } from '@sdppp/resourcing/src/@sideweb/realtime-thumbnail';
import type { ContentType } from '@sdppp/resourcing/src/resource-uris';
import type { WidgetRegistry, WidgetRenderer } from '@sdppp/widgetable-ui';
import React, { useCallback, useMemo } from 'react';
import {
    WidgetImageMaskProvider,
    type WidgetImageMaskActions,
    type WidgetImageMaskLogger,
    type WidgetRealtimeSubscriber,
} from 'sdppp-photoshop-widgets/context/WidgetImageMaskContext';
import { imageMaskWidgetRouter } from 'sdppp-photoshop-widgets/widget-router';
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import { useUploadPasses } from '../upload-pass-context';
import { resolveWorkBoundaryContext } from './work-boundary';

// 渲染旧版 PS_DOCUMENT / PS_LAYER 节点的占位内容
export const renderDeprecatedWidget: WidgetRenderer = () => {
    return <span>SDPPP 2.0不需要这个节点了</span>;
};

export const createImageMaskWidgetRegistry = (): WidgetRegistry => {
    return {
        images: imageMaskWidgetRouter,
        masks: imageMaskWidgetRouter,
        PS_DOCUMENT: renderDeprecatedWidget,
        PS_LAYER: renderDeprecatedWidget,
    };
};

const fallbackLogger: WidgetImageMaskLogger = () => undefined;

const fallbackRealtimeSubscriber: WidgetRealtimeSubscriber = () => () => undefined;

const normalizeDocId = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    const docId = Math.floor(value);
    return docId >= 0 ? docId : 0;
};

const resolveWorkBoundary = (): string => {
    const { boundaryParam, imageSize } = resolveWorkBoundaryContext();
    const docIdRaw = sdpppSDK?.stores?.PhotoshopStore?.getState().activeDocumentID;
    const docId = normalizeDocId(docIdRaw);
    return buildBoundaryUri(docId, boundaryParam ?? 'canvas', { imageSize });
};

const createActions = (): WidgetImageMaskActions => {
    const photoshopActions = sdpppSDK?.plugins?.photoshop as Record<string, any> | undefined;

    const createFromCBM: WidgetImageMaskActions['resource.file.createFromCBM'] = async params => {
        const fn = photoshopActions?.['fileResource.createFromCBM'];
        if (typeof fn !== 'function') {
            return { error: 'fileResource.createFromCBM unavailable' };
        }
        try {
            return await fn(params);
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    };

    const createFromLocal: WidgetImageMaskActions['resource.file.createFromLocal'] = async params => {
        const fn = photoshopActions?.['fileResource.createFromLocal'];
        if (typeof fn !== 'function') {
            return { error: 'fileResource.createFromLocal unavailable' };
        }
        try {
            return await fn(params);
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    };

    const createThumbnail: WidgetImageMaskActions['resource.thumbnail'] = async params => {
        const fn = photoshopActions?.['fileResource.thumbnail'];
        if (typeof fn !== 'function') {
            return { error: 'fileResource.thumbnail unavailable' };
        }
        try {
            return await fn(params);
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    };

    const normalizeBoundary: WidgetImageMaskActions['resource.boundary.normalize'] = async params => {
        const fn = photoshopActions?.['boundary.normalize'];
        if (typeof fn !== 'function') {
            return { error: 'boundary.normalize unavailable' };
        }
        try {
            return await fn(params);
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    };

    const resolveLayer: WidgetImageMaskActions['resource.layer.resolve'] = async params => {
        const fn = photoshopActions?.['layer.resolve'];
        if (typeof fn !== 'function') {
            return { error: 'layer.resolve unavailable' };
        }
        try {
            return await fn(params);
        } catch (error) {
            return { error: error instanceof Error ? error.message : String(error) };
        }
    };

    return {
        'resource.file.createFromCBM': createFromCBM,
        'resource.file.createFromLocal': createFromLocal,
        'resource.thumbnail': createThumbnail,
        'resource.boundary.normalize': normalizeBoundary,
        'resource.layer.resolve': resolveLayer,
    };
};

export interface WidgetablePhotoshopProviderProps {
    children: React.ReactNode;
    debug?: boolean;
}

export const WidgetablePhotoshopProvider: React.FC<WidgetablePhotoshopProviderProps> = ({
    children,
    debug = false,
}) => {
    const { t } = useTranslation();
    const uploadHandlers = useUploadPasses();

    const actions = useMemo(createActions, []);
    const translate = useCallback(
        (key: string, options?: Record<string, unknown>) => t(key, options),
        [t],
    );

    const logger = useMemo<WidgetImageMaskLogger>(() => {
        try {
            return sdpppSDK?.logger?.extend?.('widgetable-photoshop') ?? fallbackLogger;
        } catch {
            return fallbackLogger;
        }
    }, []);

    const selectAdvancedContentSource = useCallback(async () => {
        const fn = sdpppSDK?.plugins?.photoshop?.selectContentSource;
        if (typeof fn !== 'function') {
            try {
                logger('selectAdvancedContentSource unavailable');
            } catch {
                // ignore logging failures
            }
            return null;
        }
        try {
            const result = await fn({});
            if (!result || result.cancelled) {
                return null;
            }
            const resource = typeof result.resource === 'string' ? result.resource.trim() : '';
            if (!resource) {
                return null;
            }
            if (resource.startsWith('uxp://content/')) {
                return { contentUri: resource };
            }
            return { fileUri: resource };
        } catch (error) {
            try {
                logger(
                    'selectAdvancedContentSource error',
                    error instanceof Error ? error.message : String(error),
                );
            } catch {
                // ignore logging failures
            }
            return null;
        }
    }, [logger]);

    const realtimeSubscriber = useMemo<WidgetRealtimeSubscriber>(() => {
        if (typeof resourcingRealtimeSubscriber !== 'function') {
            return fallbackRealtimeSubscriber;
        }
        return (docId, contents, callback) =>
            resourcingRealtimeSubscriber(docId, contents as ContentType[], callback) ?? (() => undefined);
    }, []);

    return (
        <WidgetImageMaskProvider
            actions={actions}
            t={translate}
            logger={logger}
            debug={debug}
            resolveWorkBoundary={resolveWorkBoundary}
            subscribeToRealtimeChanges={realtimeSubscriber}
            uploadPassHandlers={uploadHandlers}
            selectAdvancedContentSource={selectAdvancedContentSource}
        >
            {children}
        </WidgetImageMaskProvider>
    );
};

export { createImageMaskWidgetRouter, imageMaskWidgetRouter } from 'sdppp-photoshop-widgets/widget-router';
