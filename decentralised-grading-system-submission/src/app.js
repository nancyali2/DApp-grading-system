/**
 * app.js — Front-End Logic for Decentralised Grading System DApp
 *
 * Connects the HTML UI to the Grader smart contract via Web3.js and MetaMask.
 * All blockchain interactions go through the TruffleContract abstraction.
 *
 * Authors: Saiteja Talluri, Pavan Bhargav
 * New author: Nancy Ali
 * Course:  EE 465 — Cryptocurrency and Blockchain Technology, IIT Bombay, Autumn 2019
 */

const App = {
  loading:   false,
  contracts: {},
  account:   null,
  grader:    null,

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  /**
   * Entry point — called on window load.
   * Sets up Web3, loads the connected account, and hydrates the smart contract.
   */
  load: async () => {
    try {
      App.showStatus("Connecting to Ethereum network...", "info");
      await App.loadWeb3();
      await App.loadAccount();
      await App.loadContract();
      App.showStatus(
        `Connected: ${App.account}`,
        "success"
      );
    } catch (err) {
      App.showStatus("Failed to connect: " + err.message, "danger");
      console.error("Initialisation error:", err);
    }
  },

  /**
   * Detect and configure the Web3 provider (MetaMask or legacy injected web3).
   */
  loadWeb3: async () => {
    if (window.ethereum) {
      // Modern MetaMask / EIP-1193 browsers
      window.web3 = new Web3(window.ethereum);
      App.web3Provider = window.ethereum;
      try {
        await window.ethereum.enable(); // Request account access
      } catch (err) {
        throw new Error("MetaMask access denied by user.");
      }
    } else if (window.web3) {
      // Legacy dapp browsers (older MetaMask)
      window.web3 = new Web3(window.web3.currentProvider);
      App.web3Provider = window.web3.currentProvider;
      console.warn("Using legacy web3 provider. Please update MetaMask.");
    } else {
      throw new Error(
        "No Ethereum provider found. Please install MetaMask: https://metamask.io"
      );
    }
  },

  /**
   * Read the currently selected MetaMask account.
   */
  loadAccount: async () => {
  let accounts = [];

  if (window.ethereum) {
    accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  } else if (window.web3 && window.web3.eth) {
    accounts = await new Promise((resolve, reject) => {
      window.web3.eth.getAccounts((err, accs) => {
        if (err) reject(err);
        else resolve(accs);
      });
    });
  }

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found. Please unlock MetaMask.");
  }

  App.account = accounts[0];
  console.log("Active account:", App.account);
},

  /**
   * Load the compiled Grader contract ABI and point it at the deployed address.
   */
  loadContract: async () => {
    const
    const graderABI = await $.getJSON("Grader.json");
    App.contracts.Grader = TruffleContract(graderABI);
    App.contracts.Grader.setProvider(App.web3Provider);
    App.grader = await App.contracts.Grader.deployed();
    console.log("Grader contract loaded at:", App.grader.address);
  },

  // ---------------------------------------------------------------------------
  // UI Helpers
  // ---------------------------------------------------------------------------

  /**
   * Show a Bootstrap alert in the #statusBar div.
   * @param {string} message  Message text.
   * @param {string} type     Bootstrap colour: success | danger | info | warning.
   */
  showStatus: (message, type = "info") => {
    const bar = $("#statusBar");
    bar.removeClass("alert-success alert-danger alert-info alert-warning d-none")
       .addClass(`alert alert-${type}`)
       .text(message)
       .show();
  },

  /**
   * Wrap every contract call: show loading state, catch errors, reset forms.
   */
  withLoading: async (fn) => {
    if (App.loading) return;
    App.loading = true;
    App.showStatus("Processing transaction — please confirm in MetaMask...", "warning");
    try {
      await fn();
      App.showStatus("Transaction confirmed successfully.", "success");
    } catch (err) {
      const msg = err.message || String(err);
      // MetaMask rejection
      if (msg.includes("denied") || msg.includes("User denied")) {
        App.showStatus("Transaction cancelled by user.", "warning");
      } else {
        App.showStatus("Error: " + msg.split("\n")[0], "danger");
      }
      console.error(err);
    } finally {
      App.loading = false;
      $(".formClass").trigger("reset");
    }
  },

  // ---------------------------------------------------------------------------
  // Admin Functions
  // ---------------------------------------------------------------------------

  addInstructorFun: async () => {
    await App.withLoading(async () => {
      const raw  = $("#addInstructorInp0").val().trim();
      const addrs = raw.split(",").map(s => s.trim()).filter(Boolean);
      if (addrs.length === 0) throw new Error("Please enter at least one address.");
      await App.grader.addInstructor(addrs, { from: App.account });
    });
  },

  getInstructorsListFun: async () => {
    try {
      const list = await App.grader.getInstructorsList({ from: App.account });
      const output = list.length === 0
        ? "No instructors registered yet."
        : list.join("\n");
      $("#getInstructorsListResult").val(output);
    } catch (err) {
      App.showStatus("Error: " + err.message.split("\n")[0], "danger");
    }
    $(".formClass").trigger("reset");
  },

  // ---------------------------------------------------------------------------
  // Instructor Functions
  // ---------------------------------------------------------------------------

  addCourseFun: async () => {
    await App.withLoading(async () => {
      const courseId   = web3.fromAscii($("#addCourseInp0").val().trim());
      const courseName = $("#addCourseInp1").val().trim();
      const rollList   = $("#addCourseInp2").val().split(",").map(r => web3.fromAscii(r.trim()));
      const studAddrs  = $("#addCourseInp3").val().split(",").map(s => s.trim());
      const taAddrs    = $("#addCourseInp4").val().split(",").map(s => s.trim()).filter(Boolean);

      if (!courseId || !courseName) throw new Error("Course ID and name are required.");
      if (rollList.length !== studAddrs.length) throw new Error("Roll list and student address list must have the same number of entries.");

      await App.grader.addCourse(courseId, courseName, rollList, studAddrs, taAddrs, {
        from: App.account,
        gas:  3000000
      });
    });
  },

  addExamFun: async () => {
    await App.withLoading(async () => {
      const courseId  = web3.fromAscii($("#addExamInp0").val().trim());
      const examId    = web3.fromAscii($("#addExamInp1").val().trim());
      const maxMarks  = parseInt($("#addExamInp2").val().trim(), 10);
      const rollList  = $("#addExamInp3").val().split(",").map(r => web3.fromAscii(r.trim()));
      const marksList = $("#addExamInp4").val().split(",").map(m => parseInt(m.trim(), 10));

      if (isNaN(maxMarks) || maxMarks <= 0) throw new Error("Max marks must be a positive number.");
      if (marksList.some(isNaN)) throw new Error("All marks must be valid numbers.");

      await App.grader.addExam(courseId, examId, maxMarks, rollList, marksList, {
        from: App.account,
        gas:  3000000
      });
    });
  },

  updateMarksFun: async () => {
    await App.withLoading(async () => {
      const courseId  = web3.fromAscii($("#updateMarksInp0").val().trim());
      const examId    = web3.fromAscii($("#updateMarksInp1").val().trim());
      const rollList  = $("#updateMarksInp2").val().split(",").map(r => web3.fromAscii(r.trim()));
      const marksList = $("#updateMarksInp3").val().split(",").map(m => parseInt(m.trim(), 10));

      if (marksList.some(isNaN)) throw new Error("All marks must be valid numbers.");

      await App.grader.updateMarks(courseId, examId, rollList, marksList, {
        from: App.account
      });
    });
  },

  calculateGradesFun: async () => {
    await App.withLoading(async () => {
      const courseId     = web3.fromAscii($("#calculateGradesInp0").val().trim());
      const weightages   = $("#calculateGradesInp1").val().split(",").map(w => parseInt(w.trim(), 10));
      const gradeCutoffs = $("#calculateGradesInp2").val().split(",").map(c => parseInt(c.trim(), 10));

      if (weightages.some(isNaN)) throw new Error("All weightages must be valid numbers.");
      if (gradeCutoffs.some(isNaN)) throw new Error("All grade cutoffs must be valid numbers.");

      const weightageSum = weightages.reduce((a, b) => a + b, 0);
      if (weightageSum !== 100) throw new Error(`Weightages must sum to 100 (currently ${weightageSum}).`);

      await App.grader.calculateGrades(courseId, weightages, gradeCutoffs, {
        from: App.account,
        gas:  3000000
      });
    });
  },

  getProfExamMarksFun: async () => {
    try {
      const courseId = web3.fromAscii($("#getProfExamMarksInp0").val().trim());
      const examId   = web3.fromAscii($("#getProfExamMarksInp1").val().trim());
      const output   = await App.grader.getProfExamMarks(courseId, examId, { from: App.account });

      const rollList  = output[0];
      const marksList = output[1];
      const maxMarks  = output[2].toNumber();
      const weightage = output[3].toNumber();

      let log = `Exam Details\n============\nMax Marks : ${maxMarks}\nWeightage : ${weightage}%\n\nRoll No        Marks\n----------     -----\n`;
      for (let i = 0; i < rollList.length; i++) {
        log += `${web3.toUtf8(rollList[i]).padEnd(15)}${marksList[i]}\n`;
      }
      $("#getProfExamMarksResult").val(log);
    } catch (err) {
      App.showStatus("Error: " + err.message.split("\n")[0], "danger");
    }
    $(".formClass").trigger("reset");
  },

  getProfExamWeightagesFun: async () => {
    try {
      const courseId = web3.fromAscii($("#getProfExamWeightagesInp0").val().trim());
      const output   = await App.grader.getProfExamWeightages(courseId, { from: App.account });

      const examList   = output[0].map(e => web3.toUtf8(e));
      const maxMarks   = output[1].map(m => m.toNumber());
      const weightages = output[2].map(w => w.toNumber());

      let log = `Exam Breakdown\n==============\n${"Exam".padEnd(15)}${"Max Marks".padEnd(12)}Weightage\n${"-".repeat(38)}\n`;
      for (let i = 0; i < examList.length; i++) {
        log += `${examList[i].padEnd(15)}${String(maxMarks[i]).padEnd(12)}${weightages[i]}%\n`;
      }
      $("#getProfExamWeightagesResult").val(log);
    } catch (err) {
      App.showStatus("Error: " + err.message.split("\n")[0], "danger");
    }
    $(".formClass").trigger("reset");
  },

  getProfMarksGradesFun: async () => {
    try {
      const courseId = web3.fromAscii($("#getProfMarksGradesInp0").val().trim());
      const output   = await App.grader.getProfMarksGrades(courseId, { from: App.account });

      const rollList   = output[0];
      const totals     = output[1];
      const gradeList  = output[2];
      const gradeNames = { 10:"AA", 9:"AB", 8:"BB", 7:"BC", 6:"CC", 5:"CD", 4:"DD", 0:"F" };

      let log = `Final Grade Sheet\n=================\n${"Roll No".padEnd(15)}${"Total".padEnd(10)}Grade\n${"-".repeat(35)}\n`;
      for (let i = 0; i < rollList.length; i++) {
        const pts  = gradeList[i].toNumber();
        const name = gradeNames[pts] || String(pts);
        log += `${web3.toUtf8(rollList[i]).padEnd(15)}${String(totals[i].toNumber()).padEnd(10)}${name} (${pts})\n`;
      }
      $("#getProfMarksGradesFormResult").val(log);
    } catch (err) {
      App.showStatus("Error: " + err.message.split("\n")[0], "danger");
    }
    $(".formClass").trigger("reset");
  },

  // ---------------------------------------------------------------------------
  // Student Functions
  // ---------------------------------------------------------------------------

  getStudentMarksGradesFun: async () => {
    try {
      const courseId = web3.fromAscii($("#getStudentMarksGradesInp0").val().trim());
      const rollNo   = web3.fromAscii($("#getStudentMarksGradesInp1").val().trim());
      const output   = await App.grader.getStudentMarksGrades(courseId, rollNo, { from: App.account });

      const examList   = output[0].map(e => web3.toUtf8(e));
      const weightages = output[1].map(w => w.toNumber());
      const maxMarks   = output[2].map(m => m.toNumber());
      const marksList  = output[3].map(m => m.toNumber());
      const total      = output[4].toNumber();
      const grade      = output[5].toNumber();
      const gradeNames = { 10:"AA", 9:"AB", 8:"BB", 7:"BC", 6:"CC", 5:"CD", 4:"DD", 0:"F" };

      let log = `Student Result\n==============\n${"Exam".padEnd(12)}${"Max".padEnd(6)}${"Wt%".padEnd(6)}Marks\n${"-".repeat(32)}\n`;
      for (let i = 0; i < examList.length; i++) {
        log += `${examList[i].padEnd(12)}${String(maxMarks[i]).padEnd(6)}${String(weightages[i]).padEnd(6)}${marksList[i]}\n`;
      }
      log += `\n${"Total Marks".padEnd(20)}: ${total}\n`;
      log += `${"Final Grade".padEnd(20)}: ${gradeNames[grade] || grade} (${grade} points)\n`;
      $("#getStudentMarksGradesResult").val(log);
    } catch (err) {
      App.showStatus("Error: " + err.message.split("\n")[0], "danger");
    }
    $(".formClass").trigger("reset");
  }
};

// ---------------------------------------------------------------------------
// Bootstrap — load the app when the window is ready
// ---------------------------------------------------------------------------
$(() => {
  $(window).on("load", () => {
    App.load();
  });
});
