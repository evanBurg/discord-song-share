const fetch = require("node-fetch");
const http = require("http");
const url = require("url");
const querystring = require("querystring");
const path = require("path");
const fs = require("fs");
const isUrl = require("is-url");

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

  if (!requestee) requestee = "Someone";

  //Extract data
  const results = await response.json();
  const entries = results.entitiesByUniqueId;
  let title = "";
  const pageUrl = results.pageUrl;

  let spotifyURL, youtubeURL, appleURL, soundcloudURL;
  try {
    spotifyURL = results.linksByPlatform.spotify.url;
  } catch(e) {}
  try {
    youtubeURL = results.linksByPlatform.youtubeMusic.url;
  } catch(e) {}
  try {
    appleURL = results.linksByPlatform.appleMusic.url;
  } catch(e) {}
  try {
    soundcloudURL = results.linksByPlatform.soundcloud.url;
  } catch(e) {}

  const locations = {
    spotify: spotifyURL,
    youtube: youtubeURL,
    apple: appleURL,
    soundcloud: soundcloudURL
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
          icon_url:
            "https://cdn4.iconfinder.com/data/icons/small-n-flat/24/user-alt-512.png"
        },
        title: title,
        url: pageUrl,
        fields: [
          {
            name: "YouTube Music",
            value: locations.youtube ? `[Link](${locations.youtube})` : 'Not Available',
            inline: true
          },
          {
            name: "Spotify",
            value: locations.spotify ? `[Link](${locations.spotify})` : 'Not Available',
            inline: true
          },
          {
            name: "‎",
            value: "‎"
          },
          {
            name: "Apple Music",
            value: locations.apple ? `[Link](${locations.apple})` : 'Not Available',
            inline: true
          },
          {
            name: "Soundcloud",
            value: locations.soundcloud ? `[Link](${locations.soundcloud})` : 'Not Available',
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
  console.log("[ERROR]: ", error);
  response.writeHead(status, {
    "Content-Type": "text/html",
    "Share-Error": error
  });
  fs.createReadStream(path.resolve("./views/error.html")).pipe(response);
};

const succeed = (response, message) => {
  let song = {
    title: message.embeds[0].title,
    img: message.embeds[0].image.url
  };
  response.writeHead(200, {
    "Content-Type": "text/html",
    "Song-Title": song.title,
    "Song-Image": song.img
  });
  fs.createReadStream(path.resolve("./views/success.html")).pipe(response);
};

const shareSong = async (song, user, response, headers) => {
  if (song) {
    try {
      let message = await generateMessage(song, user);
      if (!headers) {
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
      }

      succeed(response, message);
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
    const parsed = url.parse(request.url);
    const query = querystring.parse(parsed.query);

    if (request.url.includes("/share")) {
      let url = "";
      for (let key in query) {
        console.log(key, query[key]);
        if (isUrl(query[key])) url = query[key];
      }

      console.log(url);

     return shareSong(url, undefined, response, query.headers == 'true');
    }

    if (request.url.includes("?song=")) {
      return shareSong(query.song, query.user, response, query.headers == 'true');
    } else {
      //Send index
      response.writeHead(200);
      return fs.createReadStream(path.resolve("./views/index.html")).pipe(response);
    }
  }
};

const server = http.createServer((request, response) => {
  var parts = url.parse(request.url);
  if (parts.pathname === "/" || parts.pathname === "/share") {
    handleRequest(request, response);
  } else if (parts.pathname === "/manifest.json") {
    response.writeHead(200, { "Content-Type": "application/x-www-form-urlencoded"});
    fs.createReadStream(path.resolve("./views/manifest.json")).pipe(response);
  } else if (parts.pathname === "/service-worker.js") {
    response.writeHead(200, { "Content-Type": "application/javascript"});
    fs.createReadStream(path.resolve("./views/service-worker.js")).pipe(response);
  } else if (parts.pathname === "/icon.png") {
    response.writeHead(200, { "Content-Type": "image/png"});
    fs.createReadStream(path.resolve("./views/icon.png")).pipe(response);
  } else {
    response.writeHead(400, { "Content-Type": "text/plain" });
    response.end("Error: Unknown Path");
  }
});

server.listen(process.env.PORT || 80);
