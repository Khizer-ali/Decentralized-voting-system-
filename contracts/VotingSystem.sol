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
        mapping(uint => Candidate) candidates;
        mapping(address => bool) hasVoted;
        mapping(string => bool) candidateNames; // To track duplicate candidate names
        bool exists;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;
    mapping(string => bool) private electionNames; // To track duplicate election names

    // Events to track actions
    event ElectionCreated(uint electionId);
    event CandidateAdded(uint electionId, uint candidateId);
    event VoteCasted(uint electionId, uint candidateId, address voter);
    event ElectionClosed(uint electionId);

    modifier electionExists(uint _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        _;
    }

    modifier electionActive(uint _electionId) {
        require(elections[_electionId].isActive, "Election is not active");
        _;
    }

    function createElection(string memory _name) public {
        require(bytes(_name).length > 0, "Election name cannot be empty");
        require(!electionNames[_name], "Election with this name already exists");
        
        electionCount++;
        Election storage election = elections[electionCount];
        election.id = electionCount;
        election.name = _name;
        election.isActive = true;
        election.exists = true;
        electionNames[_name] = true;
        
        emit ElectionCreated(electionCount);
    }

    function addCandidate(uint _electionId, string memory _name) public 
        electionExists(_electionId) 
        electionActive(_electionId) 
    {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");
        Election storage election = elections[_electionId];
        require(!election.candidateNames[_name], "Candidate with this name already exists");
        
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
    {
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
}
