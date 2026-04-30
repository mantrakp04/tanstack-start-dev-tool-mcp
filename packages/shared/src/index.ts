import { z } from "zod"

export const DEFAULT_BRIDGE_HOST = "127.0.0.1"
export const DEFAULT_BRIDGE_PORT = 8129
export const DEFAULT_BRIDGE_TOKEN = "tanstack-agent-devtools-local"

export const routeSnapshotSchema = z.object({
  href: z.string(),
  pathname: z.string(),
  search: z.string(),
  hash: z.string(),
  title: z.string(),
})

export const querySummarySchema = z.object({
  hash: z.string(),
  key: z.unknown(),
  state: z.string(),
  isStale: z.boolean(),
  observerCount: z.number(),
  updatedAt: z.number(),
})

export const browserSnapshotSchema = z.object({
  appName: z.string(),
  route: routeSnapshotSchema,
  queries: z.array(querySummarySchema),
  timestamp: z.number(),
})

export const browserHelloMessageSchema = z.object({
  type: z.literal("browser:hello"),
  token: z.string(),
  appName: z.string(),
})

export const browserSnapshotMessageSchema = z.object({
  type: z.literal("browser:snapshot"),
  token: z.string(),
  snapshot: browserSnapshotSchema,
})

export const commandNameSchema = z.enum(["navigate", "invalidateQueries"])

export const serverCommandMessageSchema = z.object({
  type: z.literal("server:command"),
  commandId: z.string(),
  command: commandNameSchema,
  payload: z.unknown(),
})

export const browserCommandResultMessageSchema = z.object({
  type: z.literal("browser:command-result"),
  token: z.string(),
  commandId: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
})

export const bridgeClientMessageSchema = z.discriminatedUnion("type", [
  browserHelloMessageSchema,
  browserSnapshotMessageSchema,
  browserCommandResultMessageSchema,
])

export const bridgeServerMessageSchema = serverCommandMessageSchema

export type BrowserSnapshot = z.infer<typeof browserSnapshotSchema>
export type BridgeClientMessage = z.infer<typeof bridgeClientMessageSchema>
export type BridgeServerMessage = z.infer<typeof bridgeServerMessageSchema>
export type CommandName = z.infer<typeof commandNameSchema>
