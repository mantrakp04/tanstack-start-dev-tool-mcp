#!/usr/bin/env node
import {
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_PORT,
  DEFAULT_BRIDGE_TOKEN,
} from "@barreloflube/tanstack-start-dev-tool-mcp-shared"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { DevtoolsBridge } from "./bridge.js"
import { createDevtoolsMcpServer } from "./mcp.js"

function getPort() {
  const rawPort = process.env.TANSTACK_AGENT_DEVTOOLS_PORT
  if (rawPort == null || rawPort === "") {
    return DEFAULT_BRIDGE_PORT
  }

  const port = Number(rawPort)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid TANSTACK_AGENT_DEVTOOLS_PORT: ${rawPort}`)
  }
  return port
}

const bridge = new DevtoolsBridge({
  host: process.env.TANSTACK_AGENT_DEVTOOLS_HOST ?? DEFAULT_BRIDGE_HOST,
  port: getPort(),
  token: process.env.TANSTACK_AGENT_DEVTOOLS_TOKEN ?? DEFAULT_BRIDGE_TOKEN,
})

await bridge.start()
console.error(`TanStack Devtools MCP bridge listening at ws://${bridge.host}:${bridge.port}/browser`)

const mcpServer = createDevtoolsMcpServer(bridge)
const transport = new StdioServerTransport()
await mcpServer.connect(transport)

const shutdown = async () => {
  await bridge.stop()
  process.exit(0)
}

process.once("SIGINT", () => {
  shutdown().then(undefined, (error: unknown) => {
    console.error(error)
    process.exit(1)
  })
})
process.once("SIGTERM", () => {
  shutdown().then(undefined, (error: unknown) => {
    console.error(error)
    process.exit(1)
  })
})
