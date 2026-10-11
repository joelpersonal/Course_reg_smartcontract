// Run with: node test/CourseRegistration.test.js
// Uses an in-process Ganache blockchain + ethers v6. Writes results to build/test-results.json
const ganache = require("ganache");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const artifact = require("../build/CourseRegistration.json");

const results = [];
const gasLog = [];
let deployInfo = {};

let rawServer;
// Simulates the call (eth_call) from the given signer and checks it reverts with the named custom error.
async function expectRevert(contract, signer, method, args, errName) {
  const tx = await contract.connect(signer)[method].populateTransaction(...args);
  tx.from = await signer.getAddress();
  try {
    await rawServer.request({ method: "eth_call", params: [tx, "latest"] });
  } catch (e) {
    let name = "unknown";
    try { name = contract.interface.parseError(e.data).name; } catch (_) {}
    if (errName && name !== errName) throw new Error(`Expected revert "${errName}" but got "${name}"`);
    return name;
  }
  throw new Error("Expected call to revert but it succeeded");
}

async function main() {
  const server = ganache.provider({
    wallet: { mnemonic: "test test test test test test test test test test test junk", totalAccounts: 10 },
    chain: { chainId: 1337, vmErrorsOnRPCResponse: true },
    logging: { quiet: true },
  });
  rawServer = server;
  const provider = new ethers.BrowserProvider(server);
  const signers = [];
  for (let i = 0; i < 10; i++) signers.push(await provider.getSigner(i));
  const [admin, s1, s2, s3, s4] = signers;

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, admin);
  const deployTx = await factory.deploy();
  const deployReceipt = await deployTx.deploymentTransaction().wait();
  const contract = deployTx;
  const addr = await contract.getAddress();
  deployInfo = {
    network: "Ganache in-process (chainId 1337) - equivalent of Remix 'Remix VM'",
    contractAddress: addr,
    deployer: await admin.getAddress(),
    txHash: deployReceipt.hash,
    blockNumber: deployReceipt.blockNumber,
    gasUsed: deployReceipt.gasUsed.toString(),
  };

  async function send(label, promise) {
    const tx = await promise;
    const r = await tx.wait();
    gasLog.push({ label, hash: r.hash, block: r.blockNumber, gas: r.gasUsed.toString(), from: r.from });
    return r;
  }
  const as = (signer) => contract.connect(signer);

  async function test(name, fn) {
    const t0 = Date.now();
    try {
      await fn();
      results.push({ name, pass: true, ms: Date.now() - t0 });
      console.log("  PASS  " + name);
    } catch (e) {
      results.push({ name, pass: false, error: e.message, ms: Date.now() - t0 });
      console.log("  FAIL  " + name + "\n        " + e.message);
    }
  }
  const eq = (a, b, m) => { if (a.toString() !== b.toString()) throw new Error(`${m || "assert"}: expected ${b} got ${a}`); };

  console.log("\nCourseRegistration test suite\n");

  await test("TC01 Deployment sets admin and opens registration", async () => {
    eq(await contract.admin(), await admin.getAddress(), "admin");
    eq(await contract.registrationOpen(), true, "registrationOpen");
    eq(await contract.courseCount(), 0, "courseCount");
  });

  await test("TC02 Admin can add a course and CourseAdded is emitted", async () => {
    const r = await send("addCourse('Blockchain Fundamentals', 2)", contract.addCourse("Blockchain Fundamentals", 2));
    const ev = r.logs.map(l => contract.interface.parseLog(l)).find(l => l.name === "CourseAdded");
    if (!ev) throw new Error("CourseAdded not emitted");
    eq(ev.args.courseId, 1, "courseId");
    const c = await contract.getCourse(1);
    eq(c.name, "Blockchain Fundamentals", "name"); eq(c.capacity, 2, "capacity"); eq(c.enrolled, 0, "enrolled");
  });

  await test("TC03 Non-admin cannot add a course", async () => {
    await expectRevert(contract, s1, "addCourse", ["Hack", 5], "NotAdmin");
  });

  await test("TC04 Adding a course with empty name or zero capacity reverts", async () => {
    await expectRevert(contract, admin, "addCourse", ["", 5], "InvalidInput");
    await expectRevert(contract, admin, "addCourse", ["Valid", 0], "InvalidInput");
  });

  await test("TC05 Student can register and StudentRegistered is emitted", async () => {
    const r = await send("register(1) by student1", as(s1).register(1));
    const ev = r.logs.map(l => contract.interface.parseLog(l)).find(l => l.name === "StudentRegistered");
    if (!ev) throw new Error("StudentRegistered not emitted");
    eq(await contract.isRegistered(1, await s1.getAddress()), true, "isRegistered");
    eq((await contract.getCourse(1)).enrolled, 1, "enrolled");
    eq(await contract.seatsLeft(1), 1, "seatsLeft");
  });

  await test("TC06 Duplicate registration reverts", async () => {
    await expectRevert(contract, s1, "register", [1], "AlreadyRegistered");
  });

  await test("TC07 Registering for a non-existent course reverts", async () => {
    await expectRevert(contract, s1, "register", [99], "CourseDoesNotExist");
    await expectRevert(contract, s1, "register", [0], "CourseDoesNotExist");
  });

  await test("TC08 Registration fails when course is full", async () => {
    await send("register(1) by student2", as(s2).register(1));
    await expectRevert(contract, s3, "register", [1], "CourseFull");
    eq(await contract.seatsLeft(1), 0, "seatsLeft");
  });

  await test("TC09 Student can withdraw and seat is freed", async () => {
    const r = await send("withdraw(1) by student2", as(s2).withdraw(1));
    const ev = r.logs.map(l => contract.interface.parseLog(l)).find(l => l.name === "StudentWithdrawn");
    if (!ev) throw new Error("StudentWithdrawn not emitted");
    eq(await contract.isRegistered(1, await s2.getAddress()), false, "isRegistered");
    eq((await contract.getCourse(1)).enrolled, 1, "enrolled");
    eq(await contract.seatsLeft(1), 1, "seatsLeft");
  });

  await test("TC10 Withdrawing from a course not registered in reverts", async () => {
    await expectRevert(contract, s3, "withdraw", [1], "NotRegistered");
  });

  await test("TC11 Student can re-register after withdrawing", async () => {
    await send("register(1) by student3", as(s3).register(1));
    eq((await contract.getCourse(1)).enrolled, 2, "enrolled");
  });

  await test("TC12 Inactive course cannot be registered; reactivation works", async () => {
    await send("addCourse('Web Development', 30)", contract.addCourse("Web Development", 30));
    await send("setCourseActive(2,false)", contract.setCourseActive(2, false));
    await expectRevert(contract, s1, "register", [2], "CourseNotActive");
    await send("setCourseActive(2,true)", contract.setCourseActive(2, true));
    await send("register(2) by student1", as(s1).register(2));
    eq(await contract.isRegistered(2, await s1.getAddress()), true, "isRegistered");
  });

  await test("TC13 Student cannot exceed MAX_COURSES_PER_STUDENT (5)", async () => {
    for (let i = 3; i <= 6; i++) await send(`addCourse('Course ${i}', 10)`, contract.addCourse("Course " + i, 10));
    // s1 already has courses 1 and 2; add 3,4,5 -> total 5
    for (let i = 3; i <= 5; i++) await send(`register(${i}) by student1`, as(s1).register(i));
    eq((await contract.getStudentCourses(await s1.getAddress())).length, 5, "course count");
    await expectRevert(contract, s1, "register", [6], "CourseLimitReached");
  });

  await test("TC14 Course lists stay correct after withdrawal (swap-and-pop)", async () => {
    await send("withdraw(2) by student1", as(s1).withdraw(2));
    const list = (await contract.getStudentCourses(await s1.getAddress())).map(x => Number(x)).sort();
    if (JSON.stringify(list) !== JSON.stringify([1, 3, 4, 5])) throw new Error("got " + JSON.stringify(list));
    const students = await contract.getCourseStudents(1);
    eq(students.length, 2, "course 1 students");
  });

  await test("TC15 Admin can close registration; register and withdraw are blocked", async () => {
    await send("setRegistrationOpen(false)", contract.setRegistrationOpen(false));
    await expectRevert(contract, s4, "register", [1], "RegistrationClosed");
    await expectRevert(contract, s1, "withdraw", [1], "RegistrationClosed");
    await send("setRegistrationOpen(true)", contract.setRegistrationOpen(true));
    await send("register(2) by student4", as(s4).register(2));
  });

  await test("TC16 Non-admin cannot change course status or registration window", async () => {
    await expectRevert(contract, s1, "setCourseActive", [1, false], "NotAdmin");
    await expectRevert(contract, s1, "setRegistrationOpen", [false], "NotAdmin");
  });

  const passed = results.filter(r => r.pass).length;
  console.log(`\n${passed} passing, ${results.length - passed} failing\n`);

  const accounts = [];
  for (const s of signers.slice(0, 5)) accounts.push(await s.getAddress());
  fs.writeFileSync(path.join(__dirname, "../build/test-results.json"), JSON.stringify({ results, gasLog, deployInfo, accounts, passed, total: results.length }, null, 2));
  process.exit(passed === results.length ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
