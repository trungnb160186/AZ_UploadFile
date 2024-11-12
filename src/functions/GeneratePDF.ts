import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  generatePDF,
  removeDuplicatedFrames,
} from "../helper/generateMetaData";
import {
  BlobClient,
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { randomUUID } from "crypto";

import * as os from "node:os";
import * as path from "node:path";
import * as fs from "fs";

export async function GeneratePDF(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  try {
    const container = request.params.container;
    const framePath = request.params.frame_path;
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
    const result = await removeDuplicatedFrames(framePath);
    if (result === false) {
      return {
        status: 500,
        body: "Failed to create material!",
      };
    }
    context.log(`Done`);
    context.log(`Generating PDF...`);
    const materialPath = await generatePDF(
      framePath,
      path.join(path.dirname(framePath), "materials")
    );
    context.log(`Done`);
    const lessonMaterialPath = `materials/${randomUUID()}.pdf`;
    const blockBlobClient = blobServiceClient
      .getContainerClient(container)
      .getBlockBlobClient(lessonMaterialPath);

    await blockBlobClient.uploadFile(materialPath as string);
    context.log(`Cleaning up...`);
    fs.rm(
      path.join(os.tmpdir(), process.env.VIDEO_TEMP_FOLDER),
      { recursive: true, force: true },
      (err) => {
        if (err) {
          return {
            status: 500,
            body: err.message,
          };
        }
      }
    );
    context.log(`Done.`);
    return { status: 200, body: lessonMaterialPath };
  } catch (err) {
    fs.rm(
      path.join(os.tmpdir(), process.env.VIDEO_TEMP_FOLDER),
      { recursive: true, force: true },
      (err) => {
        if (err) {
          return {
            status: 500,
            body: err.message,
          };
        }
      }
    );
  }

  return { body: `Hello, ${name}!` };
}

app.http("GeneratePDF", {
  methods: ["POST"],
  authLevel: "admin",
  route: "generatepdf",
  handler: GeneratePDF,
});
