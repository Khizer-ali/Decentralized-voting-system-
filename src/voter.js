let web3;
let votingContract;
let currentAccount;
let toast;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize toast
        toast = new bootstrap.Toast(document.getElementById('toast'));
        
        // Initialize Web3 and contract
        await initWeb3();
        
        // Setup event listeners
        setupEventListeners();
        
        // Initial load of elections
        await updateElections();
        
        // Auto refresh elections every 10 seconds
        setInterval(updateElections, 10000);
        
        console.log('Voter interface initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        showNotification('Failed to initialize: ' + error.message);
    }
});

async function initWeb3() {
    try {
        // Check if MetaMask is installed
        if (window.ethereum) {
            web3 = new Web3(window.ethereum);
            try {
                // Request account access
                await window.ethereum.request({ method: 'eth_requestAccounts' });
            } catch (error) {
                throw new Error('User denied account access');
            }
        } else if (window.web3) {
            web3 = new Web3(window.web3.currentProvider);
        } else {
            web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
        }

        // Get accounts
        const accounts = await web3.eth.getAccounts();
        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found. Please check your blockchain connection.');
        }
        
        // Use the second account (index 1) as voter to avoid using admin account
        currentAccount = accounts[1]; 
        
        // Verify this account is not an admin
        const response = await fetch('./VotingSystem.json');
        if (!response.ok) {
            throw new Error('Failed to load contract JSON');
        }
        const contractJson = await response.json();
        
        const networkId = await web3.eth.net.getId();
        const deployedNetwork = contractJson.networks[networkId];
        
        if (!deployedNetwork) {
            throw new Error('Contract not deployed on this network. Please check your deployment.');
        }

        votingContract = new web3.eth.Contract(
            contractJson.abi,
            deployedNetwork.address
        );

        // Check if current account is admin
        const isAdmin = await votingContract.methods.admins(currentAccount).call();
        if (isAdmin) {
            // If current account is admin, try to use next non-admin account
            for (let i = 2; i < accounts.length; i++) {
                const isNextAdmin = await votingContract.methods.admins(accounts[i]).call();
                if (!isNextAdmin) {
                    currentAccount = accounts[i];
                    break;
                }
            }
        }

        console.log('Connected with voter account:', currentAccount);
        
        // Verify contract connection
        const count = await votingContract.methods.electionCount().call();
        console.log('Contract loaded successfully. Election count:', count);
        
        showNotification('Connected to voting system successfully');
        return true;
    } catch (error) {
        console.error('Web3 initialization error:', error);
        throw error;
    }
}

function setupEventListeners() {
    const electionSelect = document.getElementById('electionSelect');
    const candidateSelect = document.getElementById('candidateSelect');
    const voteForm = document.getElementById('voteForm');

    // Handle election selection
    electionSelect.addEventListener('change', async (e) => {
        try {
            const electionId = e.target.value;
            if (electionId) {
                await updateCandidates(electionId);
            } else {
                candidateSelect.innerHTML = '<option value="">First select an election...</option>';
            }
        } catch (error) {
            console.error('Error in election change:', error);
            showNotification('Failed to load candidates: ' + error.message);
        }
    });

    // Handle vote submission
    voteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await castVote();
    });

    // Handle completed election selection
    const completedElectionSelect = document.getElementById('completedElectionSelect');
    completedElectionSelect.addEventListener('change', async (e) => {
        if (e.target.value) {
            await displayResults(e.target.value);
        }
    });
}

async function updateElections() {
    const electionSelect = document.getElementById('electionSelect');
    const completedElectionSelect = document.getElementById('completedElectionSelect');
    
    try {
        const electionCount = await votingContract.methods.electionCount().call();
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Clear dropdowns
        electionSelect.innerHTML = '<option value="">Choose an active election...</option>';
        completedElectionSelect.innerHTML = '<option value="">Choose a completed election...</option>';
        
        let hasActiveElections = false;
        let hasCompletedElections = false;

        // Load elections
        for (let i = 1; i <= electionCount; i++) {
            const election = await votingContract.methods.elections(i).call();
            console.log('Election', i, ':', election);

            if (election.exists) {
                const hasVoted = await votingContract.methods.hasVoted(i, currentAccount).call();
                
                // Active elections
                if (election.isActive && 
                    currentTime >= parseInt(election.startTime) && 
                    currentTime <= parseInt(election.endTime) && 
                    !hasVoted) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = election.name;
                    electionSelect.appendChild(option);
                    hasActiveElections = true;
                }
                
                // Completed elections
                if (currentTime > parseInt(election.endTime)) {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = election.name;
                    completedElectionSelect.appendChild(option);
                    hasCompletedElections = true;
                }
            }
        }

        if (!hasActiveElections) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No active elections available';
            option.disabled = true;
            electionSelect.appendChild(option);
        }

        if (!hasCompletedElections) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No completed elections available';
            option.disabled = true;
            completedElectionSelect.appendChild(option);
        }
    } catch (error) {
        console.error('Error updating elections:', error);
        showNotification('Failed to load elections: ' + error.message);
    }
}

async function updateCandidates(electionId) {
    const candidateSelect = document.getElementById('candidateSelect');
    
    try {
        candidateSelect.innerHTML = '<option value="">Select a candidate...</option>';

        if (!electionId) return;

        const election = await votingContract.methods.elections(electionId).call();
        
        for (let i = 1; i <= election.candidateCount; i++) {
            const candidate = await votingContract.methods.getCandidate(electionId, i).call();
            if (candidate && candidate[1]) {
                const option = document.createElement('option');
                option.value = candidate[0];
                option.textContent = candidate[1];
                candidateSelect.appendChild(option);
            }
        }
    } catch (error) {
        console.error('Error updating candidates:', error);
        showNotification('Failed to load candidates: ' + error.message);
    }
}

async function castVote() {
    const electionId = document.getElementById('electionSelect').value;
    const candidateId = document.getElementById('candidateSelect').value;
    
    if (!electionId || !candidateId) {
        showNotification('Please select both an election and a candidate');
        return;
    }

    try {
        document.getElementById('loadingSpinner').style.display = 'block';
        
        // Verify account is not admin
        const isAdmin = await votingContract.methods.admins(currentAccount).call();
        if (isAdmin) {
            throw new Error('Admin accounts cannot vote. Please use a non-admin account.');
        }

        // Verify election is still active
        const election = await votingContract.methods.elections(electionId).call();
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (currentTime < parseInt(election.startTime)) {
            throw new Error('Voting has not started yet');
        }
        if (currentTime > parseInt(election.endTime)) {
            throw new Error('Voting has ended');
        }

        // Cast vote
        const result = await votingContract.methods.vote(electionId, candidateId)
            .send({ 
                from: currentAccount,
                gas: 200000
            });

        if (result.status) {
            showNotification('Your vote has been cast successfully!');
            document.getElementById('voteForm').reset();
            await updateElections();
        }
    } catch (error) {
        console.error('Voting error:', error);
        showNotification(error.message);
    } finally {
        document.getElementById('loadingSpinner').style.display = 'none';
    }
}

async function displayResults(electionId) {
    const resultsDisplay = document.getElementById('resultsDisplay');
    resultsDisplay.innerHTML = '<div class="text-center">Loading results...</div>';

    try {
        const election = await votingContract.methods.elections(electionId).call();
        let totalVotes = 0;
        const candidates = [];

        // Get all candidates and their votes
        for (let i = 1; i <= election.candidateCount; i++) {
            const candidate = await votingContract.methods.getCandidate(electionId, i).call();
            const votes = parseInt(candidate[2]);
            totalVotes += votes;
            candidates.push({
                name: candidate[1],
                votes: votes
            });
        }

        // Sort candidates by votes (descending)
        candidates.sort((a, b) => b.votes - a.votes);

        // Create results HTML
        let resultsHtml = `
            <h5 class="mb-4">Results for ${election.name}</h5>
            <div class="total-votes mb-3">Total Votes Cast: ${totalVotes}</div>
        `;

        candidates.forEach(candidate => {
            const percentage = totalVotes > 0 ? (candidate.votes * 100 / totalVotes).toFixed(1) : 0;
            resultsHtml += `
                <div class="candidate-result">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="candidate-name">${candidate.name}</div>
                        <div class="vote-count">
                            <span class="badge bg-primary">${candidate.votes} votes</span>
                        </div>
                    </div>
                    <div class="progress mt-2">
                        <div class="progress-bar" role="progressbar" 
                             style="width: ${percentage}%" 
                             aria-valuenow="${percentage}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            ${percentage}%
                        </div>
                    </div>
                </div>
            `;
        });

        resultsDisplay.innerHTML = resultsHtml;
    } catch (error) {
        console.error('Error displaying results:', error);
        resultsDisplay.innerHTML = `<div class="alert alert-danger">Failed to load results: ${error.message}</div>`;
    }
}

function showNotification(message) {
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.show();
} 