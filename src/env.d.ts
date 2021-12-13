/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly SECRET: string
    readonly SLACK_WEBHOOK_URL: string
  }
}
