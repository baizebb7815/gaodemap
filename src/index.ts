import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// 为高德API响应定义Zod schema (可选，但推荐)
const AmapGeocodeResponse = z.object({
	status: z.string(),
	info: z.string(),
	geocodes: z.array(z.any()).optional(),
});

const AmapReverseGeocodeResponse = z.object({
    status: z.string(),
    info: z.string(),
    regeocode: z.any().optional(),
});

const AmapPoiSearchResponse = z.object({
    status: z.string(),
    info: z.string(),
    count: z.string().optional(),
    suggestion: z.any().optional(),
    pois: z.array(z.any()).optional(),
});

const AmapRoutePlanningResponse = z.object({
    status: z.string(),
    info: z.string(),
    route: z.any().optional(),
});

const AmapWeatherResponse = z.object({
    status: z.string(),
    info: z.string(),
    lives: z.array(z.any()).optional(),
    forecasts: z.array(z.any()).optional(),
});


export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "AMAP MCP Server",
		identifier: "dev.workers.baize7815.gaodemap", // 保持唯一标识符
		version: "1.0.0",
	});

	async init() {
		// 地理编码工具 - 地址转坐标
		this.server.tool(
			"geocode",
			{
				address: z.string().describe("要查询的地址"),
				city: z.string().optional().describe("城市名称（可选）"),
			},
			async ({ address, city }, context) => {
				const apiKey = context.env.AMAP_MAPS_API_KEY;
				if (!apiKey) {
					return { content: [{ type: "text", text: "错误：未设置高德地图API密钥" }] };
				}
				const params = new URLSearchParams({ key: apiKey, address });
				if (city) params.append('city', city);

				const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?${params}`);
				const data = await response.json();
                const parsed = AmapGeocodeResponse.parse(data);

				if (parsed.status === "1" && parsed.geocodes && parsed.geocodes.length > 0) {
					const result = parsed.geocodes[0];
					return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
				}
				return { content: [{ type: "text", text: `地理编码失败：${parsed.info}` }] };
			}
		);

		// 逆地理编码工具 - 坐标转地址
		this.server.tool(
			"reverse_geocode",
			{
				longitude: z.number().describe("经度"),
				latitude: z.number().describe("纬度"),
			},
			async ({ longitude, latitude }, context) => {
				const apiKey = context.env.AMAP_MAPS_API_KEY;
				if (!apiKey) {
					return { content: [{ type: "text", text: "错误：未设置高德地图API密钥" }] };
				}
				const location = `${longitude},${latitude}`;
				const params = new URLSearchParams({ key: apiKey, location, extensions: "all" });

				const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`);
				const data = await response.json();
                const parsed = AmapReverseGeocodeResponse.parse(data);

				if (parsed.status === "1" && parsed.regeocode) {
					return { content: [{ type: "text", text: JSON.stringify(parsed.regeocode, null, 2) }] };
				}
				return { content: [{ type: "text", text: `逆地理编码失败：${parsed.info}` }] };
			}
		);

		// POI搜索工具
		this.server.tool(
			"poi_search",
			{
				keywords: z.string().describe("搜索关键词"),
				city: z.string().optional().describe("城市名称"),
				types: z.string().optional().describe("POI类型编码"),
				page: z.number().default(1).describe("页码"),
				offset: z.number().default(10).describe("每页记录数"),
			},
			async ({ keywords, city, types, page, offset }, context) => {
				const apiKey = context.env.AMAP_MAPS_API_KEY;
				if (!apiKey) {
					return { content: [{ type: "text", text: "错误：未设置高德地图API密钥" }] };
				}
				const params = new URLSearchParams({
					key: apiKey,
					keywords,
					page: page.toString(),
					offset: offset.toString(),
					extensions: "all"
				});
				if (city) params.append('city', city);
				if (types) params.append('types', types);

				const response = await fetch(`https://restapi.amap.com/v3/place/text?${params}`);
				const data = await response.json();
                const parsed = AmapPoiSearchResponse.parse(data);

				if (parsed.status === "1" && parsed.pois) {
					return { content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }] };
				}
				return { content: [{ type: "text", text: `POI搜索失败：${parsed.info}` }] };
			}
		);

		// 路径规划工具
		this.server.tool(
			"route_planning",
			{
				origin: z.string().describe("起点坐标 (经度,纬度)"),
				destination: z.string().describe("终点坐标 (经度,纬度)"),
				strategy: z.string().default("1").describe("路径规划策略 (0-10)"),
			},
			async ({ origin, destination, strategy }, context) => {
				const apiKey = context.env.AMAP_MAPS_API_KEY;
				if (!apiKey) {
					return { content: [{ type: "text", text: "错误：未设置高德地图API密钥" }] };
				}
				const params = new URLSearchParams({ key: apiKey, origin, destination, strategy, extensions: "all" });

				const response = await fetch(`https://restapi.amap.com/v3/direction/driving?${params}`);
				const data = await response.json();
                const parsed = AmapRoutePlanningResponse.parse(data);

				if (parsed.status === "1" && parsed.route) {
					return { content: [{ type: "text", text: JSON.stringify(parsed.route, null, 2) }] };
				}
				return { content: [{ type: "text", text: `路径规划失败：${parsed.info}` }] };
			}
		);

		// 天气查询工具
		this.server.tool(
			"weather",
			{
				city: z.string().describe("城市名称或adcode"),
				extensions: z.enum(["base", "all"]).default("base").describe("返回结果控制"),
			},
			async ({ city, extensions }, context) => {
				const apiKey = context.env.AMAP_MAPS_API_KEY;
				if (!apiKey) {
					return { content: [{ type: "text", text: "错误：未设置高德地图API密钥" }] };
				}
				const params = new URLSearchParams({ key: apiKey, city, extensions });

				const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?${params}`);
				const data = await response.json();
                const parsed = AmapWeatherResponse.parse(data);

				if (parsed.status === "1") {
					return { content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }] };
				}
				return { content: [{ type: "text", text: `天气查询失败：${parsed.info}` }] };
			}
		);
	}
}

export default {
	async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 实例化 MCP 服务
		const mcp = MyMCP.serve("/mcp");
		const sse = MyMCP.serveSSE("/sse");

		if (url.pathname.startsWith("/sse")) {
			return sse.fetch(request, env, ctx);
		}

		if (url.pathname.startsWith("/mcp")) {
			// 如果是 GET 请求，就返回服务器的 Manifest（工具清单）
			if (request.method === "GET") {
				return mcp.manifest(request, env, ctx);
			}
			// 其他方法（如 POST）正常处理
			return mcp.fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
