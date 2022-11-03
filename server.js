const net = require("net");
const https = require("node:https");
const server = net.createServer();
const config = {
  host: "0.0.0.0",
  port: 3128,
};
const dns = require("dns");

/// Establishes a connection to target URL via client to proxy
server.on("connection", function (clientToProxySocket) {
  console.log("Client connected to proxy");
  clientToProxySocket.once("data", function (data) {
    // Defining variables for later on
    let serverPort;
    let serverAddress;

    let isHttpsConnection = data.toString().indexOf("CONNECT") !== -1;

    if (isHttpsConnection) {
      serverPort = 443; /// HTTPS uses 443 as port number

      // Split the address information out of the request
      serverAddress = data
        .toString()
        .split("CONNECT")[1]
        .split(" ")[1]
        .split(":")[0];
    } else {
      // Filter out the address from the request, no need to change the
      // serverPort because it is already set to 80
      serverPort = 80;
      serverAddress = data.toString().split("Host: ")[1].split("\n")[0];
    }

    // Set a server configuration for astablishing a connection
    let serverConfig = {
      host: serverAddress,
      port: serverPort,
    };

    console.log(serverConfig.host);

    /// Create a connection from proxy to destination server
    let proxyToServerSocket = net.createConnection(serverConfig, function () {
      console.log("Proxy connected to server");
    });

    /// Stream the data to the server
    if (isHttpsConnection) {
      clientToProxySocket.write("HTTP/1.1 200 OK\r\n\n");
    } else {
      proxyToServerSocket.write(data);
    }

    /// Set the pipeline from [client -> proxy] to [proxy -> server]
    clientToProxySocket.pipe(proxyToServerSocket);
    /// Set the pipeline from [server -> proxy] to [proxy -> client]
    proxyToServerSocket.pipe(clientToProxySocket);

    // Get all TXT records from _dnslink.hostname
    dns.resolveTxt("_dnslink." + serverConfig.host, function (err, dnslink) {
      if (err || !Array.isArray(dnslink[0])) {
        //console.log(err);
        return;
      }

      //console.log("TXT-Records: %s", JSON.stringify(records, 0, 2));

      if (dnslink[0][0].includes("dnslink")) {
        let content = dnslink[0][0].replace("dnslink=", "");
        let isHttps = content.includes("https");

        // FIXME: This check should be adjusted to see if incoming dnslink protocol, other then https, has support
        if (!isHttps) {
          let protocol = content.substring(
            content.indexOf("/") + 1,
            content.lastIndexOf("/")
          );
          console.log("Unsupported protocol: " + protocol);

          // TODO: Add logic here for IPFS content
        } else {
          https.request(content, function(res){
            var str = "";

            //another chunk of data has been received, so append it to `str`
            res.on("data", function (chunk) {
              str += chunk;
            });

            //the whole response has been received, so we just print it out here
            res.on("end", function () {
              console.log("Statuscode: " + res.statusCode);
              console.log(str);
            });
          }).end();
        }
      }
    });

    proxyToServerSocket.on("error", function (err) {
      //console.log("Proxy to server error");
      //console.log(err);
    });

    clientToProxySocket.on("error", function (err) {
      //console.log("Client to proxy error");
      //console.log(err);
    });
  });
});

/// error handling
server.on("error", function (err) {
  console.log("An internal error has occurred!");
  console.log(err);
});

server.on("close", function () {
  console.log("Client disconnected");
});

server.listen(config, function () {
  console.log("Server listening to " + config.host + ":" + config.port);
});
