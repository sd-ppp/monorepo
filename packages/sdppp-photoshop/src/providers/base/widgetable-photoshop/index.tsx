import { sdpppSDK } from '@sdppp/common';
import { useTranslation } from '@sdppp/common/i18n/react';
import {
    combineFileResourceByCBM,
    createFileResourceByContent,
    createFileResourceByMask,
    createFileResourceFromBuffer,
    createFileResourceFromLocal,
} from '@sdppp/resourcing/src/@sideweb/file-resource-actions';
import { subscribeToRealtimeChanges as resourcingRealtimeSubscriber } from '@sdppp/resourcing/src/@sideweb/realtime-thumbnail';
import { sidewebResourceHandleRegistry } from '@sdppp/resourcing/src/@sideweb/resource-handles';
import type { ContentType } from '@sdppp/resourcing/src/resource-uris';
import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import type { WidgetRegistry, WidgetRenderer } from '@sdppp/widgetable-ui';
import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
    PhotoshopWidgetProvider,
    type PhotoshopWidgetActions,
    type PhotoshopWidgetLogger,
    type ResourceHandleManager,
    type WidgetRealtimeSubscriber,
} from 'sdppp-photoshop-widgets/context/PhotoshopWidgetContext';
import { imageMaskWidgetRouter } from 'sdppp-photoshop-widgets/widget-router';
import { useUploadPasses } from '../upload-pass-context';
import { resolveWorkBoundaryContext } from './work-boundary';

// 渲染旧版 PS_DOCUMENT / PS_LAYER 节点的占位内容
export const renderDeprecatedWidget: WidgetRenderer = () => {
    const { t } = useTranslation();
    return <span>{t('widgetable.photoshop.deprecated_node', { defaultValue: 'SDPPP 2.0 no longer needs this node' })}</span>;
};

export const createImageMaskWidgetRegistry = (): WidgetRegistry => {
    return {
        images: imageMaskWidgetRouter,
        masks: imageMaskWidgetRouter,
        video: imageMaskWidgetRouter,
        PS_DOCUMENT: renderDeprecatedWidget,
        PS_LAYER: renderDeprecatedWidget,
    };
};

const fallbackLogger: PhotoshopWidgetLogger = () => undefined;

const fallbackRealtimeSubscriber: WidgetRealtimeSubscriber = () => () => undefined;

const normalizeDocId = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    const docId = Math.floor(value);
    return docId >= 0 ? docId : 0;
};

type PhotoshopSelectionBoundary = {
    leftDistance: number;
    topDistance: number;
    rightDistance: number;
    bottomDistance: number;
    width: number;
    height: number;
} | null;

const noopUnsubscribe = () => undefined;

const useResolveWorkBoundary = (): string => {
    const subscribe = useCallback((notify: () => void) => {
        const unsubscribers: Array<() => void> = [];

        const push = (unsubscribe?: () => void) => {
            if (typeof unsubscribe === 'function') {
                unsubscribers.push(unsubscribe);
            }
        };

        const photoshopStore = sdpppSDK?.stores?.PhotoshopStore;
        if (photoshopStore?.subscribe) {
            push(
                photoshopStore.subscribe(() => {
                    notify();
                }),
            );
        }

        const webviewStore = sdpppSDK?.stores?.WebviewStore;
        if (webviewStore?.subscribe) {
            push(
                webviewStore.subscribe(() => {
                    notify();
                }),
            );
        }

        if (!unsubscribers.length) {
            return noopUnsubscribe;
        }

        return () => {
            unsubscribers.forEach(unsubscribe => {
                try {
                    unsubscribe();
                } catch {
                    // ignore unsubscribe errors
                }
            });
        };
    }, []);

    const getSnapshot = useCallback(() => {
        const { boundaryParam, imageSize } = resolveWorkBoundaryContext();
        const docIdRaw = sdpppSDK?.stores?.PhotoshopStore?.getState().activeDocumentID;
        const docId = normalizeDocId(docIdRaw);
        return buildBoundaryUri(docId, boundaryParam ?? 'canvas', { imageSize });
    }, []);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const useSelectionBoundary = (): PhotoshopSelectionBoundary => {
    const subscribe = useCallback((notify: () => void) => {
        const photoshopStore = sdpppSDK?.stores?.PhotoshopStore;
        if (photoshopStore?.subscribe) {
            const unsubscribe = photoshopStore.subscribe(() => {
                notify();
            });
            return typeof unsubscribe === 'function' ? unsubscribe : noopUnsubscribe;
        }
        return noopUnsubscribe;
    }, []);

    const getSnapshot = useCallback(() => {
        const boundary = sdpppSDK?.stores?.PhotoshopStore?.getState().selectionBoundary;
        return boundary ?? null;
    }, []);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

const createActions = (): PhotoshopWidgetActions => {
    const photoshopActions = sdpppSDK?.plugins?.photoshop as Record<string, any> | undefined;

    const createFromBuffer: PhotoshopWidgetActions['resource.file.createFromBuffer'] = async params => {
        return await createFileResourceFromBuffer(params);
    };

    const createByContent: PhotoshopWidgetActions['resource.file.createByContent'] = async params => {
        const prepared = params ?? { contentUri: '' };
        if (!prepared.contentUri || !prepared.contentUri.trim()) {
            return { resource: null, error: 'contentUri unavailable' };
        }
        return await createFileResourceByContent({
            contentUri: prepared.contentUri,
            options: prepared.options,
        });
    };

    const createByMask: PhotoshopWidgetActions['resource.file.createByMask'] = async params => {
        const prepared = params ?? { maskUri: '' };
        const maskUri = prepared.maskUri?.trim() ?? '';
        if (!maskUri || /\/empty(?:[/?#]|$)/.test(maskUri)) {
            return { resource: null, handle: null, width: null, height: null, mime: null };
        }
        return await createFileResourceByMask({
            maskUri,
            options: prepared.options,
        });
    };

    const combineByCBM: PhotoshopWidgetActions['resource.file.combineByCBM'] = async params => {
        const prepared = params ?? {
            contentUri: '',
            boundaryUri: '',
        };
        return await combineFileResourceByCBM({
            contentUri: prepared.contentUri,
            boundaryUri: prepared.boundaryUri,
            maskUri: prepared.maskUri ?? undefined,
            thumbnail: prepared.thumbnail,
            options: prepared.options,
        });
    };

    const createFromLocal: PhotoshopWidgetActions['resource.file.createFromLocal'] = async params => {
        return await createFileResourceFromLocal(params);
    };

    const createThumbnail: PhotoshopWidgetActions['resource.thumbnail'] = async params => {
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

    const normalizeBoundary: PhotoshopWidgetActions['resource.boundary.normalize'] = async params => {
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

    const resolveLayer: PhotoshopWidgetActions['resource.layer.resolve'] = async params => {
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
        'resource.file.combineByCBM': combineByCBM,
        'resource.file.createByContent': createByContent,
        'resource.file.createByMask': createByMask,
        'resource.file.createFromBuffer': createFromBuffer,
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
    const workBoundaryUri = useResolveWorkBoundary();
    const selectionBoundary = useSelectionBoundary();

    const actions = useMemo(createActions, []);
    const translate = useCallback(
        (key: string, options?: Record<string, unknown>) => t(key, options),
        [t],
    );

    const logger = useMemo<PhotoshopWidgetLogger>(() => {
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

    const resourceHandleManager = useMemo<ResourceHandleManager>(
        () => ({
            acquire: resourceId => {
                const existing = sidewebResourceHandleRegistry.acquire(resourceId);
                return existing;
            },
        }),
        [],
    );

    return (
        <PhotoshopWidgetProvider
            actions={actions}
            t={translate}
            logger={logger}
            debug={debug}
            workBoundaryUri={workBoundaryUri}
            selectionBoundary={selectionBoundary}
            subscribeToRealtimeChanges={realtimeSubscriber}
            uploadPassHandlers={uploadHandlers}
            selectAdvancedContentSource={selectAdvancedContentSource}
            resourceHandles={resourceHandleManager}
        >
            {children}
        </PhotoshopWidgetProvider>
    );
};

export { createImageMaskWidgetRouter, imageMaskWidgetRouter } from 'sdppp-photoshop-widgets/widget-router';
