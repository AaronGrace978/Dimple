import { defineConfig, type ProxyOptions } from "vite";

function to(target: string): ProxyOptions {
  return { target, changeOrigin: true, secure: true };
}

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/p/openai": { ...to("https://api.openai.com"), rewrite: (p) => p.replace(/^\/p\/openai/, "") },
      "/p/anthropic": { ...to("https://api.anthropic.com"), rewrite: (p) => p.replace(/^\/p\/anthropic/, "") },
      "/p/google": {
        ...to("https://generativelanguage.googleapis.com"),
        rewrite: (p) => p.replace(/^\/p\/google/, ""),
      },
      "/p/xai": { ...to("https://api.x.ai"), rewrite: (p) => p.replace(/^\/p\/xai/, "") },
      "/p/groq": { ...to("https://api.groq.com"), rewrite: (p) => p.replace(/^\/p\/groq/, "") },
      "/p/mistral": { ...to("https://api.mistral.ai"), rewrite: (p) => p.replace(/^\/p\/mistral/, "") },
      "/p/deepseek": { ...to("https://api.deepseek.com"), rewrite: (p) => p.replace(/^\/p\/deepseek/, "") },
      "/p/together": { ...to("https://api.together.xyz"), rewrite: (p) => p.replace(/^\/p\/together/, "") },
      "/p/fireworks": { ...to("https://api.fireworks.ai"), rewrite: (p) => p.replace(/^\/p\/fireworks/, "") },
      "/p/cerebras": { ...to("https://api.cerebras.ai"), rewrite: (p) => p.replace(/^\/p\/cerebras/, "") },
      "/p/openrouter": { ...to("https://openrouter.ai"), rewrite: (p) => p.replace(/^\/p\/openrouter/, "") },
      "/p/ollama-cloud": { ...to("https://ollama.com"), rewrite: (p) => p.replace(/^\/p\/ollama-cloud/, "") },
      "/p/elevenlabs": { ...to("https://api.elevenlabs.io"), rewrite: (p) => p.replace(/^\/p\/elevenlabs/, "") },
      "/p/ollama-local": {
        target: "http://127.0.0.1:11434",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/p\/ollama-local/, ""),
      },
    },
  },
  build: { target: "es2022" },
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
});
