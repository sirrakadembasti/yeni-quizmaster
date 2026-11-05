export const PROVIDERS = Object.freeze([
    {
        id: "openai",
        name: "OpenAI",
        region: "ABD",
        transport: "openai",
        baseURL: "https://api.openai.com/v1"
    },
    {
        id: "anthropic",
        name: "Anthropic",
        region: "ABD",
        transport: "anthropic",
        baseURL: "https://api.anthropic.com/v1"
    },
    {
        id: "google",
        name: "Google Gemini",
        region: "ABD",
        transport: "google",
        baseURL: "https://generativelanguage.googleapis.com/v1beta"
    },
    {
        id: "xai",
        name: "xAI",
        region: "ABD",
        transport: "openai",
        baseURL: "https://api.x.ai/v1"
    },
    {
        id: "openrouter",
        name: "OpenRouter",
        region: "ABD",
        transport: "openai",
        baseURL: "https://openrouter.ai/api/v1"
    },
    {
        id: "perplexity",
        name: "Perplexity",
        region: "ABD",
        transport: "openai",
        baseURL: "https://api.perplexity.ai"
    },
    {
        id: "groq",
        name: "Groq",
        region: "ABD",
        transport: "openai",
        baseURL: "https://api.groq.com/openai/v1"
    },
    {
        id: "together",
        name: "Together AI",
        region: "ABD",
        transport: "openai",
        baseURL: "https://api.together.xyz/v1"
    },
    {
        id: "fireworks",
        name: "Fireworks AI",
        region: "ABD",
        transport: "openai",
        baseURL: "https://api.fireworks.ai/inference/v1"
    },
    {
        id: "cohere",
        name: "Cohere",
        region: "Kanada",
        transport: "openai",
        baseURL: "https://api.cohere.ai/compatibility/v1"
    },
    {
        id: "deepseek",
        name: "DeepSeek",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://api.deepseek.com"
    },
    {
        id: "qwen",
        name: "Alibaba Qwen",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    },
    {
        id: "kimi",
        name: "Moonshot Kimi",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://api.moonshot.ai/v1"
    },
    {
        id: "minimax",
        name: "MiniMax",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://api.minimax.io/v1"
    },
    {
        id: "zhipu",
        name: "Zhipu GLM",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://open.bigmodel.cn/api/paas/v4"
    },
    {
        id: "siliconflow",
        name: "SiliconFlow",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://api.siliconflow.cn/v1"
    },
    {
        id: "baidu",
        name: "Baidu Qianfan",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://qianfan.baidubce.com/v2"
    },
    {
        id: "doubao",
        name: "ByteDance Doubao",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://ark.cn-beijing.volces.com/api/v3"
    },
    {
        id: "hunyuan",
        name: "Tencent Hunyuan",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://api.hunyuan.cloud.tencent.com/v1"
    },
    {
        id: "xiaomi_mimo",
        name: "Xiaomi MiMo",
        region: "\u00C7in",
        transport: "openai",
        baseURL: "https://api.xiaomimimo.com/v1",
        endpoints: [
            { name: 'PAYG (kullandıkça öde)', baseURL: 'https://api.xiaomimimo.com/v1' },
            { name: 'Token Plan — Çin', baseURL: 'https://token-plan-cn.xiaomimimo.com/v1' },
            { name: 'Token Plan — Singapur', baseURL: 'https://token-plan-sgp.xiaomimimo.com/v1' },
            { name: 'Token Plan — Amsterdam', baseURL: 'https://token-plan-ams.xiaomimimo.com/v1' },
        ],
    },
    {
        id: "custom",
        name: "\u00D6zel OpenAI uyumlu",
        region: "\u00D6zel",
        transport: "openai",
        baseURL: ""
    }
]);
