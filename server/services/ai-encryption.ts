import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
export function encryptAPIKey(value: string, key: Buffer): string {
    const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key, iv);
    return ["v1", iv.toString("base64"), Buffer.concat([c.update(value, "utf8"), c.final()]).toString("base64"), c.getAuthTag().toString("base64")].join(".");
}
export function decryptAPIKey(value: string, key: Buffer): string {
    try {
        const [v, iv, data, tag] = value.split(".");
        if (v !== "v1")
            throw 0;
        const c = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
        c.setAuthTag(Buffer.from(tag, "base64"));
        return Buffer.concat([c.update(Buffer.from(data, "base64")), c.final()]).toString("utf8");
    }
    catch {
        throw new Error("AI encryption key unavailable or invalid.");
    }
}
export async function ensureAIEncryptionKey(filePath: string, { hasEncryptedProfiles = false }: {
    hasEncryptedProfiles?: boolean;
} = {}): Promise<Buffer> {
    let value: Buffer;
    try {
        value = await readFile(filePath);
    }
    catch (e: any) {
        if (e.code !== "ENOENT" || hasEncryptedProfiles)
            throw new Error("AI encryption key unavailable.");
        await mkdir(dirname(filePath), {
            recursive: true
        });
        try {
            await writeFile(filePath, randomBytes(32), {
                flag: "wx",
                mode: 384
            });
        }
        catch (err: any) {
            if (err.code !== "EEXIST")
                throw err;
        }
        value = await readFile(filePath);
    }
    if (value.length !== 32)
        throw new Error("AI encryption key invalid.");
    return value;
}
