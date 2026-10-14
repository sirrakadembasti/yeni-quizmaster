/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { appShellPlugin } from './app-shell-manifest.mjs'

export default defineConfig((_env) => {
  // Read only the backend port into the proxy configuration. Server secrets stay
  // in Node; the client env directory and VITE_ exposure prefix are unchanged.
  const dotenv = createRequire(path.resolve(__dirname, '../server/package.json'))('dotenv')
  const filePort = (file: string): string | undefined => existsSync(file) ? dotenv.parse(readFileSync(file)).PORT : undefined
  // Match server/index.ts: process values, then server/.env, then root/.env.
  // The backend does not load Vite's mode-specific or .env.local files.
  const rawPort = process.env.PORT ?? filePort(path.resolve(__dirname, '../server/.env')) ?? filePort(path.resolve(__dirname, '../.env'))
  const backendPort = rawPort === undefined ? 5000 : Number(rawPort)
  if (!Number.isInteger(backendPort) || backendPort < 1024 || backendPort > 65535) {
    throw new Error('PORT must be an integer between 1024 and 65535.')
  }
  const backendTarget = `http://127.0.0.1:${backendPort}`
  return {
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    tailwindcss(),
    appShellPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      // Socket.IO WebSocket proxy: Vite'ın 5173 portuna gelen /socket.io isteklerini
      // backend'in yapılandırılmış portuna iletir. ws:true olmadan WebSocket handshake başarısız
      // olur ve Socket.IO polling döngüsüne düşerek setTimeout ihlallerine yol açar.
      '/socket.io': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  }
})
