export const isVideo = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

export const isImage = (url: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif'];
  const urlLower = url.toLowerCase();
  // Allow inline base64 images
  if (urlLower.startsWith('data:image/')) return true;
  return imageExtensions.some(ext => urlLower.endsWith(ext));
};
