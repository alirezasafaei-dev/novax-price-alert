module.exports = {
  apps: [
    {
      name: "novax-api",
      cwd: "/opt/novax-price-alert",
      script: "uv",
      args: "run uvicorn novax_price_alert.api.main:app --host 127.0.0.1 --port 8000",
      interpreter: "none",
      env: {
        PATH: `${process.env.HOME}/.cargo/bin:/usr/local/bin:/usr/bin:/bin`,
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/opt/novax-price-alert/logs/api-error.log",
      out_file: "/opt/novax-price-alert/logs/api-out.log",
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 5000,
      listen_timeout: 15000,
    },
    {
      name: "novax-worker",
      cwd: "/opt/novax-price-alert",
      script: "uv",
      args: "run python -m novax_price_alert.worker_main",
      interpreter: "none",
      env: {
        PATH: `${process.env.HOME}/.cargo/bin:/usr/local/bin:/usr/bin:/bin`,
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/opt/novax-price-alert/logs/worker-error.log",
      out_file: "/opt/novax-price-alert/logs/worker-out.log",
      merge_logs: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
