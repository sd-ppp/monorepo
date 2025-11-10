import { BoundaryRectSchema } from "@sdppp/common/schemas/schemas";
import type { z } from "zod";
export declare const UXP_PROTOCOL = "uxp:";
export declare const FILE_HOST = "file";
export declare const BOUNDARY_HOST = "boundary";
export declare const CONTENT_HOST = "content";
export declare const MASK_HOST = "mask";
export declare const FILE_SCHEME = "uxp://file";
export declare const BOUNDARY_SCHEME = "uxp://boundary";
export declare const CONTENT_SCHEME = "uxp://content";
export declare const MASK_SCHEME = "uxp://mask";
export type UxpUriBrand<TName extends string> = string & {
    __uxpUriBrand: TName;
};
export type FileUri = UxpUriBrand<typeof FILE_HOST>;
export type BoundaryUri = UxpUriBrand<typeof BOUNDARY_HOST>;
export type ContentUri = UxpUriBrand<typeof CONTENT_HOST>;
export type MaskUri = UxpUriBrand<typeof MASK_HOST>;
export type BoundaryRect = z.infer<typeof BoundaryRectSchema>;
export type BoundaryPrimitive = "canvas" | "curlayer" | "selection";
export type BoundarySetting = BoundaryRect | BoundaryPrimitive | null;
export type ContentType = "canvas" | "curlayer" | "selection";
export type BoundaryResource = string | null;
export interface ParsedBoundaryResource {
    docId: number;
    boundary: BoundarySetting;
    imageSize?: number;
    imageQuality?: number;
}
export interface ParsedContentResource {
    docId: number;
    content: ContentType;
    layerIdentify?: string;
}
export interface ParsedMaskResource extends ParsedContentResource {
    reverse?: boolean;
}
export declare function boundaryResourceFromSetting(boundary: BoundarySetting | undefined | null): BoundaryResource;
export declare function parseBoundaryResource(resource: string): ParsedBoundaryResource;
export declare function parseContentResource(resource: string): ParsedContentResource;
export declare function parseMaskResource(resource: string): ParsedMaskResource;
export declare function buildBoundaryUri(docId: number, boundary: BoundarySetting, options?: {
    imageSize?: number;
    imageQuality?: number;
}): string;
export declare function buildContentUri(docId: number, content: ContentType, layerIdentify?: string | null): string;
export declare function buildMaskContentUri(docId: number, content: ContentType, layerIdentify?: string | null, reverse?: boolean): string;
export declare function extractDocIdFromUris(uris: Array<string | null | undefined>): number | null;
//# sourceMappingURL=resource-uris.d.ts.map