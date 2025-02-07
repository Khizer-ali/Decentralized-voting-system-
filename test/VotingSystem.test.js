const VotingSystem = artifacts.require("VotingSystem");

contract("VotingSystem", (accounts) => {
    let votingInstance;

    beforeEach(async () => {
        votingInstance = await VotingSystem.new();
    });

    it("should create an election", async () => {
        let result = await votingInstance.createElection("Presidential Election");
        assert.equal(result.logs[0].event, "ElectionCreated", "ElectionCreated event should be emitted");
    });

    it("should add a candidate to an election", async () => {
        await votingInstance.createElection("Presidential Election");
        let result = await votingInstance.addCandidate(1, "Alice");
        assert.equal(result.logs[0].event, "CandidateAdded", "CandidateAdded event should be emitted");
    });

    it("should allow a user to vote", async () => {
        await votingInstance.createElection("Presidential Election");
        await votingInstance.addCandidate(1, "Alice");

        let result = await votingInstance.vote(1, 1, { from: accounts[0] });
        assert.equal(result.logs[0].event, "VoteCasted", "VoteCasted event should be emitted");
    });

    it("should not allow double voting", async () => {
        await votingInstance.createElection("Presidential Election");
        await votingInstance.addCandidate(1, "Alice");

        await votingInstance.vote(1, 1, { from: accounts[0] });
        try {
            await votingInstance.vote(1, 1, { from: accounts[0] });
            assert.fail("Expected revert not received");
        } catch (error) {
            assert.include(error.message, "You have already voted", "Expected revert error for double voting");
        }
    });

    it("should return election results", async () => {
        await votingInstance.createElection("Presidential Election");
        await votingInstance.addCandidate(1, "Alice");
        await votingInstance.vote(1, 1, { from: accounts[0] });

        let candidate = await votingInstance.getCandidate(1, 1);
        assert.equal(candidate[2].toNumber(), 1, "Candidate should have one vote");
    });

    it("should close an election", async () => {
        await votingInstance.createElection("Presidential Election");
        await votingInstance.closeElection(1);
        let election = await votingInstance.elections(1);
        assert.equal(election.isActive, false, "Election should be closed");
    });
});
