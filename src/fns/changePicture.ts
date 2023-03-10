import { Input, Telegram } from "telegraf";
import { Audio } from "telegraf/types";
import downloadFile from "./downloadFile.js";

async function changePicture(telegram: Telegram, audio: Audio, newThumbFileId: string, chatId: number, userId: number) {
  const audioUrl = await telegram.getFileLink(audio.file_id);
  const newThumbUrl = await telegram.getFileLink(newThumbFileId);
  const audioFilePath = await downloadFile(userId + ".mp3", audioUrl.href);

  await telegram.sendAudio(chatId, Input.fromLocalFile(audioFilePath), {
    performer: audio.performer,
    title: audio.title,
    thumb: { url: newThumbUrl.href },
    duration: audio.duration,
  });
}

export default changePicture;
