import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import {
  BlobClient,
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { randomUUID } from "crypto";

import * as os from "node:os";
import * as path from "node:path";
import * as fs from "fs";
import ffmpeg = require("fluent-ffmpeg");

import { generateFrame, generateDuration } from "../helper/lessonResources";

export async function GenerateVideoMetaData(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  try {
    const container = request.params.container;
    const file_path = request.params.path;

    const accountName = process.env.ACC_NAME;
    const accountkey = process.env.ACC_KEY;
    const sharedCredentials = new StorageSharedKeyCredential(
      accountName,
      accountkey
    );
    const blobServiceClient: BlobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedCredentials
    );
    const blobClient: BlobClient = blobServiceClient
      .getContainerClient(container)
      .getBlobClient(file_path);

    const tempFolder = process.env.VIDEO_TEMP_FOLDER;
    // Get the temporary directory
    const tempDir = os.tmpdir();
    var tempFilePath = path.join(tempDir, tempFolder, blobClient.name);

    var dir = path.dirname(tempFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await blobClient.downloadToFile(tempFilePath);

    var duration = await generateDuration(tempFilePath);
    const data = (await generateFrame(tempFilePath)) as Buffer;
    var framePath = `poster/${randomUUID()}.jpg`;
    const blockBlobClient = blobServiceClient
      .getContainerClient(container)
      .getBlockBlobClient(framePath);

    await blockBlobClient.uploadData(data);
  } catch (err) {
    fs.unlinkSync(tempFilePath);
    fs.unlinkSync(path.join(dir, "frame.jpg"));
    return {
      status: 500,
      body: err.message,
    };
  }
  fs.unlinkSync(tempFilePath);
  fs.unlinkSync(path.join(dir, "frame.jpg"));
  const data = {
    framePath,
    duration,
  };
  return { status: 200, jsonBody: data };
}

app.http("GenerateVideoMetaData", {
  methods: ["POST"],
  authLevel: "admin",
  route: "generatemetadata",
  handler: GenerateVideoMetaData,
});
