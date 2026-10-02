import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
export default defineConfig(env => mergeConfig(base(env), {server:{port:5511,strictPort:true,proxy:Object.fromEntries(['/api','/uploads','/socket.io'].map(p=>[p,{target:'http://127.0.0.1:5510',changeOrigin:true,ws:p==='/socket.io'}]))}}));
