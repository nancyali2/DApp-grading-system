/**
 * demo.js — End-to-End Demo Script for the Decentralised Grading System
 *
 * Simulates a complete semester workflow on your local Ethereum (Ganache) network.
 * Runs through every contract function with realistic sample data.
 *
 * Usage (after truffle migrate):
 *   truffle exec scripts/demo.js
 *
 * Roles assigned automatically from Ganache accounts:
 *   accounts[0] = Admin (contract deployer)
 *   accounts[1] = Instructor
 *   accounts[2] = Teaching Assistant
 *   accounts[3-5] = Students
 */

const Grader = artifacts.require("Grader");

module.exports = async function(callback) {
  try {
    const accounts = await web3.eth.getAccounts();

    const admin      = accounts[0];
    const instructor = accounts[1];
    const ta         = accounts[2];
    const student1   = accounts[3];
    const student2   = accounts[4];
    const student3   = accounts[5];

    console.log("\n========================================");
    console.log("  Decentralised Grading System — Demo  ");
    console.log("  IIT Bombay, EE 465, Autumn 2019      ");
    console.log("========================================\n");
    console.log("Ethereum Network Accounts:");
    console.log("  Admin      :", admin);
    console.log("  Instructor :", instructor);
    console.log("  TA         :", ta);
    console.log("  Student 1  :", student1, " [190010001]");
    console.log("  Student 2  :", student2, " [190010002]");
    console.log("  Student 3  :", student3, " [190010003]");

    const grader = await Grader.deployed();
    console.log("\nGrader contract address:", grader.address, "\n");

    // Encode/decode helpers (compatible with web3 v1.x and legacy)
    const enc = (s) => web3.utils ? web3.utils.fromAscii(s) : web3.fromAscii(s);
    const dec = (b) => (web3.utils ? web3.utils.toUtf8(b) : web3.toUtf8(b)).replace(/\0/g, "");
    const num = (n) => n.toNumber ? n.toNumber() : Number(n);

    const courseID = enc("EE465");
    const rolls    = [enc("190010001"), enc("190010002"), enc("190010003")];
    const examQ    = enc("quiz1");
    const examM    = enc("midsem");
    const examE    = enc("endsem");

    // ------------------------------------------------------------------
    // STEP 1: Admin registers the instructor
    // ------------------------------------------------------------------
    console.log("[STEP 1] Admin registers instructor on-chain...");
    let tx = await grader.addInstructor([instructor], { from: admin });
    const instrList = await grader.getInstructorsList({ from: admin });
    console.log("  ✓ Instructor registered. Total instructors:", instrList.length);
    console.log("  Gas used:", tx.receipt.gasUsed);

    // ------------------------------------------------------------------
    // STEP 2: Instructor creates course EE465
    // ------------------------------------------------------------------
    console.log("\n[STEP 2] Instructor creates course EE465...");
    tx = await grader.addCourse(
      courseID,
      "Cryptocurrency and Blockchain Technology",
      rolls,
      [student1, student2, student3],
      [ta],
      { from: instructor, gas: 3000000 }
    );
    console.log("  ✓ Course created. Gas used:", tx.receipt.gasUsed);
    console.log("  Event emitted:", tx.logs[0] ? tx.logs[0].event : "CourseCreated");

    // ------------------------------------------------------------------
    // STEP 3: TA enters exam marks
    // ------------------------------------------------------------------
    console.log("\n[STEP 3] TA enters marks for 3 exams...");

    tx = await grader.addExam(courseID, examQ, 10, rolls, [9, 6, 8], { from: ta, gas: 2000000 });
    console.log("  ✓ quiz1 (max 10)  — marks: 9, 6, 8  — gas:", tx.receipt.gasUsed);

    tx = await grader.addExam(courseID, examM, 50, rolls, [45, 30, 38], { from: ta, gas: 2000000 });
    console.log("  ✓ midsem (max 50) — marks: 45, 30, 38 — gas:", tx.receipt.gasUsed);

    tx = await grader.addExam(courseID, examE, 100, rolls, [88, 55, 72], { from: ta, gas: 2000000 });
    console.log("  ✓ endsem (max 100)— marks: 88, 55, 72 — gas:", tx.receipt.gasUsed);

    // ------------------------------------------------------------------
    // STEP 4: TA corrects a mark after re-evaluation
    // ------------------------------------------------------------------
    console.log("\n[STEP 4] TA corrects student 2 midsem mark (30 → 34) after re-evaluation...");
    tx = await grader.updateMarks(courseID, examM, [rolls[1]], [34], { from: ta });
    console.log("  ✓ Mark updated on-chain. Transaction hash:", tx.tx);
    console.log("  The original mark (30) and this correction (34) are both");
    console.log("  permanently visible in Ethereum transaction history.");

    // ------------------------------------------------------------------
    // STEP 5: Instructor finalises grades
    // ------------------------------------------------------------------
    console.log("\n[STEP 5] Instructor calculates final grades...");
    console.log("  Weightages : quiz=10%, midsem=30%, endsem=60%");
    console.log("  Cutoffs    : AA>=85, AB>=75, BB>=65, BC>=55, CC>=45, CD>=35, DD>=25");

    tx = await grader.calculateGrades(
      courseID,
      [10, 30, 60],
      [85, 75, 65, 55, 45, 35, 25],
      { from: instructor, gas: 3000000 }
    );
    console.log("  ✓ Grades calculated and stored on-chain. Gas used:", tx.receipt.gasUsed);

    // ------------------------------------------------------------------
    // STEP 6: Display the full grade sheet
    // ------------------------------------------------------------------
    console.log("\n[STEP 6] Fetching final grade sheet from blockchain...\n");

    const gradeNames = { 10:"AA", 9:"AB", 8:"BB", 7:"BC", 6:"CC", 5:"CD", 4:"DD", 0:"F" };
    const sheet      = await grader.getProfMarksGrades(courseID, { from: instructor });

    console.log("  EE465 — Cryptocurrency and Blockchain Technology");
    console.log("  " + "=".repeat(52));
    console.log("  " + "Roll No".padEnd(15) + "Weighted Total".padEnd(18) + "Grade");
    console.log("  " + "-".repeat(45));

    for (let i = 0; i < sheet[0].length; i++) {
      const roll  = dec(sheet[0][i]);
      const total = num(sheet[1][i]);
      const gpt   = num(sheet[2][i]);
      const gname = gradeNames[gpt] || "?";
      console.log("  " + roll.padEnd(15) + (total + "%").padEnd(18) + `${gname}  (${gpt} grade points)`);
    }

    // ------------------------------------------------------------------
    // STEP 7: Student verifies their own result
    // ------------------------------------------------------------------
    console.log("\n[STEP 7] Students verify their own results from the blockchain...\n");

    for (let i = 0; i < rolls.length; i++) {
      const stuAddr = [student1, student2, student3][i];
      const res     = await grader.getStudentMarksGrades(courseID, rolls[i], { from: stuAddr });
      const exams   = res[0].map(dec);
      const wts     = res[1].map(num);
      const maxMks  = res[2].map(num);
      const marks   = res[3].map(num);
      const total   = num(res[4]);
      const grade   = num(res[5]);
      const roll    = dec(rolls[i]);

      console.log(`  Student ${roll} (${stuAddr.slice(0,10)}...):`);
      exams.forEach((e, j) => {
        console.log(`    ${e.padEnd(10)} max=${maxMks[j]}  wt=${wts[j]}%  scored=${marks[j]}`);
      });
      console.log(`    ─────────────────────────────`);
      console.log(`    Weighted Total : ${total}%`);
      console.log(`    Final Grade    : ${gradeNames[grade]} (${grade} grade points)\n`);
    }

    console.log("  ✓ All steps completed. Every transaction is permanently");
    console.log("    recorded on the Ethereum blockchain and auditable by anyone.\n");

  } catch (err) {
    console.error("\n[ERROR]", err.message || err);
    console.error("Make sure Ganache is running and you ran: truffle migrate --reset");
  }

  callback();
};
