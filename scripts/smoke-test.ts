import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { WebSocket } from "ws"

const token = "smoke-test-token"
const port = 8139

const transport = new StdioClientTransport({
  command: "tsx",
  args: ["packages/mcp-server/src/cli.ts"],
  env: {
    ...process.env,
    TANSTACK_AGENT_DEVTOOLS_TOKEN: token,
    TANSTACK_AGENT_DEVTOOLS_PORT: String(port),
  },
})

const client = new Client({
  name: "smoke-test",
  version: "0.0.0",
})

await client.connect(transport)

const socket = new WebSocket(`ws://127.0.0.1:${port}/browser`, {
  headers: {
    origin: "http://localhost:8111",
  },
})

await new Promise<void>((resolve, reject) => {
  socket.once("open", resolve)
  socket.once("error", reject)
})

socket.send(JSON.stringify({
  type: "browser:hello",
  token,
  appName: "Smoke Test App",
}))
socket.send(JSON.stringify({
  type: "browser:snapshot",
  token,
  snapshot: {
    appName: "Smoke Test App",
    route: {
      href: "http://localhost:8111/projects/test",
      pathname: "/projects/test",
      search: "",
      hash: "",
      title: "Smoke Test",
    },
    queries: [
      {
        hash: "[\"projects\"]",
        key: ["projects"],
        state: "success",
        isStale: false,
        observerCount: 1,
        updatedAt: Date.now(),
      },
    ],
    timestamp: Date.now(),
  },
}))

socket.on("message", (data) => {
  const message = JSON.parse(data.toString("utf-8")) as { type?: string; commandId?: string }
  if (message.type === "server:command" && message.commandId != null) {
    socket.send(JSON.stringify({
      type: "browser:command-result",
      token,
      commandId: message.commandId,
      ok: true,
    }))
  }
})

const routeResult = CallToolResultSchema.parse(await client.callTool({
  name: "get_current_route",
  arguments: {},
}))
const firstContent = routeResult.content[0]
const routeText = firstContent?.type === "text" ? firstContent.text : ""
if (!routeText.includes("/projects/test")) {
  throw new Error(`Expected current route in MCP response, got: ${routeText}`)
}

await client.callTool({
  name: "navigate",
  arguments: { href: "/projects/next" },
})

socket.close()
await client.close()
console.log("Smoke test passed")
