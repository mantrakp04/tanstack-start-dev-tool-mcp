import { setTimeout as delay } from "node:timers/promises"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"

const port = Number(process.env.TANSTACK_AGENT_DEVTOOLS_PORT ?? 8129)

const transport = new StdioClientTransport({
  command: "tsx",
  args: ["packages/mcp-server/src/cli.ts"],
  env: {
    ...process.env,
    TANSTACK_AGENT_DEVTOOLS_PORT: String(port),
  },
})

const client = new Client({
  name: "live-browser-check",
  version: "0.0.0",
})

await client.connect(transport)

let connected = false
for (let attempt = 0; attempt < 20; attempt++) {
  const statusResult = CallToolResultSchema.parse(await client.callTool({
    name: "get_connection_status",
    arguments: {},
  }))
  const statusText = statusResult.content[0]?.type === "text" ? statusResult.content[0].text : "{}"
  const status = JSON.parse(statusText) as { connected?: boolean }
  if (status.connected === true) {
    connected = true
    break
  }
  await delay(500)
}

if (!connected) {
  throw new Error("Browser did not connect to the MCP bridge")
}

const routeResult = CallToolResultSchema.parse(await client.callTool({
  name: "get_current_route",
  arguments: {},
}))
const routeText = routeResult.content[0]?.type === "text" ? routeResult.content[0].text : ""
if (!routeText.includes("/projects")) {
  throw new Error(`Expected live browser route to include /projects, got: ${routeText}`)
}

const snapshotResult = CallToolResultSchema.parse(await client.callTool({
  name: "get_dashboard_snapshot",
  arguments: {},
}))
const snapshotText = snapshotResult.content[0]?.type === "text" ? snapshotResult.content[0].text : ""
if (!snapshotText.includes("Stack Auth Dashboard V2")) {
  throw new Error(`Expected live Dashboard V2 snapshot, got: ${snapshotText}`)
}

await client.close()
console.log("Live browser MCP check passed")
