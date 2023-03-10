import { Telegram } from "telegraf";
import { Message } from "telegraf/types";
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
      const progressText = `Downloading ${artistName} - ${songName}\n` + `${downloaded}/${total}`;
      await telegram.editMessageText(message.chat.id, message.message_id, undefined, progressText);
    } catch {}
  }
);

export default sendProgress;
