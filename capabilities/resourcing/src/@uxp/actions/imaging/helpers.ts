import { Buffer } from "buffer";

import { EXTENSION_TO_MIME, IMAGE_EXTENSIONS } from "./constants.js";

const MIME_TO_EXTENSION: Record<string, string> = Object.entries(EXTENSION_TO_MIME).reduce(
  (acc, [ext, mime]) => {
    if (!acc[mime]) {
      acc[mime] = ext;
    }
    return acc;
  },
  {} as Record<string, string>
);

export function encodeSvgData(svg: string): string {
  if (typeof btoa === "function") {
    return btoa(svg);
  }
  return Buffer.from(svg, "utf8").toString("base64");
}

export function buildGenericFileThumbnail(extension: string): string {
  return (
    "data:image/svg+xml;base64," +
    encodeSvgData(`
      <svg width="320" height="320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#e0e0e0"/>
        <rect x="80" y="80" width="160" height="160" fill="white" stroke="#ccc" stroke-width="2"/>
        <text x="160" y="160" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">File</text>
        <text x="160" y="180" text-anchor="middle" font-family="Arial" font-size="12" fill="#999">${extension}</text>
      </svg>
    `)
  );
}

export function buildVideoThumbnail(): string {
  return (
    "data:image/svg+xml;base64," +
    encodeSvgData(`
      <svg width="320" height="320" xmlns="http://www.w3.org/2000/svg">
        <rect width="320" height="320" fill="#000" opacity="0.8"/>
        <circle cx="160" cy="160" r="50" fill="white" opacity="0.9"/>
        <polygon points="140,130 140,190 190,160" fill="black"/>
        <text x="160" y="220" text-anchor="middle" font-family="Arial" font-size="14" fill="white">Video</text>
      </svg>
    `)
  );
}

export function normaliseExtension(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith(".") ? trimmed.toLowerCase() : `.${trimmed.toLowerCase()}`;
}

export function mimeFromExtension(extension?: string): string {
  const normalised = normaliseExtension(extension);
  if (!normalised) {
    return "application/octet-stream";
  }
  return EXTENSION_TO_MIME[normalised] ?? "application/octet-stream";
}

export function isImageExtension(extension?: string): boolean {
  const normalised = normaliseExtension(extension);
  if (!normalised) return false;
  return IMAGE_EXTENSIONS.includes(normalised);
}

export function extensionFromMime(mime?: string): string | undefined {
  if (!mime) return undefined;
  return MIME_TO_EXTENSION[mime.toLowerCase()] ?? undefined;
}
