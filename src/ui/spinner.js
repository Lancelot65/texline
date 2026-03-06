import chalk from "chalk";

import { COLORS } from "./theme.js";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createThinkingSpinner(getModel) {
  let timer = null;
  let frameIndex = 0;

  function writeFrame() {
    const frame = chalk.hex(COLORS.dim)(FRAMES[frameIndex++ % FRAMES.length]);
    const modelLabel = chalk.hex(COLORS.green)(getModel());
    const thinkingLabel = chalk.hex(COLORS.dim)("thinking");
    process.stdout.write(`\r${modelLabel} ${frame} ${thinkingLabel}`);
  }

  function start() {
    frameIndex = 0;
    writeFrame();
    timer = setInterval(writeFrame, 80);
  }

  function stop() {
    clearInterval(timer);
    process.stdout.write("\r\x1b[2K");
  }

  return { start, stop };
}
