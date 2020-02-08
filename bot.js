const fetch = require("node-fetch");
const http = require("http");
const url = require("url");
const querystring = require("querystring");
const path = require("path");
const fs = require("fs");

//Variables
const WEBHOOK_URL =
  process.env.WEBHOOK_URL ||
  "https://discordapp.com/api/webhooks/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const SONGLINK_URL =
  process.env.SONGLINK_URL || `https://api.song.link/v1-alpha.1`;
const USERNAME = process.env.USERNAME || "Music Man";
const AVATAR = process.env.AVATAR || "https://i.imgur.com/I9xBxse.jpg";

//Webhook body
const generateMessage = async (song_link, requestee) => {
  //Get Song details
  const response = await fetch(
    `${SONGLINK_URL}/links?url=${song_link}&userCountry=US`
  );

  //Cancel if not found
  if (!response.ok) return false;

  //Extract data
  const results = await response.json();
  const entries = results.entitiesByUniqueId;
  let title = "";
  const pageUrl = results.pageUrl;
  const locations = {
    spotify: results.linksByPlatform.spotify.url,
    youtube: results.linksByPlatform.youtubeMusic.url,
    apple: results.linksByPlatform.appleMusic.url,
    google: results.linksByPlatform.google.url
  };

  let thumbnail = false;
  Object.keys(entries).forEach(key => {
    let entry = entries[key];
    if (!thumbnail) {
      title = `${entry.title} by ${entry.artistName}`;
      thumbnail = {
        url: entry.thumbnailUrl,
        height: entry.thumbnailHeight,
        width: entry.thumbnailWidth
      };
    } else if (
      entry.thumbnailWidth > thumbnail.width ||
      entry.thumbnailHeight > thumbnail.height
    ) {
      title = `${entry.title} by ${entry.artistName}`;
      thumbnail = {
        url: entry.thumbnailUrl,
        height: entry.thumbnailHeight,
        width: entry.thumbnailWidth
      };
    }
  });

  return {
    username: USERNAME,
    avatar_url: AVATAR,
    content: `${requestee} shared a new song!`,
    embeds: [
      {
        author: {
          name: `Shared by ${requestee}`,
          icon_url: "https://cdn4.iconfinder.com/data/icons/small-n-flat/24/user-alt-512.png"
        },
        title: title,
        url: pageUrl,
        fields: [
          {
            name: "YouTube Music",
            value: `[Link](${locations.youtube})`,
            inline: true
          },
          {
            name: "Spotify",
            value: `[Link](${locations.spotify})`,
            inline: true
          },
          {
            name: "\u0000",
            value: "\u0000"
          },
          {
            name: "Apple Music",
            value: `[Link](${locations.apple})`,
            inline: true
          },
          {
            name: "Google Play Music",
            value: `[Link](${locations.google})`,
            inline: true
          }
        ],
        image: {
          url: thumbnail.url
        }
      }
    ]
  };
};

const fail = (response, status, error) => {
  response.writeHead(status, { "Content-Type": "text/plain" });
  response.end(error);
};

const shareSong = async (request, response) => {
  const parsed = url.parse(request.url);
  const query = querystring.parse(parsed.query);

  if (query.song) {
    try {
      let message = await generateMessage(query.song, query.user);
      let discord = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });
      if (!discord.ok) {
        let error = discord.statusText;
        let body = await discord.text();
        return fail(
          response,
          500,
          `Error: Couldn't share song... ( ${error} )\n\n${body}`
        );
      }
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("Song shared!");
    } catch (e) {
      return fail(response, 400, `Error: Couldn't share song... ( ${e} )`);
    }
  } else {
    return fail(
      response,
      400,
      "Error: You must attach a song to share! ( ?song= )"
    );
  }
};

const handleRequest = async (request, response) => {
  if (request.method === "GET") {
    if (request.url.includes("?song=")) {
      shareSong(request, response);
    } else {
      //Send index
      response.writeHead(200);
      fs.createReadStream(path.resolve("./index.html")).pipe(response);
    }
  }

  if (request.method === "POST") {
    shareSong(request, response);
  }
};

const server = http.createServer((request, response) => {
  var parts = url.parse(request.url);
  if (parts.pathname === "/") {
    handleRequest(request, response);
  } else {
    response.writeHead(400, { "Content-Type": "text/plain" });
    response.end("Error: Unknown Path");
  }
});

server.listen(process.env.PORT || 80);
