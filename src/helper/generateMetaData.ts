import * as path from "node:path";
import * as fs from "fs";
import * as ffmpeg from "fluent-ffmpeg";
import { resolve } from "node:dns/promises";
const ffprobe = require("ffprobe");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const cv = require("@techstark/opencv-js");
const { Canvas, createCanvas, Image, ImageData, loadImage } = require("canvas");
const { JSDOM } = require("jsdom");

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
      // .outputOption("-vf mpdecimate")
      // .withVideoFilters("mpdecimate,setpts=N/FRAME_RATE/TB")
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
