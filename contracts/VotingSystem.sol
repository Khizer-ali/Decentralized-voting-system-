// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VotingSystem {
    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    struct Election {
        uint id;
        string name;
        bool isActive;
        uint candidateCount;
        mapping(uint => Candidate) candidates;
        mapping(address => bool) hasVoted;
    }

    uint public electionCount;
    mapping(uint => Election) public elections;

    // Events to track actions
    event ElectionCreated(uint electionId, string name);
    event CandidateAdded(uint electionId, uint candidateId, string name);
    event VoteCasted(uint electionId, uint candidateId, address voter);
    event ElectionClosed(uint electionId);

    modifier onlyActiveElection(uint _electionId) {
        require(elections[_electionId].isActive, "Election is not active");
        _;
    }

    function createElection(string memory _name) public {
        electionCount++;
        Election storage newElection = elections[electionCount];
        newElection.id = electionCount;
        newElection.name = _name;
        newElection.isActive = true;

        emit ElectionCreated(electionCount, _name);
    }

    function addCandidate(uint _electionId, string memory _name) public onlyActiveElection(_electionId) {
        Election storage election = elections[_electionId];
        election.candidateCount++;
        election.candidates[election.candidateCount] = Candidate(election.candidateCount, _name, 0);

        emit CandidateAdded(_electionId, election.candidateCount, _name);
    }

    function vote(uint _electionId, uint _candidateId) public onlyActiveElection(_electionId) {
        Election storage election = elections[_electionId];
        require(!election.hasVoted[msg.sender], "You have already voted");
        require(_candidateId > 0 && _candidateId <= election.candidateCount, "Invalid candidate");

        election.hasVoted[msg.sender] = true;
        election.candidates[_candidateId].voteCount++;

        emit VoteCasted(_electionId, _candidateId, msg.sender);
    }

    function getCandidate(uint _electionId, uint _candidateId) public view returns (uint, string memory, uint) {
        Candidate storage candidate = elections[_electionId].candidates[_candidateId];
        return (candidate.id, candidate.name, candidate.voteCount);
    }

    function closeElection(uint _electionId) public {
        elections[_electionId].isActive = false;
        emit ElectionClosed(_electionId);
    }
}
