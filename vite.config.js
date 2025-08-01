import vitePluginArchive from "./vite-plugin-archive";

export default defineConfig(({ command, mode }) => {
  return {
    plugins: [
      vitePluginArchive({
        format: "zip", // 可选: 'zip' | 'tar' | 'tgz'
      }),
    ],
  };
});
