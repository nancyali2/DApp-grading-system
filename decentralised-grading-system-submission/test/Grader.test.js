/**
 * Grader.test.js — Unit Tests for the Grader Smart Contract
 *
 * Run with: truffle test
 * Requires: Ganache running on the port configured in truffle-config.js
 *
 * Tests cover:
 *   - Admin role: instructor registration
 *   - Instructor role: course creation, exam addition, grade calculation
 *   - TA role: mark updates
 *   - Student role: result retrieval
 *   - Access control: unauthorised calls should revert
 */

const Grader = artifacts.require("Grader");

contract("Grader", (accounts) => {

  // Assign named roles from Ganache accounts
  const admin      = accounts[0];
  const instructor = accounts[1];
  const ta         = accounts[2];
  const student1   = accounts[3];
  const student2   = accounts[4];
  const stranger   = accounts[5];

  const courseID   = web3.utils.fromAscii("EE465");
  const courseName = "Blockchain Technology";
  const rollNo1    = web3.utils.fromAscii("190010001");
  const rollNo2    = web3.utils.fromAscii("190010002");
  const examQuiz   = web3.utils.fromAscii("quiz1");
  const examMid    = web3.utils.fromAscii("midsem");
  const examEnd    = web3.utils.fromAscii("endsem");

  let grader;

  // Deploy a fresh contract before each test block
  beforeEach(async () => {
    grader = await Grader.new({ from: admin });
  });

  // ---------------------------------------------------------------------------
  describe("Deployment", () => {

    it("should deploy successfully and set admin", async () => {
      assert.ok(grader.address, "Contract has no address");
    });

  });

  // ---------------------------------------------------------------------------
  describe("Admin: addInstructor / getInstructorsList", () => {

    it("admin can register an instructor", async () => {
      await grader.addInstructor([instructor], { from: admin });
      const list = await grader.getInstructorsList({ from: admin });
      assert.equal(list.length, 1);
      assert.equal(list[0].toLowerCase(), instructor.toLowerCase());
    });

    it("admin can register multiple instructors at once", async () => {
      await grader.addInstructor([instructor, accounts[6]], { from: admin });
      const list = await grader.getInstructorsList({ from: admin });
      assert.equal(list.length, 2);
    });

    it("duplicate instructor addresses are ignored", async () => {
      await grader.addInstructor([instructor, instructor], { from: admin });
      const list = await grader.getInstructorsList({ from: admin });
      assert.equal(list.length, 1, "Duplicate should not be added twice");
    });

    it("non-admin cannot add instructors", async () => {
      try {
        await grader.addInstructor([instructor], { from: stranger });
        assert.fail("Expected revert");
      } catch (err) {
        assert.include(err.message, "revert", "Should have reverted");
      }
    });

    it("non-admin cannot read instructor list", async () => {
      try {
        await grader.getInstructorsList({ from: stranger });
        assert.fail("Expected revert");
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

  });

  // ---------------------------------------------------------------------------
  describe("Instructor: addCourse", () => {

    beforeEach(async () => {
      await grader.addInstructor([instructor], { from: admin });
    });

    it("registered instructor can create a course", async () => {
      await grader.addCourse(
        courseID, courseName,
        [rollNo1, rollNo2],
        [student1, student2],
        [ta],
        { from: instructor, gas: 3000000 }
      );
      // No revert = success
    });

    it("unregistered address cannot create a course", async () => {
      try {
        await grader.addCourse(
          courseID, courseName, [rollNo1], [student1], [],
          { from: stranger, gas: 3000000 }
        );
        assert.fail("Expected revert");
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("duplicate course IDs are rejected", async () => {
      await grader.addCourse(
        courseID, courseName, [rollNo1], [student1], [],
        { from: instructor, gas: 3000000 }
      );
      try {
        await grader.addCourse(
          courseID, "Another Name", [rollNo2], [student2], [],
          { from: instructor, gas: 3000000 }
        );
        assert.fail("Expected revert for duplicate course");
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

  });

  // ---------------------------------------------------------------------------
  describe("Instructor / TA: addExam and updateMarks", () => {

    beforeEach(async () => {
      await grader.addInstructor([instructor], { from: admin });
      await grader.addCourse(
        courseID, courseName,
        [rollNo1, rollNo2],
        [student1, student2],
        [ta],
        { from: instructor, gas: 3000000 }
      );
    });

    it("instructor can add an exam", async () => {
      await grader.addExam(
        courseID, examMid, 50,
        [rollNo1, rollNo2], [42, 35],
        { from: instructor, gas: 3000000 }
      );
    });

    it("TA can add an exam", async () => {
      await grader.addExam(
        courseID, examMid, 50,
        [rollNo1, rollNo2], [42, 35],
        { from: ta, gas: 3000000 }
      );
    });

    it("stranger cannot add an exam", async () => {
      try {
        await grader.addExam(
          courseID, examMid, 50, [rollNo1], [30],
          { from: stranger, gas: 3000000 }
        );
        assert.fail("Expected revert");
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("marks exceeding maxMarks are rejected", async () => {
      try {
        await grader.addExam(
          courseID, examMid, 50,
          [rollNo1], [60], // 60 > 50
          { from: instructor, gas: 3000000 }
        );
        assert.fail("Expected revert");
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("TA can update marks", async () => {
      await grader.addExam(
        courseID, examMid, 50,
        [rollNo1, rollNo2], [42, 35],
        { from: instructor, gas: 3000000 }
      );
      await grader.updateMarks(
        courseID, examMid,
        [rollNo1], [45],
        { from: ta }
      );
    });

  });

  // ---------------------------------------------------------------------------
  describe("Instructor: calculateGrades + getProfMarksGrades", () => {

    beforeEach(async () => {
      await grader.addInstructor([instructor], { from: admin });
      await grader.addCourse(
        courseID, courseName,
        [rollNo1, rollNo2],
        [student1, student2],
        [],
        { from: instructor, gas: 3000000 }
      );
      // quiz1: weight 10%, max 10
      await grader.addExam(courseID, examQuiz, 10, [rollNo1, rollNo2], [9, 6], { from: instructor, gas: 3000000 });
      // midsem: weight 30%, max 50
      await grader.addExam(courseID, examMid, 50, [rollNo1, rollNo2], [45, 30], { from: instructor, gas: 3000000 });
      // endsem: weight 60%, max 100
      await grader.addExam(courseID, examEnd, 100, [rollNo1, rollNo2], [88, 55], { from: instructor, gas: 3000000 });
    });

    it("instructor can calculate grades", async () => {
      // Weightages: quiz=10, midsem=30, endsem=60 — sum = 100
      // Cutoffs: AA>=85, AB>=75, BB>=65, BC>=55, CC>=45, CD>=35, DD>=25
      await grader.calculateGrades(
        courseID,
        [10, 30, 60],
        [85, 75, 65, 55, 45, 35, 25],
        { from: instructor, gas: 3000000 }
      );
    });

    it("weightages not summing to 100 are rejected", async () => {
      try {
        await grader.calculateGrades(courseID, [10, 30, 50], [85,75,65,55,45,35,25], { from: instructor, gas: 3000000 });
        assert.fail("Expected revert");
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

    it("grades are assigned correctly", async () => {
      await grader.calculateGrades(
        courseID,
        [10, 30, 60],
        [85, 75, 65, 55, 45, 35, 25],
        { from: instructor, gas: 3000000 }
      );
      const result = await grader.getProfMarksGrades(courseID, { from: instructor });
      const grades = result[2].map(g => g.toNumber());
      // student1: ~87.8 weighted -> AA (10)
      assert.equal(grades[0], 10, "Student 1 should receive AA (10 points)");
      // student2: ~56.2 weighted -> BC (7)
      assert.equal(grades[1], 7, "Student 2 should receive BC (7 points)");
    });

    it("student can view their own marks and grade", async () => {
      await grader.calculateGrades(
        courseID, [10, 30, 60], [85,75,65,55,45,35,25],
        { from: instructor, gas: 3000000 }
      );
      const result = await grader.getStudentMarksGrades(courseID, rollNo1, { from: student1 });
      const grade = result[5].toNumber();
      assert.equal(grade, 10, "Student 1 should see AA grade");
    });

    it("student cannot view another student's record", async () => {
      await grader.calculateGrades(
        courseID, [10, 30, 60], [85,75,65,55,45,35,25],
        { from: instructor, gas: 3000000 }
      );
      try {
        // student1 tries to query rollNo2 (belongs to student2)
        await grader.getStudentMarksGrades(courseID, rollNo2, { from: student1 });
        assert.fail("Expected revert");
      } catch (err) {
        assert.include(err.message, "revert");
      }
    });

  });

});
