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

export interface ImagingActionContext {
  mcpMesh: McpMeshLike;
  materializers?: {
    fromLocalFile?: (request?: Record<string, unknown>) => Promise<MaterializedPayload>;
    fromCBM?: (request: {
      contentUri?: string;
      boundaryUri?: string;
      maskUri?: string;
      options?: Record<string, unknown>;
    }) => Promise<MaterializedPayload>;
  };
  resolvers?: {
    boundaryToRect?: (boundaryUri: string) => Promise<string>;
    contentToLayer?: (contentUri: string) => Promise<string>;
    maskToLayer?: (maskUri: string) => Promise<string>;
  };
}
