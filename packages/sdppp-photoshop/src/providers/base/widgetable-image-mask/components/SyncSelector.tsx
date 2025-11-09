import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { sdpppSDK } from '@sdppp/common';
import { useTranslation } from '@sdppp/common/i18n/react';
import { ImagePreviewSplit, ImagePreviewSplitList, SyncButton } from '@sdppp/ui-library';
import { Alert, Button, Spin } from 'antd';
import React, { useMemo, useState } from 'react';
import { useRealtimeImageThumbnail, useRealtimeMaskThumbnail } from '../../realtime-thumbnail/hooks';
import { buildBoundaryUri, buildImageContentUri, buildMaskContentUri } from '../../realtime-thumbnail/utils';
import { resolveWorkBoundaryContext } from '../services/photoshop/operations';
import { useImageManager } from '../features/hooks/useImageManager';
import { useComponent } from '../foundation/stores/hooks';
import { getSlotPrimaryConfig } from '../foundation/stores/types';
import type { BoundaryUri, ContentUri, MaskUri, SlotState } from '../foundation/stores/types';
import './SyncSelector.less';

const ADVANCED_HINT_TRANSLATIONS = [
    { key: 'image.upload.primary.hint.line1', defaultValue: '本节点默认使用' },
    { key: 'image.upload.primary.hint.line2', defaultValue: '当前图层+遮罩' },
];

const widgetPreviewLog = sdpppSDK.logger.extend('widget-image-preview');

interface ImageSelectProps {
    widgetableId: string;
    uiWeight?: number;
    value: string[];
    onValueChange: (urls: string[]) => void;
    extraOptions?: Record<string, any>;
    maxCount: number;
    isMask: boolean;
}

/**
 * 同步选择器组件：根据 useImageManager 提供的槽位数据渲染按钮，并向宿主发起主图/遮罩同步。
 */
function ImageSelectComponent({
    widgetableId,
    uiWeight,
    extraOptions,
    maxCount = 1,
    value = [],
    onValueChange,
    isMask = false,
}: ImageSelectProps) {
    const { t } = useTranslation();

    // UI 配置参数目前只在宿主侧使用，这里保留解构避免丢失，同时规避未使用警告。
    void uiWeight;
    void extraOptions;

    // 通过 useImageManager 获取槽位列表及各类交互回调。
    const {
        slots,
        onPrimarySync,
        onMaskSync,
        onPrimaryAutoToggle,
        onMaskAutoToggle,
        onAdvancedSelect,
        onAdvancedCancel,
        onAdd,
        onRemove,
        uploading,
        uploadError,
        showAddRemove,
    } = useImageManager({
        componentId: widgetableId,
        maxCount,
        isMask,
        urls: value,
        onValueChange,
    });

    // 通过全局 store 读取上传状态，用于展示每个槽位的上传动画。
    const comp = useComponent(widgetableId);
    const [hoveredRemoveSlotIndex, setHoveredRemoveSlotIndex] = useState<number | null>(null);

    // 鼠标移入/移出槽位删除按钮时切换 UI 状态。
    const handleRemoveHover = (slotIndex: number) => {
        setHoveredRemoveSlotIndex(slotIndex);
    };

    const handleRemoveMouseLeave = (slotIndex: number) => {
        setHoveredRemoveSlotIndex(prev => (prev === slotIndex ? null : prev));
    };

    // 将槽位状态映射到预览列表项，供 ImagePreviewSplitList 展示。
    const items = useMemo<React.ReactElement[]>(() => {
        const photoshopLayers = sdpppSDK.stores.PhotoshopStore.getState().layers || [];

        return slots.map(index => {
            const slotState = comp?.slots?.[index];
            const fallbackUrl = value?.[index] ?? '';
            const leftNode = (
                <SlotActions
                    slotIndex={index}
                    slotState={slotState}
                    photoshopLayers={photoshopLayers}
                    uploading={uploading}
                    t={t}
                    onPrimarySync={onPrimarySync}
                    onPrimaryAutoToggle={onPrimaryAutoToggle}
                    onAdvancedSelect={onAdvancedSelect}
                    onAdvancedCancel={onAdvancedCancel}
                    onMaskSync={onMaskSync}
                    onMaskAutoToggle={onMaskAutoToggle}
                />
            );

            return (
                <SlotPreviewItem
                    key={`slot-preview-${index}`}
                    slotIndex={index}
                    slotState={slotState}
                    left={leftNode}
                    background={isMask ? 'white' : ('checkerboard' as const)}
                    fallbackUrl={fallbackUrl}
                    isMask={isMask}
                />
            );
        });
    }, [
        slots,
        comp,
        value,
        uploading,
        onPrimarySync,
        onPrimaryAutoToggle,
        onAdvancedSelect,
        onAdvancedCancel,
        onMaskSync,
        onMaskAutoToggle,
        t,
        isMask
    ]);

    // UI：多槽位场景提供移除按钮，悬停时高亮删除 icon。
    const removeControls = showAddRemove && slots.length > 1 && (
        <div className="sync-selector__remove-group">
            {slots.map(index => {
                const isHovered = hoveredRemoveSlotIndex === index;
                return (
                    <Button
                        key={`remove-${index}`}
                        size="small"
                        type="default"
                        icon={isHovered ? <DeleteOutlined /> : undefined}
                        onMouseEnter={() => handleRemoveHover(index)}
                        onMouseLeave={() => handleRemoveMouseLeave(index)}
                        onClick={() => onRemove(index)}
                        aria-label={t('image.upload.remove_slot', {
                            defaultValue: '移除槽位',
                        })}
                        className="sync-selector__remove-button"
                    >
                        {isHovered ? null : index}
                    </Button>
                );
            })}
        </div>
    );

    return (
        <div className="sync-selector">
            {/* UI：展示所有槽位的缩略图及自定义操作区域。 */}
            <ImagePreviewSplitList items={items} />

            {/* UI：当某个槽位正在上传时叠加局部 Spin，提示用户等待。 */}
            {slots.map(index => {
                const slotState = comp?.slots?.[index];
                return slotState?.uploading ? (
                    <div key={`slot-upload-${index}`} className="sync-selector__slot-uploading">
                        <Spin size="small" />
                        <span>
                            {t('image.upload.uploading', { defaultValue: '上传中…' })}
                        </span>
                    </div>
                ) : null;
            })}

            {/* UI：全局上传队列里有任务时显示顶部提示。 */}
            {uploading && (
                <div className="sync-selector__global-uploading">
                    <Spin size="small" />
                    <span>
                        {t('image.upload.uploading', { defaultValue: '上传中…' })}
                    </span>
                </div>
            )}

            {/* UI：上传失败时显示错误提示，message 文案直接来自 hook。 */}
            {uploadError && (
                <div className="sync-selector__error">
                    <Alert type="error" showIcon message={uploadError} />
                </div>
            )}

            {/* UI：允许新增/删除槽位，点击“新增”触发 onAdd，右侧展示删除按钮组。 */}
            {showAddRemove && (
                <div className="sync-selector__controls-row">
                    <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={onAdd}
                        className="sync-selector__add-button"
                    >
                        {t('image.upload.add_slot', { defaultValue: '新增槽位' })}
                    </Button>
                    {removeControls}
                </div>
            )}
        </div>
    );
}

export const SyncSelector: React.FC<ImageSelectProps> = ImageSelectComponent;

type TranslateFn = (key: string, options?: Record<string, any>) => string;

interface PhotoshopLayer {
    identify?: string | null;
    name?: string | null;
}

interface PrimaryButtonMeta {
    primaryButtonLabel: string;
    primaryButtonDesc?: string;
    isPrimaryAutoSync: boolean;
    isPrimaryAutoToggleEnabled: boolean;
    advancedButtonLabel: string;
    hasAdvancedSelection: boolean;
}

function buildPrimaryButtonMeta({
    slotState,
    photoshopLayers,
    t,
}: {
    slotState?: SlotState;
    photoshopLayers: PhotoshopLayer[];
    t: TranslateFn;
}): PrimaryButtonMeta {
    const primaryAutoEnabled = slotState?.primaryAutoEnabled ?? false;
    const primaryConfig = getSlotPrimaryConfig(slotState);
    const manualPrimaryLabel = t('image.upload.primary.manual', { defaultValue: '使用主图' });

    const findLayerName = (identify: string | null | undefined) => {
        if (!identify) {
            return undefined;
        }
        return photoshopLayers.find(layer => layer.identify === identify)?.name ?? undefined;
    };

    const resolvedLayerIdentify = primaryConfig?.layerIdentify ?? null;
    const resolvedContentName = resolvedLayerIdentify ? findLayerName(resolvedLayerIdentify) : undefined;
    const resolvedBoundary = primaryConfig?.boundary ?? null;
    const resolvedBoundaryIdentify = resolvedLayerIdentify;
    const resolvedBoundaryName = resolvedBoundaryIdentify ? findLayerName(resolvedBoundaryIdentify) : undefined;
    const resolvedContent = primaryConfig?.content ?? null;

    const buildPrimaryLabel = () => {
        if (!resolvedContent) {
            return manualPrimaryLabel;
        }
        switch (resolvedContent) {
            case 'curlayer':
                return resolvedContentName
                    ? resolvedContentName
                    : t('image.upload.primary.advanced.content.curlayer', { defaultValue: '当前图层' });
            case 'selection':
                return t('image.upload.primary.advanced.content.selection', { defaultValue: '选区' });
            case 'canvas':
            default:
                return t('image.upload.primary.advanced.content.canvas', { defaultValue: '画布' });
        }
    };

    const buildPrimaryDesc = () => {
        const boundary = resolvedBoundary;
        if (!boundary || boundary === 'canvas') {
            if (!resolvedContent) {
                return undefined;
            }
            return t('image.upload.primary.advanced.boundary.canvas', { defaultValue: '画布边界' });
        }
        if (boundary === 'selection') {
            return t('image.upload.primary.advanced.boundary.selection', { defaultValue: '选区边界' });
        }
        if (boundary === 'curlayer') {
            return resolvedBoundaryName
                ? resolvedBoundaryName
                : t('image.upload.primary.advanced.boundary.curlayer', { defaultValue: '当前图层边界' });
        }
        return t('image.upload.primary.advanced.boundary.primary', { defaultValue: '主图边界' });
    };

    const defaultPrimaryLabel = buildPrimaryLabel();
    const defaultPrimaryDesc = buildPrimaryDesc();

    let primaryButtonLabel = defaultPrimaryLabel;
    let primaryButtonDesc: string | undefined = defaultPrimaryDesc;
    let isPrimaryAutoSync = primaryAutoEnabled;
    let isPrimaryAutoToggleEnabled = true;

    const hasAdvancedSelection = !primaryAutoEnabled && !!primaryConfig;
    const advancedButtonLabel = hasAdvancedSelection
        ? t('image.upload.primary.advanced.reset', { defaultValue: '重置' })
        : t('image.upload.primary.advanced.modify', { defaultValue: '修改' });

    return {
        primaryButtonLabel,
        primaryButtonDesc,
        isPrimaryAutoSync,
        isPrimaryAutoToggleEnabled,
        advancedButtonLabel,
        hasAdvancedSelection,
    };
}

interface SlotActionsProps {
    slotIndex: number;
    slotState?: SlotState;
    photoshopLayers: PhotoshopLayer[];
    uploading: boolean;
    t: TranslateFn;
    onPrimarySync: (index: number) => Promise<void>;
    onPrimaryAutoToggle: (index: number, enable: boolean) => void;
    onAdvancedSelect: (index: number) => Promise<void>;
    onAdvancedCancel: (index: number) => void;
    onMaskSync: (index: number) => Promise<void>;
    onMaskAutoToggle: (index: number, enable: boolean) => void;
}

const SlotActions: React.FC<SlotActionsProps> = ({
    slotIndex,
    slotState,
    photoshopLayers,
    uploading,
    t,
    onPrimarySync,
    onPrimaryAutoToggle,
    onAdvancedSelect,
    onAdvancedCancel,
    onMaskSync,
    onMaskAutoToggle,
}) => {
    const isSlotBusy = uploading || !!slotState?.uploading;
    const {
        primaryButtonLabel,
        primaryButtonDesc,
        isPrimaryAutoSync,
        isPrimaryAutoToggleEnabled,
        advancedButtonLabel,
        hasAdvancedSelection,
    } = buildPrimaryButtonMeta({ slotState, photoshopLayers, t });

    const maskLabel = t('image.upload.mask.button', { defaultValue: '选区遮罩' });
    const isAdvancedButtonDisabled = isSlotBusy || isPrimaryAutoSync;
    const advancedHintLines = ADVANCED_HINT_TRANSLATIONS.map(({ key, defaultValue }) =>
        t(key, { defaultValue })
    );

    const handlePrimarySync = () => {
        void onPrimarySync(slotIndex);
    };

    const handlePrimaryAutoToggle = () => {
        onPrimaryAutoToggle(slotIndex, !isPrimaryAutoSync);
    };

    const handleAdvancedButtonClick = () => {
        if (hasAdvancedSelection) {
            onAdvancedCancel(slotIndex);
        } else {
            void onAdvancedSelect(slotIndex);
        }
    };

    const handleMaskSync = () => {
        void onMaskSync(slotIndex);
    };

    const handleMaskAutoToggle = () => {
        onMaskAutoToggle(slotIndex, !(slotState?.maskAutoEnabled ?? false));
    };

    return (
        <div className="sync-selector__slot">
            <div className="sync-selector__primary-block">
                {/* UI：点击“主图”按钮向 Photoshop 请求同步主图；开关控制自动同步。 */}
                <SyncButton
                    buttonSize={160}
                    disabled={isSlotBusy}
                    isAutoSync={isPrimaryAutoSync}
                    onSync={handlePrimarySync}
                    onAutoSyncToggle={handlePrimaryAutoToggle}
                    autoSyncEnabled={isPrimaryAutoToggleEnabled}
                    descText={primaryButtonDesc}
                >
                    <span className="sync-selector__button-label">
                        <PlusOutlined />
                        {primaryButtonLabel}
                    </span>
                </SyncButton>
            </div>
            <div className="sync-selector__advanced-row">
                <div className="sync-selector__advanced-hint">
                    <span>
                        {advancedHintLines.map((line, idx) => (
                            <React.Fragment key={idx}>
                                {line}
                                {idx < advancedHintLines.length - 1 ? <br /> : null}
                            </React.Fragment>
                        ))}
                    </span>
                </div>
                {/* UI：点击“高级选图”弹出高级资源选择器；已有配置时点击执行重置。 */}
                <SyncButton
                    className="sync-selector__advanced-button"
                    disabled={isAdvancedButtonDisabled}
                    isAutoSync={false}
                    autoSyncEnabled={false}
                    onSync={handleAdvancedButtonClick}
                    onAutoSyncToggle={() => {
                        // UI：高级按钮暂不支持自动同步开关，占位回调避免组件警告。
                    }}
                >
                    {advancedButtonLabel}
                </SyncButton>
            </div>
            <div className="sync-selector__divider" />
            <div className="sync-selector__mask-block">
                {/* UI：点击遮罩按钮同步遮罩图层，右侧开关控制自动同步遮罩。 */}
                <SyncButton
                    buttonSize={160}
                    disabled={isSlotBusy}
                    isAutoSync={slotState?.maskAutoEnabled ?? false}
                    autoSyncEnabled
                    onSync={handleMaskSync}
                    onAutoSyncToggle={handleMaskAutoToggle}
                >
                    <span className="sync-selector__button-label">
                        <PlusOutlined />
                        {maskLabel}
                    </span>
                </SyncButton>
            </div>
        </div>
    );
};

// 移除变体选择，统一在 SlotPreviewItem 中根据 slotState 构造调用参数。

interface SlotPreviewFrameProps {
    left: React.ReactNode;
    background: 'checkerboard' | 'white';
    imageUrl: string;
    isThumbnail?: boolean;
}

const SlotPreviewFrame: React.FC<SlotPreviewFrameProps> = ({ left, background, imageUrl, isThumbnail }) => (
    <ImagePreviewSplit
        left={left}
        background={background}
        imageUrl={imageUrl}
        // Some builds of ImagePreviewSplit expect an array; provide both for safety
        imageUrls={imageUrl ? [imageUrl] : [] as string[]}
        leftContainerStyle={{ flex: '0 0 auto' }}
        rightContainerStyle={{
            flex: '1 1 0%',
            minWidth: 0,
            // Right-side, soft and transparent outer shadow marking thumbnail usage
            // Prefer themed border color; mix with transparency for a subtle effect
            boxShadow: isThumbnail
                ? '8px 0 16px -8px color-mix(in srgb, var(--ant-color-border, var(--sdppp-border-color, #d9d9d9)) 20%, transparent), 1px 0 3px -2px color-mix(in srgb, var(--ant-color-border, var(--sdppp-border-color, #d9d9d9)) 30%, transparent)'
                : undefined,
        }}
    />
);

interface SlotPreviewItemProps {
    slotIndex?: number;
    slotState?: SlotState;
    left: React.ReactNode;
    background: 'checkerboard' | 'white';
    fallbackUrl: string;
    isMask: boolean;
}

// --

// --

const SlotPreviewItem: React.FC<SlotPreviewItemProps> = ({ slotIndex, slotState, left, background, fallbackUrl, isMask }) => {
    const mergedFallback = fallbackUrl || '';

    const fileUri = slotState?.fileUri ?? null;
    const contentUri = slotState?.contentUri ?? null;
    const boundaryUri = slotState?.boundaryUri ?? null;
    const maskUri = slotState?.maskUri ?? null;
    const realtime = isMask ? (slotState?.maskAutoEnabled ?? false) : (slotState?.primaryAutoEnabled ?? false);

    // no-op init effect; logs removed

    if (isMask) {
        const docIdRaw = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
        const docId = typeof docIdRaw === 'number' && Number.isFinite(docIdRaw) ? Math.max(0, Math.floor(docIdRaw)) : 0;
        const { boundaryParam } = resolveWorkBoundaryContext();
        const effectiveBoundaryUri = (boundaryUri as BoundaryUri) || buildBoundaryUri(docId, (typeof boundaryParam === 'object' || typeof boundaryParam === 'string') ? boundaryParam : null);
        const effectiveMaskUri = (maskUri as MaskUri) || buildMaskContentUri(docId, 'canvas');
        const { data, refetch } = useRealtimeMaskThumbnail({
            maskUri: effectiveMaskUri,
            boundaryUri: effectiveBoundaryUri,
            autoFetch: realtime,
            realtime,
        });
        React.useEffect(() => {
            if (!realtime && slotState?.maskResourceId) {
                void refetch();
            }
        }, [realtime, slotState?.maskResourceId, effectiveBoundaryUri, effectiveMaskUri, refetch]);
        const previewUrl = data || mergedFallback;
        const isThumb = Boolean(data);
        return <SlotPreviewFrame left={left} background={background} imageUrl={previewUrl} isThumbnail={isThumb} />;
    }

    if (typeof fileUri === 'string' && fileUri.trim().length > 0) {
        const { data, image, refetch } = useRealtimeImageThumbnail({
            fileUri,
            autoFetch: realtime,
            realtime: false,
        });
        React.useEffect(() => {
            try {
                widgetPreviewLog('slot-preview-file-params', {
                    slotIndex,
                    realtime,
                    fileUriPresent: true,
                    compose: 'auto',
                });
                // eslint-disable-next-line no-console
                console.debug('[WidgetPreview] file-params', { slotIndex, realtime, compose: 'auto' });
            } catch {}
        }, [slotIndex, realtime, fileUri]);
        React.useEffect(() => {
            if (!realtime && fileUri) {
                void refetch();
            }
        }, [realtime, fileUri, refetch]);
        const previewUrl = data || image || mergedFallback;
        const isThumb = Boolean(data || image);
        return <SlotPreviewFrame left={left} background={background} imageUrl={previewUrl} isThumbnail={isThumb} />;
    }

    let effectiveContentUri = contentUri as ContentUri | null;
    let effectiveBoundaryUri = boundaryUri as BoundaryUri | null;

    const docIdRaw = sdpppSDK.stores.PhotoshopStore.getState().activeDocumentID;
    const docId = typeof docIdRaw === 'number' && Number.isFinite(docIdRaw) ? Math.max(0, Math.floor(docIdRaw)) : 0;
    const { boundaryParam } = resolveWorkBoundaryContext();
    if (!effectiveBoundaryUri) {
        effectiveBoundaryUri = buildBoundaryUri(docId, (typeof boundaryParam === 'object' || typeof boundaryParam === 'string') ? boundaryParam : null);
    }
    if (!effectiveContentUri) {
        effectiveContentUri = buildImageContentUri(docId, 'canvas');
    }
    const { data, image, refetch } = useRealtimeImageThumbnail({
        contentUri: effectiveContentUri as ContentUri,
        boundaryUri: effectiveBoundaryUri as BoundaryUri,
        maskUri: (maskUri as MaskUri) ?? null,
        autoFetch: realtime,
        realtime,
    });
    React.useEffect(() => {
        try {
            widgetPreviewLog('slot-preview-resource-params', {
                slotIndex,
                realtime,
                effectiveBoundaryUri,
                effectiveContentUri,
                hasMaskUri: !!maskUri,
                compose: 'auto',
            });
            // eslint-disable-next-line no-console
            console.debug('[WidgetPreview] resource-params', {
                slotIndex,
                realtime,
                effectiveBoundaryUri,
                effectiveContentUri,
                hasMaskUri: !!maskUri,
                compose: 'auto',
            });
        } catch {}
    }, [slotIndex, realtime, effectiveBoundaryUri, effectiveContentUri, maskUri]);
    React.useEffect(() => {
        // Trigger refetch when sources change and realtime is disabled.
        if (!realtime) {
            void refetch();
        }
        // Keep dependency array length and order constant across renders.
    }, [realtime, effectiveBoundaryUri, effectiveContentUri, maskUri, fileUri, refetch]);
    const previewUrl = data || image || mergedFallback;
    const isThumb = Boolean(data || image);
    return <SlotPreviewFrame left={left} background={background} imageUrl={previewUrl} isThumbnail={isThumb} />;
};
