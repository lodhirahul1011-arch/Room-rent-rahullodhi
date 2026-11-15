const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { config } = require("../config");
const { fail } = require("./errors");
function root() {
  return path.resolve(config().fileRoot);
}
function imageKitConfigured() {
  return !!(
    process.env.IMAGE_KIT_PRIVATE_KEY &&
    process.env.IMAGE_KIT_URL_ENDPOINT
  );
}
function imageKitLocation(key) {
  try {
    const parsed = JSON.parse(Buffer.from(key.slice(3), "base64url").toString());
    const endpoint = new URL(process.env.IMAGE_KIT_URL_ENDPOINT);
    const url = new URL(parsed.url);
    if (
      typeof parsed.fileId !== "string" ||
      url.protocol !== "https:" ||
      url.origin !== endpoint.origin ||
      !url.pathname.startsWith(endpoint.pathname.replace(/\/$/, "") + "/")
    )
      throw Error();
    return { fileId: parsed.fileId, url, endpoint };
  } catch {
    fail(500, "Invalid ImageKit private file reference");
  }
}
function imageKitAuthorization() {
  return (
    "Basic " +
    Buffer.from(process.env.IMAGE_KIT_PRIVATE_KEY + ":").toString("base64")
  );
}
function location(key) {
  if (!/^[a-f0-9]{32}$/.test(key)) throw Error("Invalid storage key");
  return path.join(root(), key);
}
function durableConfigured() {
  if (process.env.PRIVATE_STORAGE_DRIVER === "imagekit")
    return imageKitConfigured();
  return (
    process.env.PRIVATE_STORAGE_DRIVER === "s3" &&
    !!process.env.S3_BUCKET &&
    !!(process.env.S3_REGION || process.env.AWS_REGION)
  );
}
function client() {
  if (!durableConfigured())
    fail(
      503,
      "Permanent private storage is not configured. Set PRIVATE_STORAGE_DRIVER=s3, S3_BUCKET and S3_REGION before uploading meter photos.",
    );
  const { S3Client } = require("@aws-sdk/client-s3");
  const endpoint = process.env.S3_ENDPOINT;
  if (
    endpoint &&
    !endpoint.startsWith("https://") &&
    !(
      process.env.NODE_ENV === "test" &&
      /^http:\/\/(localhost|127\.0\.0\.1):/.test(endpoint)
    )
  )
    fail(503, "Private storage endpoint must use HTTPS");
  return new S3Client({
    region: process.env.S3_REGION || process.env.AWS_REGION,
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
        }
      : {}),
    ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          },
        }
      : {}),
    maxAttempts: 2,
    requestHandler: { requestTimeout: 15000, connectionTimeout: 5000 },
  });
}
function objectLocation(key) {
  try {
    const parsed = JSON.parse(
      Buffer.from(key.slice(3), "base64url").toString(),
    );
    if (
      typeof parsed.bucket !== "string" ||
      typeof parsed.key !== "string" ||
      !/^roomrent-private\/[a-f0-9]{32}$/.test(parsed.key)
    )
      throw Error();
    return { Bucket: parsed.bucket, Key: parsed.key };
  } catch {
    fail(500, "Invalid private object reference");
  }
}
async function write(buffer, options = {}) {
  if (process.env.PRIVATE_STORAGE_DRIVER === "imagekit") {
    if (!imageKitConfigured())
      fail(503, "ImageKit private storage is not configured");
    const extension =
      options.mime === "application/pdf"
        ? "pdf"
        : options.mime === "image/png"
          ? "png"
          : "jpg";
    const body = new FormData();
    const fileName = `roomrent-${crypto.randomBytes(16).toString("hex")}.${extension}`;
    body.set(
      "file",
      new Blob([buffer], { type: options.mime || "application/octet-stream" }),
      fileName,
    );
    body.set("fileName", fileName);
    body.set("folder", "/roomrent-private");
    body.set("useUniqueFileName", "true");
    body.set("isPrivateFile", "true");
    try {
      const response = await fetch(
        "https://upload.imagekit.io/api/v2/files/upload",
        {
          method: "POST",
          headers: { Authorization: imageKitAuthorization() },
          body,
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) throw Error();
      const uploaded = await response.json();
      if (!uploaded.fileId || !uploaded.url) throw Error();
      return (
        "ik:" +
        Buffer.from(
          JSON.stringify({ fileId: uploaded.fileId, url: uploaded.url }),
        ).toString("base64url")
      );
    } catch {
      fail(503, "ImageKit private upload failed; the file was not saved");
    }
  }
  if (options.durable && !durableConfigured()) client();
  if (durableConfigured()) {
    const c = client();
    const location = {
      Bucket: process.env.S3_BUCKET,
      Key: "roomrent-private/" + crypto.randomBytes(16).toString("hex"),
    };
    try {
      const { PutObjectCommand } = require("@aws-sdk/client-s3");
      await c.send(
        new PutObjectCommand({
          ...location,
          Body: buffer,
          ContentType: options.mime || "application/octet-stream",
          ...(process.env.S3_SERVER_SIDE_ENCRYPTION
            ? { ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION }
            : {}),
        }),
      );
      return (
        "s3:" +
        Buffer.from(
          JSON.stringify({ bucket: location.Bucket, key: location.Key }),
        ).toString("base64url")
      );
    } catch {
      fail(
        503,
        "Permanent private storage upload failed. No successful photo upload was recorded.",
      );
    } finally {
      c.destroy();
    }
  }
  const key = crypto.randomBytes(16).toString("hex");
  await fs.mkdir(root(), { recursive: true, mode: 0o700 });
  await fs.writeFile(location(key), buffer, { flag: "wx", mode: 0o600 });
  return key;
}
async function read(key) {
  if (key.startsWith("ik:")) {
    const { url, endpoint } = imageKitLocation(key);
    const expires = Math.floor(Date.now() / 1000) + 60;
    const relativePath = url.pathname.slice(endpoint.pathname.replace(/\/$/, "").length).replace(/^\//, "");
    const signature = crypto
      .createHmac("sha1", process.env.IMAGE_KIT_PRIVATE_KEY)
      .update(relativePath + expires)
      .digest("hex");
    url.search = "";
    url.searchParams.set("ik-t", String(expires));
    url.searchParams.set("ik-s", signature);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error();
      return Buffer.from(await response.arrayBuffer());
    } catch {
      fail(503, "ImageKit private file is temporarily unavailable");
    }
  }
  if (!key.startsWith("s3:")) return fs.readFile(location(key));
  const c = client();
  try {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    const response = await c.send(new GetObjectCommand(objectLocation(key)));
    return Buffer.from(await response.Body.transformToByteArray());
  } catch {
    fail(503, "Private file is temporarily unavailable");
  } finally {
    c.destroy();
  }
}
async function remove(key) {
  if (key.startsWith("ik:")) {
    const { fileId } = imageKitLocation(key);
    try {
      const response = await fetch(
        `https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`,
        {
          method: "DELETE",
          headers: { Authorization: imageKitAuthorization() },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok && response.status !== 404) throw Error();
    } catch {
      fail(503, "ImageKit private file could not be removed");
    }
    return;
  }
  if (!key.startsWith("s3:")) return fs.rm(location(key), { force: true });
  const c = client();
  try {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    await c.send(new DeleteObjectCommand(objectLocation(key)));
  } finally {
    c.destroy();
  }
}
module.exports = { write, read, remove, durableConfigured };
