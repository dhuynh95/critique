Read @src/App.jsx @server.js
Digest, no output token. Wait for my input.

Launch the server and open it on Chrome MCP (chrome-devtools - navigate_page (MCP)(type: "url", url: "http://localhost:PORT"))

Do not pkill -f "node server.js"; pkill -f "vite" as we auto clean at each Claude session.

After npm start, wait 5 seconds, then do cat to look at the output and then launch Chrome MCP.