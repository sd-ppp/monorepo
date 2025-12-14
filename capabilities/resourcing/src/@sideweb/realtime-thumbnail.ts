import { sdpppSDK } from "@sdppp/common";
import type { ContentType } from "../resource-uris.js";

/**
 * Minimal shape of the PhotoshopStore state exposed to SideWeb code.
 * Only the properties required by the realtime thumbnail watcher are included.
 */
export interface SidewebRealtimeState {
  activeDocumentID: number;
  canvasStateID?: number | null;
  selectionStateID?: string | null;
}

type PhotoshopStoreLike = {
  subscribe: (
    listener: (state: SidewebRealtimeState, prevState: SidewebRealtimeState | undefined) => void
  ) => () => void;
  getState?: () => SidewebRealtimeState;
} | undefined;

/**
 * Determine whether a given content type should trigger a thumbnail refresh
 * based on the current/previous Photoshop state snapshot.
 */
export const shouldTriggerForContent = (
  content: ContentType,
  state: SidewebRealtimeState,
  prev: SidewebRealtimeState | undefined
): boolean => {
  if (!prev) return false;

  switch (content) {
    case "canvas":
      return state.canvasStateID !== prev.canvasStateID;
    case "selection":
      return state.selectionStateID !== prev.selectionStateID;
    case "curlayer":
      return (
        state.canvasStateID !== prev.canvasStateID ||
        state.selectionStateID !== prev.selectionStateID
      );
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
export const subscribeToRealtimeChanges = (
  docId: number,
  watched: ContentType[],
  callback: () => void
): (() => void) => {
  const photoshopStore = sdpppSDK?.stores?.PhotoshopStore as PhotoshopStoreLike;

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

    const shouldTrigger = uniqueWatched.some(content =>
      shouldTriggerForContent(content, state, prev)
    );

    if (shouldTrigger) {
      callback();
    }
  });
};
