import * as path from "node:path";
import * as fs from "fs";
import * as ffmpeg from "fluent-ffmpeg";
import { randomUUID, createHash } from "node:crypto";
const ffprobe = require("ffprobe");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const PDFDocument = require("pdfkit");

export async function generateFrame(filePath: string) {
  return new Promise((resolve, reject) => {
    const folder = path.dirname(filePath);
    ffmpeg.setFfmpegPath(ffmpegStatic);
    ffmpeg(filePath)
      .on("end", () => {
        const frameData = fs.readFileSync(path.join(folder, "frame.jpg"));
        resolve(frameData);
      })
      .on("error", (err) => {
        reject(err);
      })
      .screenshots({
        count: 1,
        folder: folder,
        filename: "frame.jpg",
        timemarks: ["1"],
      });
  });
}

export async function generateDuration(filePath: string) {
  return new Promise((resolve, reject) => {
    ffprobe(filePath, { path: ffprobeStatic.path }, (err, video) => {
      if (err) {
        reject(err);
      } else {
        resolve(Math.floor(video.streams[0].duration / 60));
      }
    });
  });
}

export async function generateFramesFromVideo(
  inputVideoPath: string,
  outputFramePath
) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputFramePath)) {
      fs.mkdirSync(outputFramePath);
    }
    ffmpeg.setFfmpegPath(ffmpegStatic);
    ffmpeg()
      .input(inputVideoPath)
      .fps(0.5)
      .outputOptions(["-vf", "scale=1280:720", "-qscale:v", "1"])
      .saveToFile(path.join(outputFramePath, "frame_%03d.jpg"))
      .on("end", () => {
        resolve(outputFramePath);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

export function removeDuplicatedFramesEnhance(folderPath) {
  try {
    const files = fs
      .readdirSync(folderPath)
      .filter((file) => path.extname(file) === ".jpg");

    const md5Set = new Set();
    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(folderPath, files[i]);

      const md5Image = generateMD5(filePath);
      if (md5Set.has(md5Image)) {
        fs.unlinkSync(path.join(folderPath, files[i]));
      } else {
        md5Set.add(md5Image);
      }
    }
    fs.unlinkSync(path.join(folderPath, "frame_001.jpg"));

    return true;
  } catch (error) {
    return false;
  }
}

export async function generatePDF(frameFolder, outPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outPath)) {
      fs.mkdirSync(outPath);
    }
    const doc = new PDFDocument({ size: "A4", layout: "landscape" });
    const outFile = path.join(outPath, `${randomUUID()}.pdf`);

    const outputStream = fs
      .createWriteStream(outFile)
      .on("finish", () => {
        resolve(outFile);
      })
      .on("error", (err) => {
        reject(err);
      });
    doc.pipe(outputStream);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    const imageRatio = 1280 / 720;
    const pageRatio = pageWidth / pageHeight;
    let width, height;
    if (imageRatio > pageRatio) {
      width = pageWidth * 1;
      height = width / imageRatio;
    } else {
      height = pageHeight * 0.8;
      width = height * imageRatio;
    }
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;
    const files = fs
      .readdirSync(frameFolder)
      .filter((file) => path.extname(file) === ".jpg");

    files.forEach((file) => {
      doc
        .addPage()
        .rect(0, 0, pageWidth, pageHeight)
        .fill("#F4F4F4")
        .image(path.join(frameFolder, file), x, y, {
          width,
          height,
        });
    });
    doc.end();
  });
}

export async function removeTempFolder(path) {
  return new Promise((resolve, reject) => {
    fs.rm(path, { recursive: true, force: true }, (err) => {
      if (err) {
        reject(err.message);
      }
      resolve("Folder was deleted");
    });
  });
}
function generateMD5(filePath) {
  const hash = createHash("md5");
  const fileBuff = fs.readFileSync(filePath);
  hash.update(fileBuff);
  return hash.digest("hex");
}

export interface DataResponse {
  status: {
    code: number;
    err_message: string;
  };
  data: {
    resource_path: string;
  };
}

export function createResponse(
  code: number,
  err_message: string,
  response: string
): DataResponse {
  const dataResponse: DataResponse = {
    status: {
      code: code,
      err_message: err_message,
    },
    data: {
      resource_path: response,
    },
  };

  return dataResponse;
}
