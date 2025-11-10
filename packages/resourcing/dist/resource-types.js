import { v4 as uuidv4 } from "uuid";
export const RESOURCE_SCHEME = "uxp://";
export function createResourceId(type, suffix) {
    const idSegment = suffix ?? uuidv4();
    return `${RESOURCE_SCHEME}${type}/${idSegment}`;
}
export function isResourceId(value) {
    return typeof value === "string" && value.startsWith(RESOURCE_SCHEME);
}
export function assertResourceId(value, message = "Expected a uxp:// resource id") {
    if (!isResourceId(value)) {
        throw new TypeError(message);
    }
    return value;
}
export function getResourceType(resourceId) {
    const segment = resourceId.slice(RESOURCE_SCHEME.length).split("/", 1)[0];
    if (segment === "image" || segment === "mask" || segment === "file") {
        return segment;
    }
    return null;
}
//# sourceMappingURL=resource-types.js.map