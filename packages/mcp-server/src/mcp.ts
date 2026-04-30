import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { DevtoolsBridge } from "./bridge.js"

function jsonText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

export function createDevtoolsMcpServer(bridge: DevtoolsBridge) {
  const server = new McpServer({
    name: "tanstack-start-devtools",
    version: "0.0.0",
  })

  server.registerTool(
    "get_connection_status",
    {
      title: "Get TanStack Devtools bridge connection status",
      description: "Returns whether a browser TanStack Devtools panel is connected to the local bridge.",
      inputSchema: z.object({}),
    },
    async () => jsonText(bridge.getStatus()),
  )

  server.registerTool(
    "get_current_route",
    {
      title: "Get current browser route",
      description: "Returns the latest route snapshot reported by the TanStack Devtools panel.",
      inputSchema: z.object({}),
    },
    async () => {
      const snapshot = bridge.getLatestSnapshot()
      return jsonText(snapshot?.route ?? null)
    },
  )

  server.registerTool(
    "get_query_cache_summary",
    {
      title: "Get React Query cache summary",
      description: "Returns query keys, status, staleness, observers, and update times from the connected app.",
      inputSchema: z.object({}),
    },
    async () => {
      const snapshot = bridge.getLatestSnapshot()
      return jsonText(snapshot?.queries ?? [])
    },
  )

  server.registerTool(
    "get_dashboard_snapshot",
    {
      title: "Get full dashboard devtools snapshot",
      description: "Returns the full latest serializable browser snapshot.",
      inputSchema: z.object({}),
    },
    async () => jsonText(bridge.getLatestSnapshot()),
  )

  server.registerTool(
    "navigate",
    {
      title: "Navigate connected browser",
      description: "Asks the connected browser app to navigate to an href.",
      inputSchema: z.object({
        href: z.string().min(1),
      }),
    },
    async ({ href }) => {
      await bridge.sendCommand("navigate", { href })
      return jsonText({ ok: true, href })
    },
  )

  server.registerTool(
    "invalidate_queries",
    {
      title: "Invalidate React Query cache",
      description: "Asks the connected browser app to invalidate all React Query queries.",
      inputSchema: z.object({}),
    },
    async () => {
      await bridge.sendCommand("invalidateQueries", {})
      return jsonText({ ok: true })
    },
  )

  return server
}
