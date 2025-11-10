export declare const RESOURCE_SCHEME = "uxp://";
export type ResourceType = "image" | "mask" | "file";
export type ResourceId = `${typeof RESOURCE_SCHEME}${string}`;
export interface ResourceData {
    buffer?: Uint8Array;
    mime?: string;
    path?: string;
    [key: string]: unknown;
}
export interface ResourceThumbnailCache {
    base64: string;
    width?: number;
    height?: number;
    mime?: string;
    generatedAt: number;
}
export interface ResourceEntry {
    type: ResourceType;
    data: ResourceData;
    originalMeta?: Record<string, unknown>;
    thumbnailCache?: ResourceThumbnailCache;
}
export interface ResourceListing {
    id: ResourceId;
    entry: ResourceEntry;
}
export declare function createResourceId(type: ResourceType, suffix?: string): ResourceId;
export declare function isResourceId(value: unknown): value is ResourceId;
export declare function assertResourceId(value: unknown, message?: string): ResourceId;
export declare function getResourceType(resourceId: ResourceId): ResourceType | null;
//# sourceMappingURL=resource-types.d.ts.map