import {
  DEFAULT_BRIDGE_PORT,
  DEFAULT_BRIDGE_TOKEN,
  bridgeServerMessageSchema,
  browserSnapshotMessageSchema,
  type BrowserSnapshot,
  type CommandName,
} from "@barreloflube/tanstack-start-dev-tool-mcp-shared"
import { useQueryClient } from "@tanstack/react-query"
import { useRouterState } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"

type AgentDevtoolsPanelProps = {
  appName?: string
  bridgeUrl?: string
  token?: string
}

type ConnectionState = "connecting" | "connected" | "disconnected" | "error"

function elapsedNow() {
  return performance.now()
}

function getBrowserRoute(): BrowserSnapshot["route"] {
  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    title: document.title,
  }
}

function makeBridgeUrl(port: number) {
  return `ws://127.0.0.1:${port}/browser`
}

function stringifyQueryKey(key: unknown) {
  try {
    return JSON.stringify(key)
  } catch {
    return "[unserializable query key]"
  }
}

export function AgentDevtoolsPanel(props: AgentDevtoolsPanelProps) {
  const appName = props.appName ?? "TanStack Start App"
  const bridgeUrl = props.bridgeUrl ?? makeBridgeUrl(DEFAULT_BRIDGE_PORT)
  const token = props.token ?? DEFAULT_BRIDGE_TOKEN
  const queryClient = useQueryClient()
  const routerState = useRouterState()
  const socketRef = useRef<WebSocket | null>(null)
  const lastSnapshotRef = useRef<BrowserSnapshot | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectStartedAtRef = useRef(elapsedNow())
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting")
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [lastCommand, setLastCommand] = useState("No commands yet")

  const snapshot = useMemo<BrowserSnapshot>(() => {
    const queries = queryClient.getQueryCache().getAll().map((query) => ({
      hash: query.queryHash,
      key: query.queryKey,
      state: query.state.status,
      isStale: query.isStale(),
      observerCount: query.getObserversCount(),
      updatedAt: query.state.dataUpdatedAt,
    }))

    return {
      appName,
      route: getBrowserRoute(),
      queries,
      timestamp: Date.now(),
    }
  }, [appName, queryClient, routerState.location.href])

  useEffect(() => {
    lastSnapshotRef.current = snapshot
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      return
    }

    const message = browserSnapshotMessageSchema.parse({
      type: "browser:snapshot",
      token,
      snapshot,
    })
    socket.send(JSON.stringify(message))
    setLastSyncAt(Date.now())
  }, [snapshot, token])

  useEffect(() => {
    let closed = false

    const executeCommand = async (command: CommandName, payload: unknown) => {
      if (command === "navigate") {
        if (typeof payload !== "object" || payload == null || !("href" in payload) || typeof payload.href !== "string") {
          throw new Error("navigate command requires a string href")
        }
        window.history.pushState(null, "", payload.href)
        window.dispatchEvent(new PopStateEvent("popstate"))
        return
      }

      if (command === "invalidateQueries") {
        await queryClient.invalidateQueries()
        return
      }

      const exhaustive: never = command
      throw new Error(`Unsupported command: ${exhaustive}`)
    }

    const handleServerMessage = (rawData: unknown, socket: WebSocket) => {
      if (typeof rawData !== "string") {
        setLastCommand("Ignored non-text bridge message")
        return
      }

      const parsed = JSON.parse(rawData) as unknown
      const result = bridgeServerMessageSchema.safeParse(parsed)
      if (!result.success) {
        setLastCommand("Ignored invalid bridge message")
        return
      }

      const message = result.data
      executeCommand(message.command, message.payload).then(() => {
        setLastCommand(`${message.command} completed`)
        socket.send(JSON.stringify({
          type: "browser:command-result",
          token,
          commandId: message.commandId,
          ok: true,
        }))
      }, (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setLastCommand(`${message.command} failed: ${errorMessage}`)
        socket.send(JSON.stringify({
          type: "browser:command-result",
          token,
          commandId: message.commandId,
          ok: false,
          error: errorMessage,
        }))
      })
    }

    const connect = () => {
      if (closed) {
        return
      }

      setConnectionState("connecting")
      const socket = new WebSocket(bridgeUrl)
      socketRef.current = socket

      socket.addEventListener("open", () => {
        setConnectionState("connected")
        reconnectStartedAtRef.current = elapsedNow()
        socket.send(JSON.stringify({ type: "browser:hello", token, appName }))
        const currentSnapshot = lastSnapshotRef.current
        if (currentSnapshot != null) {
          socket.send(JSON.stringify({
            type: "browser:snapshot",
            token,
            snapshot: currentSnapshot,
          }))
          setLastSyncAt(Date.now())
        }
      })

      socket.addEventListener("message", (event) => {
        handleServerMessage(event.data, socket)
      })

      socket.addEventListener("error", () => {
        setConnectionState("error")
      })

      socket.addEventListener("close", () => {
        if (closed) {
          return
        }
        setConnectionState("disconnected")
        const elapsed = elapsedNow() - reconnectStartedAtRef.current
        const reconnectDelay = elapsed < 10_000 ? 500 : 2000
        reconnectTimerRef.current = window.setTimeout(connect, reconnectDelay)
      })
    }

    connect()

    return () => {
      closed = true
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current)
      }
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [appName, bridgeUrl, queryClient, token])

  const connectionColor =
    connectionState === "connected"
      ? "#16a34a"
      : connectionState === "connecting"
        ? "#ca8a04"
        : "#dc2626"

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Agent bridge</div>
          <h2 style={styles.title}>{appName}</h2>
        </div>
        <span style={{ ...styles.status, borderColor: connectionColor, color: connectionColor }}>
          {connectionState}
        </span>
      </header>

      <dl style={styles.grid}>
        <div style={styles.metric}>
          <dt style={styles.label}>Route</dt>
          <dd style={styles.value}>{snapshot.route.pathname || "/"}</dd>
        </div>
        <div style={styles.metric}>
          <dt style={styles.label}>Queries</dt>
          <dd style={styles.value}>{snapshot.queries.length}</dd>
        </div>
        <div style={styles.metric}>
          <dt style={styles.label}>Last Sync</dt>
          <dd style={styles.value}>{lastSyncAt == null ? "Never" : new Date(lastSyncAt).toLocaleTimeString()}</dd>
        </div>
      </dl>

      <div style={styles.block}>
        <div style={styles.label}>Bridge URL</div>
        <code style={styles.code}>{bridgeUrl}</code>
      </div>

      <div style={styles.block}>
        <div style={styles.label}>Last command</div>
        <div style={styles.value}>{lastCommand}</div>
      </div>

      <div style={styles.block}>
        <div style={styles.label}>Query cache</div>
        <div style={styles.queryList}>
          {snapshot.queries.length === 0 ? (
            <span style={styles.muted}>No queries observed.</span>
          ) : (
            snapshot.queries.slice(0, 8).map((query) => (
              <div key={query.hash} style={styles.queryRow}>
                <span style={styles.queryKey}>{stringifyQueryKey(query.key)}</span>
                <span style={styles.queryState}>{query.state}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

const styles = {
  panel: {
    minWidth: 420,
    maxWidth: 560,
    padding: 16,
    color: "#111827",
    background: "#f8fafc",
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 12,
    borderBottom: "1px solid #e5e7eb",
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: "3px 0 0",
    fontSize: 18,
    fontWeight: 760,
    letterSpacing: 0,
  },
  status: {
    border: "1px solid",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 90px 120px",
    gap: 8,
    margin: "14px 0",
  },
  metric: {
    margin: 0,
    padding: 10,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#ffffff",
    minWidth: 0,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  value: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 650,
    overflowWrap: "anywhere",
  },
  block: {
    marginTop: 12,
  },
  code: {
    display: "block",
    marginTop: 5,
    padding: "8px 10px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#ffffff",
    color: "#334155",
    fontSize: 12,
    overflowWrap: "anywhere",
  },
  queryList: {
    display: "grid",
    gap: 6,
    marginTop: 6,
  },
  queryRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
    padding: "7px 9px",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#ffffff",
  },
  queryKey: {
    minWidth: 0,
    color: "#334155",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  queryState: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 700,
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
  },
} satisfies Record<string, React.CSSProperties>
