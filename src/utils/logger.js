// console.* の薄いラッパー。将来 Sentry 等への差し替えを容易にするため抽象化。
// 個人ツールなので外部送信はしない。

const PREFIX = '[disney-weather]';

export const logger = {
  info(...args) {
    console.info(PREFIX, ...args);
  },
  warn(...args) {
    console.warn(PREFIX, ...args);
  },
  error(...args) {
    console.error(PREFIX, ...args);
  },
};
