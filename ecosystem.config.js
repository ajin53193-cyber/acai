// PM2 进程配置：在 /app 目录下执行  pm2 start ecosystem.config.js
// Windows 宝塔：可在「Node 项目」里用 PM2 管理，或直接命令行运行。
module.exports = {
  apps: [
    {
      name: "gogo589-backend",
      // Windows 下建议用虚拟环境里的 uvicorn，或全局安装后直接 uvicorn
      script: "uvicorn",
      args: "server:app --host 0.0.0.0 --port 8001 --workers 2",
      cwd: "./backend",
      interpreter: "none", // uvicorn 是可执行命令，不用 node 解释
      env: { PYTHONUNBUFFERED: "1" },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
