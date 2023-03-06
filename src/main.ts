import { Telegraf, Input, deunionize } from "telegraf";
import getPayload from "./fns/getPayload.js";
import { Message } from "telegraf/typings/core/types/typegram.js";
import spotifyds from "spotifyds-core";
import "dotenv/config";
import downloadSong from "./fns/downloadSong.js";

const env = process.env;
const token = env.BOT_TOKEN;

if (!token) {
  throw Error("Please provide BOT_TOKEN");
}
function editMessageText(message: Message.TextMessage, newText: string) {
  return app.telegram.editMessageText(message.chat.id, message.message_id, undefined, newText);
}
function throttle<T extends Function>(func: T, timeout = 1000) {
  let wait = false;

  return (...args: any) => {
    if (wait) return;
    func(...args);
    wait = true;
    setTimeout(() => (wait = false), timeout);
  };
}
const sendProgress = throttle(
  (r: Message.TextMessage, artist: string, songName: string, downloaded: number, total: number) => {
    const progressText = `Downloading ${artist} - ${songName}\n` + `${downloaded}/${total}`;
    return editMessageText(r, progressText);
  }
);
const app = new Telegraf(token);

app.telegram.setMyCommands([
  { command: "r", description: "download song from title" },
  { command: "changetitle", description: "change song title" },
  { command: "changepicture", description: "change song picture" },
  { command: "changeartist", description: "change artist name" },
  { command: "uptime", description: "check bot alive time" },
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
      try {
        sendProgress(r, artist[0], result.name, downloaded, total);
      } catch {}
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

  if (!newTitle) {
    return ctx.reply("Please provide the new title");
  }
  if (message.reply_to_message && "audio" in message.reply_to_message) {
    const audio = message.reply_to_message.audio;
    const r = await downloadSong(app.telegram, audio);
    const defaultThumbUrl = "https://i.scdn.co/image/ab67616d00004851ef3eca064b57fe5efc97e597";

    await app.telegram.sendAudio(ctx.chat.id, Input.fromLocalFile(r.songFilePath), {
      performer: audio.performer,
      title: newTitle,
      thumb: { url: r.thumbUrl?.href || defaultThumbUrl },
      duration: audio.duration,
    });
  }
});
app.telegram.getMe().then((me) => {
  console.log(`Successfully logged in as ${me.username}`);
});
app.launch();

process.once("SIGINT", () => app.stop("SIGINT"));
process.once("SIGTERM", () => app.stop("SIGTERM"));
