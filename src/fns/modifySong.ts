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
  const audioBuffer = await downloadFile(audioUrl.href, async (chunkLength, downloaded, total) => {
    await sendProgress(telegram, replyMessage, chunkLength, downloaded, total, audio.performer, audio.title);
  });
  await telegram.editMessageText(replyMessage.chat.id, replyMessage.message_id, undefined, "Oke tunggu sebentar");
  await telegram.sendAudio(chatId, Input.fromBuffer(audioBuffer), extra);
  await telegram.deleteMessage(replyMessage.chat.id, replyMessage.message_id);
}

export default modifySong;
