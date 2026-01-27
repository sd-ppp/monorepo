import { sdpppSDK } from '@sdppp/common';
import { Workflow, WorkflowDataSource } from "./workflow-provider";

class ComfyWorkflowDataSource implements WorkflowDataSource {
    async listWorkflows(): Promise<Workflow[]> {
        const listResult = await sdpppSDK.plugins.ComfyCaller.listWorkflows({});
        return listResult.workflows.map((workflow: string) => ({
            path: workflow,
            isDir: false,
            meta: {}
        }));
    }

    async getWorkflowJSON(workflowPath: string): Promise<any> {
        throw new Error("getWorkflowJSON not implemented");
    }
}

export const defaultComfyDataSource = new ComfyWorkflowDataSource();