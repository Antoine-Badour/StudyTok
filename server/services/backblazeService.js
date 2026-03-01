import B2 from "backblaze-b2";
import dotenv from "dotenv";

dotenv.config();

const keyId = process.env.B2_APPLICATION_KEY_ID || process.env.B2_KEY_ID;
const applicationKey = process.env.B2_APPLICATION_KEY || process.env.B2_APP_KEY;
const bucketId = process.env.B2_BUCKET_ID;
const bucketName = process.env.B2_BUCKET_NAME;
const endpoint = process.env.B2_ENDPOINT;

function derivePublicBaseUrl() {
  if (process.env.B2_PUBLIC_BASE_URL) {
    return process.env.B2_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  if (!bucketName) return null;

  // Preferred and stable public URL format for Backblaze B2 buckets.
  if (endpoint && /backblazeb2\.com/i.test(endpoint)) {
    return `https://f000.backblazeb2.com/file/${bucketName}`;
  }

  if (endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucketName}`;
  }

  return `https://f000.backblazeb2.com/file/${bucketName}`;
}

const publicBaseUrl = derivePublicBaseUrl();

if (!keyId || !applicationKey || !bucketId || !publicBaseUrl) {
  throw new Error(
    "Missing Backblaze B2 env variables. Expected key id/key, bucket id, and B2_PUBLIC_BASE_URL (or B2_ENDPOINT + B2_BUCKET_NAME)."
  );
}

const b2 = new B2({
  applicationKeyId: keyId,
  applicationKey,
});

async function authorize() {
  await b2.authorize();
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function extractFileNameFromUrl(fileUrl) {
  if (!fileUrl) return null;

  const base = publicBaseUrl.replace(/\/$/, "");
  if (fileUrl.startsWith(`${base}/`)) {
    return decodeURIComponent(fileUrl.slice(base.length + 1));
  }

  try {
    const parsed = new URL(fileUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

export function parseFileNameFromUrl(fileUrl) {
  return extractFileNameFromUrl(fileUrl);
}

export async function uploadBuffer({ buffer, filename, contentType }) {
  await authorize();

  const safeName = `${Date.now()}-${sanitizeFilename(filename)}`;

  const {
    data: { uploadUrl, authorizationToken },
  } = await b2.getUploadUrl({ bucketId });

  await b2.uploadFile({
    uploadUrl,
    uploadAuthToken: authorizationToken,
    fileName: safeName,
    data: buffer,
    mime: contentType,
  });

  return `${publicBaseUrl}/${encodeURIComponent(safeName)}`;
}

export async function deleteFileByUrl(fileUrl) {
  const fileName = extractFileNameFromUrl(fileUrl);
  if (!fileName) return;

  await authorize();

  const { data } = await b2.listFileNames({
    bucketId,
    startFileName: fileName,
    maxFileCount: 1,
  });

  const file = (data?.files || []).find((item) => item.fileName === fileName);
  if (!file) return;

  await b2.deleteFileVersion({
    fileName: file.fileName,
    fileId: file.fileId,
  });
}

export async function downloadFileByName(fileName) {
  if (!fileName) {
    throw new Error("Missing fileName.");
  }

  await authorize();

  const response = await b2.downloadFileByName({
    bucketName,
    fileName,
    responseType: "arraybuffer",
  });

  const headers = response?.headers || {};
  const data = response?.data;

  if (!data) {
    throw new Error("Failed to download media file.");
  }

  return {
    data: Buffer.from(data),
    contentType: headers["content-type"] || headers["Content-Type"] || "application/octet-stream",
    contentLength: headers["content-length"] || headers["Content-Length"] || undefined,
  };
}
