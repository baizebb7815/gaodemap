import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with AMAP tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "AMAP MCP Server",
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
			async ({ address, city }) => {
				try {
					const apiKey = process.env.AMAP_MAPS_API_KEY;
					if (!apiKey) {
						return {
							content: [{
								type: "text",
								text: "错误：未设置高德地图API密钥"
							}]
						};
					}

					const params = new URLSearchParams({
						key: apiKey,
						address: address,
						...(city && { city })
					});

					const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.geocodes.length > 0) {
						const result = data.geocodes[0];
						return {
							content: [{
								type: "text",
								text: JSON.stringify({
									address: result.formatted_address,
									location: result.location,
									level: result.level,
									province: result.province,
									city: result.city,
									district: result.district
								}, null, 2)
							}]
						};
					} else {
						return {
							content: [{
								type: "text",
								text: `地理编码失败：${data.info || '未知错误'}`
							}]
						};
					}
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `请求失败：${error.message}`
						}]
					};
				}
			}
		);

		// 逆地理编码工具 - 坐标转地址
		this.server.tool(
			"reverse_geocode",
			{
				longitude: z.number().describe("经度"),
				latitude: z.number().describe("纬度"),
			},
			async ({ longitude, latitude }) => {
				try {
					const apiKey = process.env.AMAP_MAPS_API_KEY;
					if (!apiKey) {
						return {
							content: [{
								type: "text",
								text: "错误：未设置高德地图API密钥"
							}]
						};
					}

					const location = `${longitude},${latitude}`;
					const params = new URLSearchParams({
						key: apiKey,
						location: location,
						extensions: "all"
					});

					const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.regeocode) {
						const regeocode = data.regeocode;
						return {
							content: [{
								type: "text",
								text: JSON.stringify({
									formatted_address: regeocode.formatted_address,
									country: regeocode.addressComponent.country,
									province: regeocode.addressComponent.province,
									city: regeocode.addressComponent.city,
									district: regeocode.addressComponent.district,
									township: regeocode.addressComponent.township,
									pois: regeocode.pois?.slice(0, 3) // 只返回前3个POI
								}, null, 2)
							}]
						};
					} else {
						return {
							content: [{
								type: "text",
								text: `逆地理编码失败：${data.info || '未知错误'}`
							}]
						};
					}
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `请求失败：${error.message}`
						}]
					};
				}
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
			async ({ keywords, city, types, page, offset }) => {
				try {
					const apiKey = process.env.AMAP_MAPS_API_KEY;
					if (!apiKey) {
						return {
							content: [{
								type: "text",
								text: "错误：未设置高德地图API密钥"
							}]
						};
					}

					const params = new URLSearchParams({
						key: apiKey,
						keywords: keywords,
						page: page.toString(),
						offset: offset.toString(),
						extensions: "all"
					});

					if (city) params.append('city', city);
					if (types) params.append('types', types);

					const response = await fetch(`https://restapi.amap.com/v3/place/text?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.pois) {
						const results = data.pois.map(poi => ({
							name: poi.name,
							type: poi.type,
							address: poi.address,
							location: poi.location,
							tel: poi.tel,
							distance: poi.distance,
							business_area: poi.business_area
						}));

						return {
							content: [{
								type: "text",
								text: JSON.stringify({
									count: data.count,
									suggestion: data.suggestion,
									pois: results
								}, null, 2)
							}]
						};
					} else {
						return {
							content: [{
								type: "text",
								text: `POI搜索失败：${data.info || '未知错误'}`
							}]
						};
					}
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `请求失败：${error.message}`
						}]
					};
				}
			}
		);

		// 路径规划工具
		this.server.tool(
			"route_planning",
			{
				origin: z.string().describe("起点坐标 (经度,纬度)"),
				destination: z.string().describe("终点坐标 (经度,纬度)"),
				strategy: z.enum(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]).default("1").describe("路径规划策略"),
			},
			async ({ origin, destination, strategy }) => {
				try {
					const apiKey = process.env.AMAP_MAPS_API_KEY;
					if (!apiKey) {
						return {
							content: [{
								type: "text",
								text: "错误：未设置高德地图API密钥"
							}]
						};
					}

					const params = new URLSearchParams({
						key: apiKey,
						origin: origin,
						destination: destination,
						strategy: strategy,
						extensions: "all"
					});

					const response = await fetch(`https://restapi.amap.com/v3/direction/driving?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.route && data.route.paths.length > 0) {
						const path = data.route.paths[0];
						return {
							content: [{
								type: "text",
								text: JSON.stringify({
									distance: path.distance,
									duration: path.duration,
									tolls: path.tolls,
									toll_distance: path.toll_distance,
									steps: path.steps.map(step => ({
										instruction: step.instruction,
										road: step.road,
										distance: step.distance,
										duration: step.duration,
										action: step.action
									}))
								}, null, 2)
							}]
						};
					} else {
						return {
							content: [{
								type: "text",
								text: `路径规划失败：${data.info || '未知错误'}`
							}]
						};
					}
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `请求失败：${error.message}`
						}]
					};
				}
			}
		);

		// 天气查询工具
		this.server.tool(
			"weather",
			{
				city: z.string().describe("城市名称或adcode"),
				extensions: z.enum(["base", "all"]).default("base").describe("返回结果控制"),
			},
			async ({ city, extensions }) => {
				try {
					const apiKey = process.env.AMAP_MAPS_API_KEY;
					if (!apiKey) {
						return {
							content: [{
								type: "text",
								text: "错误：未设置高德地图API密钥"
							}]
						};
					}

					const params = new URLSearchParams({
						key: apiKey,
						city: city,
						extensions: extensions
					});

					const response = await fetch(`https://restapi.amap.com/v3/weather/weatherInfo?${params}`);
					const data = await response.json();

					if (data.status === "1" && data.lives) {
						return {
							content: [{
								type: "text",
								text: JSON.stringify(data.lives[0], null, 2)
							}]
						};
					} else if (data.status === "1" && data.forecasts) {
						return {
							content: [{
								type: "text",
								text: JSON.stringify(data.forecasts[0], null, 2)
							}]
						};
					} else {
						return {
							content: [{
								type: "text",
								text: `天气查询失败：${data.info || '未知错误'}`
							}]
						};
					}
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `请求失败：${error.message}`
						}]
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Streamable HTTP endpoint
		if (url.pathname === "/mcp" || url.pathname === "/") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
