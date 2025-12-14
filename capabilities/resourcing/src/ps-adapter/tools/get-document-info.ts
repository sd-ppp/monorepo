import { t } from "@sdppp/common";

import type { getDocumentInfoActions } from "@sdppp/common/interface/PhotoshopCalleeInterface";
import { getDocumentFromIdentify } from "../utils/document";
import { BoundaryRectUtils } from "../types/boundary-rect-utils";

export default async function getDocumentInfo(
    params: getDocumentInfoActions["params"]
): Promise<getDocumentInfoActions["result"]> {
    const documentIdentify = params.document_identify;
    const document = getDocumentFromIdentify(documentIdentify);
    if (!document) throw new Error(t("document {{0}} not found", { "0": documentIdentify }));

    const docWidth = Number(document.width) || 0;
    const docHeight = Number(document.height) || 0;

    const documentBoundary = BoundaryRectUtils.fromPositionAndSize(
        0,
        0,
        docWidth,
        docHeight,
        docWidth,
        docHeight,
    );

    const selection = document.selection;
    const selectionBounds = selection?.bounds;
    const selectionBoundary = selectionBounds
        ? BoundaryRectUtils.fromPhotoshopBounds(
            {
                left: Number(selectionBounds.left ?? 0),
                top: Number(selectionBounds.top ?? 0),
                right: Number(selectionBounds.right ?? docWidth),
                bottom: Number(selectionBounds.bottom ?? docHeight),
            },
            docWidth,
            docHeight,
          )
        : null;

    return {
        document_boundary: documentBoundary,
        selection_boundary: selectionBoundary || documentBoundary
    };
}
