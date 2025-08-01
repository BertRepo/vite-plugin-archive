import fs from "fs/promises";
import fsExtra from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";
import ProgressBar from "progress";

// 格式化日期为 YYYY-MM-DD HH:mm:ss
function formatDate(date = new Date()) {
  const pad = (num) => String(num).padStart(2, "0");
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-"
    ) +
    " " +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
      ":"
    )
  );
}

// 打包目录 默认zip压缩
async function packDist(sourceDir, outPath, format = "zip") {
  try {
    await fsExtra.ensureDir(path.dirname(outPath));
    const output = fsExtra.createWriteStream(outPath);

    const archive = archiver(format, {
      zlib: { level: 9 },
      statConcurrency: 4, // 并发统计文件信息
    });

    // 打包进度条
    const bar = new ProgressBar(":bar :percent", {
      total: 100,
      width: 30,
      complete: "█",
      incomplete: "░",
      clear: true,
    });
    archive.on("progress", (progress) => {
      bar.update(progress.fs.processed / progress.fs.total);
      process.stdout.cursorTo(0);
    });

    // 结束事件处理
    output.on("close", () => {
      process.stdout.write(
        `\n打包完成: ${(archive.pointer() / 1024 / 1024).toFixed(
          2
        )} MB → ${outPath}\n`
      );
    });

    archive.pipe(output);
    archive.glob("**/*", {
      cwd: sourceDir,
      ignore: [
        // 忽略掉这些
        "**/node_modules/**",
        "**/*.log",
        "**/.DS_Store",
        "**/Thumbs.db",
      ],
      dot: true,
    });

    await archive.finalize();
    return outPath;
  } catch (err) {
    process.stdout.write("\n"); // 确保错误在新行显示
    console.error("打包失败:", err.message);
    throw err;
  }
}

// 生成版本信息
async function generateVersionInfo(pkgPath, distDir) {
  try {
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    const versionInfo = {
      name: pkg.name,
      version: pkg.version,
      buildTime: formatDate(),
      dependencies: pkg.dependencies || {},
    };

    const outputPath = path.join(distDir, "version.json");
    await fs.writeFile(outputPath, JSON.stringify(versionInfo, null, 2));

    return versionInfo;
  } catch (err) {
    console.error("生成版本信息失败:", err.message);
    throw err;
  }
}

export default function vitePluginVersion(options = {}) {
  return {
    name: "vite-plugin-archive",
    apply: "build",

    async closeBundle() {
      try {
        const startTime = Date.now();
        process.stdout.write("开始生成版本信息和打包...");

        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const pkgPath = path.join(__dirname, "package.json");
        const distDir = path.join(__dirname, "dist");

        await fsExtra.ensureDir(distDir);
        const { name, version } = await generateVersionInfo(pkgPath, distDir);

        const distPath = path.join(process.cwd(), `${name}-${version}.zip`);
        await packDist(distDir, distPath, options.format || "zip");

        process.stdout.write(
          `\n✨ 完成! 耗时 ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`
        );
      } catch (error) {
        process.stdout.write("\n");
        console.error("❌ 插件执行失败:", error.message);
        process.exitCode = 1;
      }
    },
  };
}
