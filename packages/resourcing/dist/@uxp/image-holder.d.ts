import type { ResourceEntry, ResourceId, ResourceListing } from "../resource-types.js";
export declare function createResource(entry: ResourceEntry): ResourceId;
export declare function resolveResource(resourceId: ResourceId): ResourceEntry | undefined;
export declare function updateResource(resourceId: ResourceId, entry: Partial<ResourceEntry>): void;
export declare function deleteResource(resourceId: ResourceId): void;
export declare function clearResources(): void;
export declare function listResources(): ResourceListing[];
export declare function addImageHolder(imagePromise: Promise<{
    file_buffer: Uint8Array;
    file_mimetype: string;
}>): ResourceId;
export declare function removeImageHolder(fileToken: string): void;
export declare function getImageHolder(fileToken: string): Promise<{
    file_buffer: Uint8Array;
    file_mimetype: string;
} | undefined>;
export declare function resolveResourceBuffer(resourceOrToken: string): Promise<{
    buffer: Uint8Array;
    mime?: string;
}>;
export declare function ensureResourceTempFile(resourceOrToken: string, options?: {
    extensionHint?: string;
}): Promise<string>;
export type { ResourceEntry, ResourceListing, ResourceThumbnailCache, ResourceType };
//# sourceMappingURL=image-holder.d.ts.map