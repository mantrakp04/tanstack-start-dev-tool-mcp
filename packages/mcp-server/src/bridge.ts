import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import crypto from "node:crypto"
import {
  bridgeClientMessageSchema,
  type BrowserSnapshot,
  type BridgeServerMessage,
  type CommandName,
} from "@barreloflube/tanstack-start-dev-tool-mcp-shared"
import { WebSocket, WebSocketServer } from "ws"

type BridgeOptions = {
  host: string
  port: number
  token: string
}

type BrowserCommandResult = {
  ok: boolean
  error?: string
}

type PendingCommand = {
  resolve: (result: BrowserCommandResult) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export class DevtoolsBridge {
  readonly host: string
  readonly port: number
  readonly token: string
  private server: Server | null = null
  private webSocketServer: WebSocketServer | null = null
  private browserSocket: WebSocket | null = null
  private browserAppName: string | null = null
  private latestSnapshot: BrowserSnapshot | null = null
  private pendingCommands = new Map<string, PendingCommand>()

  constructor(options: BridgeOptions) {
    this.host = options.host
    this.port = options.port
    this.token = options.token
  }

  async start() {
    if (this.server != null) {
      return
    }

    const server = createServer((request, response) => {
      this.handleHttpRequest(request, response)
    })
    const webSocketServer = new WebSocketServer({ noServer: true })

    server.on("upgrade", (request, socket, head) => {
      if (request.url !== "/browser") {
        socket.destroy()
        return
      }

      const origin = request.headers.origin
      if (origin != null && !this.isAllowedOrigin(origin)) {
        socket.destroy()
        return
      }

      webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        webSocketServer.emit("connection", webSocket, request)
      })
    })

    webSocketServer.on("connection", (socket) => {
      this.attachBrowserSocket(socket)
    })

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(this.port, this.host, () => {
        server.off("error", reject)
        resolve()
      })
    })

    this.server = server
    this.webSocketServer = webSocketServer
  }

  async stop() {
    for (const [commandId, pending] of this.pendingCommands) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(`Bridge stopped before command ${commandId} completed`))
    }
    this.pendingCommands.clear()

    this.browserSocket?.close()
    this.browserSocket = null

    await new Promise<void>((resolve, reject) => {
      if (this.webSocketServer == null) {
        resolve()
        return
      }
      this.webSocketServer.close((error) => {
        if (error != null) {
          reject(error)
          return
        }
        resolve()
      })
    })
    this.webSocketServer = null

    await new Promise<void>((resolve, reject) => {
      if (this.server == null) {
        resolve()
        return
      }
      this.server.close((error) => {
        if (error != null) {
          reject(error)
          return
        }
        resolve()
      })
    })
    this.server = null
  }

  getStatus() {
    return {
      connected: this.browserSocket?.readyState === WebSocket.OPEN,
      appName: this.browserAppName,
      latestSnapshotAt: this.latestSnapshot?.timestamp ?? null,
      bridgeUrl: `ws://${this.host}:${this.port}/browser`,
    }
  }

  getLatestSnapshot() {
    return this.latestSnapshot
  }

  async sendCommand(command: CommandName, payload: unknown) {
    const socket = this.browserSocket
    if (socket?.readyState !== WebSocket.OPEN) {
      throw new Error("No browser devtools panel is connected")
    }

    const commandId = crypto.randomUUID()
    const message: BridgeServerMessage = {
      type: "server:command",
      commandId,
      command,
      payload,
    }

    const result = await new Promise<BrowserCommandResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId)
        reject(new Error(`Command ${command} timed out`))
      }, 5000)

      this.pendingCommands.set(commandId, { resolve, reject, timeout })
      socket.send(JSON.stringify(message), (error) => {
        if (error == null) {
          return
        }

        clearTimeout(timeout)
        this.pendingCommands.delete(commandId)
        reject(error)
      })
    })

    if (!result.ok) {
      throw new Error(result.error ?? `Command ${command} failed`)
    }

    return result
  }

  private handleHttpRequest(request: IncomingMessage, response: ServerResponse) {
    if (request.url !== "/health") {
      response.writeHead(404, { "content-type": "application/json" })
      response.end(JSON.stringify({ ok: false, error: "Not found" }))
      return
    }

    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ ok: true, status: this.getStatus() }))
  }

  private attachBrowserSocket(socket: WebSocket) {
    this.browserSocket?.close()
    this.browserSocket = socket
    this.browserAppName = null

    socket.on("message", (data) => {
      const raw = typeof data === "string" ? data : data.toString("utf-8")
      const parsedJson = JSON.parse(raw) as unknown
      const messageResult = bridgeClientMessageSchema.safeParse(parsedJson)
      if (!messageResult.success) {
        socket.close(1008, "Invalid bridge message")
        return
      }

      const message = messageResult.data
      if (message.token !== this.token) {
        socket.close(1008, "Invalid bridge token")
        return
      }

      if (message.type === "browser:hello") {
        this.browserAppName = message.appName
        return
      }

      if (message.type === "browser:snapshot") {
        this.latestSnapshot = message.snapshot
        this.browserAppName = message.snapshot.appName
        return
      }

      const pending = this.pendingCommands.get(message.commandId)
      if (pending == null) {
        return
      }
      clearTimeout(pending.timeout)
      this.pendingCommands.delete(message.commandId)
      if (message.error == null) {
        pending.resolve({ ok: message.ok })
        return
      }
      pending.resolve({ ok: message.ok, error: message.error })
    })

    socket.on("close", () => {
      if (this.browserSocket === socket) {
        this.browserSocket = null
      }
    })
  }

  private isAllowedOrigin(origin: string) {
    const parsed = new URL(origin)
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname.endsWith(".localhost")
  }
}
