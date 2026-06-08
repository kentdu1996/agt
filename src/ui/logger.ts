import chalk from "chalk";

export const logger = {
  info: (msg: string) => console.log(msg),
  success: (msg: string) => console.log(chalk.green("✓ ") + msg),
  warn: (msg: string) => console.log(chalk.yellow("⚠ ") + msg),
  error: (msg: string) => console.error(chalk.red("✗ ") + msg),
  dim: (msg: string) => console.log(chalk.gray(msg)),
  title: (msg: string) => console.log(chalk.bold.cyan(msg)),
  raw: (msg: string) => console.log(msg),
  blank: () => console.log(""),
};

export { chalk };
