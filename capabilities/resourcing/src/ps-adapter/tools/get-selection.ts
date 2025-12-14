import { imaging } from "photoshop";
import type { Document } from "photoshop/dom/Document";
import { t } from "@sdppp/common";
import type { Bounds } from "photoshop/dom/objects/Bounds";
import type { getSelectionActions, PixelsAndSize as PixelsAndSizeAction } from "@sdppp/common/interface/PhotoshopCalleeInterface";

import { runNextModalState } from "../helpers/modal-state-wrapper";
import {
    alignPixelBit,
    getScaleRatio,
    padAndTrimToDesireBounds,
    getDesireBounds,
    convertSDPPPBoundsToBoundaryRect,
    type ImageBounds,
    scaleBounds
} from "../helpers/image-processing";
import type { BoundaryRect } from "../types/boundary-rect-utils";
import { getDocumentFromIdentify } from "../utils/document";
import { getIntersectBounds } from "../utils/image";

type PixelsAndSize<T> = PixelsAndSizeAction<T>;

async function getSelectionData({
    document,
    bounds,
    targetSize
}: {
    document: Document;
    bounds: ImageBounds;
    targetSize: { width: number; height: number };
}) {
    const options = {
        documentID: document.id,
        sourceBounds: bounds,
        targetSize
    };
    const selection = await imaging.getSelection(options);
    const imageData = selection.imageData;
    const dataFromAPI = await imageData.getData({});
    Promise.resolve().then(() => {
        imageData.dispose();
    });
    return {
        dataFromAPI,
        width: imageData.width,
        height: imageData.height
    };
}

export default async function getSelection(params: getSelectionActions["params"]) {
    const documentIdentify = params.document_identify;
    const document = getDocumentFromIdentify(documentIdentify);
    if (!document) throw new Error(t("document {{0}} not found", { "0": documentIdentify }));

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

    const scaleRatio = getScaleRatio(bounds.desire, params.max_wh);
    bounds.scaledDesire = scaleBounds(bounds.desire, scaleRatio);

    if (!document.selection?.bounds) {
        const arr = new Uint8Array(bounds.desire.width * bounds.desire.height);
        arr.fill(255);
        return {
            blob: arr,
            width: bounds.desire.width,
            height: bounds.desire.height
        };
    }

    let selectionData: Uint8Array | null = null;
    let selectionDataFromAPI: PixelsAndSize<Uint8Array> | null = null;

    await runNextModalState(async () => {
        bounds.origin = document.selection?.bounds || {
            left: 0,
            top: 0,
            right: document.width,
            bottom: document.height
        } as Bounds;

        bounds.intersect = getIntersectBounds(bounds.origin, bounds.desire!);
        bounds.scaledIntersect = scaleBounds(bounds.intersect!, scaleRatio);

        selectionDataFromAPI = await getSelectionData({
            document,
            bounds: bounds.intersect!,
            targetSize: {
                width: bounds.scaledIntersect!.width!,
                height: bounds.scaledIntersect!.height!
            }
        }) as any;
    }, { document, commandName: "SDPPP getSelection", suspendHistory: false, dontRecoverSelection: true });

    if (!selectionDataFromAPI || !bounds.scaledIntersect || !bounds.origin) {
        throw new Error(t("get selection failed"));
    }

    selectionDataFromAPI = alignPixelBit(selectionDataFromAPI);
    selectionData = padAndTrimToDesireBounds(selectionDataFromAPI, bounds.scaledIntersect, bounds.scaledDesire!, 1);

    return {
        blob: selectionData,
        width: bounds.scaledDesire!.width!,
        height: bounds.scaledDesire!.height!
    };
}
