# Install

This project is intended to be cloned and used locally. It is not published to npm.

## Manual Setup

1. Clone the repo somewhere stable:

```sh
git clone <repo-url> ~/dev/tanstack-start-dev-tool-mcp
cd ~/dev/tanstack-start-dev-tool-mcp
pnpm install
pnpm typecheck
pnpm test:smoke
```

2. Add the React devtools panel package to your TanStack app by aliasing the local source files.

For Vite:

```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const devtoolsMcpRoot = fileURLToPath(
  new URL("../tanstack-start-dev-tool-mcp", import.meta.url),
)

export default defineConfig({
  resolve: {
    alias: {
      "@barreloflube/tanstack-start-dev-tool-mcp-react": fileURLToPath(
        new URL("../tanstack-start-dev-tool-mcp/packages/react/src/index.tsx", import.meta.url),
      ),
      "@barreloflube/tanstack-start-dev-tool-mcp-shared": fileURLToPath(
        new URL("../tanstack-start-dev-tool-mcp/packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    fs: {
      allow: [devtoolsMcpRoot],
    },
  },
})
```

Add matching TypeScript paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@barreloflube/tanstack-start-dev-tool-mcp-react": [
        "../tanstack-start-dev-tool-mcp/packages/react/src/index.tsx"
      ],
      "@barreloflube/tanstack-start-dev-tool-mcp-shared": [
        "../tanstack-start-dev-tool-mcp/packages/shared/src/index.ts"
      ]
    }
  }
}
```

3. Mount the panel in TanStack Devtools:

```tsx
import { AgentDevtoolsPanel } from "@barreloflube/tanstack-start-dev-tool-mcp-react"

<TanStackDevtools
  plugins={[
    { name: "Agent", render: <AgentDevtoolsPanel appName="My TanStack App" /> },
  ]}
/>
```

4. Add the MCP server to Codex:

```sh
codex mcp add tanstack-start-devtools \
  --env TANSTACK_AGENT_DEVTOOLS_TOKEN=tanstack-agent-devtools-local \
  -- ~/dev/tanstack-start-dev-tool-mcp/node_modules/.bin/tsx \
  ~/dev/tanstack-start-dev-tool-mcp/packages/mcp-server/src/cli.ts
```

Use the real clone path in place of `~/dev/tanstack-start-dev-tool-mcp`.

For stdio clients, launch `tsx` directly instead of `pnpm mcp`; package-manager lifecycle banners can corrupt the MCP JSON-RPC stream.

5. Restart Codex.

6. Open your TanStack app in the browser, open TanStack Devtools, and select the `Agent` tab once so the bridge connects.

7. Verify:

```sh
codex mcp get tanstack-start-devtools
```

Inside a Codex session, the server should expose:

- `get_connection_status`
- `get_current_route`
- `get_query_cache_summary`
- `get_dashboard_snapshot`
- `navigate`
- `invalidate_queries`

## Agent Install Prompt

Copy this prompt into an agent working in the target TanStack app repo:

```text
Install the local TanStack Start Devtools MCP bridge from <CLONE_PATH>.

Do not install it from npm. Treat it as a clone-and-use local repo.

Tasks:
1. Run pnpm install, pnpm typecheck, and pnpm test:smoke in <CLONE_PATH>.
2. In this TanStack app, add Vite aliases for:
   - @barreloflube/tanstack-start-dev-tool-mcp-react -> <CLONE_PATH>/packages/react/src/index.tsx
   - @barreloflube/tanstack-start-dev-tool-mcp-shared -> <CLONE_PATH>/packages/shared/src/index.ts
3. Add matching TypeScript paths.
4. Ensure Vite server.fs.allow includes <CLONE_PATH>.
5. Import AgentDevtoolsPanel from @barreloflube/tanstack-start-dev-tool-mcp-react.
6. Add an Agent plugin to the existing TanStackDevtools plugins array:
   { name: "Agent", render: <AgentDevtoolsPanel appName="<APP_NAME>" /> }
7. Add the MCP server to Codex using direct tsx launch, not pnpm:
   codex mcp add tanstack-start-devtools --env TANSTACK_AGENT_DEVTOOLS_TOKEN=tanstack-agent-devtools-local -- <CLONE_PATH>/node_modules/.bin/tsx <CLONE_PATH>/packages/mcp-server/src/cli.ts
8. Verify the app typechecks, the MCP smoke test passes, and codex mcp get tanstack-start-devtools shows the direct tsx command.
9. Restart Codex and confirm the MCP tools are available.

Do not commit or stage changes unless explicitly asked.
```
