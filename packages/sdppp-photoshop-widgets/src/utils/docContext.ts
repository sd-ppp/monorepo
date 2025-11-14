export interface DocContext {
  docId: number;
  hasDocument: boolean;
  normalizedBoundaryUri: string;
  canvasBoundaryUri: string;
  canvasContentUri: string;
}

export const resolveDocContext = (
  boundaryUri?: string | null,
  fallbackDocId?: number | null,
): DocContext => {
  const normalizedBoundaryUri =
    typeof boundaryUri === 'string' ? boundaryUri.trim() : '';
  const boundaryMatch = /^uxp:\/\/boundary\/(\d+)/.exec(normalizedBoundaryUri);
  const matchedId = boundaryMatch ? Number(boundaryMatch[1]) : NaN;
  const parsedBoundaryId =
    Number.isFinite(matchedId) && matchedId > 0 ? Math.trunc(matchedId) : 0;

  const parsedFallbackId =
    fallbackDocId && fallbackDocId > 0 && Number.isFinite(fallbackDocId)
      ? Math.trunc(fallbackDocId)
      : 0;

  const docId = parsedBoundaryId > 0 ? parsedBoundaryId : parsedFallbackId;
  const hasDocument = docId > 0;

  const canvasBoundaryUri = hasDocument
    ? `uxp://boundary/${docId}/canvas`
    : 'uxp://boundary/0/canvas';
  const canvasContentUri = hasDocument
    ? `uxp://content/${docId}/canvas`
    : 'uxp://content/canvas';

  return {
    docId,
    hasDocument,
    normalizedBoundaryUri,
    canvasBoundaryUri,
    canvasContentUri,
  };
};

export const resolveDocIdFromBoundary = (
  boundaryUri?: string | null,
): number => resolveDocContext(boundaryUri).docId;

