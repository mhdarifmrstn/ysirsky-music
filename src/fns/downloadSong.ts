import https from "node:https";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { Telegram } from "telegraf";
import { Audio } from "telegraf/types";

function getRandomName() {
  return randomBytes(5).toString("hex");
}
async function downloadFile(fileName: string, url: string): Promise<string> {
  const dir = "tmp";
  const filePath = `${process.cwd()}/${dir}/${fileName}`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const file = fs.createWriteStream(filePath);

  return new Promise((resolve) => {
    https.get(url, (res) => {
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(filePath);
      });
    });
  });
}
async function downloadSong(telegram: Telegram, audio: Audio) {
  const audioUrl = await telegram.getFileLink(audio.file_id);
  const thumbUrl = audio.thumb && (await telegram.getFileLink(audio.thumb?.file_id));
  const audioFileName = getRandomName() + ".mp3";
  const songFilePath = await downloadFile(audioFileName, audioUrl.href);

  return { songFilePath, thumbUrl };
}

export default downloadSong;
