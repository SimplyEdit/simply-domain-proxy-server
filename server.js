const { http, https } = require('follow-redirects');
const config = {
  host: process.env.NODE_HOST || "0.0.0.0",
  port: process.env.NODE_PORT || 3000,
};
const dns = require("dns");

function getProxyProtocol(dnslink) {
  if (dnslink.includes("https")) {
    return "https";
  }
  if (dnslink.includes("http")) {
    return "http";
  }
  // FIXME: Add other types here: ipfs, hyper, etc;
}

const server = http.createServer((requestFromClient, res) => {
  // Get all TXT records from _dnslink.hostname
  dns.resolveTxt("_dnslink." + requestFromClient.headers['x-forwarded-host'], function (err, dnslink) {
    if (err || !Array.isArray(dnslink[0])) {
      //console.log(err);
      return;
    }

    if (dnslink[0][0].includes("dnslink")) {
      const requestedUrl = requestFromClient.url;
      console.log("Requested URL from client: " + requestedUrl);
      
      const content = dnslink[0][0].replace("dnslink=", "");
      console.log("Retrieved dnslink url - " + content);

      let targetUrl = content + requestFromClient.url;
      let proxyProtocol = getProxyProtocol(content);
      let urlToServer;
      console.log("Detected target protocol: " + proxyProtocol);      
      switch (proxyProtocol) {
        case "http":
          urlToServer = new URL(targetUrl);
          http.get(urlToServer, (responseFromServerToClient) => {
            const buffer = [];

            responseFromServerToClient.on("data", (chunk) =>
              buffer.push(chunk)
            );

            responseFromServerToClient.on("end", () => {
              res.write(Buffer.concat(buffer));
              res.end();
            });
          });
        break;
        case "https":
          urlToServer = new URL(targetUrl);
          https.get(urlToServer, (responseFromServerToClient) => {
            const buffer = [];

            responseFromServerToClient.on("data", (chunk) =>
              buffer.push(chunk)
            );

            responseFromServerToClient.on("end", () => {
              res.write(Buffer.concat(buffer));
              res.end();
            });
          });
        break;
        default:
          throw new Exception("Unhandled proxy type");
        break;
      }
    }
  });
})
.listen(config, function () {
  console.log(`Server listening to port ${config.port}`);
});

function setHostHandler(url) {
  let urlObj = new URL(url);
  let isHttps = url.includes("https");
  const host = urlObj.host.replace("www.", "");

  if (!isHttps) {
    console.log("Is not https");
    return host.concat(":80");
  } else {
    console.log("Is https");
    return host.concat(":443");
  }
}

// error handling
server.on("error", function (err) {
  console.log("An internal error has occurred!");
  console.log(err);
});

server.on("close", function () {
  console.log("Client disconnected");
});
