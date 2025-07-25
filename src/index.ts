import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// 定义环境变量接口，确保类型安全
interface Env {
	AMAP_MAPS_API_KEY: string;
	[key: string]: any; // 允许其他环境变量
}

export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "AMAP MCP Server",
		identifier: "dev.workers.baize7815.gaodemap", // 您的唯一标识符
		version: "1.0.0",
	});

	async init() {
		// 这是一个辅助函数，用于安全地获取API Key
		const getApiKey = (context: { env: Env }): string | null => {
			return context.env.AMAP_MAPS_API_KEY;
		};

		// 统一的错误处理函数
		const handleError = (error: any) => {
			console.error("工具执行出错:", error);
			return { content: [{ type: "text", text: `执行工具时发生错误: ${error.message}` }] };
		};

		// --- 定义所有高德地图工具 ---

		this.server.tool("geocode", { address: z.string().describe("要查询的地址"), city: z.string().optional().describe("城市名称（可选）")},
			async ({ address, city }, context) => {
				try {
					const apiKey = getApiKey(context as { env: Env });
					if (!apiKey) return { content: [{ type: "text", text: "错误: AMAP_MAPS_API_KEY 未配置" }] };
					
					const params = new URLSearchParams({ key: apiKey, address });
					if (city) params.append('city', city);
					
					const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.geocodes?.length > 0) {
						return { content: [{ type: "text", text: `查询成功: \n${JSON.stringify(data.geocodes[0], null, 2)}` }] };
					}
					return { content: [{ type: "text", text: `地理编码失败：${data.info}` }] };
				} catch (e) { return handleError(e); }
			}
		);

		this.server.tool("reverse_geocode", { longitude: z.number().describe("经度"), latitude: z.number().describe("纬度") },
			async ({ longitude, latitude }, context) => {
				try {
					const apiKey = getApiKey(context as { env: Env });
					if (!apiKey) return { content: [{ type: "text", text: "错误: AMAP_MAPS_API_KEY 未配置" }] };
					
					const params = new URLSearchParams({ key: apiKey, location: `${longitude},${latitude}`, extensions: "all" });
					
					const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.regeocode) {
						return { content: [{ type: "text", text: `查询成功: \n${JSON.stringify(data.regeocode, null, 2)}` }] };
					}
					return { content: [{ type: "text", text: `逆地理编码失败：${data.info}` }] };
				} catch (e) { return handleError(e); }
			}
		);
        
        this.server.tool( "poi_search", { keywords: z.string().describe("搜索关键词"), city: z.string().optional().describe("城市"), types: z.string().optional().describe("POI类型") },
			async ({ keywords, city, types }, context) => {
				try {
					const apiKey = getApiKey(context as { env: Env });
					if (!apiKey) return { content: [{ type: "text", text: "错误: AMAP_MAPS_API_KEY 未配置" }] };
					
					const params = new URLSearchParams({ key: apiKey, keywords, extensions: "all" });
					if (city) params.append('city', city);
					if (types) params.append('types', types);

					const response = await fetch(`https://restapi.amap.com/v3/place/text?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.pois) {
						return { content: [{ type: "text", text: `找到 ${data.count} 个结果: \n${JSON.stringify(data.pois, null, 2)}` }] };
					}
					return { content: [{ type: "text", text: `POI搜索失败：${data.info}` }] };
				} catch (e) { return handleError(e); }
			}
		);

		this.server.tool( "route_planning", { origin: z.string().describe("起点坐标(经度,纬度)"), destination: z.string().describe("终点坐标(经度,纬度)") },
			async ({ origin, destination }, context) => {
				try {
					const apiKey = getApiKey(context as { env: Env });
					if (!apiKey) return { content: [{ type: "text", text: "错误: AMAP_MAPS_API_KEY 未配置" }] };
					
					const params = new URLSearchParams({ key: apiKey, origin, destination, extensions: "all" });
					
					const response = await fetch(`https://restapi.amap.com/v3/direction/driving?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.route?.paths?.length > 0) {
						return { content: [{ type: "text", text: `路径规划成功: \n${JSON.stringify(data.route.paths, null, 2)}` }] };
					}
					return { content: [{ type: "text", text: `路径规划失败：${data.info}` }] };
				} catch (e) { return handleError(e); }
			}
		);

		this.server.tool( "weather", { city: z.string().describe("城市名或adcode"), extensions: z.enum(["base", "all"]).default("base").describe("base:实况天气, all:预报天气") },
			async ({ city, extensions }, context) => {
				try {
					const apiKey = getApiKey(context as { env: Env });
					if (!apiKey) return { content: [{ type: "text", text: "错误: AMAP_MAPS_API_KEY 未配置" }] };
					
					const params = new URLSearchParams({ key: apiKey, city, extensions });
					
					const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?${params}`);
					const data = await response.json();

					if (data.status === "1") {
						const result = extensions === 'base' ? data.lives : data.forecasts;
						return { content: [{ type: "text", text: `天气查询成功: \n${JSON.stringify(result, null, 2)}` }] };
					}
					return { content: [{ type: "text", text: `天气查询失败：${data.info}` }] };
				} catch (e) { return handleError(e); }
			}
		);
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 正确的、简化的处理方式
		if (url.pathname.startsWith("/mcp")) {
			// 将所有 /mcp 的请求（无论是GET还是POST）都交给 MCP 服务来处理
			// 它内部会自动响应 GET manifest 请求和 POST tool_calls 请求
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		if (url.pathname.startsWith("/sse")) {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		return new Response("路径未找到 (Not Found)", { status: 404 });
	},
};
