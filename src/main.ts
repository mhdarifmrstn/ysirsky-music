import { Telegraf, Input, deunionize } from "telegraf";
import spotifyds from "spotifyds-core";
import { Audio } from "telegraf/types";
import getPayload from "./fns/getPayload.js";
import { Message } from "telegraf/typings/core/types/typegram.js";
import downloadFile from "./fns/downloadFile.js";
import "dotenv/config";
import changePicture from "./fns/changePicture.js";
import formatBytes from "./fns/formatBytes.js";
import modifySong from "./fns/modifySong.js";
import sendProgress from "./fns/sendProgress.js";

const env = process.env;
const token = env.BOT_TOKEN;
// const logChannelId = env.LOG_CHANNEL_ID;

if (!token) {
  throw Error("Please provide BOT_TOKEN");
}
// if (!logChannelId) {
//   throw Error("Please provide LOG_CHANNEL_ID");
// }
function editMessageText(message: Message.TextMessage, newText: string) {
  return app.telegram.editMessageText(message.chat.id, message.message_id, undefined, newText);
}
interface TaskManager {
  [userId: number]: {
    name: "changetitle" | "changepicture" | "changeartist";
    audio: Audio;
  };
}
const app = new Telegraf(token);
const taskManager: TaskManager = {};

app.telegram.setMyCommands([
  { command: "r", description: "download song from title" },
  { command: "changetitle", description: "change song title" },
  { command: "changepicture", description: "change song picture" },
  { command: "changeartist", description: "change artist name" },
  { command: "uptime", description: "check bot alive time" },
  { command: "leave", description: "cancel the current task" },
]);
app.command("r", async (ctx) => {
  try {
    const r = await ctx.reply("Terminal Running..");
    const query = getPayload(ctx.message.text);
    await editMessageText(r, "Searching Track..");
    const result = await spotifyds.searchTrack(query);
    const artist = result.artists.items.map((artist) => artist.profile.name);
    const ytResult = await spotifyds.getTrackInfo(result.name, artist);

    await editMessageText(r, "Downloading Track..");
    const download = spotifyds.downloadTrack(ytResult.name, ytResult.youtubeId!, "musics");

    download.on("progress", async (chunkLength, downloaded, total) => {
      sendProgress(ctx.telegram, ctx.message, chunkLength, downloaded, total, artist[0], result.name);
    });
    download.on("finish", async (filePath) => {
      await editMessageText(r, "Sending file..");

      await app.telegram.sendAudio(ctx.chat.id, Input.fromLocalFile(filePath), {
        performer: result.artists.items[0].profile.name,
        title: result.name,
        thumb: { url: ytResult.thumbnailUrl! },
        duration: ytResult.duration?.totalSeconds,
      });
      await app.telegram.deleteMessage(r.chat.id, r.message_id);
    });
    download.on("error", console.log);
  } catch (err) {
    console.log(err);
    return ctx.reply((err as any).message);
  }
});
app.command("changetitle", async (ctx) => {
  const message = deunionize(ctx.message);
  const newTitle = getPayload(message.text);
  const userId = message.from.id;

  if (!newTitle) {
    return ctx.reply("Please provide a new title");
  }
  if (message.reply_to_message && "audio" in message.reply_to_message) {
    const replyMessage = await ctx.reply("Terminal Running..");
    const audio = message.reply_to_message.audio;
    const thumbFileId = audio.thumb?.file_id;
    const thumbUrl = thumbFileId && (await ctx.telegram.getFileLink(thumbFileId)).href;

    modifySong(ctx.telegram, audio, replyMessage, ctx.chat.id, userId, {
      performer: audio.performer,
      title: newTitle,
      thumb: thumbUrl ? { url: thumbUrl } : undefined,
      duration: audio.duration,
    });
  }
});
app.command("changepicture", async (ctx) => {
  const message = deunionize(ctx.message);
  const userId = message.from.id;

  if (message.reply_to_message && "audio" in message.reply_to_message) {
    const audio = message.reply_to_message.audio;

    taskManager[userId] = {
      name: "changepicture",
      audio,
    };
    return ctx.reply("Send me a picture");
  }
});
app.command("changeartist", async (ctx) => {
  const message = deunionize(ctx.message);
  const newArtistName = getPayload(message.text);
  const userId = message.from.id;

  if (!newArtistName) {
    return ctx.reply("Please provide a new artist name");
  }
  if (message.reply_to_message && "audio" in message.reply_to_message) {
    const replyMessage = await ctx.reply("Terminal Running..");
    const audio = message.reply_to_message.audio;
    const thumbFileId = audio.thumb?.file_id;
    const thumbUrl = thumbFileId && (await ctx.telegram.getFileLink(thumbFileId)).href;

    modifySong(ctx.telegram, audio, replyMessage, ctx.chat.id, userId, {
      performer: newArtistName,
      title: audio.title,
      thumb: thumbUrl ? { url: thumbUrl } : undefined,
      duration: audio.duration,
    });
  }
});
app.command("leave", async (ctx) => {
  const userId = ctx.message.from.id;
  delete taskManager[userId];
  return ctx.replyWithSticker("CAACAgUAAxkBAAEMf59kBzfOYBDYlZPZ0ux5HATmYnvligACqQIAAqyPiFXqD9zrFfqzNy4E");
});
app.on("photo", async (ctx) => {
  const userId = ctx.message.from.id;
  const newThumbFileId = ctx.message.photo[0].file_id;
  const userTask = taskManager[userId];

  if (userTask) {
    if (userTask.name === "changepicture") {
      const replyMessage = await ctx.reply("Terminal Running..");
      const audio = userTask.audio;
      const newThumbUrl = (await ctx.telegram.getFileLink(newThumbFileId)).href;

      modifySong(ctx.telegram, audio, replyMessage, ctx.chat.id, userId, {
        performer: audio.performer,
        title: audio.title,
        thumb: { url: newThumbUrl },
        duration: audio.duration,
      });
      delete taskManager[userId];
    } else {
      return ctx.reply("Please send me a picture or type /leave to cancel the current task");
    }
  }
});
app.telegram.getMe().then((me) => {
  console.log(`Successfully logged in as ${me.username}`);
});
app.launch();

process.once("SIGINT", () => app.stop("SIGINT"));
process.once("SIGTERM", () => app.stop("SIGTERM"));
