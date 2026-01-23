const GRID_LAYOUTS = [
  { maxCount: 1, columns: 1, maxRows: 1 },
  { maxCount: 4, columns: 2, maxRows: 2 },
  { maxCount: 9, columns: 3, maxRows: 3 },
  { maxCount: Number.POSITIVE_INFINITY, columns: 4, maxRows: 3 },
] as const;

const WRAPPER_GAP = 8;
const GRID_GAP = 8;
const RIGHT_PADDING = 8;
const BASE_TILE_SIZE = 96;
const MIN_TILE_SIZE = 36;
const LEFT_BASE_WIDTH = 160;
const LEFT_MIN_WIDTH = 28;
const TRASH_BUTTON_HEIGHT = 28;
const BASE_ADD_BUTTON_HEIGHT = 100;
const MAX_PANEL_HEIGHT = BASE_ADD_BUTTON_HEIGHT + TRASH_BUTTON_HEIGHT;

export const LOCAL_IMAGE_PACK_LAYOUT_CONSTANTS = {
  WRAPPER_GAP,
  GRID_GAP,
  RIGHT_PADDING,
  LEFT_MIN_WIDTH,
  TRASH_BUTTON_HEIGHT,
  BASE_ADD_BUTTON_HEIGHT,
} as const;

interface GridLayout {
  maxCount: number;
  columns: number;
  maxRows: number;
}

const getGridLayout = (count: number): GridLayout => {
  return GRID_LAYOUTS.find(layout => count <= layout.maxCount) ?? GRID_LAYOUTS[GRID_LAYOUTS.length - 1];
};

export interface LocalImagePackLayoutInput {
  imageCount: number;
  containerWidth: number;
  rightWidth: number;
}

export interface LocalImagePackLayoutResult {
  columns: number;
  maxRows: number;
  leftWidth: number;
  tileSize: number;
  panelHeight: number;
  addButtonHeight: number;
  needsScroll: boolean;
  totalCapacity: number;
}

const computeDefaultLeftWidth = (columns: number): number => {
  if (columns >= 4) return 112;
  if (columns === 3) return 140;
  return LEFT_BASE_WIDTH;
};

const clampLeftWidth = (desired: number, fallback: number): number => {
  return Math.max(LEFT_MIN_WIDTH, Math.min(fallback, desired));
};

const deriveFileNameBase = (resource: string): string => {
  const suffix = resource.split('/').pop();
  if (!suffix || !suffix.trim()) return 'image';
  return suffix.trim();
};

export const computeLocalImagePackLayout = ({
  imageCount,
  containerWidth,
  rightWidth,
}: LocalImagePackLayoutInput): LocalImagePackLayoutResult => {
  const countForLayout = Math.max(imageCount, 1);
  const { columns, maxRows } = getGridLayout(countForLayout);

  const defaultLeftWidth = computeDefaultLeftWidth(columns);

  const preferredTileSize = (() => {
    const tileFromHeight =
      (MAX_PANEL_HEIGHT - RIGHT_PADDING * 2 - GRID_GAP * Math.max(maxRows - 1, 0)) /
      Math.max(maxRows, 1);
    return Math.max(MIN_TILE_SIZE, Math.min(BASE_TILE_SIZE, tileFromHeight));
  })();

  const desiredRightWidth =
    columns * preferredTileSize +
    GRID_GAP * Math.max(columns - 1, 0) +
    RIGHT_PADDING * 2;

  const maxLeftForDesired = containerWidth - desiredRightWidth - WRAPPER_GAP;
  const leftWidth = clampLeftWidth(maxLeftForDesired, defaultLeftWidth);

  const effectiveRightWidth = Math.max(rightWidth - RIGHT_PADDING * 2, 0);
  const tileSizeFromWidth =
    columns > 0
      ? (effectiveRightWidth - GRID_GAP * Math.max(columns - 1, 0)) / Math.max(columns, 1)
      : preferredTileSize;

  const tileSizeFromHeight =
    (MAX_PANEL_HEIGHT - RIGHT_PADDING * 2 - GRID_GAP * Math.max(maxRows - 1, 0)) /
    Math.max(maxRows, 1);

  const tileSize = Math.max(
    MIN_TILE_SIZE,
    Math.min(
      preferredTileSize,
      Number.isFinite(tileSizeFromWidth) ? tileSizeFromWidth : preferredTileSize,
      Number.isFinite(tileSizeFromHeight) ? tileSizeFromHeight : preferredTileSize,
    ),
  );

  const computedPanelHeight =
    tileSize * maxRows +
    GRID_GAP * Math.max(maxRows - 1, 0) +
    RIGHT_PADDING * 2;

  const panelHeight = Math.max(TRASH_BUTTON_HEIGHT, Math.min(MAX_PANEL_HEIGHT, computedPanelHeight));
  const hasImages = imageCount > 0;

  const addButtonHeight = hasImages
    ? Math.max(
        TRASH_BUTTON_HEIGHT,
        Math.min(BASE_ADD_BUTTON_HEIGHT, panelHeight - TRASH_BUTTON_HEIGHT),
      )
    : panelHeight;

  const totalCapacity = columns * maxRows;
  const needsScroll = imageCount > totalCapacity;

  return {
    columns,
    maxRows,
    leftWidth,
    tileSize,
    panelHeight,
    addButtonHeight,
    needsScroll,
    totalCapacity,
  };
};

export interface LocalImagePackPreviewCell {
  id: string;
  url: string;
  status: 'pending' | 'success';
}

export const computeLocalImagePackCells = (
  items: LocalImagePackPreviewCell[],
  layout: LocalImagePackLayoutResult,
): LocalImagePackPreviewCell[] => {
  if (items.length === 0) {
    return [];
  }
  if (layout.needsScroll) {
    return items.slice();
  }
  const padded = items.slice();
  while (padded.length < layout.totalCapacity) {
    padded.push({
      id: `placeholder-${padded.length}`,
      url: '',
      status: 'success',
    });
  }
  return padded;
};

export const buildUploadFileName = (resource: string, mime?: string | null): string => {
  const base = deriveFileNameBase(resource);
  if (!mime || typeof mime !== 'string') {
    return `${base}.png`;
  }
  const subtype = mime.split('/')[1];
  if (!subtype || !subtype.trim()) {
    return `${base}.png`;
  }
  return `${base}.${subtype.trim()}`;
};
