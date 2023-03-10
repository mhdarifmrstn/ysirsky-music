import fs from "node:fs";
import https from "node:https";
import http from "node:http";

type ProgressCallback = (chunkLength: number, downloaded: number, total: number) => any;

async function downloadFile(fileName: string, url: string, progressCallback: ProgressCallback): Promise<string> {
  const urlProtocol = new URL(url).protocol;
  const request = urlProtocol === "https:" ? https : http;
  const dir = "tmp";
  const filePath = `${process.cwd()}/${dir}/${fileName}`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const file = fs.createWriteStream(filePath);

  return new Promise((resolve) => {
    let downloaded = 0;

    request.get(url, (res) => {
      res.pipe(file);
      res.on("data", (chunk) => {
        const chunkLength = chunk.length;
        downloaded += chunkLength;
        const total = Number(res.headers["content-length"]);
        progressCallback(chunkLength, downloaded, total);
      });
      file.on("finish", () => {
        file.close();
        resolve(filePath);
      });
    });
  });
}

export default downloadFile;
