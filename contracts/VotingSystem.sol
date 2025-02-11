// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VotingSystem {
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
        bool exists;
    }

    struct Election {
        uint id;
        string name;
        bool isActive;
        uint candidateCount;
        uint startTime;
        uint endTime;
        mapping(uint => Candidate) candidates;
        mapping(address => bool) hasVoted;
        mapping(string => bool) candidateNames; // To track duplicate candidate names
        bool exists;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;
    mapping(string => bool) private electionNames; // To track duplicate election names
    mapping(address => bool) public admins;
    address public owner;

    // Events to track actions
    event ElectionCreated(uint electionId);
    event CandidateAdded(uint electionId, uint candidateId);
    event VoteCasted(uint electionId, uint candidateId, address voter);
    event ElectionClosed(uint electionId);

    constructor() {
        owner = msg.sender;
        admins[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admins can perform this action");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier electionExists(uint _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        _;
    }

    modifier electionActive(uint _electionId) {
        require(elections[_electionId].isActive, "Election is not active");
        _;
    }

    modifier votingOpen(uint _electionId) {
        require(block.timestamp >= elections[_electionId].startTime, "Voting has not started yet");
        require(block.timestamp <= elections[_electionId].endTime, "Voting has ended");
        _;
    }

    modifier canAddCandidates(uint _electionId) {
        require(block.timestamp < elections[_electionId].startTime, "Cannot add candidates after voting has started");
        _;
    }

    function addAdmin(address _admin) public onlyOwner {
        admins[_admin] = true;
    }

    function removeAdmin(address _admin) public onlyOwner {
        require(_admin != owner, "Cannot remove owner from admins");
        admins[_admin] = false;
    }

    function createElection(string memory _name, uint _startTime, uint _endTime) public onlyAdmin {
        require(bytes(_name).length > 0 && bytes(_name).length <= 32, "Election name must be between 1 and 32 characters");
        require(!electionNames[_name], "Election with this name already exists");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        require(_endTime - _startTime <= 30 days, "Election duration cannot exceed 30 days");
        
        electionCount++;
        Election storage election = elections[electionCount];
        election.id = electionCount;
        election.name = _name;
        election.isActive = true;
        election.exists = true;
        election.startTime = _startTime;
        election.endTime = _endTime;
        electionNames[_name] = true;
        
        emit ElectionCreated(electionCount);
    }

    function addCandidate(uint _electionId, string memory _name) public 
        onlyAdmin 
        electionExists(_electionId) 
        electionActive(_electionId)
        canAddCandidates(_electionId)
    {
        require(bytes(_name).length > 0 && bytes(_name).length <= 32, "Candidate name must be between 1 and 32 characters");
        Election storage election = elections[_electionId];
        require(!election.candidateNames[_name], "Candidate with this name already exists");
        require(election.candidateCount < 20, "Maximum candidate limit reached");
        
        election.candidateCount++;
        election.candidates[election.candidateCount] = Candidate(
            election.candidateCount,
            _name,
            0,
            true
        );
        election.candidateNames[_name] = true;
        
        emit CandidateAdded(_electionId, election.candidateCount);
    }

    function vote(uint _electionId, uint _candidateId) public 
        electionExists(_electionId)
        electionActive(_electionId)
        votingOpen(_electionId)
    {
        require(!admins[msg.sender], "Admins cannot vote");
        Election storage election = elections[_electionId];
        require(!election.hasVoted[msg.sender], "You have already voted");
        require(_candidateId > 0 && _candidateId <= election.candidateCount, "Invalid candidate");
        require(election.candidates[_candidateId].exists, "Candidate does not exist");

        election.hasVoted[msg.sender] = true;
        election.candidates[_candidateId].voteCount++;

        emit VoteCasted(_electionId, _candidateId, msg.sender);
    }

    function getCandidate(uint _electionId, uint _candidateId) public view 
        electionExists(_electionId)
        returns (uint, string memory, uint) 
    {
        require(_candidateId > 0 && _candidateId <= elections[_electionId].candidateCount, "Invalid candidate ID");
        Candidate storage candidate = elections[_electionId].candidates[_candidateId];
        require(candidate.exists, "Candidate does not exist");
        return (candidate.id, candidate.name, candidate.voteCount);
    }

    function closeElection(uint _electionId) public electionExists(_electionId) {
        require(elections[_electionId].isActive, "Election is already closed");
        elections[_electionId].isActive = false;
        emit ElectionClosed(_electionId);
    }

    function hasVoted(uint _electionId, address _voter) public view 
        electionExists(_electionId) 
        returns (bool) 
    {
        return elections[_electionId].hasVoted[_voter];
    }
}
