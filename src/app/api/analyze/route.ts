import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { prompts } from "@/lib/prompts";

const requestSchema = z.object({
  scene: z.enum(["overview", "line", "project"]),
  baseURL: z.string().url(),
  model: z.string().min(1).max(200),
  apiKey: z.string().min(1).max(1000),
  data: z.unknown(),
});

const schemas = {
  overview: z.object({ "全盘结论": z.string() }),
  line: z.object({ "问题说明·原因·风险预警": z.string(), "改善措施": z.string(), "本周进展": z.string(), "是否可改善": z.string() }),
  project: z.object({ "AI基础分析": z.string() }),
};

function privateAddress(address: string) {
  const v = address.replace(/^::ffff:/, "");
  if (v === "::1" || v === "0.0.0.0") return true;
  if (v.includes(":")) return v.toLowerCase().startsWith("fc") || v.toLowerCase().startsWith("fd") || v.toLowerCase().startsWith("fe8");
  const parts = v.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
}

async function validateBaseURL(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("中转站地址必须是 HTTPS 公网地址。");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("不允许访问本机或内网地址。");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw new Error("不允许访问本机、内网或保留地址。");
  return url.toString().replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const baseURL = await validateBaseURL(input.baseURL);
    const provider = createOpenAICompatible({
      name: "user-relay",
      baseURL,
      apiKey: input.apiKey,
      fetch: (url, init) => fetch(url, { ...init, redirect: "error", cache: "no-store" }),
    });
    const { output } = await generateText({
      model: provider.chatModel(input.model),
      system: prompts[input.scene],
      prompt: JSON.stringify(input.data),
      temperature: 0,
      output: Output.object({ schema: schemas[input.scene] as z.ZodType<Record<string, string>> }),
    });
    return Response.json(output, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 分析失败";
    return Response.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
