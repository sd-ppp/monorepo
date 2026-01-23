import React from 'react';
import { WidgetableNode, WidgetableWidget } from "@sdppp/common/schemas/schemas";
import { 
    renderToggleWidget, 
    renderNumberWidget, 
    renderComboWidget, 
    renderSegmentWidget, 
    renderStringWidget, 
    renderErrorWidget
} from './widgetable-web/default-widgets';

export interface WidgetRenderMeta {
    absoluteIndex: number;
    absolutePosition: number;
    sameTypeIndex: number;
    sameTypePosition: number;
    sameTypeTotal: number;
    widgetType: string;
    nodeOrderIndex: number;
    nodeId: WidgetableNode['id'];
    widgetIndex: number;
}

export interface WidgetRendererProps {
    fieldInfo: WidgetableNode;
    widget: WidgetableWidget;
    widgetIndex: number;
    value: any;
    onValueChange: (value: any) => void;
    extraOptions?: any;
    renderMeta?: WidgetRenderMeta;
}

export type WidgetRenderer = (props: WidgetRendererProps) => React.ReactElement | null;

export interface WidgetRegistry {
    [widgetType: string]: WidgetRenderer;
}

export interface WidgetRegistryContextType {
    registry: WidgetRegistry;
    registerWidget: (widgetType: string, renderer: WidgetRenderer) => void;
    unregisterWidget: (widgetType: string) => void;
    getWidgetRenderer: (widgetType: string) => WidgetRenderer | null;
}

export const createDefaultWidgetRegistry = (): WidgetRegistry => {
    return {
        'number': renderNumberWidget,
        'combo': renderComboWidget,
        'segment': renderSegmentWidget,
        'boolean': renderToggleWidget,
        'toggle': renderToggleWidget,
        'string': renderStringWidget,
        'customtext': renderStringWidget,
        'text': renderStringWidget,
        'error': renderErrorWidget,
        // Note: 'images', 'masks', 'PS_DOCUMENT', 'PS_LAYER' are now externally injected
    };
};
