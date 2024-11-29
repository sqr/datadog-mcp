#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ErrorCode,
	McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import {
	isValidDatadogArgs,
	DatadogResponse,
	LogsData,
	DatadogLog,
} from "./types.js";

dotenv.config();

const DD_API_KEY = process.env.DD_API_KEY;
const DD_APP_KEY = process.env.DD_APP_KEY;

if (!DD_API_KEY || !DD_APP_KEY) {
	throw new Error("Missing environment variables. API and APP key with access to read logs required.");
}

const DD_API_CONFIG = {
	BASE_URL: "https://api.datadoghq.com/api/v2",
	DEFAULT_CLUSTER: "dev",
	DEFAULT_NAMESPACE: "dev",
	ENDPOINTS: {
		LOGS: "logs/events",
	},
} as const;

class DatadogServer {
	private server: Server;
	private axiosInstance;

	constructor() {
		this.server = new Server(
			{
				name: "datadog-server",
				version: "0.1.0",
			},
			{
				capabilities: {
					resources: {},
					tools: {},
				},
			},
		);

		// Configure axios with defaults
		this.axiosInstance = axios.create({
			baseURL: DD_API_CONFIG.BASE_URL,
			headers: {
				Accept: "application/json",
				"DD-API-KEY": DD_API_KEY,
				"DD-APPLICATION-KEY": DD_APP_KEY,
			},
			params: {
				sort: "timestamp",
			},
		});

		this.setupHandlers();
		this.setupErrorHandling();
	}

	private setupErrorHandling(): void {
		this.server.onerror = (error) => {
			console.error("[MCP Error]", error);
		};

		process.on("SIGINT", async () => {
			await this.server.close();
			process.exit(0);
		});
	}

	private setupHandlers(): void {
		this.setupResourceHandlers();
		this.setupToolHandlers();
	}

	private setupResourceHandlers(): void {
		this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
			resources: [
				{
					uri: `datadog://${DD_API_CONFIG.DEFAULT_CLUSTER}/${DD_API_CONFIG.DEFAULT_NAMESPACE}/logs`,
					name: `Latest logs for cluster ${DD_API_CONFIG.DEFAULT_CLUSTER} and namespace ${DD_API_CONFIG.DEFAULT_NAMESPACE}`,
					mimeType: "application/json",
					description:
						"Latest logs that provide insights into the status of a specific Kubernetes cluster and namespace, retrieved from Datadog",
				},
			],
		}));

		this.server.setRequestHandler(
			ReadResourceRequestSchema,
			async (request) => {
				const cluster = DD_API_CONFIG.DEFAULT_CLUSTER;
				const namespace = DD_API_CONFIG.DEFAULT_NAMESPACE;
				if (request.params.uri !== `datadog://${cluster}/${namespace}/logs`) {
					throw new McpError(
						ErrorCode.InvalidRequest,
						`Unknown resource: ${request.params.uri}`,
					);
				}

				try {
					const response = await this.axiosInstance.get<DatadogResponse>(
						DD_API_CONFIG.ENDPOINTS.LOGS,
						{
							params: {
								"filter[query]": `cluster_name:${cluster} AND kube_namespace:${namespace}`,
							},
						},
					);

					const logsData: LogsData[] = response.data.data.map((log) => ({
						id: log.id,
						service: log.attributes.service,
						message: log.attributes.message,
						timestamp: log.attributes.timestamp,
						level: log.attributes.attributes.level,
						tags: log.attributes.tags,
					}));

					return {
						contents: [
							{
								uri: request.params.uri,
								mimeType: "application/json",
								text: JSON.stringify(logsData, null, 2),
							},
						],
					};
				} catch (error) {
					if (axios.isAxiosError(error)) {
						throw new McpError(
							ErrorCode.InternalError,
							`Datadog API error: ${error.response?.data.message ?? error.message}`,
						);
					}
					throw error;
				}
			},
		);
	}

	private setupToolHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: "get_logs",
					description: "Get datadog logs for a specific cluster and namespace",
					inputSchema: {
						type: "object",
						properties: {
							cluster: {
								type: "string",
								description: "Cluster name",
							},
							namespace: {
								type: "string",
								description: "Namespace to retrieve logs from",
							},
						},
						required: ["cluster", "namespace"],
					},
				},
			],
		}));

		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			if (request.params.name !== "get_logs") {
				throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
			}
			if (!isValidDatadogArgs(request.params.arguments)) {
				throw new McpError(ErrorCode.InvalidParams, "Invalid request arguments");
			}
			const cluster = request.params.arguments.cluster;
			const namespace = request.params.arguments.namespace;
			try {
				const response = await this.axiosInstance.get(DD_API_CONFIG.ENDPOINTS.LOGS, {
					params: {
						"filter[query]": `cluster_name:${cluster} AND kube_namespace:${namespace}`,
					},
				});
				const logsData: LogsData[] = response.data.data.map((log: DatadogLog) => ({
					id: log.id,
					service: log.attributes.service,
					message: log.attributes.message,
					timestamp: log.attributes.timestamp,
					level: log.attributes.level,
					tags: log.attributes.tags,
				}));
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(logsData, null, 2),
						},
					],
				};
			}
			catch (error) {
				if (axios.isAxiosError(error)) {
					return {
						content: [
							{
								type: "text",
								text: `Datadog API error: ${error.response?.data.message ?? error.message}`,
							},
						],
						isError: true,
					};
				}
				throw error;
			}
		});
	}

	async run(): Promise<void> {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);

		// Although this is just an informative message, we must log to stderr,
		// to avoid interfering with MCP communication that happens on stdout
		console.error("Datadog MCP server running on stdio");
	}
}

const server = new DatadogServer();
server.run().catch(console.error);
