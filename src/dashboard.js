let web3;
let votingContract;
let currentAccount;
let toast;

// Initialize the application
window.addEventListener('load', async () => {
    toast = new bootstrap.Toast(document.getElementById('toastNotification'));
    await initWeb3();
});

// Initialize Web3
async function initWeb3() {
    try {
        // Connect to local Ganache
        web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
        
        // Get the first account from Ganache
        const accounts = await web3.eth.getAccounts();
        currentAccount = accounts[0];

        // Load the contract
        const response = await fetch('VotingSystem.json');
        const contractJson = await response.json();
        
        votingContract = new web3.eth.Contract(
            contractJson.abi,
            contractJson.networks['5777'].address
        );

        showNotification('Connected to blockchain successfully', 'success');
    } catch (error) {
        showNotification('Failed to connect to blockchain: ' + error.message, 'danger');
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const toastElement = document.getElementById('toastNotification');
    const toastMessage = document.getElementById('toastMessage');
    toastElement.className = `toast text-white bg-${type}`;
    toastMessage.textContent = message;
    toast.show();
}

// Show/hide loading spinner
function toggleLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Navigation between steps
function showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show selected step
    document.getElementById(`step${stepNumber}`).classList.add('active');
    
    // Update progress bar
    document.getElementById('progressBar').style.width = `${stepNumber * 25}%`;
}

// Create Election
async function createElection(event) {
    event.preventDefault();
    toggleLoading(true);
    
    try {
        const electionName = document.getElementById('electionName').value;
        
        const result = await votingContract.methods.createElection(electionName)
            .send({ from: currentAccount, gas: 200000 });
        
        const electionId = result.events.ElectionCreated.returnValues.electionId;
        showNotification(`Election created successfully! Election ID: ${electionId}`, 'success');
        document.getElementById('electionName').value = '';
        
        // Move to next step
        showStep(2);
    } catch (error) {
        showNotification('Failed to create election: ' + error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
    return false;
}

// Add Candidate
async function addCandidate(event) {
    event.preventDefault();
    toggleLoading(true);
    
    try {
        const electionId = document.getElementById('candidateElectionId').value;
        const candidateName = document.getElementById('candidateName').value;
        
        const result = await votingContract.methods.addCandidate(electionId, candidateName)
            .send({ from: currentAccount, gas: 200000 });
        
        const candidateId = result.events.CandidateAdded.returnValues.candidateId;
        showNotification(`Candidate added successfully! Candidate ID: ${candidateId}`, 'success');
        document.getElementById('candidateName').value = '';
        
        // Update candidates list
        await updateCandidatesList(electionId);
    } catch (error) {
        showNotification('Failed to add candidate: ' + error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
    return false;
}

// Cast Vote
async function castVote(event) {
    event.preventDefault();
    toggleLoading(true);
    
    try {
        const electionId = document.getElementById('voteElectionId').value;
        const candidateId = document.getElementById('voteCandidateId').value;
        
        await votingContract.methods.vote(electionId, candidateId)
            .send({ from: currentAccount, gas: 200000 });
        
        showNotification('Vote cast successfully!', 'success');
        document.getElementById('voteForm').reset();
    } catch (error) {
        showNotification('Failed to cast vote: ' + error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
    return false;
}

// Get Results
async function getResults(event) {
    event.preventDefault();
    toggleLoading(true);
    
    try {
        const electionId = document.getElementById('resultsElectionId').value;
        const resultsDisplay = document.getElementById('resultsDisplay');
        
        // Get election details
        const election = await votingContract.methods.elections(electionId).call();
        
        let resultsHtml = `
            <div class="alert alert-info">
                <h6>Election: ${election.name}</h6>
                <p>Status: ${election.isActive ? 'Active' : 'Closed'}</p>
            </div>
            <div class="list-group">
        `;
        
        // Get results for each candidate
        for (let i = 1; i <= election.candidateCount; i++) {
            const candidate = await votingContract.methods.getCandidate(electionId, i).call();
            resultsHtml += `
                <div class="list-group-item">
                    <h6>Candidate ${candidate[0]}: ${candidate[1]}</h6>
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" 
                             style="width: ${(candidate[2] / election.candidateCount) * 100}%">
                            ${candidate[2]} votes
                        </div>
                    </div>
                </div>
            `;
        }
        
        resultsHtml += '</div>';
        resultsDisplay.innerHTML = resultsHtml;
    } catch (error) {
        showNotification('Failed to get results: ' + error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
    return false;
}

// Update Candidates List
async function updateCandidatesList(electionId) {
    try {
        const candidatesList = document.getElementById('candidatesList');
        const election = await votingContract.methods.elections(electionId).call();
        
        let listHtml = '<h6 class="mt-3">Current Candidates:</h6><div class="list-group">';
        
        for (let i = 1; i <= election.candidateCount; i++) {
            const candidate = await votingContract.methods.getCandidate(electionId, i).call();
            listHtml += `
                <div class="list-group-item">
                    <strong>ID ${candidate[0]}:</strong> ${candidate[1]}
                </div>
            `;
        }
        
        listHtml += '</div>';
        candidatesList.innerHTML = listHtml;
    } catch (error) {
        showNotification('Failed to update candidates list: ' + error.message, 'danger');
    }
} 