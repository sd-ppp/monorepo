import { app } from "photoshop";
import { t } from "@sdppp/common";

import { getSelectedLayerIdentify } from "../utils/layer";

export async function getCurrentLayerIdentify() {
    if (!app.activeDocument) {
        throw new Error(t("photoshop.no_active_document"));
    }

    const activeLayer = app.activeDocument.activeLayers?.[0] ?? null;
    if (!activeLayer) {
        return { layer_identify: null };
    }

    const identify = getSelectedLayerIdentify();
    return { layer_identify: identify };
}
