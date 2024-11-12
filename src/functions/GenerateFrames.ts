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

import {
  generateFramesFromVideo,
  removeTempFolder,
} from "../helper/lessonResources";

export async function GenerateFrames(
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
    context.log(`Dowloaded file to: ${dir}`);
    context.log(`Generating frames to: ${path.join(dir, "frames")}`);
    const frameFolder = await generateFramesFromVideo(
      tempFilePath,
      path.join(dir, "frames")
    );
    context.log(`Done`);

    return { status: 200, body: frameFolder as string };
  } catch (err) {
    await removeTempFolder(
      path.join(os.tmpdir(), process.env.VIDEO_TEMP_FOLDER)
    );
    return {
      status: 500,
      body: err.message,
    };
  }

  return { body: `Hello, ${name}!` };
}

app.http("GenerateFrames", {
  methods: ["POST"],
  authLevel: "admin",
  route: "generateframes",
  handler: GenerateFrames,
});
