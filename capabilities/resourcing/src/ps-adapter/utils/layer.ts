import { app, constants } from "photoshop";
import type { Document } from "photoshop/dom/Document";
import type { Layer } from "photoshop/dom/Layer";
import { t } from "@sdppp/common";

import { SpeicialIDManager } from "../state/special-id-manager";
import { BoundaryRectUtils, type BoundaryRect } from "../types/boundary-rect-utils";

function makeLayerIdentify(id: number, name: string, level = 0): string {
    return `${"-".repeat(level)}${name} (id:${id})`;
}

export function getSelectedLayerIdentify(): string {
    const layer = app.activeDocument?.activeLayers?.[0];
    if (!layer) return SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS();
    return makeLayerIdentify(layer.id, layer.name);
}

export function getAllSubLayer(layer: Layer | Document, level = 0, parentPath = ""): Array<{
    layer: Layer;
    path: string;
    level: number;
}> {
    if (!("layers" in layer) || !layer.layers) return [];
    return layer.layers.reduce((ret: Array<{ layer: Layer; path: string; level: number }>, subLayer: Layer) => {
        const path = level === 0 ? `/${subLayer.name}` : `${parentPath}/${subLayer.name}`;
        ret.push({
            layer: subLayer,
            path,
            level
        });
        return ret.concat(getAllSubLayer(subLayer, level + 1, path));
    }, []);
}

export function findInAllSubLayerByName(rootLayer: Document | Layer, name: string): Layer | null {
    if (!("layers" in rootLayer) || !rootLayer.layers) return null;
    for (const layer of rootLayer.layers) {
        if (layer.name === name) return layer;

        const result = findInAllSubLayerByName(layer, name);
        if (result) return result;
    }
    return null;
}

export function findInAllSubLayer(rootLayer: Document | Layer, layerid: number): Layer | null {
    if (!("layers" in rootLayer) || !rootLayer.layers) return null;
    for (const layer of rootLayer.layers) {
        if (layer.id === layerid) return layer;

        const result = findInAllSubLayer(layer, layerid);
        if (result) return result;
    }
    return null;
}

export async function getRasterizedLayer(document: Document, layerID: number): Promise<[Layer | null, boolean]> {
    if (layerID <= 0) return [null, false];
    const layer = findInAllSubLayer(document, layerID);
    if (!layer) throw new Error(t("layer not found {{0}}", { "0": layerID }));
    if (layer.kind === constants.LayerKind.GROUP) {
        const mergedLayer = await mergeGroupLayer(layer, document);
        if (!mergedLayer) throw new Error(t("merge group failed"));
        return [mergedLayer, true];
    } else if (layer.kind === constants.LayerKind.GRADIENTFILL) {
        const dupLayer = await layer.duplicate(document);
        await dupLayer?.rasterize(constants.RasterizeType.ENTIRELAYER);
        return [dupLayer, true];
    }
    return [layer, false];
}

export async function mergeGroupLayer(layer: Layer, document: Document): Promise<Layer | null> {
    let visibleOriginal = true;
    if (!layer.visible) {
        layer.visible = true;
        visibleOriginal = false;
    }
    const dupLayer = await layer.duplicate(document);
    const mergedLayer = await dupLayer?.merge();
    if (!visibleOriginal) layer.visible = false;

    return mergedLayer || null;
}

export function getLayerInfoFromLayer(document: Document, layer: Layer): {
    name: string;
    opacity: number;
    boundary: BoundaryRect;
    isGroup: boolean;
} {
    const docWidth = Number(document.width) || 0;
    const docHeight = Number(document.height) || 0;
    const layerBounds = layer.bounds ?? null;
    const boundary = layerBounds
        ? BoundaryRectUtils.fromPhotoshopBounds(
            {
                left: Number(layerBounds.left ?? 0),
                top: Number(layerBounds.top ?? 0),
                right: Number(layerBounds.right ?? docWidth),
                bottom: Number(layerBounds.bottom ?? docHeight)
            },
            docWidth,
            docHeight
        )
        : BoundaryRectUtils.fromPositionAndSize(0, 0, docWidth, docHeight, docWidth, docHeight);

    return {
        name: layer.name,
        opacity: layer.opacity / 100,
        boundary,
        isGroup: layer.kind === constants.LayerKind.GROUP
    };
}
