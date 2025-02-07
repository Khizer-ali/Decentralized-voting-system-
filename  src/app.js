// Connect to Ethereum node (e.g., MetaMask)
if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}

// Replace with your contract's ABI and address
const contractABI = [ /* ABI from your compiled contract */ ];
const contractAddress = '0xYourContractAddress';

const votingSystem = new web3.eth.Contract(contractABI, contractAddress);

// Function to create an election
async function createElection() {
    const electionName = document.getElementById('electionName').value;
    const accounts = await web3.eth.getAccounts();
    await votingSystem.methods.createElection(electionName).send({ from: accounts[0] });
    alert('Election created successfully!');
}

// Function to add a candidate
async function addCandidate() {
    const electionId = document.getElementById('electionId').value;
    const candidateName = document.getElementById('candidateName').value;
    const accounts = await web3.eth.getAccounts();
    await votingSystem.methods.addCandidate(electionId, candidateName).send({ from: accounts[0] });
    alert('Candidate added successfully!');
}

// Function to vote
async function vote() {
    const electionId = document.getElementById('voteElectionId').value;
    const candidateId = document.getElementById('candidateId').value;
    const accounts = await web3.eth.getAccounts();
    await votingSystem.methods.vote(electionId, candidateId).send({ from: accounts[0] });
    alert('Vote cast successfully!');
}

// Function to get election results
async function getResults() {
    const electionId = document.getElementById('resultsElectionId').value;
    const results = await votingSystem.methods.getResults(electionId).call();
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.innerHTML = '';

    results.forEach(candidate => {
        const candidateInfo = document.createElement('div');
        candidateInfo.textContent = `Candidate ID: ${candidate.id}, Name: ${candidate.name}, Votes: ${candidate.voteCount}`;
        resultsDisplay.appendChild(candidateInfo);
    });
}

// Function to close an election
async function closeElection() {
    const electionId = document.getElementById('closeElectionId').value;
    const accounts = await web3.eth.getAccounts();
    await votingSystem.methods.closeElection(electionId).send({ from: accounts[0] });
    alert('Election closed successfully!');
}