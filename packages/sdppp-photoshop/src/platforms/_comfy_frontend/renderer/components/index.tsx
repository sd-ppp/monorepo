import React, { Component, useEffect, useState, useMemo } from "react";
import WorkflowList from "./workflow-list";
import { WorkflowDetail } from "./workflow-detail";
import { useStore } from "zustand";
import { sdpppSDK } from '@sdppp/common';
import { Alert } from "antd";
import ErrorBoundary from "antd/es/alert/ErrorBoundary";


export function ComfyFrontendRendererContent() {
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [currentWorkflow, setCurrentWorkflow] = useState<string>('');

    // 使用稳定的选择器，确保返回值稳定
    const rawWidgetablePath = useStore(sdpppSDK.stores.ComfyStore, (state) => {
        const path = state.widgetableStructure?.widgetablePath;
        return typeof path === 'string' ? path : '';
    });

    const widgetablePath = useMemo(() => {
        const processed = rawWidgetablePath.replace(/^workflows\//, '');
        return processed;
    }, [rawWidgetablePath]);

    useEffect(() => {
        sdpppSDK.logger('widgetablePath', widgetablePath, 'currentWorkflow', currentWorkflow);
        if (widgetablePath === currentWorkflow && currentWorkflow) {
            setView('detail');
        } else {
            setView('list');
        }
    }, [currentWorkflow, widgetablePath]);

    return (
        <SDPPPErrorBoundary>
            <WorkflowList hidden={view === 'detail'} currentWorkflow={currentWorkflow} setCurrentWorkflow={setCurrentWorkflow} />
            {view === "detail" && <WorkflowDetail currentWorkflow={currentWorkflow} setCurrentWorkflow={setCurrentWorkflow} />}
        </SDPPPErrorBoundary>
    );
}

class SDPPPErrorBoundary extends Component<any, any> {
    state = {
        error: undefined,
        info: { componentStack: '' }
    };
    componentDidCatch(error: Error | null, info: object): void {
        this.setState({ error, info });
    }
    render() {
        const error = this.state.error as Error | undefined;
        if (error) {
            return <Alert message={error.message} type="error" />
        }
        return this.props.children;
    }
}