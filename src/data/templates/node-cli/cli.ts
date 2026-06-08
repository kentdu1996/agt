#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";

// {{idea}}
const program = new Command();

program
  .name("{{slug}}")
  .description("{{idea}}")
  .version("0.1.0");

program
  .command("hello")
  .description("Example command")
  .action(() => {
    console.log(chalk.green("Hello from {{slug}}!"));
  });

program.parseAsync(process.argv);
