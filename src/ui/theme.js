import chalk from "chalk";

export const COLORS = {
  border: "#414868",
  dim: "#565f89",
  blue: "#7aa2f7",
  green: "#9ece6a",
  yellow: "#e0af68",
  red: "#f7768e",
  cyan: "#7dcfff",
  purple: "#bb9af7",
  white: "#c0caf5",
};

export function width() {
  return process.stdout.columns || 80;
}

export function dim(value) {
  return chalk.hex(COLORS.dim)(value);
}

export function bold(value) {
  return chalk.bold.hex(COLORS.white)(value);
}

export function info(value) {
  return chalk.hex(COLORS.cyan)(value);
}

export function warn(value) {
  return chalk.hex(COLORS.yellow)(value);
}

export function good(value) {
  return chalk.hex(COLORS.green)(value);
}

export function err(value) {
  return chalk.hex(COLORS.red)(value);
}
