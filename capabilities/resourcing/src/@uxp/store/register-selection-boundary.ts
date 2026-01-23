import { app } from "photoshop";
import { BoundaryRectUtils } from "../../ps-adapter/index";
import type { ImagingActionContext } from "../actions/imaging/context.js";
import type { BoundaryRect } from "../../resource-uris.js";

const EPSILON = 1e-3;
let initialized = false;

const toPixels = (value: any): number | null => {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "object") {
    try {
      if (typeof value.as === "function") {
        const px = value.as("px");
        if (Number.isFinite(px)) {
          return px;
        }
      }
    } catch {
      // ignore conversion failure
    }

    if ("value" in (value as Record<string, unknown>)) {
      const raw = Number((value as Record<string, unknown>).value);
      if (Number.isFinite(raw)) {
        return raw;
      }
    }
  }

  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : null;
};

const boundariesEqual = (a: BoundaryRect | null | undefined, b: BoundaryRect | null | undefined): boolean => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.leftDistance - b.leftDistance) < EPSILON &&
    Math.abs(a.topDistance - b.topDistance) < EPSILON &&
    Math.abs(a.rightDistance - b.rightDistance) < EPSILON &&
    Math.abs(a.bottomDistance - b.bottomDistance) < EPSILON &&
    Math.abs(a.width - b.width) < EPSILON &&
    Math.abs(a.height - b.height) < EPSILON
  );
};

const computeSelectionBoundary = (): BoundaryRect | null => {
  try {
    const doc = app.activeDocument;
    if (!doc) {
      return null;
    }

    const docWidth = toPixels(doc.width);
    const docHeight = toPixels(doc.height);
    if (docWidth == null || docHeight == null || docWidth <= 0 || docHeight <= 0) {
      return null;
    }

    const selection = doc.selection as any;
    if (!selection) {
      return null;
    }

    let bounds: any;
    try {
      bounds = selection.bounds;
    } catch {
      return null;
    }

    if (!bounds) {
      return null;
    }

    const left = toPixels(bounds.left ?? bounds[0]);
    const top = toPixels(bounds.top ?? bounds[1]);
    const right = toPixels(bounds.right ?? bounds[2]);
    const bottom = toPixels(bounds.bottom ?? bounds[3]);

    if (
      left == null ||
      top == null ||
      right == null ||
      bottom == null ||
      right <= left ||
      bottom <= top
    ) {
      return null;
    }

    const rect = BoundaryRectUtils.fromPhotoshopBounds(
      { left, top, right, bottom },
      docWidth,
      docHeight
    );

    return BoundaryRectUtils.isValid(rect) ? rect : null;
  } catch {
    return null;
  }
};

export function registerSelectionBoundaryMaintenance(context: ImagingActionContext): void {
  if (initialized) return;
  initialized = true;

  const mesh = context.mcpMesh as any;
  const store = mesh?.store;

  if (
    !store ||
    typeof store.getState !== "function" ||
    typeof store.setState !== "function"
  ) {
    console.warn("[resourcing] selection boundary maintenance skipped: mesh store missing");
    return;
  }

  const updateSelectionBoundary = () => {
    const nextBoundary = computeSelectionBoundary();
    const currentState = store.getState?.();
    const prevBoundary = currentState?.selectionBoundary ?? null;

    if (boundariesEqual(prevBoundary, nextBoundary)) {
      return;
    }

    store.setState({
      selectionBoundary: nextBoundary ?? null
    });
  };

  updateSelectionBoundary();

  if (typeof store.subscribe === "function") {
    store.subscribe((state: any, prev: any) => {
      if (
        state?.selectionStateID !== prev?.selectionStateID ||
        state?.activeDocumentID !== prev?.activeDocumentID
      ) {
        updateSelectionBoundary();
      }
    });
  }
}
