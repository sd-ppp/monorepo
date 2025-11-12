import React, { ReactNode, FC, useCallback } from "react";
import { WidgetableNode, WidgetableValues, WidgetableWidget } from "@sdppp/common/schemas/schemas";
import { useWidgetable } from "../context";
import type { WidgetRenderMeta } from "../widget-registry";
import { WidgetRenderMetaProvider } from "../render-tracker/context";

interface UseWidgetableRendererProps {
    widgetableValues: WidgetableValues;
    onWidgetChange: (nodeID: string, widgetIndex: number, value: any, fieldInfo: WidgetableNode) => void;
    onTitleChange: (nodeID: string, title: string) => void;
    extraOptions?: any;
    getRenderMeta?: (fieldInfo: WidgetableNode, widgetIndex: number) => WidgetRenderMeta | undefined;
}

interface RenderFunctions {
    renderWidget: (fieldInfo: WidgetableNode, widget: WidgetableWidget, widgetIndex: number) => React.ReactElement | null;
    renderTitle: (title: string, fieldInfo: WidgetableNode) => ReactNode;
}

// 渲染计数器
let useWidgetableRendererCount = 0;

export const useWidgetableRenderer = ({
    widgetableValues,
    onWidgetChange,
    onTitleChange,
    extraOptions,
    getRenderMeta
}: UseWidgetableRendererProps): RenderFunctions => {
    useWidgetableRendererCount++;

    const { getWidgetRenderer } = useWidgetable();

    // Note: no debug logging here; keep hook lean

    const renderWidget = useCallback((fieldInfo: WidgetableNode, widget: WidgetableWidget, widgetIndex: number): React.ReactElement | null => {
        const widgetType = widget.outputType as string;
        const renderer = getWidgetRenderer(widgetType);

        if (!renderer) {
            return null;
        }
        const renderMeta = getRenderMeta?.(fieldInfo, widgetIndex);

        const value = widgetableValues[fieldInfo.id]?.[widgetIndex];
        const onValueChange = (newValue: any) => {
            onWidgetChange(fieldInfo.id, widgetIndex, newValue, fieldInfo);
        };

        const element = renderer({
            fieldInfo,
            widget,
            widgetIndex,
            value,
            onValueChange,
            extraOptions,
            renderMeta
        });
        if (!element) {
            return null;
        }

        return (
            <WidgetRenderMetaProvider value={renderMeta ?? null}>
                {element}
            </WidgetRenderMetaProvider>
        );
    }, [widgetableValues, onWidgetChange, getWidgetRenderer, extraOptions, getRenderMeta]);

    const renderTitle = useCallback((title: string, fieldInfo: WidgetableNode): ReactNode => {
        // return <EditableTitle title={title} onTitleChange={(newTitle) => {
        //     onTitleChange(fieldInfo.id, newTitle);
        // }} />;
        return <div>{title} {fieldInfo.widgets[0]?.options?.required ? <span style={{ color: 'lightcoral' }}>*</span> : null}</div>;
    }, []);

    return {
        renderWidget,
        renderTitle
    };
};

// // 保持原有的组件接口以向后兼容
// interface WidgetableRendererWebProps {
//     widgetableValue: WidgetableValues;
//     onWidgetChange: (nodeID: number, widgetIndex: number, value: any, fieldInfo: WidgetableNode) => void;
//     onTitleRender?: (title: string, fieldInfo: WidgetableNode) => ReactNode;
//     extraOptions?: any;
//     fieldInfo: WidgetableNode;
//     widget: WidgetableNode['widgets'][0];
//     widgetIndex: number;
// }
