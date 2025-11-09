export const UXP_PROTOCOL = "uxp:";
export const FILE_HOST = "file";
export const BOUNDARY_HOST = "boundary";
export const CONTENT_HOST = "content";
export const MASK_HOST = "mask";
export const FILE_SCHEME = `uxp://${FILE_HOST}`;
export const BOUNDARY_SCHEME = `uxp://${BOUNDARY_HOST}`;
export const CONTENT_SCHEME = `uxp://${CONTENT_HOST}`;
export const MASK_SCHEME = `uxp://${MASK_HOST}`;
const RECT_QUERY_KEYS = [
    "leftDistance",
    "topDistance",
    "rightDistance",
    "bottomDistance",
    "width",
    "height"
];
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
function normalizeDocId(docId) {
    const numeric = Number(docId);
    if (!Number.isFinite(numeric))
        return 0;
    const normalized = Math.floor(numeric);
    return normalized < 0 ? 0 : normalized;
}
function appendQuery(base, params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "")
            continue;
        searchParams.set(key, String(value));
    }
    const query = searchParams.toString();
    return query ? `${base}?${query}` : base;
}
function ensureFiniteNumber(value, label) {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number`);
    }
}
function parseNumberQuery(url, key) {
    const raw = url.searchParams.get(key);
    if (raw == null || raw === "")
        return undefined;
    const num = Number(raw);
    ensureFiniteNumber(num, key);
    return num;
}
function serializeBoundaryRect(rect) {
    const serialized = {};
    for (const key of RECT_QUERY_KEYS) {
        serialized[key] = Number(rect[key]);
    }
    return serialized;
}
function deserializeBoundaryRect(url) {
    const rect = {};
    for (const key of RECT_QUERY_KEYS) {
        const value = parseNumberQuery(url, key);
        if (value === undefined) {
            throw new Error(`boundary rect missing query parameter "${key}"`);
        }
        rect[key] = value;
    }
    return rect;
}
function ensureUxpUrl(uri, expectedHost) {
    let parsed;
    try {
        parsed = new URL(uri);
    }
    catch {
        throw new Error(`Invalid ${expectedHost} uri: ${uri}`);
    }
    if (parsed.protocol !== UXP_PROTOCOL) {
        throw new Error(`${expectedHost} uri must use uxp:// scheme`);
    }
    if (parsed.hostname !== expectedHost) {
        throw new Error(`${expectedHost} uri host must be "${expectedHost}"`);
    }
    const [docSegment, ...rest] = parsed.pathname.split("/").filter(Boolean);
    if (!docSegment) {
        throw new Error(`${expectedHost} uri is missing required segments`);
    }
    const docId = Number(docSegment);
    ensureFiniteNumber(docId, "docId");
    if (!Number.isInteger(docId) || docId < 0) {
        throw new Error("docId must be a non-negative integer");
    }
    return { parsed, docId, segments: rest };
}
export function boundaryResourceFromSetting(boundary) {
    if (!boundary)
        return null;
    if (boundary === "canvas" || boundary === "curlayer" || boundary === "selection") {
        return `${BOUNDARY_SCHEME}/${boundary}`;
    }
    const serialized = RECT_QUERY_KEYS.map((key) => {
        const value = boundary[key];
        return isFiniteNumber(value) ? value : 0;
    });
    return `${BOUNDARY_SCHEME}/rect/${serialized.join(",")}`;
}
export function parseBoundaryResource(resource) {
    const { parsed, docId, segments } = ensureUxpUrl(resource, BOUNDARY_HOST);
    const boundaryType = segments[0];
    if (!boundaryType || boundaryType === "canvas" || boundaryType === "curlayer" || boundaryType === "selection") {
        return {
            docId,
            boundary: boundaryType ?? "canvas",
            imageSize: parseNumberQuery(parsed, "imageSize"),
            imageQuality: parseNumberQuery(parsed, "imageQuality")
        };
    }
    if (boundaryType !== "rect") {
        throw new Error(`Unsupported boundary type "${boundaryType}"`);
    }
    return {
        docId,
        boundary: deserializeBoundaryRect(parsed),
        imageSize: parseNumberQuery(parsed, "imageSize"),
        imageQuality: parseNumberQuery(parsed, "imageQuality")
    };
}
export function parseContentResource(resource) {
    const { parsed, docId, segments } = ensureUxpUrl(resource, CONTENT_HOST);
    const contentType = segments[0];
    if (!contentType) {
        throw new Error("content uri is missing required segments");
    }
    if (contentType === "canvas" || contentType === "selection") {
        return {
            docId,
            content: contentType
        };
    }
    if (contentType === "curlayer") {
        return {
            docId,
            content: "curlayer",
            layerIdentify: parsed.searchParams.get("layerId") ?? undefined
        };
    }
    if (contentType === "layer") {
        const layerIdentify = parsed.searchParams.get("layerId");
        if (!layerIdentify) {
            throw new Error("content uri with /layer requires layerId query parameter");
        }
        return {
            docId,
            content: "curlayer",
            layerIdentify
        };
    }
    throw new Error(`Unsupported content type "${contentType}"`);
}
export function parseMaskResource(resource) {
    const { parsed, docId, segments } = ensureUxpUrl(resource, MASK_HOST);
    const contentType = segments[0];
    if (!contentType) {
        throw new Error("mask content uri is missing required segments");
    }
    const reverseParam = parsed.searchParams.get("reverse");
    const reverse = reverseParam === "1" || reverseParam?.toLowerCase() === "true";
    if (contentType === "canvas" || contentType === "selection") {
        return { docId, content: contentType, reverse };
    }
    if (contentType === "curlayer") {
        return {
            docId,
            content: "curlayer",
            reverse,
            layerIdentify: parsed.searchParams.get("layerId") ?? undefined
        };
    }
    if (contentType === "layer") {
        const layerIdentify = parsed.searchParams.get("layerId");
        if (!layerIdentify) {
            throw new Error("mask content uri with /layer requires layerId query parameter");
        }
        return {
            docId,
            content: "curlayer",
            layerIdentify,
            reverse
        };
    }
    throw new Error(`Unsupported mask content type "${contentType}"`);
}
export function buildBoundaryUri(docId, boundary, options) {
    const docSegment = normalizeDocId(docId);
    if (!boundary || boundary === "canvas" || boundary === "curlayer" || boundary === "selection") {
        return appendQuery(`${BOUNDARY_SCHEME}/${docSegment}/${boundary ?? "canvas"}`, {
            imageSize: options?.imageSize,
            imageQuality: options?.imageQuality
        });
    }
    return appendQuery(`${BOUNDARY_SCHEME}/${docSegment}/rect`, {
        ...serializeBoundaryRect(boundary),
        imageSize: options?.imageSize,
        imageQuality: options?.imageQuality
    });
}
export function buildContentUri(docId, content, layerIdentify) {
    const docSegment = normalizeDocId(docId);
    if (content === "curlayer") {
        if (layerIdentify && layerIdentify !== "") {
            return appendQuery(`${CONTENT_SCHEME}/${docSegment}/layer`, { layerId: layerIdentify });
        }
        return `${CONTENT_SCHEME}/${docSegment}/curlayer`;
    }
    return `${CONTENT_SCHEME}/${docSegment}/${content}`;
}
export function buildMaskContentUri(docId, content, layerIdentify, reverse) {
    const docSegment = normalizeDocId(docId);
    if (content === "curlayer") {
        return appendQuery(`${MASK_SCHEME}/${docSegment}/layer`, {
            layerId: layerIdentify ?? undefined,
            reverse: reverse ? 1 : undefined
        });
    }
    return appendQuery(`${MASK_SCHEME}/${docSegment}/${content}`, {
        reverse: reverse ? 1 : undefined
    });
}
export function extractDocIdFromUris(uris) {
    for (const uri of uris) {
        if (!uri)
            continue;
        try {
            const parsed = new URL(uri);
            if (parsed.protocol !== UXP_PROTOCOL)
                continue;
            const docSegment = parsed.pathname.split("/").filter(Boolean)[0];
            if (!docSegment)
                continue;
            const numeric = Number(docSegment);
            if (!Number.isFinite(numeric))
                continue;
            const normalized = Math.floor(numeric);
            if (normalized >= 0) {
                return normalized;
            }
        }
        catch {
            continue;
        }
    }
    return null;
}
