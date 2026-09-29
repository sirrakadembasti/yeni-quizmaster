declare module "vite";
declare module "nanoid" {
  export function nanoid(size?: number): string;
}
declare module "*/vite.config" {
  const config: any;
  export default config;
}
declare module "../vite.config" {
  const config: any;
  export default config;
}
