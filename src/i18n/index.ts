import { en, type Messages } from "./en.js";
import { zh } from "./zh.js";

function detectLocale(): "en" | "zh" {
  const forced = process.env.AGENTGUARD_LANG;
  if (forced === "en") return "en";
  if (forced === "zh") return "zh";
  const lang = process.env.LC_ALL || process.env.LANG || "";
  return lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

const locale = detectLocale();

export const t: Messages = locale === "zh" ? zh : en;
export const currentLocale = locale;
