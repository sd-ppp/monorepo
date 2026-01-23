import React, { ReactNode, useMemo, useCallback } from "react";

import type { WidgetableNode, WidgetableStructure, WidgetableValues, WidgetableWidget } from "@sdppp/common/schemas/schemas";
import type { WidgetRenderMeta } from "./widget-registry";
import { computeUIWeightCSS } from "./utils";

import './index.less'
import { useWidgetableRenderer } from "./widgetable-web/main";
import { useWidgetable } from "./context";
// Note: antd dependency removed - Alert component should be provided by consumer

interface WorkflowEditApiFormatProps {
    modelName: string;
    nodes: WidgetableNode[];
    values: Record<string, any>;
    errors: Record<string, string>;
    onWidgetChange: (widgetIndex: number, value: any, fieldInfo: WidgetableNode) => void;
}

export function WorkflowEditApiFormat({
    modelName,
    nodes,
    values,
    errors,

    onWidgetChange

}: WorkflowEditApiFormatProps) {
    const widgetableStructure = useMemo(() => {
        return {
            widgetableID: modelName,
            widgetablePath: modelName,
            nodes: nodes.reduce((nodes, node, index) => {
                nodes[node.id] = {
                    id: node.id,
                    title: node.title,
                    widgets: node.widgets,
                    uiWeightSum: node.uiWeightSum,
                }
                return nodes;
            }, {} as Record<string, WidgetableNode>),
            nodeIndexes: nodes.map((node) => node.id),
            options: {},
        }
    }, [nodes, modelName]);
    const widgetableValues = Object.keys(values).reduce((acc, key) => {
        acc[key] = [values[key as keyof typeof values]];
        return acc;
    }, {} as Record<string, any>);

    return <WorkflowEdit
        widgetableStructure={widgetableStructure}
        widgetableValues={widgetableValues}
        widgetableErrors={errors}
        onWidgetChange={(nodeID, widgetIndex, value, fieldInfo) => {
            onWidgetChange(widgetIndex, value, fieldInfo)
        }}
        onTitleChange={() => { }}
    />
}

interface WorkflowEditProps {
    widgetableStructure: WidgetableStructure;
    widgetableValues: WidgetableValues;
    widgetableErrors: Record<string, string>;
    selectedItem?: any;
    onWidgetChange: (nodeID: string, widgetIndex: number, value: any, fieldInfo: WidgetableNode) => void;
    onTitleChange: (nodeID: string, title: string) => void;
}

// 渲染计数器
let workflowEditRenderCount = 0;

export default function WorkflowEdit({
    widgetableStructure,
    widgetableValues,
    widgetableErrors,

    onWidgetChange,
    onTitleChange
}: WorkflowEditProps) {
    workflowEditRenderCount++;

    useWidgetable();

    const nodeIndexes = Array.isArray(widgetableStructure?.nodeIndexes)
        ? widgetableStructure.nodeIndexes
        : [];
    const nodesMap = widgetableStructure?.nodes ?? {};
    const options = widgetableStructure?.options ?? {};
    const safeWidgetableValues = widgetableValues ?? {};
    const safeWidgetableErrors = widgetableErrors ?? {};

    const renderMetaMap = useMemo(() => {
        const metaMap = new Map<string, WidgetRenderMeta>();
        const sameTypeTotals = new Map<string, number>();

        nodeIndexes.forEach(nodeID => {
            const fieldInfo = nodesMap[nodeID];
            if (!fieldInfo || !Array.isArray(fieldInfo.widgets)) {
                return;
            }
            fieldInfo.widgets.forEach(widget => {
                if (!widget) return;
                const widgetType = String(widget.outputType ?? 'unknown');
                sameTypeTotals.set(widgetType, (sameTypeTotals.get(widgetType) ?? 0) + 1);
            });
        });

        const sameTypeSeen = new Map<string, number>();
        let absoluteIndex = 0;

        nodeIndexes.forEach((nodeID, nodeOrderIndex) => {
            const fieldInfo = nodesMap[nodeID];
            if (!fieldInfo || !Array.isArray(fieldInfo.widgets)) {
                return;
            }
            fieldInfo.widgets.forEach((widget, widgetIndex) => {
                if (!widget) {
                    return;
                }
                const widgetType = String(widget.outputType ?? 'unknown');
                const sameTypeIndex = sameTypeSeen.get(widgetType) ?? 0;
                const sameTypeTotal = sameTypeTotals.get(widgetType) ?? 0;

                const meta: WidgetRenderMeta = {
                    absoluteIndex,
                    absolutePosition: absoluteIndex + 1,
                    sameTypeIndex,
                    sameTypePosition: sameTypeIndex + 1,
                    sameTypeTotal,
                    widgetType,
                    nodeOrderIndex,
                    nodeId: fieldInfo.id,
                    widgetIndex,
                };
                metaMap.set(`${fieldInfo.id}:${widgetIndex}`, meta);

                sameTypeSeen.set(widgetType, sameTypeIndex + 1);
                absoluteIndex += 1;
            });
        });

        return metaMap;
    }, [nodeIndexes, nodesMap]);

    const getRenderMeta = useCallback(
        (fieldInfo: WidgetableNode, widgetIndex: number): WidgetRenderMeta | undefined => {
            return renderMetaMap.get(`${fieldInfo.id}:${widgetIndex}`);
        },
        [renderMetaMap],
    );

    const { renderWidget, renderTitle } = useWidgetableRenderer({
        widgetableValues: safeWidgetableValues,
        onWidgetChange,
        onTitleChange,
        extraOptions: options,
        getRenderMeta,
    });

    const allRenderedFields = nodeIndexes.map(nodeID => {
        const fieldInfo = nodesMap[nodeID];
        if (!fieldInfo) {
            return null;
        }

        const widgets = Array.isArray(fieldInfo.widgets) ? fieldInfo.widgets : [];
        const useShortTitle = widgets.length === 1 && (
            fieldInfo.uiWeightSum <= 8 &&
            (widgets[0]?.outputType !== 'number')
        );
        return (
            <div className="workflow-edit-field param-row" key={fieldInfo.id}>
                <div className="workflow-edit-field-title param-label" title={fieldInfo.title} style={{
                    ...computeUIWeightCSS(useShortTitle ? 4 : 12),
                }}>
                    <WidgetTitleRenderErrorBoundary title={fieldInfo.title}>
                        {renderTitle(fieldInfo.title, fieldInfo)}
                    </WidgetTitleRenderErrorBoundary>
                </div>
                {
                    widgets.map((widget, widgetIndex) => {
                        try {
                            const renderedWidget = renderWidget(fieldInfo, widget, widgetIndex);
                            if (renderedWidget) {
                                return <WidgetRenderErrorBoundary key={widgetIndex}>{renderedWidget}</WidgetRenderErrorBoundary>;
                            }
                            return null;
                        } catch (error: any) {
                            return <WidgetRenderErrorBoundary key={widgetIndex}>{error.stack || error.message || error.toString()}</WidgetRenderErrorBoundary>;
                        }
                    })
                }
                {
                    safeWidgetableErrors[fieldInfo.id] ?
                        <span className="list-error-label">{safeWidgetableErrors[fieldInfo.id]}</span> : ''
                }
            </div>
        )
    }).filter(Boolean);

    const nodeErrorsInWidgetTable = Object.keys(safeWidgetableErrors).filter((key: any) => nodesMap[parseInt(key)]);
    const nodeErrorsNotInWidgetTable = Object.keys(safeWidgetableErrors).filter((key: any) => !nodesMap[parseInt(key)]);

    let errorLabel: ReactNode | null = null;
    if (nodeErrorsNotInWidgetTable.length > 0) {
        errorLabel = <span className="list-error-label">{safeWidgetableErrors[+nodeErrorsNotInWidgetTable[0]]}</span>
    } else if (nodeErrorsInWidgetTable.length > 0) {
        errorLabel = <span className="list-error-label">{safeWidgetableErrors[+nodeErrorsInWidgetTable[0]]}</span>
    }

    return (
        <>
            <div className="params-section workflow-edit-content">
                {
                    errorLabel
                }
                {allRenderedFields}
            </div>
        </>
    );
}

class WidgetTitleRenderErrorBoundary extends React.Component<{
    children: React.ReactNode;
    title: string;
}, {
    hasError: boolean;
    error: Error | null;
}> {
    constructor(props: {
        children: React.ReactNode;
        title: string;
    }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ hasError: true, error });
    }

    render() {
        if (this.state.hasError) {
            return <span>{this.props.title}</span>
        }
        return this.props.children;
    }
}
class WidgetRenderErrorBoundary extends React.Component<{
    children: React.ReactNode;
}, {
    hasError: boolean;
    error: Error | null;
}> {
    constructor(props: {
        children: React.ReactNode;
    }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ hasError: true, error });
    }

    render() {
        if (this.state.hasError) {
            return <div style={{ color: 'red', border: '1px solid red', padding: '8px', margin: '4px' }}>
                {this.state.error?.stack || this.state.error?.message || this.state.error?.toString()}
            </div>
        }
        return this.props.children;
    }
}
