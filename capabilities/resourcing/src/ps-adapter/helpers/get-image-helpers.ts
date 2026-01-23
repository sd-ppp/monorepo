import { BoundaryRectSchema } from "@sdppp/common/schemas/schemas";
import type { z } from "zod";

import type { BoundaryRect } from "../types/boundary-rect-utils";

const BOUNDARY_HOST = "boundary";
const CONTENT_HOST = "content";
const MASK_HOST = "mask";

type BoundaryRectShape = z.infer<typeof BoundaryRectSchema>;

export interface ParsedBoundaryResource {
    docId: number;
    boundary: "canvas" | "curlayer" | "selection" | BoundaryRectShape;
    imageSize?: number;
    imageQuality?: number;
}

export interface ParsedContentResource {
    docId: number;
    content: "canvas" | "curlayer" | "selection";
    layerIdentify?: string;
}

export type MaskType = ParsedContentResource["content"] | "empty";

export interface ParsedMaskContentResource {
    docId: number;
    maskType: MaskType;
    /**
     * @deprecated use maskType instead.
     */
    content: MaskType;
    layerIdentify?: string;
    reverse?: boolean;
}

function ensureFiniteNumber(value: number, label: string): void {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number`);
    }
}

function parseNumberQuery(url: URL, key: string): number | undefined {
    const raw = url.searchParams.get(key);
    if (raw == null || raw === "") {
        return undefined;
    }
    const num = Number(raw);
    ensureFiniteNumber(num, key);
    return num;
}

function composeLayerIdentify(layerId?: string | null, layerName?: string | null): string | undefined {
    const id = layerId?.trim();
    const name = layerName?.trim();
    if (name && id) {
        return `${name} (id:${id})`;
    }
    if (name) {
        return name;
    }
    if (id) {
        return `${id} (id:${id})`;
    }
    return undefined;
}

export function parseBoundaryResource(resource: string): ParsedBoundaryResource {
    if (typeof resource !== "string" || resource.trim() === "") {
        throw new Error("boundary must be a non-empty string");
    }
    let url: URL;
    try {
        url = new URL(resource);
    } catch {
        throw new Error(`Invalid boundary uri: ${resource}`);
    }
    if (url.protocol !== "uxp:") {
        throw new Error("boundary uri must use uxp:// scheme");
    }
    if (url.hostname !== BOUNDARY_HOST) {
        throw new Error(`boundary uri host must be "${BOUNDARY_HOST}"`);
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
        throw new Error("boundary uri is missing required segments");
    }

    const docIdRaw = segments[0];
    const docId = Number(docIdRaw);
    ensureFiniteNumber(docId, "docId");
    if (!Number.isInteger(docId) || docId < 0) {
        throw new Error("docId must be a non-negative integer");
    }

    const boundaryType = segments[1];
    if (boundaryType === "rect") {
        const rectKeys: Array<keyof BoundaryRectShape> = [
            "leftDistance",
            "topDistance",
            "rightDistance",
            "bottomDistance",
            "width",
            "height"
        ];
        const rect: Partial<BoundaryRectShape> = {};
        for (const key of rectKeys) {
            const value = parseNumberQuery(url, key);
            if (value === undefined) {
                throw new Error(`boundary rect missing query parameter "${key}"`);
            }
            rect[key] = value;
        }
        return {
            docId,
            boundary: rect as BoundaryRect,
            imageSize: parseNumberQuery(url, "imageSize"),
            imageQuality: parseNumberQuery(url, "imageQuality")
        };
    }

    if (boundaryType !== "canvas" && boundaryType !== "curlayer" && boundaryType !== "selection") {
        throw new Error(`Unsupported boundary type "${boundaryType}"`);
    }

    return {
        docId,
        boundary: boundaryType,
        imageSize: parseNumberQuery(url, "imageSize"),
        imageQuality: parseNumberQuery(url, "imageQuality")
    };
}

export function parseContentResource(resource: string): ParsedContentResource {
    if (typeof resource !== "string" || resource.trim() === "") {
        throw new Error("content must be a non-empty string");
    }
    let url: URL;
    try {
        url = new URL(resource);
    } catch {
        throw new Error(`Invalid content uri: ${resource}`);
    }

    if (url.protocol !== "uxp:") {
        throw new Error("content uri must use uxp:// scheme");
    }
    if (url.hostname !== CONTENT_HOST) {
        throw new Error(`content uri host must be "${CONTENT_HOST}"`);
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
        throw new Error("content uri is missing required segments");
    }

    const docIdRaw = segments[0];
    const docId = Number(docIdRaw);
    ensureFiniteNumber(docId, "docId");
    if (!Number.isInteger(docId) || docId < 0) {
        throw new Error("docId must be a non-negative integer");
    }

    const contentType = segments[1];
    const layerIdParam = url.searchParams.get("layerid");
    const layerNameParam = url.searchParams.get("layername");

    switch (contentType) {
        case "canvas":
            return { docId, content: "canvas" };
        case "curlayer":
            return {
                docId,
                content: "curlayer",
                layerIdentify: composeLayerIdentify(layerIdParam ?? undefined, layerNameParam ?? undefined)
            };
        case "selection":
            return { docId, content: "selection" };
        case "layer": {
            const layerId = layerIdParam;
            if (!layerId) {
                throw new Error("content uri with /layer requires layerid query parameter");
            }
            return {
                docId,
                content: "curlayer",
                layerIdentify: composeLayerIdentify(layerId, layerNameParam ?? undefined)
            };
        }
        default:
            throw new Error(`Unsupported content type "${contentType}"`);
    }
}

export function parseMaskContentResource(resource: string): ParsedMaskContentResource {
    if (typeof resource !== "string" || resource.trim() === "") {
        throw new Error("mask content must be a non-empty string");
    }
    let url: URL;
    try {
        url = new URL(resource);
    } catch {
        throw new Error(`Invalid mask content uri: ${resource}`);
    }

    if (url.protocol !== "uxp:") {
        throw new Error("mask content uri must use uxp:// scheme");
    }
    if (url.hostname !== MASK_HOST) {
        throw new Error(`mask content uri host must be "${MASK_HOST}"`);
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
        throw new Error("mask content uri is missing required segments");
    }

    const docIdRaw = segments[0];
    const docId = Number(docIdRaw);
    ensureFiniteNumber(docId, "docId");
    if (!Number.isInteger(docId) || docId < 0) {
        throw new Error("docId must be a non-negative integer");
    }

    const contentType = segments[1];
    const layerIdParam = url.searchParams.get("layerid");
    const reverseParam = url.searchParams.get("reverse");
    const reverse = reverseParam === "1" || reverseParam?.toLowerCase?.() === "true";

    switch (contentType) {
        case "canvas":
            return { docId, maskType: "canvas", content: "canvas", reverse };
        case "curlayer":
            return {
                docId,
                maskType: "curlayer",
                content: "curlayer",
                reverse,
                layerIdentify: layerIdParam ?? undefined
            };
        case "selection":
            return { docId, maskType: "selection", content: "selection", reverse };
        case "empty":
            return { docId, maskType: "empty", content: "empty", reverse };
        case "layer": {
            const layerId = layerIdParam;
            if (!layerId) {
                throw new Error("mask content uri with /layer requires layerid query parameter");
            }
            return {
                docId,
                maskType: "curlayer",
                content: "curlayer",
                layerIdentify: layerId,
                reverse
            };
        }
        default:
            throw new Error(`Unsupported mask content type "${contentType}"`);
    }
}

export function buildGetImageParamsFromResources(boundaryResource: string, contentResource: string): {
    boundary: "canvas" | "curlayer" | "selection" | BoundaryRect;
    content: "canvas" | "curlayer" | "selection";
    imageSize: number;
    imageQuality: number;
    layer_identify: string | null;
} {
    const boundary = parseBoundaryResource(boundaryResource);
    const content = parseContentResource(contentResource);

    if (boundary.docId !== content.docId) {
        throw new Error("boundary and content must target the same document");
    }

    return {
        boundary: boundary.boundary,
        content: content.content,
        imageSize: boundary.imageSize ?? 0,
        imageQuality: boundary.imageQuality ?? 1,
        layer_identify: content.layerIdentify ?? null
    };
}

export function buildGetMaskParamsFromResources(boundaryResource: string, maskContentResource: string): {
    boundary: "canvas" | "curlayer" | "selection" | BoundaryRect;
    maskType: MaskType;
    content: MaskType;
    imageSize: number;
    reverse: boolean;
    layer_identify: string | null;
} {
    const boundary = parseBoundaryResource(boundaryResource);
    const mask = parseMaskContentResource(maskContentResource);

    if (boundary.docId !== mask.docId) {
        throw new Error("boundary and mask content must target the same document");
    }

    return {
        boundary: boundary.boundary,
        maskType: mask.maskType,
        content: mask.maskType,
        imageSize: boundary.imageSize ?? 0,
        reverse: mask.reverse ?? false,
        layer_identify: mask.layerIdentify ?? null
    };
}
