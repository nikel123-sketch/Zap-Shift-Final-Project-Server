const fs = require("fs");
const key = fs.readFileSync("./zap-shift-final-project-token-key.json", "utf8");
const base64 = Buffer.from(key).toString("base64");

