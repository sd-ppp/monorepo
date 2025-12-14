import { app } from "photoshop";
import { t } from "@sdppp/common";
import { JimpMime } from "jimp";

import type { BoundaryRect } from "../types/boundary-rect-utils";
import { BoundaryRectUtils } from "../types/boundary-rect-utils";
import getImage from "../tools/get-image";
import getDocumentInfo from "../tools/get-document-info";
import { SpeicialIDManager } from "../state/special-id-manager";

export async function getBoundaryImpl(params: { type: "curlayer" | "selection" }) {
    if (!app.activeDocument) {
        throw new Error(t("photoshop.no_active_document"));
    }

    const document = app.activeDocument;
    let boundaryRect: BoundaryRect;

    switch (params.type) {
        case "curlayer": {
            const activeLayer = document.activeLayers?.[0];
            if (!activeLayer) {
                throw new Error(t("photoshop.no_active_layer"));
            }

            const layerBounds = activeLayer.bounds;
            if (!layerBounds) {
                boundaryRect = BoundaryRectUtils.fromPositionAndSize(
                    0,
                    0,
                    document.width,
                    document.height,
                    document.width,
                    document.height
                );
            } else {
                boundaryRect = BoundaryRectUtils.fromPhotoshopBounds(layerBounds, document.width, document.height);
            }
            break;
        }
        case "selection": {
            const selectionBounds = document.selection?.bounds;
            if (!selectionBounds) {
                boundaryRect = BoundaryRectUtils.fromPositionAndSize(
                    0,
                    0,
                    document.width,
                    document.height,
                    document.width,
                    document.height
                );
            } else {
                boundaryRect = BoundaryRectUtils.fromPhotoshopBounds(selectionBounds, document.width, document.height);
            }
            break;
        }
        default:
            throw new Error(t("photoshop.invalid_boundary_type", { type: params.type }));
    }

    const thumbnail = await generateBoundaryThumbnail(document, boundaryRect);

    return {
        boundary: boundaryRect,
        thumbnail
    };
}

async function generateBoundaryThumbnail(document: any, boundaryRect: BoundaryRect): Promise<string> {
  try {
    const documentInfo = await getDocumentInfo({
      document_identify: SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT()
    });
    const docWidth = Number(document.width) || 0;
    const docHeight = Number(document.height) || 0;
    const documentBoundary = BoundaryRectUtils.toSDPPPBounds(
      documentInfo.document_boundary,
      docWidth,
      docHeight,
    );

    const canvasImage = await (getImage as any).getJimpImage({
      document_identify: SpeicialIDManager.get_SPECIAL_DOCUMENT_CURRENT(),
      layer_identify: SpeicialIDManager.get_SPECIAL_LAYER_USE_CANVAS(),
      boundary: documentBoundary,
      max_wh: 192,
      quality: 8
    });

        const thumbWidth = canvasImage.width;
        const thumbHeight = canvasImage.height;
        const docWidthPx = Number(document.width) || 0;
        const docHeightPx = Number(document.height) || 0;
        const scaleX = thumbWidth / docWidthPx;
        const scaleY = thumbHeight / docHeightPx;

        const boundaryLeft = Math.round(boundaryRect.leftDistance * scaleX);
        const boundaryTop = Math.round(boundaryRect.topDistance * scaleY);
        const boundaryRight = Math.round((docWidth - boundaryRect.rightDistance) * scaleX);
        const boundaryBottom = Math.round((docHeight - boundaryRect.bottomDistance) * scaleY);

        canvasImage.scan(0, 0, thumbWidth, thumbHeight, function (x: number, y: number, idx: number) {
            const isOutsideBoundary =
                x < boundaryLeft || x >= boundaryRight || y < boundaryTop || y >= boundaryBottom;

            if (isOutsideBoundary) {
                canvasImage.bitmap.data[idx + 3] = Math.round(canvasImage.bitmap.data[idx + 3] * 0.3);
            }
        });

        const thumbnailBuffer = await canvasImage.getBuffer(JimpMime.png);
        return "data:image/png;base64," + thumbnailBuffer.toString("base64");
    } catch (error) {
        console.error("Error generating boundary thumbnail:", error);
        return "";
    }
}
