import path from 'node:path';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import sharp from 'sharp';
import { sha256 } from './archive-package';
import type { FrozenRow } from './archive-report';
import type { FrozenImage } from './archive-export';

export async function freezeArchiveImages(rows: FrozenRow[], uploadsRoot: string, assertDirectory: (path: string) => Promise<string>,byteLimit:number) {
  const files = new Map<string, Buffer>(), inline = new Map<string, string>(), images: FrozenImage[] = [];
  const copied = new Map<string, { path: string; mime: string; bytes: Buffer; inline?:string }>();
  const content = new Map<string,{ path: string; mime: string; bytes: Buffer; inline?:string }>();let totalBytes=0;
  let root: string | undefined;
  for (const row of rows) {
    if (!['question', 'questionBank'].includes(row.entityType) || typeof row.data.imageUrl !== 'string' || !row.data.imageUrl) continue;
    const originalUrl = row.data.imageUrl;
    // External URLs remain in frozen business JSON, but are never requested.
    if (!originalUrl.startsWith('/uploads')) continue;
    if (!/^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(png|jpe?g|webp)$/i.test(originalUrl) || originalUrl.includes('..')) throw new Error('Unsafe archive image path');
    let image = copied.get(originalUrl);
    if (!image) {
      try {
        root ??= await assertDirectory(uploadsRoot);
        const filename = path.join(root, originalUrl.slice('/uploads/'.length)), before = await lstat(filename);
        if (before.isSymbolicLink() || !before.isFile() || before.size > 5 * 1024 * 1024) throw new Error('Unsafe archive image file');
        const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        let bytes: Buffer;
        try {
          const opened = await handle.stat();
          if (!opened.isFile() || opened.size !== before.size || opened.ino !== before.ino || opened.dev !== before.dev) throw new Error('Archive image changed during copy');
          bytes = await handle.readFile();
          if (bytes.length !== before.size) throw new Error('Archive image changed during copy');
        } finally { await handle.close(); }
        const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
        if (!png && !jpeg && !webp) throw new Error('Unsupported archive image format');
        const metadata = await sharp(bytes, { limitInputPixels: 100000000 }).metadata();
        if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || !metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000) throw new Error('Invalid archive image');
        const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format!;
        const imagePath='images/' + sha256(bytes) + '.' + extension;
        image=content.get(imagePath);
        if(!image){
          totalBytes+=bytes.length;if(totalBytes>byteLimit)throw new Error('Archive image size limit exceeded');
          image = { path:imagePath, mime: 'image/' + (extension === 'jpg' ? 'jpeg' : extension), bytes };
          content.set(imagePath,image);files.set(imagePath,bytes);
        }
        copied.set(originalUrl, image);
      } catch (error) { throw new Error('Archive image could not be frozen: ' + (error instanceof Error ? error.message : 'invalid image')); }
    }
    images.push({ entityType: row.entityType, entityId: row.entityId, originalUrl, path: image.path, mime: image.mime });
    if(row.entityType==='question'){
      image.inline??='data:' + image.mime + ';base64,' + image.bytes.toString('base64');
      inline.set(row.entityType + ':' + row.entityId,image.inline);
    }
  }
  return { files, inline, images };
}
