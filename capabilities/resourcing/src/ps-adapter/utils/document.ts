import { app } from "photoshop";
import type { Document } from "photoshop/dom/Document";
import { t } from "@sdppp/common";

import { SpeicialIDManager } from "../state/special-id-manager";

function getDocumentOrLayerID(name: string): number {
    if (typeof name !== "string") throw new Error("not a invalid identifer: " + name);
    const split = name.split("(id:");
    const layerID = split.pop();
    if (!layerID) throw new Error(t(`invalid name: {0}`, name));
    return parseInt(layerID.trim().slice(0, -1));
}

export function getDocumentID(name: string): number {
    if (SpeicialIDManager.is_SPECIAL_DOCUMENT_CURRENT(name)) {
        return -1;
    }
    return getDocumentOrLayerID(name);
}

export function getLayerID(document: Document, name: string): number {
    if (SpeicialIDManager.is_SPECIAL_LAYER_USE_CANVAS(name)) return 0;
    if (SpeicialIDManager.is_SPECIAL_LAYER_SELECTED_LAYER(name))
        return document.activeLayers.length > 0 ? document.activeLayers[0].id : 0;
    if (SpeicialIDManager.is_SPECIAL_LAYER_NEW_LAYER(name)) return -2;
    return getDocumentOrLayerID(name);
}

export function getDocumentFromIdentify(documentIdentify: string): Document | null {
    return (
        (
            SpeicialIDManager.is_SPECIAL_DOCUMENT_CURRENT(documentIdentify)
                ? app.activeDocument
                : app.documents.find((document) => document.id === getDocumentID(documentIdentify))
        ) || null
    );
}
