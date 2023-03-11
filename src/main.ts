import { rmSync } from "node:fs";
import { Telegraf, Input, deunionize } from "telegraf";
import express from "express";
import spotifyds from "spotifyds-core";
import { Audio } from "telegraf/types";
import getPayload from "./fns/getPayload.js";
import { Message } from "telegraf/typings/core/types/typegram.js";
import modifySong from "./fns/modifySong.js";
import sendProgress from "./fns/sendProgress.js";
import "dotenv/config";

const env = process.env;
const token = env.BOT_TOKEN;

if (!token) {
  throw Error("Please provide BOT_TOKEN");
}
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
const startTime = Date.now();
const server = express();
const port = env.PORT || 8080;

app.telegram.setMyCommands([
  { command: "r", description: "download song from title (shortcut)" },
  { command: "download", description: "download song from title" },
  { command: "changetitle", description: "change song title" },
  { command: "changepicture", description: "change song picture" },
  { command: "changeartist", description: "change artist name" },
  { command: "uptime", description: "check bot alive time" },
  { command: "leave", description: "cancel the current task" },
]);
app.start(async (ctx) => {
  setTimeout(() => ctx.reply("Hai"), 2000);
});
app.command(["r", "download"], async (ctx) => {
  try {
    const r = await ctx.reply("Nice");
    const query = getPayload(ctx.message.text);
    await editMessageText(r, `Mencari ${query}..`);
    const result = await spotifyds.searchTrack(query);
    const artist = result.artists.items.map((artist) => artist.profile.name);
    const ytResult = await spotifyds.getTrackInfo(result.name, artist);

    await editMessageText(r, "Oke wait");
    const download = spotifyds.downloadTrack(ytResult.name, ytResult.youtubeId!, "musics");

    download.on("progress", async (chunkLength, downloaded, total) => {
      sendProgress(ctx.telegram, r, chunkLength, downloaded, total, artist[0], result.name);
    });
    download.on("finish", async (filePath) => {
      await editMessageText(r, "Sedang mengirim lagu, tunggu aja");

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
    return ctx.reply("Kirim yang benar\nContoh: /changetitle Bentuk Cinta");
  }
  if (message.reply_to_message && "audio" in message.reply_to_message) {
    const replyMessage = await ctx.reply("Nice");
    const audio = message.reply_to_message.audio;
    const thumbFileId = audio.thumb?.file_id;
    const thumbUrl = thumbFileId && (await ctx.telegram.getFileLink(thumbFileId)).href;

    modifySong(ctx.telegram, audio, replyMessage, ctx.chat.id, userId, {
      performer: audio.performer,
      title: newTitle,
      thumb: thumbUrl ? { url: thumbUrl } : undefined,
      duration: audio.duration,
    });
  } else {
    return ctx.reply("Reply ke lagunya cuy");
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
    return ctx.reply("Kirim foto kesini");
  } else {
    return ctx.reply("Reply ke lagunya");
  }
});
app.command("changeartist", async (ctx) => {
  const message = deunionize(ctx.message);
  const newArtistName = getPayload(message.text);
  const userId = message.from.id;

  if (!newArtistName) {
    return ctx.reply("Kirim yang benar\nContoh: /changeartist Will Hyde");
  }
  if (message.reply_to_message && "audio" in message.reply_to_message) {
    const replyMessage = await ctx.reply("Nice");
    const audio = message.reply_to_message.audio;
    const thumbFileId = audio.thumb?.file_id;
    const thumbUrl = thumbFileId && (await ctx.telegram.getFileLink(thumbFileId)).href;

    modifySong(ctx.telegram, audio, replyMessage, ctx.chat.id, userId, {
      performer: newArtistName,
      title: audio.title,
      thumb: thumbUrl ? { url: thumbUrl } : undefined,
      duration: audio.duration,
    });
  } else {
    return ctx.reply("Reply ke lagu yang mau diganti");
  }
});
app.command("leave", async (ctx) => {
  const userId = ctx.message.from.id;
  delete taskManager[userId];
  return ctx.replyWithSticker("CAACAgUAAxkBAAEMf59kBzfOYBDYlZPZ0ux5HATmYnvligACqQIAAqyPiFXqD9zrFfqzNy4E");
});
app.command("clean", async (ctx) => {
  rmSync("./musics/", { recursive: true, force: true });
  rmSync("./tmp/", { recursive: true, force: true });

  await ctx.reply("Done!!");
});
app.command("uptime", async (ctx) => {
  try {
    let uptimeTotal = Math.abs(+new Date() - startTime) / 1000;
    const uptimeHours = Math.floor(uptimeTotal / 3600);
    uptimeTotal -= uptimeHours * 3600;
    const uptimeMinutes = Math.floor(uptimeTotal / 60) % 60;
    uptimeTotal -= uptimeMinutes * 60;
    const uptimeSeconds = (uptimeTotal % 60).toFixed();

    if (uptimeHours !== 0 && uptimeMinutes !== 0)
      await ctx.reply(`${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`);
    else if (uptimeHours === 0 && uptimeMinutes !== 0) {
      await ctx.reply(`${uptimeMinutes}m ${uptimeSeconds}s`);
    } else {
      await ctx.reply(`${uptimeSeconds}s`);
    }
  } catch (err) {
    console.log(err);
    return ctx.reply((err as any).message);
  }
});
app.on("photo", async (ctx) => {
  const userId = ctx.message.from.id;
  const newThumbFileId = ctx.message.photo[0].file_id;
  const userTask = taskManager[userId];

  if (userTask) {
    if (userTask.name === "changepicture") {
      const replyMessage = await ctx.reply("Nice");
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
      return ctx.reply("Kirim foto atau ketik /leave untuk membatalkan");
    }
  }
});
if (env.DEVELOPMENT) {
  app.telegram.getMe().then((me) => {
    console.log(`Successfully logged in as ${me.username}`);
  });
  app.launch();
} else {
  const domain = env.WEBHOOK_DOMAIN;

  if (!domain) {
    throw Error("Please provide WEBHOOK_DOMAIN");
  }
  server.use(await app.createWebhook({ domain }));
  server.listen(port, () => console.log(`Server listening on ${port}`));
}

process.once("SIGINT", () => app.stop("SIGINT"));
process.once("SIGTERM", () => app.stop("SIGTERM"));
