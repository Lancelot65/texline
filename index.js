#!/usr/bin/env node
import "dotenv/config";

import { runApp } from "./src/app.js";

process.exitCode = await runApp({ sessionFile: process.argv[2] || "" });
