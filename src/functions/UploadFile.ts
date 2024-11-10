import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { randomUUID } from "crypto";
import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

export async function UploadFile(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`);
  const fileId = randomUUID();
  const uploadContainer = request.headers.get("Upload-Container");
  try {
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
    var containerClient: ContainerClient =
      blobServiceClient.getContainerClient(uploadContainer);
    await containerClient.createIfNotExists();
  } catch (err) {
    return {
      status: 500,
      body: err.message,
    };
  }

  return {
    status: 200,
    body: fileId,
  };
}

app.http("UploadFile", {
  methods: ["POST"],
  authLevel: "admin",
  route: "upload",
  handler: UploadFile,
});
