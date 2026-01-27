import React, { useCallback, useEffect, useState, createContext, useContext, ReactNode, useRef } from "react";
import { defaultComfyDataSource } from "./comfy-workflow-datasource";
import { useStore } from "zustand";
import { sdpppSDK } from "@sdppp/common";

export interface Workflow {
    path: string;
    isDir: boolean;
    thumbnailPath?: string;
    meta: Record<string, any>; 
}

export interface WorkflowDataSource {
    listWorkflows(): Promise<Workflow[]>;
    getWorkflowJSON(workflowPath: string): Promise<any>;
}

export interface TreeNodeData {
    key: string;
    title: string;
    isLeaf: boolean;
    children?: TreeNodeData[];
    workflow?: Workflow;
}

const log = sdpppSDK.logger.extend('workflow-provider');

function useWorkflowList(dataSource: WorkflowDataSource = defaultComfyDataSource) {
    const [allWorkflowList, setAllWorkflowList] = useState<Record<string, Workflow>>({});
    const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const comfyWebviewConnectStatus = useStore(sdpppSDK.stores.PhotoshopStore, (state) => state.comfyWebviewConnectStatus);

    // Build tree structure from flat workflow list
    const buildTreeData = useCallback((workflows: Record<string, Workflow>): TreeNodeData[] => {
        const tree: TreeNodeData[] = [];
        const pathMap: Record<string, TreeNodeData> = {};

        // Sort paths to ensure parent directories are processed before children
        const sortedPaths = Object.keys(workflows).sort();

        sortedPaths.forEach(path => {
            const workflow = workflows[path];
            const pathParts = path.split('/').filter(part => part !== '');

            // Build the path hierarchy
            let currentPath = '';
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                const parentPath = currentPath;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (!pathMap[currentPath]) {
                    const isLeaf = i === pathParts.length - 1 && !workflow.isDir;
                    const node: TreeNodeData = {
                        key: currentPath,
                        title: part,
                        isLeaf,
                        children: isLeaf ? undefined : [],
                        workflow: isLeaf ? workflow : undefined
                    };

                    pathMap[currentPath] = node;

                    if (parentPath && pathMap[parentPath]) {
                        pathMap[parentPath].children!.push(node);
                    } else {
                        tree.push(node);
                    }
                }
            }
        });

        // Sort children in each node: folders first, then files
        const sortTreeNodes = (nodes: TreeNodeData[]): TreeNodeData[] => {
            return nodes.sort((a, b) => {
                // Folders first, then files
                if (!a.isLeaf && b.isLeaf) return -1;
                if (a.isLeaf && !b.isLeaf) return 1;
                // Same type, sort alphabetically
                return a.title.localeCompare(b.title);
            }).map(node => ({
                ...node,
                children: node.children ? sortTreeNodes(node.children) : undefined
            }));
        };

        return sortTreeNodes(tree);
    }, []);

    const doFetchWorkflowList = useCallback(async () => {
        try {
            setError(null);
            setLoading(true);
            setAllWorkflowList({});
            setTreeData([]);

            const workflows = await dataSource.listWorkflows();
            const workflowList: Record<string, Workflow> = workflows
                .reduce((acc: Record<string, Workflow>, workflow: Workflow) => {
                    acc[workflow.path] = workflow;
                    return acc;
                }, {} as Record<string, Workflow>);

            setAllWorkflowList(workflowList);
            setTreeData(buildTreeData(workflowList));

        } catch (error: any) {
            setError(error.stack || error.message || error.toString());

        } finally {
            setLoading(false);
        }
    }, [dataSource, buildTreeData]);

    const getWorkflowJSON = useCallback(async (workflowPath: string) => {
        return await dataSource.getWorkflowJSON(workflowPath);
    }, [dataSource]);

    // Track connect status changes to trigger fetch only when becoming connected
    const prevStatusRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        const prev = prevStatusRef.current;
        if (comfyWebviewConnectStatus === "connected") {
            // If just became connected (including initial mount when already connected), refetch once
            if (prev !== "connected") {
                doFetchWorkflowList();
            }
        }
        // Update previous status
        prevStatusRef.current = comfyWebviewConnectStatus;
    }, [comfyWebviewConnectStatus, doFetchWorkflowList]);

    // Handle expand/collapse - allow multiple folders to be expanded
    const handleExpand = useCallback((newExpandedKeys: string[]) => {
        setExpandedKeys(newExpandedKeys);
    }, []);

    return {
        // Tree data for DirectoryTree
        treeData,
        expandedKeys,
        onExpand: handleExpand,

        loading,
        error,
        refetch: () => {
            // Avoid fetching when not connected
            if (comfyWebviewConnectStatus !== "connected") return;
            doFetchWorkflowList();
        },

        // 全量数据
        allWorkflowList: allWorkflowList,

        // 获取工作流JSON内容
        getWorkflowJSON,
    };
}

interface WorkflowListContextType {
    treeData: TreeNodeData[];
    expandedKeys: string[];
    onExpand: (expandedKeys: string[]) => void;
    loading: boolean;
    error: string | null;
    refetch: () => void;
    allWorkflowList: Record<string, Workflow>;
    getWorkflowJSON: (workflowPath: string) => Promise<any>;
}

const WorkflowListContext = createContext<WorkflowListContextType | undefined>(undefined);

export function WorkflowListProvider({ children, dataSource }: { children: ReactNode; dataSource?: WorkflowDataSource }) {
    const workflowListValue = useWorkflowList(dataSource);
    
    return React.createElement(WorkflowListContext.Provider, { value: workflowListValue }, children);
}

export function useWorkflowListContext() {
    const context = useContext(WorkflowListContext);
    if (context === undefined) {
        throw new Error('useWorkflowListContext must be used within a WorkflowListProvider');
    }
    return context;
}
