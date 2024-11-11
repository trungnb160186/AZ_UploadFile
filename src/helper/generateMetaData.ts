import * as path from "node:path";
import * as fs from "fs";
import * as ffmpeg from "fluent-ffmpeg";
import { resolve } from "node:dns/promises";
import { randomUUID } from "node:crypto";
const ffprobe = require("ffprobe");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const cv = require("@techstark/opencv-js");
const { Canvas, createCanvas, Image, ImageData, loadImage } = require("canvas");
const { JSDOM } = require("jsdom");
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

export async function removeDuplicatedFrames(folderPath) {
  try {
    installDOM();
    fs.unlinkSync(path.join(folderPath, "frame_001.jpg"));
    fs.unlinkSync(path.join(folderPath, "frame_002.jpg"));
    const files = fs
      .readdirSync(folderPath)
      .filter((file) => path.extname(file) === ".jpg");

    const uniqueFiles = [];
    for (let i = 0; i < files.length; i++) {
      const filePath = path.join(folderPath, files[i]);
      const imgTemplate = await loadImage(filePath);
      let isUnique = true;
      for (let j = i + 1; j < files.length; j++) {
        const identical = await areImagesMatching(
          path.join(folderPath, files[j]),
          imgTemplate
        );
        if (!identical) {
          isUnique = false;
          i = j - 1;
          break;
        } else {
          fs.unlinkSync(path.join(folderPath, files[j]));
        }
      }
    }
    return;
  } catch (error) {
    return error;
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

const areImagesMatching = async (img1Path: string, imgTemplate) => {
  const img1 = await loadImage(img1Path);
  const checkImg = cv.imread(img1);
  const templateImg = cv.imread(imgTemplate);

  let dst = new cv.Mat();
  let mask = new cv.Mat();
  cv.matchTemplate(checkImg, templateImg, dst, cv.TM_CCOEFF_NORMED, mask);
  let result = cv.minMaxLoc(dst, mask);
  if (result.maxVal < 0) {
    return false;
  } else if (result.maxVal > 0.9 && result.maxVal <= 1) {
    return true;
  } else {
    return false;
  }
};

function installDOM() {
  const dom = new JSDOM();
  global.document = dom.window.document;

  // The rest enables DOM image and canvas and is provided by node-canvas
  global.Image = Image;
  global.HTMLCanvasElement = Canvas;
  global.ImageData = ImageData;
  global.HTMLImageElement = Image;
}
