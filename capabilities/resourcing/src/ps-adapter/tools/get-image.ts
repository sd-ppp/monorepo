import { constants, imaging } from "photoshop";
import type { Document } from "photoshop/dom/Document";
import type { imaging as imagingType } from "photoshop/dom/ImagingModule";
import type { Layer } from "photoshop/dom/Layer";
import { t } from "@sdppp/common";
import { Jimp, JimpInstance, JimpMime } from "jimp";
import type { getImageActions } from "@sdppp/common/interface/PhotoshopCalleeInterface";
import { logger as sdpppLogger } from "@sdppp/ps-uxp/src/logger";

import { runNextModalState } from "../helpers/modal-state-wrapper";
import {
    applyLayerDataWithTransparent,
    fixAlphaChannel,
    alignPixelBit,
    padAndTrimToDesireBounds as padAndTrimToBounds,
    getScaleRatio,
    getDesireBounds,
    convertSDPPPBoundsToBoundaryRect,
    type ImageBounds,
    scaleBounds
} from "../helpers/image-processing";
import { getLayerID, getDocumentFromIdentify } from "../utils/document";
import { getRasterizedLayer, findInAllSubLayer } from "../utils/layer";
import { SpeicialIDManager } from "../state/special-id-manager";
import { getIntersectBounds } from "../utils/image";

const perfLogger = sdpppLogger.extend("perf");
const PERF_ALLOWED_REGEX = /^fileResource\.(createBy|createFrom)[^.]+\.action$/;

const shouldLogPerf = (label: string): boolean => PERF_ALLOWED_REGEX.test(label);

function createPerfTracker(label: string): (stage: string, extra?: Record<string, unknown>) => void {
    if (!shouldLogPerf(label)) {
        return () => undefined;
    }
    const startedAt = Date.now();
    const logger = perfLogger.extend(label);
    return (stage: string, extra?: Record<string, unknown>) => {
        const elapsed = Date.now() - startedAt;
        if (extra) {
            logger(`${stage} +${elapsed}ms`, extra);
        } else {
            logger(`${stage} +${elapsed}ms`);
        }
    };
}

async function getPixelsData({
    document,
    layer,
    bounds,
    targetSize
}: {
    document: Document;
    layer: Layer | null;
    bounds: ImageBounds;
    targetSize: { width: number; height: number };
}) {
    const log = createPerfTracker("getPixelsData");
    log("start", {
        layerId: layer?.id,
        targetWidth: targetSize.width,
        targetHeight: targetSize.height
    });
    const options: any = {
        documentID: document.id,
        applyAlpha: false,
        hasAlpha: true,
        sourceBounds: bounds,
        targetSize,
        colorSpace: "RGB"
    };
    if (document.mode !== constants.DocumentMode.RGB) {
        Object.assign(options, { colorProfile: "sRGB IEC61966-2.1" });
    }
    if (layer) options.layerID = layer.id;
    const pixels = await imaging.getPixels(options);
    const imageData = pixels.imageData;
    log("imaging.getPixels.resolved", {
        width: imageData?.width,
        height: imageData?.height
    });
    const dataFromAPI = await imageData.getData({});
    Promise.resolve().then(() => {
        imageData.dispose();
    });
    log("completed", {
        width: imageData.width,
        height: imageData.height
    });
    return {
        dataFromAPI,
        width: imageData.width,
        height: imageData.height
    };
}

async function getMaskData({
    document,
    layer,
    bounds,
    targetSize
}: {
    document: Document;
    layer: Layer | null;
    bounds: ImageBounds;
    targetSize: { width: number; height: number };
}) {
    const log = createPerfTracker("getMaskData");
    log("start", {
        layerId: layer?.id,
        targetWidth: targetSize.width,
        targetHeight: targetSize.height
    });
    if (!layer) return null;
    const options = {
        documentID: document.id,
        sourceBounds: bounds,
        targetSize,
        layerID: layer.id
    };
    let mask: imagingType.GetLayerMaskResult | null = null;
    try {
        mask = await imaging.getLayerMask(options);
        log("getLayerMask.resolved", {
            width: mask?.imageData?.width,
            height: mask?.imageData?.height
        });
    } catch {
        return null;
    }
    const imageData = mask.imageData;
    if (!imageData) return null;
    const dataFromAPI = await imageData.getData({});
    Promise.resolve().then(() => {
        imageData.dispose();
    });
    log("completed", {
        width: imageData.width,
        height: imageData.height
    });
    return {
        dataFromAPI,
        width: imageData.width,
        height: imageData.height
    };
}

async function getJimpImageSimple(params: getImageActions["params"]): Promise<JimpInstance> {
    const log = createPerfTracker("getJimpImageSimple");
    log("start", {
        document: params.document_identify,
        layerIdentify: params.layer_identify,
        maxWH: params.max_wh
    });
    const documentIdentify = params.document_identify;
    const document = getDocumentFromIdentify(documentIdentify);
    if (!document) throw new Error(t("document {{0}} not found", { "0": documentIdentify }));

    const layerIdentify = params.layer_identify;
    const layerID = getLayerID(document, layerIdentify);
    const maxWidthHeight = params.max_wh;

    const isCanvas = SpeicialIDManager.is_SPECIAL_LAYER_USE_CANVAS(layerIdentify);
    const layer: Layer | null = !isCanvas && layerID > 0 ? findInAllSubLayer(document, layerID) : null;

    const bounds: Record<string, ImageBounds | null> = {
        origin: layer?.bounds ?? {
            left: 0,
            top: 0,
            right: document.width,
            bottom: document.height,
            width: document.width,
            height: document.height
        },
        intersect: null,
        scaledIntersect: null,
        desire: params.boundary
            ? getDesireBounds(
                document.width,
                document.height,
                convertSDPPPBoundsToBoundaryRect(params.boundary, document.width, document.height)
            )
            : getDesireBounds(document.width, document.height),
        scaledDesire: null
    };
    if (!bounds.desire) throw new Error(t("desire bounds is null"));

    const scaleRatio = getScaleRatio(bounds.desire, maxWidthHeight);
    bounds.scaledDesire = scaleBounds(bounds.desire, scaleRatio);

    bounds.intersect = getIntersectBounds(bounds.origin, bounds.desire);
    if (!bounds.intersect || !bounds.scaledDesire) throw new Error(t("intersect or scaledDesire is null"));
    bounds.scaledIntersect = scaleBounds(bounds.intersect, scaleRatio);

    let pixelDataFromAPIInit: any;
    let maskDataFromAPIInit: any;
    await runNextModalState(async () => {
        log("modalStart");
        [pixelDataFromAPIInit, maskDataFromAPIInit] = await Promise.all([
            getPixelsData({
                document,
                layer,
                bounds: bounds.intersect!,
                targetSize: { width: bounds.scaledIntersect!.width!, height: bounds.scaledIntersect!.height! }
            }),
            getMaskData({
                document,
                layer,
                bounds: bounds.intersect!,
                targetSize: { width: bounds.scaledIntersect!.width!, height: bounds.scaledIntersect!.height! }
            })
        ]);
    }, { commandName: "SDPPP getImage (read-only)", document, suspendHistory: false, dontRecoverSelection: true });
    log("modalEnd");

    if (!pixelDataFromAPIInit) throw new Error(t("get pixel of {{0}} failed", { "0": layerIdentify }));
    let pixelDataFromAPI = alignPixelBit(pixelDataFromAPIInit);

    let layerWithoutTransparent = false;
    if (layer) {
        layerWithoutTransparent = layer.transparentPixelsLocked;
    } else if (isCanvas) {
        layerWithoutTransparent = document.layers.every((l) => l.transparentPixelsLocked);
    }
    if (layerWithoutTransparent) {
        pixelDataFromAPI = fixAlphaChannel(pixelDataFromAPI);
    }

    let pixelData = padAndTrimToBounds(pixelDataFromAPI, bounds.scaledIntersect!, bounds.scaledDesire!);

    let maskData: Uint8Array | null = null;
    if (maskDataFromAPIInit) {
        const alignedMask = alignPixelBit(maskDataFromAPIInit);
        maskData = padAndTrimToBounds(alignedMask, bounds.scaledIntersect!, bounds.scaledDesire!, 1);
    }
    pixelData = applyLayerDataWithTransparent(pixelData, maskData);

    const result = new Jimp({
        data: Buffer.from(pixelData),
        width: bounds.scaledDesire!.width!,
        height: bounds.scaledDesire!.height!
    });
    log("completed", {
        width: result.bitmap.width,
        height: result.bitmap.height
    });
    return result;
}

async function getJimpImageWithHistory(params: getImageActions["params"]): Promise<JimpInstance> {
    const log = createPerfTracker("getJimpImageWithHistory");
    log("start", {
        document: params.document_identify,
        layerIdentify: params.layer_identify,
        maxWH: params.max_wh
    });
    const documentIdentify = params.document_identify;
    const document = getDocumentFromIdentify(documentIdentify);
    if (!document) throw new Error(t("document {{0}} not found", { "0": documentIdentify }));

    const layerIdentify = params.layer_identify;
    const layerID = getLayerID(document, layerIdentify);
    const maxWidthHeight = params.max_wh;

    const bounds: Record<string, ImageBounds | null> = {
        origin: {
            left: 0,
            top: 0,
            right: document.width,
            bottom: document.height,
            width: document.width,
            height: document.height
        },
        intersect: null,
        scaledIntersect: null,
        desire: params.boundary
            ? getDesireBounds(
                document.width,
                document.height,
                convertSDPPPBoundsToBoundaryRect(params.boundary, document.width, document.height)
            )
            : getDesireBounds(document.width, document.height),
        scaledDesire: null
    };
    if (!bounds.desire) throw new Error(t("desire bounds is null"));

    const scaleRatio = getScaleRatio(bounds.desire, maxWidthHeight);
    bounds.scaledDesire = scaleBounds(bounds.desire, scaleRatio);

    let mergedLayer: Layer | null = null;
    let pixelDataFromAPI: any;
    let maskDataFromAPI: any;
    let layerWithoutTransparent = false;

    await runNextModalState(async (restorer) => {
        log("modalStart");
        const [layer, isGroup] = await getRasterizedLayer(document, layerID);
        if (isGroup) mergedLayer = layer;
        if (mergedLayer != null) {
            const tempLayer = mergedLayer;
            restorer.add(async () => {
                try {
                    const deletionResult = tempLayer.delete();
                    if (deletionResult && typeof (deletionResult as Promise<unknown>).then === "function") {
                        await deletionResult;
                    }
                } catch {
                    // ignore cleanup errors
                }
            });
        }

        bounds.origin = layer?.bounds ?? bounds.origin;
        bounds.intersect = getIntersectBounds(bounds.origin!, bounds.desire!);
        bounds.scaledIntersect = scaleBounds(bounds.intersect!, scaleRatio);
        if (!bounds.intersect || !bounds.scaledDesire) throw new Error(t("intersect or scaledDesire is null"));

        [pixelDataFromAPI, maskDataFromAPI] = await Promise.all([
            getPixelsData({
                document,
                layer,
                bounds: bounds.intersect,
                targetSize: { width: bounds.scaledIntersect!.width!, height: bounds.scaledIntersect!.height! }
            }),
            getMaskData({
                document,
                layer,
                bounds: bounds.intersect,
                targetSize: { width: bounds.scaledIntersect!.width!, height: bounds.scaledIntersect!.height! }
            })
        ]);

        layerWithoutTransparent = false;
        if (layer) {
            layerWithoutTransparent = layer.transparentPixelsLocked;
        } else if (SpeicialIDManager.is_SPECIAL_LAYER_USE_CANVAS(layerIdentify)) {
            layerWithoutTransparent = document.layers.every((l) => l.transparentPixelsLocked);
        }
    }, {
        commandName: t("get content of layer {{0}}", { "0": layerIdentify }),
        document
    });
    log("modalEnd", {
        width: bounds.scaledDesire?.width,
        height: bounds.scaledDesire?.height
    });

    if (!pixelDataFromAPI || !bounds.scaledIntersect || !bounds.origin) {
        throw new Error(t("get pixel of {{0}} failed", { "0": layerIdentify }));
    }
    pixelDataFromAPI = alignPixelBit(pixelDataFromAPI);
    if (layerWithoutTransparent) {
        pixelDataFromAPI = fixAlphaChannel(pixelDataFromAPI);
    }

    let pixelData = padAndTrimToBounds(pixelDataFromAPI, bounds.scaledIntersect, bounds.scaledDesire!);

    let maskData: Uint8Array | null = null;
    if (maskDataFromAPI) {
        maskDataFromAPI = alignPixelBit(maskDataFromAPI);
        maskData = padAndTrimToBounds(maskDataFromAPI, bounds.scaledIntersect, bounds.scaledDesire!, 1);
    }
    pixelData = applyLayerDataWithTransparent(pixelData, maskData);

    const result = new Jimp({
        data: Buffer.from(pixelData),
        width: bounds.scaledDesire!.width!,
        height: bounds.scaledDesire!.height!
    });
    log("completed", {
        width: result.bitmap.width,
        height: result.bitmap.height
    });
    return result;
}

async function getJimpImage(params: getImageActions["params"]): Promise<JimpInstance> {
    const log = createPerfTracker("getJimpImage");
    log("start", {
        document: params.document_identify,
        layerIdentify: params.layer_identify,
        boundaryProvided: Boolean(params.boundary)
    });
    const documentIdentify = params.document_identify;
    const document = getDocumentFromIdentify(documentIdentify);
    if (!document) throw new Error(t("document {{0}} not found", { "0": documentIdentify }));

    const layerIdentify = params.layer_identify;
    const layerID = getLayerID(document, layerIdentify);
    const isCanvas = SpeicialIDManager.is_SPECIAL_LAYER_USE_CANVAS(layerIdentify);

    let useSimple = true;
    if (!isCanvas && layerID > 0) {
        const layer = findInAllSubLayer(document, layerID);
        if (layer) {
            if (layer.kind === constants.LayerKind.GROUP || layer.kind === constants.LayerKind.GRADIENTFILL) {
                useSimple = false;
            }
        }
    }
    if (useSimple) {
        log("simplePath");
        const result = await getJimpImageSimple(params);
        log("completed", {
            width: result.bitmap.width,
            height: result.bitmap.height
        });
        return result;
    }
    log("historyPath");
    const result = await getJimpImageWithHistory(params);
    log("completed", {
        width: result.bitmap.width,
        height: result.bitmap.height
    });
    return result;
}

async function getImage(params: getImageActions["params"]): Promise<getImageActions["result"]> {
    const log = createPerfTracker("getImage");
    log("start", {
        document: params.document_identify,
        layerIdentify: params.layer_identify
    });
    const jimpImage = await getJimpImage(params);
    log("jimpReady", {
        width: jimpImage.bitmap.width,
        height: jimpImage.bitmap.height
    });

    const width = jimpImage.bitmap.width;
    const height = jimpImage.bitmap.height;
    const blackImage = new Jimp({ width, height });

    for (let i = 0; i < width * height; i++) {
        blackImage.bitmap.data[i * 4 + 3] = jimpImage.bitmap.data[i * 4 + 3];
    }

    const result = {
        jpegData: new Uint8Array(await jimpImage.getBuffer(JimpMime.jpeg, { quality: params.quality })),
        alphaData: new Uint8Array(await blackImage.getBuffer(JimpMime.png))
    };
    log("completed", { width, height });
    return result;
}

getImage.getJimpImage = getJimpImage as any;

export default getImage;

export {
    applyLayerDataWithTransparent,
    fixAlphaChannel,
    alignPixelBit,
    padAndTrimToBounds as padAndTrimToDesireBounds,
    getScaleRatio
};
