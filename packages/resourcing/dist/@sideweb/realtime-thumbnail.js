import { sdpppSDK } from "@sdppp/common";
/**
 * Determine whether a given content type should trigger a thumbnail refresh
 * based on the current/previous Photoshop state snapshot.
 */
export const shouldTriggerForContent = (content, state, prev) => {
    if (!prev)
        return false;
    switch (content) {
        case "canvas":
            return state.canvasStateID !== prev.canvasStateID;
        case "selection":
            return state.selectionStateID !== prev.selectionStateID;
        case "curlayer":
            return (state.canvasStateID !== prev.canvasStateID ||
                state.selectionStateID !== prev.selectionStateID);
        default:
            return false;
    }
};
/**
 * Subscribe to PhotoshopStore changes and invoke {@link callback} whenever the watched
 * content types indicate that a thumbnail refresh is required for the specified document.
 *
 * The helper reads `sdpppSDK.stores.PhotoshopStore` directly; consumers only need to
 * supply the document id, watched content types, and a callback to invoke.
 */
export const subscribeToRealtimeChanges = (docId, watched, callback) => {
    const photoshopStore = sdpppSDK?.stores?.PhotoshopStore;
    if (!photoshopStore?.subscribe) {
        console.warn("[resourcing:@sideweb] subscribeToRealtimeChanges: store missing subscribe()");
        return () => undefined;
    }
    const uniqueWatched = Array.from(new Set(watched));
    if (uniqueWatched.length === 0) {
        return () => undefined;
    }
    return photoshopStore.subscribe((state, prev) => {
        if (state.activeDocumentID !== docId) {
            const becameActive = prev?.activeDocumentID !== docId && state.activeDocumentID === docId;
            if (becameActive) {
                callback();
            }
            return;
        }
        if (!prev) {
            return;
        }
        if (prev.activeDocumentID !== docId) {
            callback();
            return;
        }
        const shouldTrigger = uniqueWatched.some(content => shouldTriggerForContent(content, state, prev));
        if (shouldTrigger) {
            callback();
        }
    });
};
//# sourceMappingURL=realtime-thumbnail.js.map