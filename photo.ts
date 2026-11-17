/**
 * Profile photos are cropped square and stored as tiny data URLs so they fit in localStorage
 * and in network messages. Pixel mode keeps a 24x24 PNG drawn with hard pixels.
 */
export const PHOTO_MAX_CHARS = 24000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not read that image.'));
    img.src = src;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Could not read that image.'));
    r.readAsDataURL(file);
  });
}

function squareCrop(img: HTMLImageElement, size: number, type: 'image/png' | 'image/jpeg', quality = 0.82) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - s) / 2;
  const sy = (img.naturalHeight - s) / 3; // bias upward: faces sit high in portraits
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, Math.max(0, sy), s, s, 0, 0, size, size);
  return c.toDataURL(type, quality);
}

/** Source copy kept so the pixel option can be toggled later without re-uploading. */
export async function fileToSource(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const img = await loadImage(await readFile(file));
  return squareCrop(img, 160, 'image/jpeg', 0.8);
}

export async function renderPhoto(source: string, pixel: boolean): Promise<string> {
  const img = await loadImage(source);
  return pixel ? squareCrop(img, 24, 'image/png') : squareCrop(img, 96, 'image/jpeg', 0.8);
}

export const isPixelPhoto = (photo?: string) => !!photo && photo.startsWith('data:image/png');
