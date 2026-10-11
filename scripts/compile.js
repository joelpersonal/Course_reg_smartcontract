const solc = require("solc");
const fs = require("fs");
const path = require("path");
const file = "CourseRegistration.sol";
const source = fs.readFileSync(path.join(__dirname, "../contracts", file), "utf8");
const input = {
  language: "Solidity",
  sources: { [file]: { content: source } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = (out.errors || []);
errs.forEach(e => console.log(e.severity.toUpperCase() + ": " + e.formattedMessage));
if (errs.some(e => e.severity === "error")) process.exit(1);
const c = out.contracts[file].CourseRegistration;
fs.mkdirSync(path.join(__dirname, "../build"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "../build/CourseRegistration.json"), JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2));
console.log("Compiled OK with solc " + solc.version());
console.log("ABI entries: " + c.abi.length + ", bytecode size: " + (c.evm.bytecode.object.length / 2) + " bytes");
