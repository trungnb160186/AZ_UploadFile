import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  createResponse,
  DataResponse,
  generatePDF,
  removeDuplicatedFramesEnhance,
  removeTempFolder,
} from "../helper/lessonResources";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { randomUUID } from "crypto";

import * as path from "node:path";

export async function GeneratePDF(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);

  let dataResponse: DataResponse = {
    status: {
      code: 200,
      err_message: "",
    },
    data: {
      resource_path: "",
    },
  };
  const container = request.params.container;
  const framePath = request.params.path;
  const accountName = process.env.ACC_NAME;
  const accountkey = process.env.ACC_KEY;
  try {
    const sharedCredentials = new StorageSharedKeyCredential(
      accountName,
      accountkey
    );
    const blobServiceClient: BlobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedCredentials
    );

    const result = removeDuplicatedFramesEnhance(framePath);
    if (result === false) {
      context.log(`Failed to handle duplicated frames`);
      dataResponse = createResponse(
        500,
        "Failed to handle duplicated frames",
        ""
      );

      return {
        status: 500,
        jsonBody: dataResponse,
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

    await removeTempFolder(path.dirname(framePath));

    context.log(`Done.`);

    dataResponse = createResponse(200, "", lessonMaterialPath as string);

    return { status: 200, jsonBody: dataResponse };
  } catch (err) {
    context.log(`Failed: ${err.message}`);

    await removeTempFolder(path.dirname(framePath));

    dataResponse = createResponse(500, err.message, "");

    return {
      status: 500,
      jsonBody: dataResponse,
    };
  }
}

app.http("GeneratePDF", {
  methods: ["POST"],
  authLevel: "admin",
  route: "generatepdf",
  handler: GeneratePDF,
});
