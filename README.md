# datadog-mcp

Model Context Protocol server that retrieves logs from a specific Kubernetes cluster and namespace from Datadog for analysis by Claude.

## Prerequisites

- Datadog API Key
- Datadog Application Key with permission to read logs
- Claude Desktop application
- Node.js >= 18

## Usage

- Clone the repository
- Build the application

```
cd datadog-mcp
npm run build
```

- Add the Datadog API Key and Application Key to your Claude desktop configuration, and MCP server configuration if needed. Example for macOS:

```
vim  ~/Library/Application Support/Claude/claude_desktop_config.json
```

- The above file should look like the following. In this example we are using nvm, so we need to provide the full path to the executable in line 4. If you are not using nvm, you can just pass `node`.

```
{
  "mcpServers": {
     "datadog-mcp": {
        "command": "/Users/<your-user>/.nvm/versions/node/v22.11.0/bin/node",
        "args": [
          "/<path-to-repo>/datadog-mcp/build/index.js"
        ],
        "env": {
          "DD_API_KEY": <YOUR_API_KEY>
          "DD_APP_KEY": <YOUR_APP_KEY>
        }
     }
  }
 }
```

- Open the Claude desktop application. On the bottom right hand corner of the chat window you should see a hammer 🔨, and `1 MCP tool available` when hovering. If you don't see the hammer, something is not working properly.
- Ask Claude to provide information about a specific cluster and namespace. For example:

```
What insights can you give me about datadog logs in the cluster dev and namespace app?
```

- Claude will use your API and APP keys, make a request to Datadog, parse the logs and provide a response.

## To do

- Pass start and end timestamp
- Query Metrics
- Query Monitors

## Reference

The code is based on the [starter example](https://modelcontextprotocol.io/docs/first-server/typescript#compare-weather) provided by Anthropic.
