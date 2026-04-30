# TanStack Start Devtools MCP

Local development bridge between TanStack Devtools and MCP-capable coding agents.

This repo is clone-and-use local tooling, not an npm-published package. See [INSTALL.md](./INSTALL.md) for setup instructions and an agent install prompt.

## Packages

- `@barreloflube/tanstack-start-dev-tool-mcp-shared`: shared browser/server protocol schemas.
- `@barreloflube/tanstack-start-dev-tool-mcp-react`: React panel for `@tanstack/react-devtools`.
- `@barreloflube/tanstack-start-dev-tool-mcp-server`: MCP server plus local WebSocket bridge.

## Development

```sh
pnpm install
pnpm dev:mcp
```

`pnpm dev:mcp` uses `tsx watch`, so edits to the MCP server restart the process automatically.

## Environment

- `TANSTACK_AGENT_DEVTOOLS_PORT`: bridge port, defaults to `8129`.
- `TANSTACK_AGENT_DEVTOOLS_HOST`: bridge host, defaults to `127.0.0.1`.
- `TANSTACK_AGENT_DEVTOOLS_TOKEN`: shared browser/server token, defaults to `tanstack-agent-devtools-local`.

## MCP Client Config

For stdio-based clients:

```json
{
  "mcpServers": {
    "tanstack-start-devtools": {
      "command": "/Users/barreloflube/Desktop/tanstack-start-dev-tool-mcp/node_modules/.bin/tsx",
      "args": [
        "/Users/barreloflube/Desktop/tanstack-start-dev-tool-mcp/packages/mcp-server/src/cli.ts"
      ],
      "env": {
        "TANSTACK_AGENT_DEVTOOLS_TOKEN": "tanstack-agent-devtools-local"
      }
    }
  }
}
```

For stdio clients, launch `tsx` directly instead of `pnpm mcp`; package-manager lifecycle banners can corrupt the MCP JSON-RPC stream.
