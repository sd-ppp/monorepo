import type { Jimp } from "jimp";

export interface McpMeshLike {
  implementAction: (name: string, handler: (...args: any[]) => any) => void;
  store?: {
    getState?: () => any;
    setState?: (partial: Record<string, unknown>) => void;
    subscribe?: (listener: (state: any, prevState: any) => void) => () => void;
  };
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
  mime?: string;
  meta?: Record<string, unknown>;
}

export interface CreateByContentParams {
  contentUri: string;
  maskUri?: undefined;
  options?: Record<string, unknown>;
}

export interface CreateByMaskParams {
  maskUri: string;
  contentUri?: undefined;
  options?: Record<string, unknown>;
}

export interface CombineByCbmParams {
  contentUri: string;
  boundaryUri: string;
  maskUri?: string | null;
  thumbnail?: boolean;
  options?: Record<string, unknown>;
}

export interface ImagingActionContext {
  mcpMesh: McpMeshLike;
  materializers?: {
    fromLocalFile?: (request?: Record<string, unknown>) => Promise<MaterializedPayload>;
    fromContent?: (request: CreateByContentParams) => Promise<MaterializedCbmPayload>;
    fromMask?: (request: CreateByMaskParams) => Promise<MaterializedCbmPayload>;
    combineCBM?: (request: CombineByCbmParams) => Promise<MaterializedCbmPayload>;
  };
  resolvers?: {
    boundaryToRect?: (boundaryUri: string) => Promise<string>;
    contentToLayer?: (contentUri: string) => Promise<string>;
    maskToLayer?: (maskUri: string) => Promise<string>;
  };
}
