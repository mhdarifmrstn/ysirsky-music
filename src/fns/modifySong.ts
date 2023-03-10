import { Input, Telegram } from "telegraf";
import { Audio, Message } from "telegraf/types";
import downloadFile from "./downloadFile.js";
import formatBytes from "./formatBytes.js";
import sendProgress from "./sendProgress.js";

interface Extra {
  performer?: string;
  title?: string;
  thumb?: { url: string };
  duration?: number;
}
async function modifySong(
  telegram: Telegram,
  audio: Audio,
  replyMessage: Message.TextMessage,
  chatId: number,
  userId: number,
  extra: Extra
) {
  const audioUrl = await telegram.getFileLink(audio.file_id);
  const audioFilePath = await downloadFile(userId + ".mp3", audioUrl.href, async (chunkLength, downloaded, total) => {
    const percent = Number(((100.0 * downloaded) / total).toFixed(2));
    process.stdout.write(`Downloading yeah ${percent}% ${formatBytes(downloaded)}/${formatBytes(total)}\r`);
    await sendProgress(telegram, replyMessage, chunkLength, downloaded, total, audio.performer, audio.title);
  });
  await telegram.sendAudio(chatId, Input.fromLocalFile(audioFilePath), extra);
}

export default modifySong;
