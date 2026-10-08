import { createApp } from "./http.js";

const port = parseInt(process.env.MCP_PORT ?? "3000", 10);
const app = createApp();

app.listen(port, () => {
  console.log(`HOMEGUARD MCP server running at http://localhost:${port}/mcp`);
  console.log(`Try: npx @modelcontextprotocol/inspector`);
});
