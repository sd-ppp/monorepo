export interface McpMeshLike {
    implementAction: (name: string, handler: (...args: any[]) => any) => void;
}
export interface MaterializedPayload {
    buffer: Uint8Array;
    mime?: string;
    name?: string;
    width?: number;
    height?: number;
    thumbnail?: string;
    meta?: Record<string, unknown>;
}
export interface MaterializedCbmPayload {
    type: "image" | "mask";
    image: Jimp;
    thumbnail?: string;
    mime?: string;
    meta?: Record<string, unknown>;
}
export interface CreateFromCbmParams {
    contentUri?: string;
    boundaryUri?: string;
    maskUri?: string;
}
export interface ImagingActionContext {
    mcpMesh: McpMeshLike;
    materializers?: {
        fromLocalFile?: (request?: Record<string, unknown>) => Promise<MaterializedPayload>;
        fromCBM?: (request: CreateFromCbmParams) => Promise<MaterializedCbmPayload>;
    };
    resolvers?: {
        boundaryToRect?: (boundaryUri: string) => Promise<string>;
        contentToLayer?: (contentUri: string) => Promise<string>;
        maskToLayer?: (maskUri: string) => Promise<string>;
    };
}
//# sourceMappingURL=context.d.ts.map