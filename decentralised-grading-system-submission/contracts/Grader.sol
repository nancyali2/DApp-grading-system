pragma solidity ^0.5.0;

/**
 * @title Grader
 * @dev Decentralised student grading system for IIT Bombay (EE 465, Autumn 2019)
 * @notice Implements the full IIT Bombay marking and grading workflow on Ethereum.
 *         Every mark entry, correction, and final grade is an immutable on-chain transaction.
 * @author Saiteja Talluri, Pavan Bhargav
 */
contract Grader {

    // -----------------------------------------------------------------------
    // State Variables
    // -----------------------------------------------------------------------

    address private admin;

    // IIT Bombay grade point chart: AA=10, AB=9, BB=8, BC=7, CC=6, CD=5, DD=4, F=0
    uint8[8] private gradeChart = [10, 9, 8, 7, 6, 5, 4, 0];

    bytes32[] private courseIDList;
    address[] private instructorsList;

    mapping(bytes32 => bool)    private courseExists;
    mapping(address => bool)    private isInstructor;
    mapping(bytes32 => address) private courseInstructor;

    // -----------------------------------------------------------------------
    // Events — every state-changing action emits an event for off-chain indexing
    // -----------------------------------------------------------------------

    event InstructorAdded(address indexed instructor);
    event CourseCreated(bytes32 indexed courseID, string courseName, address indexed instructor);
    event ExamAdded(bytes32 indexed courseID, bytes32 indexed examID, uint maxMarks);
    event MarksUpdated(bytes32 indexed courseID, bytes32 indexed examID);
    event GradesCalculated(bytes32 indexed courseID);

    // -----------------------------------------------------------------------
    // Structs
    // -----------------------------------------------------------------------

    struct Exam {
        bytes32 examID;
        uint    maxMarks;
        mapping(bytes32 => uint) marks; // rollNo => marks obtained
    }

    struct Course {
        bytes32   courseID;
        string    courseName;
        address   instructor;
        bytes32[] rollList;
        bool      marksInitialised;

        mapping(bytes32 => bool)    enrolledRoll;   // roll number is enrolled
        mapping(address => bool)    isTa;           // address is a TA
        mapping(bytes32 => address) rollToAddr;     // roll number => student wallet
        mapping(address => bool)    enrolledAddr;   // wallet already registered
    }

    struct CourseMarks {
        bytes32[] examIDList;
        uint[]    weightageList;
        uint[]    maxMarksList;
        uint[]    gradeCutoffs;
        uint[]    gradeList;         // [studentIdx] -> grade point
        uint[]    totalMarksList;    // [studentIdx] -> weighted total
        uint[][]  marksByStudent;    // [studentIdx][examIdx]
        uint[][]  marksByExam;       // [examIdx][studentIdx]  transposed view
        bool      transposedReady;

        mapping(bytes32 => bool)  examExists;
        mapping(bytes32 => Exam)  exams;
        mapping(bytes32 => uint)  examWeightage;
        mapping(bytes32 => uint)  studentTotal;
        mapping(bytes32 => uint)  studentGrade;
    }

    mapping(bytes32 => Course)      private courses;
    mapping(bytes32 => CourseMarks) private courseMarks;

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlyAdmin() {
        require(msg.sender == admin, "Grader: caller is not admin");
        _;
    }

    modifier onlyInstructor(bytes32 courseID) {
        require(courseExists[courseID], "Grader: course does not exist");
        require(
            courseInstructor[courseID] == msg.sender,
            "Grader: caller is not the course instructor"
        );
        _;
    }

    modifier onlyInstructorOrTA(bytes32 courseID) {
        require(courseExists[courseID], "Grader: course does not exist");
        require(
            courseInstructor[courseID] == msg.sender || courses[courseID].isTa[msg.sender],
            "Grader: caller is not instructor or TA for this course"
        );
        _;
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor() public {
        admin = msg.sender;
    }

    // -----------------------------------------------------------------------
    // Admin Functions
    // -----------------------------------------------------------------------

    /**
     * @notice Register one or more Ethereum addresses as instructors.
     * @param instrAddresses Array of instructor wallet addresses.
     */
    function addInstructor(address[] calldata instrAddresses) external onlyAdmin {
        for (uint i = 0; i < instrAddresses.length; i++) {
            address addr = instrAddresses[i];
            require(addr != address(0), "Grader: zero address not allowed");
            if (!isInstructor[addr]) {
                isInstructor[addr] = true;
                instructorsList.push(addr);
                emit InstructorAdded(addr);
            }
        }
    }

    /**
     * @notice Return the full list of registered instructor addresses.
     */
    function getInstructorsList() external view onlyAdmin returns (address[] memory) {
        return instructorsList;
    }

    /**
     * @notice Destroy the contract and return any Ether to admin.
     * @dev Use only in development. In production, use an upgrade proxy instead.
     */
    function kill() external onlyAdmin {
        selfdestruct(msg.sender);
    }

    // -----------------------------------------------------------------------
    // Instructor Functions
    // -----------------------------------------------------------------------

    /**
     * @notice Create a new course and enrol students and TAs.
     * @param courseID   Unique bytes32 identifier (e.g. web3.fromAscii("EE465")).
     * @param courseName Human-readable name string.
     * @param rollList   Ordered array of student roll numbers.
     * @param studAddrs  Ethereum address for each roll number (same order).
     * @param taAddrs    Addresses of teaching assistants for this course.
     */
    function addCourse(
        bytes32           courseID,
        string   calldata courseName,
        bytes32[] calldata rollList,
        address[] calldata studAddrs,
        address[] calldata taAddrs
    ) external {
        require(isInstructor[msg.sender],             "Grader: caller is not a registered instructor");
        require(!courseExists[courseID],              "Grader: course ID already in use");
        require(rollList.length == studAddrs.length,  "Grader: rollList / studAddrs length mismatch");
        require(rollList.length > 0,                  "Grader: must enrol at least one student");

        courseExists[courseID]     = true;
        courseInstructor[courseID] = msg.sender;
        courseIDList.push(courseID);

        Course storage c  = courses[courseID];
        c.courseID         = courseID;
        c.courseName       = courseName;
        c.instructor       = msg.sender;
        c.marksInitialised = false;

        for (uint i = 0; i < rollList.length; i++) {
            bytes32 roll = rollList[i];
            address addr = studAddrs[i];
            require(addr != address(0), "Grader: zero student address");
            if (!c.enrolledAddr[addr] && !c.enrolledRoll[roll]) {
                c.rollList.push(roll);
                c.rollToAddr[roll]   = addr;
                c.enrolledRoll[roll] = true;
                c.enrolledAddr[addr] = true;
            }
        }

        for (uint j = 0; j < taAddrs.length; j++) {
            require(taAddrs[j] != address(0), "Grader: zero TA address");
            c.isTa[taAddrs[j]] = true;
        }

        emit CourseCreated(courseID, courseName, msg.sender);
    }

    /**
     * @notice Record exam marks for all students.
     * @param courseID  Course this exam belongs to.
     * @param examID    Unique exam identifier (e.g. web3.fromAscii("midsem")).
     * @param maxMarks  Maximum marks for this exam (must be > 0).
     * @param rollList  Roll numbers of students being graded.
     * @param marksList Corresponding marks (each must be <= maxMarks).
     */
    function addExam(
        bytes32           courseID,
        bytes32           examID,
        uint              maxMarks,
        bytes32[] calldata rollList,
        uint[]    calldata marksList
    ) external onlyInstructorOrTA(courseID) {
        require(marksList.length == rollList.length, "Grader: rollList / marksList length mismatch");
        require(maxMarks > 0,                        "Grader: maxMarks must be > 0");

        if (!courses[courseID].marksInitialised) {
            _initialiseCourseMarks(courseID);
        }

        CourseMarks storage cm = courseMarks[courseID];
        require(!cm.examExists[examID], "Grader: exam ID already exists for this course");

        cm.examExists[examID] = true;
        cm.examIDList.push(examID);
        cm.maxMarksList.push(maxMarks);

        Exam storage exam = cm.exams[examID];
        exam.examID   = examID;
        exam.maxMarks = maxMarks;

        for (uint k = 0; k < rollList.length; k++) {
            require(marksList[k] <= maxMarks, "Grader: a student mark exceeds maxMarks");
            exam.marks[rollList[k]] = marksList[k];
        }

        // Append this exam's column to every student's marks row
        Course storage c = courses[courseID];
        for (uint i = 0; i < c.rollList.length; i++) {
            cm.marksByStudent[i].push(exam.marks[c.rollList[i]]);
        }

        emit ExamAdded(courseID, examID, maxMarks);
    }

    /**
     * @notice Correct previously entered marks for specific students.
     *         The change is permanently recorded as a new blockchain transaction.
     * @param courseID  The course the exam belongs to.
     * @param examID    The exam to update.
     * @param rollList  Roll numbers of students whose marks need correction.
     * @param marksList Corrected marks in the same order as rollList.
     */
    function updateMarks(
        bytes32           courseID,
        bytes32           examID,
        bytes32[] calldata rollList,
        uint[]    calldata marksList
    ) external onlyInstructorOrTA(courseID) {
        require(courses[courseID].marksInitialised,       "Grader: no marks data for this course");
        require(courseMarks[courseID].examExists[examID], "Grader: exam does not exist");
        require(marksList.length == rollList.length,      "Grader: length mismatch");

        CourseMarks storage cm = courseMarks[courseID];
        Exam storage exam      = cm.exams[examID];

        for (uint k = 0; k < rollList.length; k++) {
            require(courses[courseID].enrolledRoll[rollList[k]], "Grader: roll number not enrolled");
            require(marksList[k] <= exam.maxMarks, "Grader: marks exceed maxMarks");
            exam.marks[rollList[k]] = marksList[k];
        }

        // Sync the corrected marks back into the marksByStudent matrix
        Course storage c = courses[courseID];
        for (uint i = 0; i < c.rollList.length; i++) {
            for (uint j = 0; j < cm.examIDList.length; j++) {
                if (cm.examIDList[j] == examID) {
                    cm.marksByStudent[i][j] = exam.marks[c.rollList[i]];
                }
            }
        }

        emit MarksUpdated(courseID, examID);
    }

    /**
     * @notice Compute and store final grades for every student in a course.
     * @param courseID     The course to finalise.
     * @param weightages   Percentage weightage per exam (must sum to exactly 100).
     * @param gradeCutoffs Seven strictly descending thresholds: [AA, AB, BB, BC, CC, CD, DD].
     */
    function calculateGrades(
        bytes32          courseID,
        uint[]  calldata weightages,
        uint[]  calldata gradeCutoffs
    ) external onlyInstructor(courseID) {
        CourseMarks storage cm = courseMarks[courseID];
        require(courses[courseID].marksInitialised,         "Grader: no marks data yet");
        require(cm.examIDList.length == weightages.length,  "Grader: weightage count does not match exam count");
        require(gradeCutoffs.length == gradeChart.length - 1, "Grader: must supply exactly 7 grade cutoffs");

        _setWeightages(courseID, weightages);
        _setGradeCutoffs(courseID, gradeCutoffs);
        _calculateTotals(courseID);

        Course storage c = courses[courseID];
        for (uint i = 0; i < c.rollList.length; i++) {
            bytes32 roll = c.rollList[i];
            uint total   = cm.studentTotal[roll];
            uint grade   = gradeChart[gradeChart.length - 1]; // default F

            for (uint j = 0; j < cm.gradeCutoffs.length; j++) {
                if (total >= cm.gradeCutoffs[j]) {
                    grade = gradeChart[j];
                    break;
                }
            }
            cm.gradeList[i]       = grade;
            cm.studentGrade[roll] = grade;
        }

        _buildTransposedMarks(courseID);
        emit GradesCalculated(courseID);
    }

    // -----------------------------------------------------------------------
    // View Functions — Instructor
    // -----------------------------------------------------------------------

    function getProfExamWeightages(bytes32 courseID)
        external view onlyInstructor(courseID)
        returns (bytes32[] memory examList, uint[] memory maxMarksList, uint[] memory weightages)
    {
        CourseMarks storage cm = courseMarks[courseID];
        examList     = cm.examIDList;
        maxMarksList = cm.maxMarksList;
        weightages   = cm.weightageList;
    }

    function getProfExamMarks(bytes32 courseID, bytes32 examID)
        external view onlyInstructor(courseID)
        returns (bytes32[] memory rollList, uint[] memory marksList, uint maxMarks, uint weightage)
    {
        CourseMarks storage cm = courseMarks[courseID];
        require(cm.examExists[examID], "Grader: exam does not exist");
        rollList  = courses[courseID].rollList;
        maxMarks  = cm.exams[examID].maxMarks;
        weightage = cm.examWeightage[examID];
        for (uint i = 0; i < cm.examIDList.length; i++) {
            if (cm.examIDList[i] == examID) {
                marksList = cm.marksByExam[i];
                break;
            }
        }
    }

    function getProfMarksGrades(bytes32 courseID)
        external view onlyInstructor(courseID)
        returns (bytes32[] memory rollList, uint[] memory totalMarks, uint[] memory gradeList)
    {
        rollList   = courses[courseID].rollList;
        totalMarks = courseMarks[courseID].totalMarksList;
        gradeList  = courseMarks[courseID].gradeList;
    }

    // -----------------------------------------------------------------------
    // View Functions — Student / Instructor
    // -----------------------------------------------------------------------

    /**
     * @notice Retrieve a student's full marks breakdown, total, and grade.
     * @dev The instructor can query any student. A student can only query themselves.
     */
    function getStudentMarksGrades(bytes32 courseID, bytes32 rollNo)
        external view
        returns (
            bytes32[] memory examList,
            uint[]    memory weightages,
            uint[]    memory maxMarksList,
            uint[]    memory marksList,
            uint totalMarks,
            uint grade
        )
    {
        require(courseExists[courseID],             "Grader: course does not exist");
        Course storage c = courses[courseID];
        require(c.enrolledRoll[rollNo],             "Grader: roll number not enrolled");
        require(c.marksInitialised,                 "Grader: no marks available yet");

        bool callerIsInstructor = (courseInstructor[courseID] == msg.sender);
        bool callerIsStudent    = (c.rollToAddr[rollNo] == msg.sender);
        require(callerIsInstructor || callerIsStudent, "Grader: not authorised to view this record");

        CourseMarks storage cm = courseMarks[courseID];
        examList     = cm.examIDList;
        weightages   = cm.weightageList;
        maxMarksList = cm.maxMarksList;
        totalMarks   = cm.studentTotal[rollNo];
        grade        = cm.studentGrade[rollNo];

        for (uint i = 0; i < c.rollList.length; i++) {
            if (c.rollList[i] == rollNo) {
                marksList = cm.marksByStudent[i];
                break;
            }
        }
    }

    // -----------------------------------------------------------------------
    // Private Helpers
    // -----------------------------------------------------------------------

    function _initialiseCourseMarks(bytes32 courseID) private {
        uint n             = courses[courseID].rollList.length;
        CourseMarks storage cm = courseMarks[courseID];
        cm.gradeList      = new uint[](n);
        cm.totalMarksList = new uint[](n);
        cm.marksByStudent = new uint[][](n);
        cm.transposedReady = false;
        for (uint i = 0; i < n; i++) {
            cm.marksByStudent[i] = new uint[](0);
        }
        courses[courseID].marksInitialised = true;
    }

    function _setWeightages(bytes32 courseID, uint[] memory weightages) private {
        uint total = 0;
        for (uint i = 0; i < weightages.length; i++) total += weightages[i];
        require(total == 100, "Grader: exam weightages must sum to exactly 100");
        CourseMarks storage cm = courseMarks[courseID];
        cm.weightageList = weightages;
        for (uint i = 0; i < cm.examIDList.length; i++) {
            cm.examWeightage[cm.examIDList[i]] = weightages[i];
        }
    }

    function _setGradeCutoffs(bytes32 courseID, uint[] memory cutoffs) private {
        for (uint i = 1; i < cutoffs.length; i++) {
            require(cutoffs[i] < cutoffs[i - 1], "Grader: cutoffs must be strictly descending");
        }
        courseMarks[courseID].gradeCutoffs = cutoffs;
    }

    function _calculateTotals(bytes32 courseID) private {
        CourseMarks storage cm = courseMarks[courseID];
        Course storage c       = courses[courseID];
        uint precision         = 1000; // avoid floating point; equivalent to 2 d.p.

        for (uint p = 0; p < c.rollList.length; p++) {
            cm.studentTotal[c.rollList[p]] = 0;
        }

        for (uint i = 0; i < cm.examIDList.length; i++) {
            bytes32 eid  = cm.examIDList[i];
            uint maxMks  = cm.exams[eid].maxMarks;
            uint w       = cm.examWeightage[eid];
            for (uint j = 0; j < c.rollList.length; j++) {
                bytes32 roll = c.rollList[j];
                cm.studentTotal[roll] += (cm.exams[eid].marks[roll] * precision * w) / maxMks;
            }
        }

        for (uint k = 0; k < c.rollList.length; k++) {
            cm.studentTotal[c.rollList[k]] /= precision;
            cm.totalMarksList[k] = cm.studentTotal[c.rollList[k]];
        }
    }

    function _buildTransposedMarks(bytes32 courseID) private {
        CourseMarks storage cm = courseMarks[courseID];
        Course storage c       = courses[courseID];
        uint numExams          = cm.examIDList.length;
        uint numStudents       = c.rollList.length;

        if (!cm.transposedReady) {
            cm.marksByExam = new uint[][](numExams);
            for (uint j = 0; j < numExams; j++) {
                cm.marksByExam[j] = new uint[](numStudents);
            }
            cm.transposedReady = true;
        }

        for (uint j = 0; j < numExams; j++) {
            for (uint i = 0; i < numStudents; i++) {
                cm.marksByExam[j][i] = cm.marksByStudent[i][j];
            }
        }
    }
}
