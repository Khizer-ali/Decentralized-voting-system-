let web3;
let votingContract;

window.addEventListener('load', async () => {
    await initWeb3();
    await loadAccounts();
});

async function initWeb3() {
    try {
        web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));
        const response = await fetch('VotingSystem.json');
        const contractJson = await response.json();
        
        votingContract = new web3.eth.Contract(
            contractJson.abi,
            contractJson.networks['5777'].address
        );
    } catch (error) {
        console.error('Failed to initialize Web3:', error);
    }
}

async function loadAccounts() {
    try {
        const accounts = await web3.eth.getAccounts();
        const adminSelect = document.getElementById('adminAccount');
        const voterSelect = document.getElementById('voterAccount');
        
        for (let account of accounts) {
            const isAdmin = await votingContract.methods.admins(account).call();
            const option = new Option(account, account);
            
            if (isAdmin) {
                adminSelect.add(option.cloneNode(true));
            } else {
                voterSelect.add(option.cloneNode(true));
            }
        }

        // Store selected account in localStorage when changed
        adminSelect.addEventListener('change', function() {
            localStorage.setItem('selectedAccount', this.value);
        });

        voterSelect.addEventListener('change', function() {
            localStorage.setItem('selectedAccount', this.value);
        });

        // Disable login buttons until account is selected
        const adminLogin = document.getElementById('adminLogin');
        const voterLogin = document.getElementById('voterLogin');
        
        adminSelect.addEventListener('change', function() {
            adminLogin.classList.toggle('disabled', !this.value);
        });

        voterSelect.addEventListener('change', function() {
            voterLogin.classList.toggle('disabled', !this.value);
        });

        // Initially disable buttons
        adminLogin.classList.add('disabled');
        voterLogin.classList.add('disabled');
    } catch (error) {
        console.error('Failed to load accounts:', error);
    }
} 