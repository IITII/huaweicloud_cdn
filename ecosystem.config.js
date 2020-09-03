/**
 pm2 deploy <configuration_file> <environment> <command>

 Commands:
 setup                run remote setup commands
 update               update deploy to the latest release
 revert [n]           revert to [n]th last deployment or 1
 curr[ent]            output current release commit
 prev[ious]           output previous release commit
 exec|run <cmd>       execute the given <cmd>
 list                 list previous deploy commits
 [ref]                deploy to [ref], the "ref" setting, or latest tag
 @example pm2 [start|restart|stop|delete] ecosystem.config.js
 @example pm2 start ecosystem.config.js --only TG_SETU_BOT
 @example pm2 deploy ecosystem.config.js staging
 @example pm2 deploy ecosystem.config.js production setup && pm2 deploy ecosystem.config.js production
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/#ecosystem-file
 * @see https://pm2.keymetrics.io/docs/usage/deployment/
 */
module.exports = {
  apps: [{
    name: "HWC_CDN",
    script: 'index.js',
    watch: true,
    ignore_watch: [
      '.idea', '.vscode',
      '.vs', 'logs',
      'tmp', 'examples',
      '*.log', 'npm-debug.log*',
      'yarn-debug.log*', 'yarn-error.log*',
      'pids', '*.pid',
      '*.seed', '*.pid.lock',
      'lib-cov', 'coverage',
      '.nyc_output', '.grunt',
      'bower_components', '.lock-wscript',
      'build', 'node_modules',
      'jspm_packages', 'typings',
      '.npm', '.eslintcache',
      '.node_repl_history', '*.tgz',
      '.yarn-integrity', '.env',
      '.next'
    ],
    instance: 1,
    cron_restart: "30 4 * * *",
    autorestart: false,
    node_args: '--max-http-header-size 80000',
    error_file: '/tmp/HWC_CDN_ERR.log',
    out_file: '/tmp/HWC_CDN_OUT.log',
    log_file: '/tmp/HWC_CDN.log',
    time: false,
    env: {
      "NODE_ENV": "development",
    },
    env_production: {
      "NODE_ENV": "production"
    }
  }],

  deploy: null
};
