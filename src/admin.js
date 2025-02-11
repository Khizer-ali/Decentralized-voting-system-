let web3;
let votingContract;
let currentAccount;
let toast;

// Initialize the application
window.addEventListener('load', async () => {
    toast = new bootstrap.Toast(document.getElementById('toastNotification'));
    await initWeb3();
    await updateElectionDropdown();
});

// Initialize Web3
async function initWeb3() {
    try {
        web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
        const accounts = await web3.eth.getAccounts();
        currentAccount = accounts[0]; // Use first account as admin

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

// Show/hide sections
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

// Create Election
async function createElection(event) {
    event.preventDefault();
    
    try {
        const name = document.getElementById('electionName').value.trim();
        const startTime = Math.floor(new Date(document.getElementById('startTime').value).getTime() / 1000);
        const endTime = Math.floor(new Date(document.getElementById('endTime').value).getTime() / 1000);
        
        // Validate inputs
        if (!name) {
            throw new Error('Election name cannot be empty');
        }
        
        if (startTime >= endTime) {
            throw new Error('End time must be after start time');
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (startTime <= currentTime) {
            throw new Error('Start time must be in the future');
        }

        const form = document.getElementById('createElectionForm');
        form.querySelectorAll('input, button').forEach(el => el.disabled = true);
        toggleLoading(true);

        const result = await votingContract.methods.createElection(name, startTime, endTime)
            .send({ 
                from: currentAccount,
                gas: 2000000
            });

        if (result.status) {
            showNotification('Election created successfully!', 'success');
            form.reset();
            await updateElectionDropdown();
        }
    } catch (error) {
        let errorMessage = error.message;
        if (error.message.includes("revert")) {
            if (error.message.includes("Election with this name already exists")) {
                errorMessage = "An election with this name already exists";
            } else if (error.message.includes("Invalid time range")) {
                errorMessage = "Invalid election time range";
            }
        }
        showNotification('Failed to create election: ' + errorMessage, 'danger');
    } finally {
        const form = document.getElementById('createElectionForm');
        form.querySelectorAll('input, button').forEach(el => el.disabled = false);
        toggleLoading(false);
    }
    return false;
}

// Add Candidate
async function addCandidate(event) {
    event.preventDefault();
    
    try {
        const electionId = document.getElementById('candidateElectionId').value;
        const candidateName = document.getElementById('candidateName').value.trim();
        
        // Validate inputs
        if (!electionId) {
            throw new Error('Please select an election');
        }

        if (!candidateName) {
            throw new Error('Candidate name cannot be empty');
        }

        // Check if election exists and is still accepting candidates
        const election = await votingContract.methods.elections(electionId).call();
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (!election.exists) {
            throw new Error('Selected election does not exist');
        }

        if (currentTime >= election.startTime) {
            throw new Error('Cannot add candidates after voting has started');
        }

        // Check candidate count
        if (election.candidateCount >= 20) {
            throw new Error('Maximum number of candidates (20) reached');
        }

        const form = document.getElementById('addCandidateForm');
        form.querySelectorAll('input, button, select').forEach(el => el.disabled = true);
        toggleLoading(true);

        const result = await votingContract.methods.addCandidate(electionId, candidateName)
            .send({ 
                from: currentAccount,
                gas: 1000000
            });

        if (result.status) {
            showNotification('Candidate added successfully!', 'success');
            document.getElementById('candidateName').value = '';
            await updateCandidatesList(electionId);
        }
    } catch (error) {
        let errorMessage = error.message;
        if (error.message.includes("revert")) {
            if (error.message.includes("Candidate with this name already exists")) {
                errorMessage = "A candidate with this name already exists in this election";
            } else if (error.message.includes("Election not active")) {
                errorMessage = "This election is not active";
            } else if (error.message.includes("Voting has started")) {
                errorMessage = "Cannot add candidates after voting has started";
            }
        }
        showNotification('Failed to add candidate: ' + errorMessage, 'danger');
    } finally {
        const form = document.getElementById('addCandidateForm');
        form.querySelectorAll('input, button, select').forEach(el => el.disabled = false);
        toggleLoading(false);
    }
    return false;
}

// Update election dropdown
async function updateElectionDropdown() {
    try {
        const electionCount = await votingContract.methods.electionCount().call();
        const dropdown = document.getElementById('candidateElectionId');
        const resultsDropdown = document.getElementById('resultsElectionId');
        
        if (dropdown) dropdown.innerHTML = '<option value="">Choose an active election...</option>';
        if (resultsDropdown) resultsDropdown.innerHTML = '<option value="">Choose an election...</option>';

        const currentTime = Math.floor(Date.now() / 1000);

        for (let i = 1; i <= electionCount; i++) {
            const election = await votingContract.methods.elections(i).call();
            if (election.exists) {
                const option = new Option(`Election #${i}: ${election.name}`, i);
                
                // For adding candidates, only show elections that haven't started
                if (dropdown && currentTime < election.startTime) {
                    dropdown.add(option.cloneNode(true));
                }
                
                // For results, show all elections
                if (resultsDropdown) {
                    resultsDropdown.add(option.cloneNode(true));
                }
            }
        }
    } catch (error) {
        showNotification('Failed to load elections: ' + error.message, 'danger');
    }
}

// Update candidates list
async function updateCandidatesList(electionId) {
    try {
        const candidatesList = document.getElementById('candidatesList');
        if (!electionId) {
            candidatesList.innerHTML = '';
            return;
        }

        const election = await votingContract.methods.elections(electionId).call();
        
        let html = '<h5 class="mt-4">Current Candidates</h5>';
        if (election.candidateCount === 0) {
            html += '<p>No candidates added yet</p>';
        } else {
            html += '<ul class="list-group">';
            for (let i = 1; i <= election.candidateCount; i++) {
                const candidate = await votingContract.methods.getCandidate(electionId, i).call();
                html += `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        ${candidate[1]}
                        <span class="badge bg-secondary">#${i}</span>
                    </li>`;
            }
            html += '</ul>';
        }
        candidatesList.innerHTML = html;
    } catch (error) {
        console.error('Error updating candidates list:', error);
        candidatesList.innerHTML = '<p class="text-danger">Error loading candidates</p>';
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

// Toggle loading spinner
function toggleLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Add event listener for election dropdown
document.getElementById('candidateElectionId')?.addEventListener('change', function() {
    updateCandidatesList(this.value);
});

// Get Results
async function getResults(event) {
    event.preventDefault();
    
    try {
        const electionId = document.getElementById('resultsElectionId').value;
        if (!electionId) {
            throw new Error('Please select an election');
        }

        const election = await votingContract.methods.elections(electionId).call();
        const currentTime = Math.floor(Date.now() / 1000);
        const resultsDisplay = document.getElementById('resultsDisplay');
        
        let html = `<h4 class="mt-4">Results for ${election.name}</h4>`;
        
        if (currentTime < election.endTime && election.isActive) {
            html += '<div class="alert alert-warning">This election is still ongoing. Final results will be available after the election ends.</div>';
        }

        if (election.candidateCount === 0) {
            html += '<p>No candidates in this election</p>';
        } else {
            html += '<div class="list-group mt-3">';
            let totalVotes = 0;
            const candidates = [];

            // First, get all candidates and calculate total votes
            for (let i = 1; i <= election.candidateCount; i++) {
                const candidate = await votingContract.methods.getCandidate(electionId, i).call();
                totalVotes += parseInt(candidate[2]);
                candidates.push({
                    name: candidate[1],
                    votes: parseInt(candidate[2])
                });
            }

            // Sort candidates by votes in descending order
            candidates.sort((a, b) => b.votes - a.votes);

            // Display candidates with vote percentages
            candidates.forEach(candidate => {
                const percentage = totalVotes > 0 ? (candidate.votes * 100 / totalVotes).toFixed(2) : 0;
                html += `
                    <div class="list-group-item">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="mb-1">${candidate.name}</h5>
                            <span class="badge bg-primary rounded-pill">${candidate.votes} votes</span>
                        </div>
                        <div class="progress mt-2" style="height: 20px;">
                            <div class="progress-bar bg-success" role="progressbar" 
                                 style="width: ${percentage}%;" 
                                 aria-valuenow="${percentage}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                                ${percentage}%
                            </div>
                        </div>
                    </div>`;
            });

            html += `</div>
                    <div class="mt-3">
                        <strong>Total Votes Cast: ${totalVotes}</strong>
                    </div>`;
        }

        resultsDisplay.innerHTML = html;
    } catch (error) {
        showNotification('Failed to get results: ' + error.message, 'danger');
    }
    return false;
}