import type { ContentType } from "../resource-uris.ts";
/**
 * Minimal shape of the PhotoshopStore state exposed to SideWeb code.
 * Only the properties required by the realtime thumbnail watcher are included.
 */
export interface SidewebRealtimeState {
    activeDocumentID: number;
    canvasStateID?: number | null;
    selectionStateID?: string | null;
}
/**
 * Determine whether a given content type should trigger a thumbnail refresh
 * based on the current/previous Photoshop state snapshot.
 */
export declare const shouldTriggerForContent: (content: ContentType, state: SidewebRealtimeState, prev: SidewebRealtimeState | undefined) => boolean;
/**
 * Subscribe to PhotoshopStore changes and invoke {@link callback} whenever the watched
 * content types indicate that a thumbnail refresh is required for the specified document.
 *
 * The helper reads `sdpppSDK.stores.PhotoshopStore` directly; consumers only need to
 * supply the document id, watched content types, and a callback to invoke.
 */
export declare const subscribeToRealtimeChanges: (docId: number, watched: ContentType[], callback: () => void) => (() => void);
//# sourceMappingURL=realtime-thumbnail.d.ts.map