let web3;
let votingContract;
let currentAccount;
let toast;
let currentRole = 'voter';
let isAdmin = false;

// Initialize the application
window.addEventListener('load', async () => {
    toast = new bootstrap.Toast(document.getElementById('toastNotification'));
    await initWeb3();
    await updateElectionDropdown(); // Initial load of dropdown
    preventDoubleSubmission('addCandidateForm');
    preventDoubleSubmission('createElectionForm');
    preventDoubleSubmission('voteForm');
    preventDoubleSubmission('resultsForm');
    
    // Check if user is admin
    isAdmin = await votingContract.methods.admins(currentAccount).call();
    
    // Set initial role - if admin, start in admin mode, otherwise voter mode
    currentRole = isAdmin ? 'admin' : 'voter';
    await switchRole(currentRole);

    // Set minimum datetime for election creation
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1); // Set minimum time to 1 minute from now
    
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    
    if (startTimeInput && endTimeInput) {
        // Format datetime for input
        const minDateTime = now.toISOString().slice(0, 16);
        startTimeInput.min = minDateTime;
        endTimeInput.min = minDateTime;
        
        // Set default values
        startTimeInput.value = minDateTime;
        
        // Set default end time to 24 hours after start time
        const defaultEnd = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        endTimeInput.value = defaultEnd.toISOString().slice(0, 16);
        
        // Update end time min value when start time changes
        startTimeInput.addEventListener('change', function() {
            const newStartTime = new Date(this.value);
            const minEndTime = new Date(newStartTime.getTime() + (60 * 1000)); // At least 1 minute after start
            endTimeInput.min = minEndTime.toISOString().slice(0, 16);
            
            // If current end time is before new start time, update it
            if (new Date(endTimeInput.value) <= newStartTime) {
                const newEndTime = new Date(newStartTime.getTime() + (24 * 60 * 60 * 1000));
                endTimeInput.value = newEndTime.toISOString().slice(0, 16);
            }
        });
    }
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
    document.querySelectorAll('.step-content').forEach(step => {
        step.classList.remove('active');
    });
    
    document.getElementById(`step${stepNumber}`).classList.add('active');
    document.getElementById('progressBar').style.width = `${Math.min(stepNumber * 20, 100)}%`;

    // Load active elections when switching to that tab
    if (stepNumber === 5) {
        loadActiveElections();
    }
    // Update dropdowns when switching to relevant tabs
    if (stepNumber === 2 || stepNumber === 3) {
        updateElectionDropdown();
    }
}

// Create Election
async function createElection(event) {
    event.preventDefault();
    if (!isAdmin) {
        showNotification('Only admins can create elections', 'danger');
        return false;
    }

    try {
        const electionName = document.getElementById('electionName').value.trim();
        // Get the input values
        const startDateTime = document.getElementById('startTime').value;
        const endDateTime = document.getElementById('endTime').value;
        
        if (!startDateTime || !endDateTime) {
            throw new Error('Please select both start and end times');
        }
        
        // Convert to Unix timestamps (seconds)
        const startTime = Math.floor(new Date(startDateTime).getTime() / 1000);
        const endTime = Math.floor(new Date(endDateTime).getTime() / 1000);
        const currentTime = Math.floor(Date.now() / 1000);
        
        // Validate times
        if (startTime <= currentTime) {
            throw new Error('Start time must be in the future');
        }
        
        if (endTime <= startTime) {
            throw new Error('End time must be after start time');
        }
        
        const thirtyDays = 30 * 24 * 60 * 60; // 30 days in seconds
        if (endTime - startTime > thirtyDays) {
            throw new Error('Election duration cannot exceed 30 days');
        }

        // Disable form while processing
        const form = document.getElementById('createElectionForm');
        form.querySelectorAll('input, button').forEach(el => el.disabled = true);
        toggleLoading(true);

        // Create election
        const result = await votingContract.methods.createElection(electionName, startTime, endTime)
            .send({ 
                from: currentAccount,
                gas: 500000
            });

        if (result.status) {
            showNotification('Election created successfully!', 'success');
            form.reset();
            await updateElectionDropdown();
            showStep(2); // Move to add candidates step
        }
    } catch (error) {
        showNotification('Failed to create election: ' + error.message, 'danger');
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
        
        if (!electionId) {
            throw new Error('Please select an election');
        }
        if (!candidateName) {
            throw new Error('Candidate name cannot be empty');
        }

        // Check if election exists and if voting has started
        const election = await votingContract.methods.elections(electionId).call();
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (currentTime >= election.startTime) {
            throw new Error('Cannot add candidates after voting has started');
        }

        // Disable the form while processing
        const form = document.getElementById('addCandidateForm');
        form.querySelectorAll('input, button, select').forEach(el => el.disabled = true);
        toggleLoading(true);

        // Check if candidate already exists in this election
        for (let i = 1; i <= election.candidateCount; i++) {
            const candidate = await votingContract.methods.getCandidate(electionId, i).call();
            if (candidate[1] === candidateName) {
                throw new Error('Candidate with this name already exists in this election');
            }
        }

        // Add candidate
        const result = await votingContract.methods.addCandidate(electionId, candidateName)
            .send({ 
                from: currentAccount, 
                gas: 300000  // Increased gas limit
            });

        if (result.status) {
            showNotification(`Candidate "${candidateName}" added successfully!`, 'success');
            form.reset();
            await updateCandidatesList(electionId);
            document.getElementById('candidateElectionId').value = electionId; // Restore election selection
        }
    } catch (error) {
        showNotification('Failed to add candidate: ' + error.message, 'danger');
    } finally {
        const form = document.getElementById('addCandidateForm');
        form.querySelectorAll('input, button, select').forEach(el => el.disabled = false);
        toggleLoading(false);
    }
    return false;
}

// Cast Vote
async function castVote(event) {
    event.preventDefault();
    
    try {
        // Check if user is admin
        const isUserAdmin = await votingContract.methods.admins(currentAccount).call();
        if (isUserAdmin) {
            throw new Error('Administrators cannot vote. Please use a different account for voting.');
        }

        const electionId = document.getElementById('voteElectionId').value;
        const candidateId = document.getElementById('voteCandidateId').value;
        
        if (!electionId || !candidateId) {
            throw new Error('Please select both an election and a candidate');
        }

        // Check if voting is open
        const election = await votingContract.methods.elections(electionId).call();
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (currentTime < election.startTime) {
            throw new Error('Voting has not started yet');
        }
        if (currentTime > election.endTime) {
            throw new Error('Voting has ended');
        }

        // Disable form while processing
        const form = document.getElementById('voteForm');
        form.querySelectorAll('input, button, select').forEach(el => el.disabled = true);
        toggleLoading(true);

        const result = await votingContract.methods.vote(electionId, candidateId)
            .send({ 
                from: currentAccount, 
                gas: 200000 
            });

        if (result.status) {
            showNotification('Vote cast successfully!', 'success');
            form.reset();
            document.getElementById('voteCandidateId').innerHTML = '<option value="">First select an election...</option>';
        }
    } catch (error) {
        showNotification('Failed to cast vote: ' + error.message, 'danger');
    } finally {
        const form = document.getElementById('voteForm');
        form.querySelectorAll('input, button, select').forEach(el => el.disabled = false);
        toggleLoading(false);
    }
    return false;
}

// Get Results
async function getResults(event) {
    if (event.preventDefault) {
        event.preventDefault();
    }
    
    try {
        const electionId = document.getElementById('resultsElectionId').value;
        if (!electionId) {
            throw new Error('Please enter an election ID');
        }

        // Hide the form and show loading
        const form = document.getElementById('resultsForm');
        form.style.display = 'none';
        toggleLoading(true);

        const election = await votingContract.methods.elections(electionId).call();
        const resultsDisplay = document.getElementById('resultsDisplay');

        if (!election.id || election.id === '0') {
            throw new Error('Election not found');
        }

        let resultsHtml = `
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Results for Election #${election.id}: ${election.name}</h5>
                    <button class="btn btn-primary btn-sm" onclick="backToResultsForm()">
                        <i class="fas fa-arrow-left me-1"></i>Back
                    </button>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <span class="badge bg-${election.isActive ? 'success' : 'danger'}">
                            ${election.isActive ? 'Active' : 'Closed'}
                        </span>
                    </div>
                    <div class="list-group">
        `;

        // Get all candidates and their votes
        const candidates = [];
        let totalVotes = 0;
        
        for (let i = 1; i <= election.candidateCount; i++) {
            const candidate = await votingContract.methods.getCandidate(electionId, i).call();
            candidates.push({
                id: candidate[0],
                name: candidate[1],
                votes: parseInt(candidate[2])
            });
            totalVotes += parseInt(candidate[2]);
        }

        // Sort candidates by votes (descending)
        candidates.sort((a, b) => b.votes - a.votes);

        // Add each candidate's results
        candidates.forEach(candidate => {
            const percentage = totalVotes > 0 ? (candidate.votes / totalVotes * 100).toFixed(1) : 0;
            resultsHtml += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <strong>Candidate #${candidate.id}: ${candidate.name}</strong>
                        <span class="badge bg-primary rounded-pill">${candidate.votes} votes</span>
                    </div>
                    <div class="progress" style="height: 20px;">
                        <div class="progress-bar" role="progressbar" 
                             style="width: ${percentage}%;" 
                             aria-valuenow="${percentage}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            ${percentage}%
                        </div>
                    </div>
                </div>
            `;
        });

        resultsHtml += `
                    </div>
                    <div class="mt-3">
                        <small class="text-muted">Total Votes: ${totalVotes}</small>
                    </div>
                </div>
            </div>
        `;

        resultsDisplay.innerHTML = resultsHtml;
    } catch (error) {
        showNotification('Failed to get results: ' + error.message, 'danger');
        // Show the form again in case of error
        document.getElementById('resultsForm').style.display = 'block';
    } finally {
        toggleLoading(false);
    }
    return false;
}

// Add this function to handle going back to the form
function backToResultsForm() {
    document.getElementById('resultsForm').style.display = 'block';
    document.getElementById('resultsDisplay').innerHTML = '';
    document.getElementById('resultsElectionId').value = '';
}

// Update Candidates List
async function updateCandidatesList(electionId) {
    try {
        const candidatesList = document.getElementById('candidatesList');
        const election = await votingContract.methods.elections(electionId).call();
        
        if (!election.id || election.id === '0') {
            candidatesList.innerHTML = '<div class="alert alert-warning">Election not found</div>';
            return;
        }

        let listHtml = `
            <div class="alert alert-info mb-3">
                <h6 class="mb-0">Election: ${election.name}</h6>
                <small>Total Candidates: ${election.candidateCount}</small>
            </div>
            <div class="list-group">
        `;
        
        // Get all candidates
        const candidatePromises = [];
        for (let i = 1; i <= election.candidateCount; i++) {
            candidatePromises.push(votingContract.methods.getCandidate(electionId, i).call());
        }
        
        const candidates = await Promise.all(candidatePromises);
        
        candidates.forEach(candidate => {
            listHtml += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>ID ${candidate[0]}:</strong> ${candidate[1]}
                    </div>
                    <span class="badge bg-primary rounded-pill">${candidate[2]} votes</span>
                </div>
            `;
        });
        
        listHtml += '</div>';
        candidatesList.innerHTML = listHtml;
    } catch (error) {
        console.error('Error updating candidates list:', error);
        showNotification('Failed to update candidates list: ' + error.message, 'danger');
    }
}

// Add new functions for managing active elections
async function loadActiveElections() {
    toggleLoading(true);
    try {
        const electionCount = await votingContract.methods.electionCount().call();
        const activeElectionsList = document.getElementById('activeElectionsList');
        activeElectionsList.innerHTML = '';

        // Create a Set to store unique election IDs
        const addedElections = new Set();

        if (electionCount == 0) {
            activeElectionsList.innerHTML = '<div class="alert alert-info">No elections found.</div>';
            return;
        }

        for (let i = 1; i <= electionCount; i++) {
            const election = await votingContract.methods.elections(i).call();
            if (election.id != 0 && !addedElections.has(election.id)) { // Check if election exists and hasn't been added
                addedElections.add(election.id);
                const candidateCount = election.candidateCount;
                
                const card = document.createElement('div');
                card.className = 'card mb-3';
                card.innerHTML = `
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h5 class="card-title">Election #${election.id}: ${election.name}</h5>
                                <p class="card-text mb-2">
                                    <span class="badge bg-${election.isActive ? 'success' : 'danger'}">
                                        ${election.isActive ? 'Active' : 'Closed'}
                                    </span>
                                    <span class="badge bg-info ms-2">
                                        ${candidateCount} Candidates
                                    </span>
                                </p>
                            </div>
                            <div class="btn-group">
                                <button class="btn btn-outline-primary btn-sm" 
                                        onclick="viewElectionDetails(${election.id})">
                                    <i class="fas fa-eye me-1"></i>View
                                </button>
                                ${election.isActive ? `
                                    <button class="btn btn-outline-danger btn-sm" 
                                            onclick="closeElection(${election.id})">
                                        <i class="fas fa-lock me-1"></i>Close
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
                activeElectionsList.appendChild(card);
            }
        }

        // If no elections found after filtering
        if (addedElections.size === 0) {
            activeElectionsList.innerHTML = '<div class="alert alert-info">No elections found.</div>';
        }
    } catch (error) {
        showNotification('Failed to load elections: ' + error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

async function viewElectionDetails(electionId) {
    document.getElementById('resultsElectionId').value = electionId;
    showStep(4);
    await getResults({ preventDefault: () => {} });
}

async function closeElection(electionId) {
    if (!confirm('Are you sure you want to close this election?')) {
        return;
    }

    toggleLoading(true);
    try {
        await votingContract.methods.closeElection(electionId)
            .send({ 
                from: currentAccount, 
                gas: 200000 
            });
        
        showNotification('Election closed successfully!', 'success');
        await loadActiveElections(); // Refresh the list
    } catch (error) {
        showNotification('Failed to close election: ' + error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Also add this helper function to prevent double form submissions
function preventDoubleSubmission(formId) {
    const form = document.getElementById(formId);
    const submitButton = form.querySelector('button[type="submit"]');
    
    form.addEventListener('submit', () => {
        submitButton.disabled = true;
        setTimeout(() => {
            submitButton.disabled = false;
        }, 5000); // Re-enable after 5 seconds in case of error
    });
}

// Add this helper function
async function checkElectionStatus(electionId) {
    const election = await votingContract.methods.elections(electionId).call();
    const currentTime = Math.floor(Date.now() / 1000);
    
    if (!election.exists) {
        throw new Error('Election does not exist');
    }
    
    if (!election.isActive) {
        throw new Error('Election is not active');
    }
    
    return {
        hasStarted: currentTime >= election.startTime,
        hasEnded: currentTime > election.endTime,
        startTime: election.startTime,
        endTime: election.endTime
    };
}

// Function to update election dropdown
async function updateElectionDropdown() {
    try {
        const electionCount = await votingContract.methods.electionCount().call();
        const candidateDropdown = document.getElementById('candidateElectionId');
        const voteDropdown = document.getElementById('voteElectionId');
        
        // Clear dropdowns
        if (candidateDropdown) {
            candidateDropdown.innerHTML = '<option value="">Choose an active election...</option>';
        }
        if (voteDropdown) {
            voteDropdown.innerHTML = '<option value="">Choose an active election...</option>';
        }

        // Create a Map to store unique elections
        const uniqueElections = new Map();

        // Get current timestamp
        const currentTime = Math.floor(Date.now() / 1000);

        // Collect all valid elections
        for (let i = 1; i <= electionCount; i++) {
            const election = await votingContract.methods.elections(i).call();
            const status = await checkElectionStatus(i).catch(() => null);
            
            if (status && election.exists && election.isActive) {
                const electionId = election.id.toString();
                
                // For admin, show all active elections
                // For voters, only show elections within voting period
                if (currentRole === 'admin' || 
                    (currentTime >= election.startTime && currentTime <= election.endTime)) {
                    
                    if (!uniqueElections.has(electionId)) {
                        uniqueElections.set(electionId, {
                            id: electionId,
                            name: election.name,
                            startTime: election.startTime,
                            endTime: election.endTime
                        });
                    }
                }
            }
        }

        // Convert to array and sort by ID
        const sortedElections = Array.from(uniqueElections.values())
            .sort((a, b) => Number(a.id) - Number(b.id));

        // Add to dropdowns
        sortedElections.forEach(election => {
            const optionText = `Election #${election.id}: ${election.name}`;
            
            if (currentRole === 'admin' && candidateDropdown) {
                candidateDropdown.add(new Option(optionText, election.id));
            }
            
            if (voteDropdown) {
                const option = new Option(optionText, election.id);
                voteDropdown.add(option);
                
                // Add timing information for voters
                if (currentRole === 'voter') {
                    const startDate = new Date(election.startTime * 1000).toLocaleString();
                    const endDate = new Date(election.endTime * 1000).toLocaleString();
                    option.title = `Voting period: ${startDate} to ${endDate}`;
                }
            }
        });

        // Handle empty state
        if (sortedElections.length === 0) {
            const noElectionOption = new Option("No active elections available", "");
            noElectionOption.disabled = true;
            
            if (currentRole === 'admin' && candidateDropdown) {
                candidateDropdown.add(noElectionOption.cloneNode(true));
            }
            if (voteDropdown) {
                voteDropdown.add(noElectionOption.cloneNode(true));
            }
        }
    } catch (error) {
        console.error('Error updating election dropdown:', error);
        showNotification('Failed to load elections: ' + error.message, 'danger');
    }
}

// Add this new function to update candidate dropdown
async function updateCandidateDropdown(electionId) {
    try {
        const dropdown = document.getElementById('voteCandidateId');
        dropdown.innerHTML = '<option value="">Loading candidates...</option>';

        if (!electionId) {
            dropdown.innerHTML = '<option value="">First select an election...</option>';
            return;
        }

        const election = await votingContract.methods.elections(electionId).call();
        
        if (!election.id || election.id === '0') {
            dropdown.innerHTML = '<option value="">Invalid election</option>';
            return;
        }

        // Clear and set default option
        dropdown.innerHTML = '<option value="">Select a candidate...</option>';

        // Get all candidates
        const candidates = [];
        for (let i = 1; i <= election.candidateCount; i++) {
            const candidate = await votingContract.methods.getCandidate(electionId, i).call();
            candidates.push({
                id: candidate[0],
                name: candidate[1],
                votes: candidate[2]
            });
        }

        // Sort candidates by ID
        candidates.sort((a, b) => Number(a.id) - Number(b.id));

        // Add candidates to dropdown
        candidates.forEach(candidate => {
            const option = new Option(`Candidate #${candidate.id}: ${candidate.name}`, candidate.id);
            dropdown.appendChild(option);
        });

        if (candidates.length === 0) {
            const option = new Option("No candidates available", "");
            option.disabled = true;
            dropdown.appendChild(option);
        }
    } catch (error) {
        console.error('Error updating candidate dropdown:', error);
        showNotification('Failed to load candidates', 'danger');
        dropdown.innerHTML = '<option value="">Error loading candidates</option>';
    }
}

// Add this function to handle role switching
async function switchRole(role) {
    try {
        // Check if user is admin
        const isUserAdmin = await votingContract.methods.admins(currentAccount).call();
        
        // If user is not an admin but tries to switch to admin role
        if (role === 'admin' && !isUserAdmin) {
            showNotification('You do not have admin privileges', 'danger');
            return;
        }
        
        // If user is an admin but wants to vote, they need to switch to voter role
        if (role === 'voter' && isUserAdmin) {
            showNotification('Admins cannot vote. Please use a different account for voting.', 'warning');
            return;
        }

        currentRole = role;
        isAdmin = (role === 'admin' && isUserAdmin);

        // Update UI
        document.querySelectorAll('.role-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase() === role) {
                btn.classList.add('active');
            }
        });
        
        // Show/hide appropriate navigation
        document.querySelector('.admin-nav').style.display = role === 'admin' ? 'block' : 'none';
        document.querySelector('.voter-nav').style.display = role === 'voter' ? 'block' : 'none';
        
        // Reset view
        showStep(role === 'admin' ? 1 : 3);
        
        showNotification(`Switched to ${role} mode`, 'success');
    } catch (error) {
        console.error('Error switching role:', error);
        showNotification('Failed to switch role', 'danger');
    }
}

// Add function to update voting time info
async function updateVotingTimeInfo(electionId) {
    const timeInfo = document.getElementById('votingTimeInfo');
    if (!electionId) {
        timeInfo.textContent = '';
        return;
    }

    try {
        const election = await votingContract.methods.elections(electionId).call();
        const startDate = new Date(election.startTime * 1000).toLocaleString();
        const endDate = new Date(election.endTime * 1000).toLocaleString();
        const currentTime = Math.floor(Date.now() / 1000);

        if (currentTime < election.startTime) {
            timeInfo.className = 'text-warning';
            timeInfo.textContent = `Voting starts at ${startDate}`;
        } else if (currentTime > election.endTime) {
            timeInfo.className = 'text-danger';
            timeInfo.textContent = `Voting ended at ${endDate}`;
        } else {
            timeInfo.className = 'text-success';
            timeInfo.textContent = `Voting is open until ${endDate}`;
        }
    } catch (error) {
        timeInfo.textContent = '';
    }
} 