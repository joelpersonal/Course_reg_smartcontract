// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Course Registration Smart Contract
/// @notice Lets students register for and withdraw from courses. The admin manages the course catalogue.
contract CourseRegistration {
    // ---------------------------------------------------------------------
    // Types & storage
    // ---------------------------------------------------------------------
    struct Course {
        uint256 id;
        string name;
        uint256 capacity;
        uint256 enrolled;
        bool active;
    }

    address public admin;
    bool public registrationOpen;
    uint256 public constant MAX_COURSES_PER_STUDENT = 5;
    uint256 public courseCount;

    mapping(uint256 => Course) private courses;
    mapping(uint256 => mapping(address => bool)) public isRegistered;
    mapping(address => uint256[]) private studentCourses;
    mapping(uint256 => address[]) private courseStudents;

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------
    event CourseAdded(uint256 indexed courseId, string name, uint256 capacity);
    event CourseStatusChanged(uint256 indexed courseId, bool active);
    event RegistrationWindowChanged(bool open);
    event StudentRegistered(uint256 indexed courseId, address indexed student);
    event StudentWithdrawn(uint256 indexed courseId, address indexed student);

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------
    error NotAdmin();
    error RegistrationClosed();
    error CourseDoesNotExist();
    error CourseNotActive();
    error CourseFull();
    error AlreadyRegistered();
    error NotRegistered();
    error CourseLimitReached();
    error InvalidInput();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier courseExists(uint256 courseId) {
        if (courseId == 0 || courseId > courseCount) revert CourseDoesNotExist();
        _;
    }

    constructor() {
        admin = msg.sender;
        registrationOpen = true;
    }

    // ---------------------------------------------------------------------
    // Admin functions
    // ---------------------------------------------------------------------
    function addCourse(string calldata name, uint256 capacity) external onlyAdmin returns (uint256) {
        if (bytes(name).length == 0 || capacity == 0) revert InvalidInput();
        courseCount++;
        courses[courseCount] = Course(courseCount, name, capacity, 0, true);
        emit CourseAdded(courseCount, name, capacity);
        return courseCount;
    }

    function setCourseActive(uint256 courseId, bool active) external onlyAdmin courseExists(courseId) {
        courses[courseId].active = active;
        emit CourseStatusChanged(courseId, active);
    }

    function setRegistrationOpen(bool open) external onlyAdmin {
        registrationOpen = open;
        emit RegistrationWindowChanged(open);
    }

    // ---------------------------------------------------------------------
    // Student functions
    // ---------------------------------------------------------------------
    function register(uint256 courseId) external courseExists(courseId) {
        if (!registrationOpen) revert RegistrationClosed();
        Course storage c = courses[courseId];
        if (!c.active) revert CourseNotActive();
        if (isRegistered[courseId][msg.sender]) revert AlreadyRegistered();
        if (c.enrolled >= c.capacity) revert CourseFull();
        if (studentCourses[msg.sender].length >= MAX_COURSES_PER_STUDENT) revert CourseLimitReached();

        isRegistered[courseId][msg.sender] = true;
        studentCourses[msg.sender].push(courseId);
        courseStudents[courseId].push(msg.sender);
        c.enrolled++;
        emit StudentRegistered(courseId, msg.sender);
    }

    function withdraw(uint256 courseId) external courseExists(courseId) {
        if (!registrationOpen) revert RegistrationClosed();
        if (!isRegistered[courseId][msg.sender]) revert NotRegistered();

        isRegistered[courseId][msg.sender] = false;
        _remove(studentCourses[msg.sender], courseId);
        _removeAddr(courseStudents[courseId], msg.sender);
        courses[courseId].enrolled--;
        emit StudentWithdrawn(courseId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // View functions
    // ---------------------------------------------------------------------
    function getCourse(uint256 courseId) external view courseExists(courseId) returns (Course memory) {
        return courses[courseId];
    }

    function getStudentCourses(address student) external view returns (uint256[] memory) {
        return studentCourses[student];
    }

    function getCourseStudents(uint256 courseId) external view courseExists(courseId) returns (address[] memory) {
        return courseStudents[courseId];
    }

    function seatsLeft(uint256 courseId) external view courseExists(courseId) returns (uint256) {
        return courses[courseId].capacity - courses[courseId].enrolled;
    }

    // ---------------------------------------------------------------------
    // Internal helpers (swap-and-pop)
    // ---------------------------------------------------------------------
    function _remove(uint256[] storage arr, uint256 value) private {
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == value) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }

    function _removeAddr(address[] storage arr, address value) private {
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == value) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }
}
