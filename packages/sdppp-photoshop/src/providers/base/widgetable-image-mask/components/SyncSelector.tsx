import React, { useMemo, useState } from 'react';
import { ImagePreviewSplitList, SyncButton } from '@sdppp/ui-library';
import type { ImagePreviewSplitListItem } from '@sdppp/ui-library';
import { Alert, Button, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from '@sdppp/common/i18n/react';
import { useImageManager } from '../hooks/useImageManager';
import { useComponent } from '../stores/global-image-store';
import './SyncSelector.less';

interface ImageSelectProps {
    widgetableId: string;
    uiWeight?: number;
    value: string[];
    onValueChange: (urls: string[]) => void;
    extraOptions?: Record<string, any>;
    maxCount: number;
    isMask: boolean;
}

function ImageSelectComponent({
    widgetableId,
    maxCount = 1,
    value = [],
    onValueChange,
    isMask = false,
}: ImageSelectProps) {
    const { t } = useTranslation();

    // Use the new image manager hook
    const {
        slots,
        onPrimarySync,
        onMaskSync,
        onPrimaryAutoToggle,
        onMaskAutoToggle,
        onAdvancedSelect,
        onAdvancedResync,
        onAdvancedAutoToggle,
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

    // Get component state for per-slot uploading indicators
    const comp = useComponent(widgetableId);
    const [hoveredRemoveIndex, setHoveredRemoveIndex] = useState<number | null>(null);

    const items: ImagePreviewSplitListItem[] = useMemo(() => {
        return slots.map(slot => {
            const mainAuto = slot.primaryAuto;
            const mainLabel = mainAuto
                ? t('image.upload.primary.auto', { defaultValue: '自动取图中...' })
                : t('image.upload.primary.manual', { defaultValue: '使用主图' });

            const defaultAdvancedLabel = t('image.upload.primary.advanced', { defaultValue: '高级选图' });
            const advancedSelection = slot.advancedSelection;
            const hasAdvanced = !!advancedSelection;

            let advancedMainLabel = defaultAdvancedLabel;
            let advancedDescText: string | undefined;

            if (advancedSelection) {
                if (advancedSelection.action === 'pickLocalFile') {
                    advancedMainLabel = t('image.upload.primary.advanced.local_file', { defaultValue: '从磁盘获取' });
                } else {
                    const content = advancedSelection.params?.content;
                    switch (content) {
                        case 'curlayer':
                            advancedMainLabel = t('image.upload.primary.advanced.content.curlayer', { defaultValue: '当前图层' });
                            break;
                        case 'selection':
                            advancedMainLabel = t('image.upload.primary.advanced.content.selection', { defaultValue: '选区' });
                            break;
                        case 'canvas':
                        default:
                            advancedMainLabel = t('image.upload.primary.advanced.content.canvas', { defaultValue: '画布' });
                            break;
                    }

                    const boundary = advancedSelection.params?.boundary;
                    if (typeof boundary === 'string') {
                        switch (boundary) {
                            case 'curlayer':
                                advancedDescText = t('image.upload.primary.advanced.boundary.curlayer', { defaultValue: '当前图层边界' });
                                break;
                            case 'selection':
                                advancedDescText = t('image.upload.primary.advanced.boundary.selection', { defaultValue: '选区边界' });
                                break;
                            case 'canvas':
                            default:
                                advancedDescText = t('image.upload.primary.advanced.boundary.canvas', { defaultValue: '画布边界' });
                                break;
                        }
                    } else if (boundary) {
                        advancedDescText = t('image.upload.primary.advanced.boundary.primary', { defaultValue: '主图边界' });
                    }
                }
            }

            const advancedHint = t('image.upload.primary.hint', {
                defaultValue: '本节点默认使用\n当前图层+遮罩',
            });

            const maskLabel = t('image.upload.mask.button', { defaultValue: '选区遮罩' });

            const leftContent = (
                <div className="sync-selector__slot">
                    <div className="sync-selector__primary-block">
                        <SyncButton
                            buttonWidth={160}
                            disabled={uploading || slot.uploading}
                            isAutoSync={mainAuto}
                            onSync={() => void onPrimarySync(slot.index)}
                            onAutoSyncToggle={() =>
                                onPrimaryAutoToggle(slot.index, !mainAuto)
                            }
                            autoSyncEnabled
                        >
                            {mainLabel}
                        </SyncButton>
                        {mainAuto ? (
                            <div className="sync-selector__auto-hint">
                                {advancedHint}
                            </div>
                        ) : (
                            <SyncButton
                                buttonWidth={160}
                                disabled={uploading || slot.uploading}
                                isAutoSync={hasAdvanced ? slot.advancedAuto : false}
                                autoSyncEnabled={hasAdvanced}
                                cancelEnabled={hasAdvanced}
                                onSync={() => {
                                    if (hasAdvanced) {
                                        void onAdvancedResync(slot.index);
                                    } else {
                                        void onAdvancedSelect(slot.index);
                                    }
                                }}
                                onAutoSyncToggle={() => {
                                    if (hasAdvanced) {
                                        onAdvancedAutoToggle(slot.index, !slot.advancedAuto);
                                    }
                                }}
                                onCancel={() => {
                                    if (hasAdvanced) {
                                        onAdvancedCancel(slot.index);
                                    }
                                }}
                                descText={advancedDescText}
                            >
                                {advancedMainLabel}
                            </SyncButton>
                        )}
                    </div>
                    <div className="sync-selector__divider" />
                    <div className="sync-selector__mask-block">
                        <SyncButton
                            buttonWidth={160}
                            disabled={uploading || slot.uploading}
                            isAutoSync={slot.maskAuto}
                            autoSyncEnabled
                            onSync={() => void onMaskSync(slot.index)}
                            onAutoSyncToggle={() =>
                                onMaskAutoToggle(slot.index, !slot.maskAuto)
                            }
                        >
                            <span className="sync-selector__mask-label">
                                <PlusOutlined />
                                {maskLabel}
                            </span>
                        </SyncButton>
                    </div>
                </div>
            );

            return {
                id: slot.index,
                imageUrl: slot.imageUrl,
                background: isMask ? 'white' : 'checkerboard' as const,
                left: leftContent,
                leftContainerStyle: { flex: '0 0 auto' },
                rightContainerStyle: { flex: '1 1 0%', minWidth: 0 },
            };
        });
    }, [slots, uploading, onPrimarySync, onPrimaryAutoToggle, onAdvancedSelect, onAdvancedResync, onAdvancedAutoToggle, onAdvancedCancel, onMaskSync, onMaskAutoToggle, t, isMask]);

    const removeControls = showAddRemove && slots.length > 1 && (
        <div className="sync-selector__remove-group">
            {slots.map(({ index }) => {
                const isHovered = hoveredRemoveIndex === index;
                return (
                    <Button
                        key={`remove-${index}`}
                        size="small"
                        type="default"
                        icon={isHovered ? <DeleteOutlined /> : undefined}
                        onMouseEnter={() => setHoveredRemoveIndex(index)}
                        onMouseLeave={() =>
                            setHoveredRemoveIndex(prev => (prev === index ? null : prev))
                        }
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
            <ImagePreviewSplitList items={items} />

            {slots.map(slot =>
                comp?.slots?.[slot.index]?.uploading ? (
                    <div key={`slot-upload-${slot.index}`} className="sync-selector__slot-uploading">
                        <Spin size="small" />
                        <span>
                            {t('image.upload.uploading', { defaultValue: '上传中…' })}
                        </span>
                    </div>
                ) : null
            )}

            {uploading && (
                <div className="sync-selector__global-uploading">
                    <Spin size="small" />
                    <span>
                        {t('image.upload.uploading', { defaultValue: '上传中…' })}
                    </span>
                </div>
            )}

            {uploadError && (
                <div className="sync-selector__error">
                    <Alert type="error" showIcon message={uploadError} />
                </div>
            )}

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
