import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";
import { randomUUID } from "crypto";
import { Readable } from "stream";
interface Chunk {
  index: number;
  blockId: string;
  contentLength: number;
  offset: number;
  data: Uint8Array;
}

var mapFiles = new Map<string, Map<string, Chunk>>();

export async function UploadChunk(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const fileId = request.query.get("patch");
  const chunkSize = process.env.CHUNK_SIZE as unknown as number;

  if (request.method === "HEAD") {
    const lastChunk = [...mapFiles.get(fileId)].at(-1);
    context.log(Number(lastChunk[1].offset) + Number(chunkSize));

    return {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Upload-Offset",
        "Upload-Offset": (
          Number(lastChunk[1].offset) + Number(chunkSize)
        ).toString(),
      },
    };
  }

  context.log(`Http function processed request for url "${request.url}"`);
  const dir = process.env.UPLOAD_TEMP_DIR;
  if (!mapFiles.has(fileId)) {
    mapFiles.set(fileId, new Map<string, Chunk>());
  }

  const fileName = request.headers.get("Upload-Name");
  const uploadlength = request.headers.get(
    "Upload-Length"
  ) as unknown as number;
  const offset = request.headers.get("Upload-Offset") as unknown as number;
  const lastChunkIndex = Math.floor(uploadlength / chunkSize);

  let chunk: Chunk = {
    index: Math.floor(offset / chunkSize),
    blockId: Buffer.from(randomUUID(), "utf-8").toString("base64"),
    contentLength: Number(request.headers.get("content-length")),
    offset: offset,
    data: null,
  };

  const chunks = [];
  for await (let chunk of request.body) {
    chunks.push(chunk);
  }
  chunk.data = Buffer.concat(chunks);

  mapFiles.get(fileId).set(chunk.index.toString(), chunk);

  if (chunk.index == lastChunkIndex) {
    const fileChunks = mapFiles.get(fileId);
    var dataStream = new Readable();

    fileChunks.forEach((chunk) => {
      // fs.appendFileSync(finalFilePath, chunk.data);
      dataStream.push(chunk.data);
    });
    dataStream.push(null);

    // Specify data transfer options
    // const uploadOptions = {
    //   blockSize: 5 * 1024 * 1024, // 5 MiB max block size
    //   concurrency: 8, // maximum number of parallel transfer workers
    //   maxSingleShotSize: 10 * 1024 * 1024, // 10 MiB initial transfer size
    // };
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

      const container = request.headers.get("Upload-Container");
      const blobName = `${request.headers.get(
        "Upload-Category"
      )}/${fileId}/${fileName}`;
      const blockBlobClient = blobServiceClient
        .getContainerClient(container)
        .getBlockBlobClient(blobName);
      // await blockBlobClient.uploadFile(finalFilePath, uploadOptions);
      await blockBlobClient.uploadStream(dataStream, 5 * 1024 * 1024, 8);
    } catch (err) {
      return {
        status: 500,
        body: err.message,
      };
    }
  }

  return { status: 200 };
}

app.http("UploadChunk", {
  methods: ["HEAD", "PATCH"],
  authLevel: "admin",
  route: "uploadchunk",
  handler: UploadChunk,
});
