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

## Prompts used to build this

1. “i want to make a mcp server that allows the tanstack start dev tool's access to the agent. how should we go around making it”
2. “i want a sep personal repo for this.”
3. “you can make the sep repo in the Desktop/tanstack-start-dev-tool-mcp folder and work in there, import it here and start the mcp server test it, dont stop until it works, also support hmr for the mcp server so you can itereate quickly.”