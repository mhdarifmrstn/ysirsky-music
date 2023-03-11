import { Telegram } from "telegraf";
import { Message } from "telegraf/types";
import formatBytes from "./formatBytes.js";
import throttle from "./throttle.js";

const sendProgress = throttle(
  async (
    telegram: Telegram,
    message: Message,
    chunkLength: number,
    downloaded: number,
    total: number,
    artistName?: string,
    songName?: string
  ) => {
    try {
      const formatDownloaded = formatBytes(downloaded);
      const formatTotal = formatBytes(total);
      const progressText =
        `Ysirsky Music\n\n` +
        `Nama: ${songName || "-"}\n` +
        `Artist: ${artistName || "-"}\n\n` +
        `${formatDownloaded} / ${formatTotal}`;
      await telegram.editMessageText(message.chat.id, message.message_id, undefined, progressText);
    } catch {}
  }
);

export default sendProgress;
