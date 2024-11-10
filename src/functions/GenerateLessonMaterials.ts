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

import {
  generateFramesFromVideo,
  generatePDF,
  removeDuplicatedFrames,
} from "../helper/generateMetaData";

export async function GenerateLessonMaterials(
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

    const frameFolder = await generateFramesFromVideo(
      tempFilePath,
      path.join(dir, "frames")
    );
    await removeDuplicatedFrames(frameFolder);

    const materialPath = await generatePDF(
      frameFolder,
      path.join(dir, "materials")
    );
    const lessonMaterialPath = `materials/${randomUUID()}.pdf`;
    const blockBlobClient = blobServiceClient
      .getContainerClient(container)
      .getBlockBlobClient(lessonMaterialPath);

    await blockBlobClient.uploadFile(materialPath as string);
    fs.rm(tempDir, { recursive: true, force: true }, (err) => {
      if (err) {
        return {
          status: 500,
          body: err.message,
        };
      }
    });
    return { status: 200, body: lessonMaterialPath };
  } catch (err) {
    fs.unlinkSync(tempFilePath);
    return {
      status: 500,
      body: err.message,
    };
  }

  return { body: `Hello, ${name}!` };
}

app.http("GenerateLessonMaterials", {
  methods: ["POST"],
  authLevel: "admin",
  route: "generatelessonmaterials",
  handler: GenerateLessonMaterials,
});
