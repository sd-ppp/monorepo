import type { Layer } from "photoshop/dom/Layer";
import { t } from "@sdppp/common";
import type { getLayerInfoActions } from "@sdppp/common/interface/PhotoshopCalleeInterface";

import { runNextModalState } from "../helpers/modal-state-wrapper";
import { getDocumentFromIdentify, getLayerID } from "../utils/document";
import { SpeicialIDManager } from "../state/special-id-manager";
import { getLayerInfoFromLayer, getRasterizedLayer } from "../utils/layer";
import { BoundaryRectUtils } from "../types/boundary-rect-utils";

export default async function getLayerInfo(
    params: getLayerInfoActions["params"]
): Promise<getLayerInfoActions["result"]> {
    const documentIdentify = params.document_identify;
    const document = getDocumentFromIdentify(documentIdentify);
    if (!document) throw new Error(t("document {{0}} not found", { "0": documentIdentify }));
    if (!params.layer_identify) throw new Error(t("get_layer_info: layer_identify required"));

    let returnData: getLayerInfoActions["result"] = {
        name: "",
        opacity: 0,
        boundary: BoundaryRectUtils.fromPositionAndSize(
            0,
            0,
            Number(document.width) || 0,
            Number(document.height) || 0,
            Number(document.width) || 0,
            Number(document.height) || 0,
        ),
        isGroup: false,
        identify: ""
    };

    await runNextModalState(async (restorer) => {
        let layer: Layer | null = null;
        let layerIdentify = params.layer_identify;
        let isGroup = false;

        if (params.layer_identify) {
            layerIdentify = params.layer_identify;
            const layerID = getLayerID(document, layerIdentify);

            if (SpeicialIDManager.is_SPECIAL_LAYER_USE_CANVAS(layerIdentify)) {
                returnData = {
                    name: "",
                    opacity: 1,
                    boundary: BoundaryRectUtils.fromPositionAndSize(
                        0,
                        0,
                        Number(document.width) || 0,
                        Number(document.height) || 0,
                        Number(document.width) || 0,
                        Number(document.height) || 0,
                    ),
                    isGroup: true,
                    identify: layerIdentify
                };
                return returnData;
            }

            [layer, isGroup] = await getRasterizedLayer(document, layerID);
            restorer.add(() => {
                if (layer && isGroup) {
                    layer.delete();
                }
            });
        }

        if (!layer) throw new Error(t("layer not found: {{0}}", { "0": params.layer_identify }));

        returnData = Object.assign(
            {
                isGroup,
                identify: layerIdentify || ""
            },
            getLayerInfoFromLayer(document, layer)
        );
    }, {
        commandName: t("get layer info"),
        document
    });

    return returnData;
}
