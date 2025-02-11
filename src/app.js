let web3;
let votingSystem;
let isInitialized = false;

// Connect to Ethereum node
async function initWeb3() {
    const connectionStatus = document.getElementById('connectionStatus');
    
    try {
        // Check if already initialized
        if (isInitialized) return true;

        // Check if MetaMask is installed
        if (typeof window.ethereum !== 'undefined') {
            try {
                // Request account access
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                web3 = new Web3(window.ethereum);
                
                // Get the network ID
                const networkId = await web3.eth.net.getId();
                
                // Get the contract instance
                const response = await fetch('VotingSystem.json');
                const contractJson = await response.json();
                
                // Get contract address for current network
                const deployedNetwork = contractJson.networks[networkId];
                if (!deployedNetwork) {
                    throw new Error('Please connect to the correct network');
                }

                // Initialize contract instance
                votingSystem = new web3.eth.Contract(
                    contractJson.abi,
                    deployedNetwork.address
                );

                // Update connection status
                connectionStatus.className = 'connection-status status-connected';
                connectionStatus.innerHTML = `
                    <i class="fas fa-circle"></i>
                    Connected to MetaMask
                `;

                isInitialized = true;
                showNotification('Connected to blockchain successfully!', 'success');
                return true;
            } catch (error) {
                connectionStatus.className = 'connection-status status-disconnected';
                connectionStatus.innerHTML = `
                    <i class="fas fa-circle"></i>
                    Connection Failed
                `;
                throw error;
            }
        } else {
            connectionStatus.className = 'connection-status status-disconnected';
            connectionStatus.innerHTML = `
                <i class="fas fa-circle"></i>
                MetaMask Not Found
            `;
            throw new Error('Please install MetaMask to use this application');
        }
    } catch (error) {
        showNotification(error.message, 'danger');
        return false;
    }
}

// Initialize the application
window.addEventListener('load', async () => {
    await initWeb3();
});

// Show notification function
function showNotification(message, type = 'success') {
    const alert = document.getElementById('notificationAlert');
    const messageElement = document.getElementById('notificationMessage');
    
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    messageElement.textContent = message;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Show/hide loading spinner
function toggleLoading(show) {
    document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
}

// Function to check if contract is initialized
async function ensureContractInitialized() {
    if (!isInitialized) {
        const initialized = await initWeb3();
        if (!initialized) {
            throw new Error('Contract not initialized. Please check your connection.');
        }
    }
}

// Function to create an election
async function createElection() {
    try {
        await ensureContractInitialized();
        toggleLoading(true);
        
        const electionName = document.getElementById('electionName').value;
        if (!electionName) {
            throw new Error('Please enter an election name');
        }

        const accounts = await web3.eth.getAccounts();
        const result = await votingSystem.methods.createElection(electionName)
            .send({ 
                from: accounts[0],
                gas: 200000
            });

        const electionId = result.events.ElectionCreated.returnValues.electionId;
        showNotification(`Election created successfully! Election ID: ${electionId}`);
        document.getElementById('electionName').value = '';
    } catch (error) {
        showNotification(error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to add a candidate
async function addCandidate() {
    try {
        await ensureContractInitialized();
        toggleLoading(true);
        
        const electionId = document.getElementById('electionId').value;
        const candidateName = document.getElementById('candidateName').value;
        
        if (!electionId || !candidateName) {
            throw new Error('Please fill in all fields');
        }

        const accounts = await web3.eth.getAccounts();
        const result = await votingSystem.methods.addCandidate(electionId, candidateName)
            .send({ 
                from: accounts[0],
                gas: 200000
            });

        const candidateId = result.events.CandidateAdded.returnValues.candidateId;
        showNotification(`Candidate added successfully! Candidate ID: ${candidateId}`);
        document.getElementById('candidateName').value = '';
    } catch (error) {
        showNotification(error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to vote
async function vote() {
    try {
        await ensureContractInitialized();
        toggleLoading(true);
        
        const electionId = document.getElementById('voteElectionId').value;
        const candidateId = document.getElementById('candidateId').value;
        
        if (!electionId || !candidateId) {
            throw new Error('Please fill in all fields');
        }

        const accounts = await web3.eth.getAccounts();
        await votingSystem.methods.vote(electionId, candidateId)
            .send({ 
                from: accounts[0],
                gas: 200000
            });

        showNotification('Vote cast successfully!');
        document.getElementById('voteElectionId').value = '';
        document.getElementById('candidateId').value = '';
    } catch (error) {
        showNotification(error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to get election results
async function getResults() {
    try {
        await ensureContractInitialized();
        toggleLoading(true);
        
        const electionId = document.getElementById('resultsElectionId').value;
        if (!electionId) {
            throw new Error('Please enter an election ID');
        }

        const resultsDisplay = document.getElementById('resultsDisplay');
        resultsDisplay.innerHTML = '';

        // Get election details
        const election = await votingSystem.methods.elections(electionId).call();
        if (!election.id) {
            throw new Error('Election not found');
        }

        // Create election info header
        const electionInfo = document.createElement('div');
        electionInfo.className = 'alert alert-info';
        electionInfo.innerHTML = `
            <h6>Election: ${election.name}</h6>
            <p>Status: ${election.isActive ? 'Active' : 'Closed'}</p>
        `;
        resultsDisplay.appendChild(electionInfo);

        // Get and display each candidate's information
        const candidateCount = election.candidateCount;
        for (let i = 1; i <= candidateCount; i++) {
            const candidate = await votingSystem.methods.getCandidate(electionId, i).call();
            const candidateDiv = document.createElement('div');
            candidateDiv.className = 'results-item';
            candidateDiv.innerHTML = `
                <strong>Candidate ${candidate[0]}:</strong> ${candidate[1]}
                <br>Votes: ${candidate[2]}
            `;
            resultsDisplay.appendChild(candidateDiv);
        }
    } catch (error) {
        showNotification(error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to close an election
async function closeElection() {
    try {
        await ensureContractInitialized();
        toggleLoading(true);
        
        const electionId = document.getElementById('closeElectionId').value;
        if (!electionId) {
            throw new Error('Please enter an election ID');
        }

        const accounts = await web3.eth.getAccounts();
        await votingSystem.methods.closeElection(electionId)
            .send({ 
                from: accounts[0],
                gas: 200000
            });

        showNotification('Election closed successfully!');
        document.getElementById('closeElectionId').value = '';
    } catch (error) {
        showNotification(error.message, 'danger');
    } finally {
        toggleLoading(false);
    }
}

// MetaMask event listeners
if (window.ethereum) {
    window.ethereum.on('accountsChanged', async function (accounts) {
        if (accounts.length === 0) {
            isInitialized = false;
            showNotification('Please connect to MetaMask', 'warning');
        } else {
            await initWeb3();
            showNotification('Account changed to: ' + accounts[0], 'info');
        }
    });

    window.ethereum.on('chainChanged', function (chainId) {
        isInitialized = false;
        window.location.reload();
    });

    window.ethereum.on('disconnect', function () {
        isInitialized = false;
        showNotification('Disconnected from MetaMask', 'warning');
    });
} 