/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import Web3 from "web3";
import axios from "axios";

const BACKEND_URL = "http://localhost:3000";  
const CONTRACT_ADDRESS = "0x9e11d2164642da0f6f475813f0Aeef1A0e5DC210";
const CONTRACT_ABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"enum PariMutuelBetting.Outcome","name":"outcome","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"BetPlaced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"}],"name":"BettingClosed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"},{"indexed":false,"internalType":"enum PariMutuelBetting.Outcome","name":"winningOutcome","type":"uint8"}],"name":"OutcomeFinalized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"round","type":"uint256"},{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawal","type":"event"},{"inputs":[],"name":"closeBetting","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"currentRound","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"enum PariMutuelBetting.Outcome","name":"_outcome","type":"uint8"}],"name":"finalizeOutcome","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getContractBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"enum PariMutuelBetting.Outcome","name":"_outcome","type":"uint8"}],"name":"placeBet","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"rounds","outputs":[{"internalType":"bool","name":"isActive","type":"bool"},{"internalType":"bool","name":"isFinalized","type":"bool"},{"internalType":"enum PariMutuelBetting.Outcome","name":"winningOutcome","type":"uint8"},{"internalType":"uint256","name":"totalPool","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"startNewRound","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"roundId","type":"uint256"}],"name":"withdrawWinnings","outputs":[],"stateMutability":"nonpayable","type":"function"}];
const adminAddress = "0x6Fb15cAa19E6D954176295B3B3df4a5653EA4CEF"; 

function App() {
    const [web3, setWeb3] = useState(null);
    const [contract, setContract] = useState(null);
    const [account, setAccount] = useState(null);
    const [currentRound, setCurrentRound] = useState(null);
    const [bets, setBets] = useState([]);
    const [betAmount, setBetAmount] = useState("");
    const [selectedOutcome, setSelectedOutcome] = useState(null);
    const [gameState, setGameState] = useState({});
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        connectWallet();
        loadGameState();

        // Listen for account changes
        if (window.ethereum) {
          window.ethereum.on("accountsChanged", handleAccountChange);
      }

      return () => {
          if (window.ethereum) {
              window.ethereum.removeListener("accountsChanged", handleAccountChange);
          }
      };
    }, []);

    async function connectWallet() {
        if (window.ethereum) {
            const web3Instance = new Web3(window.ethereum);
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const accounts = await web3Instance.eth.getAccounts();
            
            setWeb3(web3Instance);
            setAccount(accounts[0]);

            const contractInstance = new web3Instance.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
            setContract(contractInstance);

            // Check if user is admin
            setIsAdmin(accounts[0].toLowerCase() === adminAddress.toLowerCase());
        } else {
            alert("Please install MetaMask!");
        }
    }

    function handleAccountChange(accounts) {
      if (accounts.length > 0) {
          console.log("Account changed to:", accounts[0]);
          setAccount(accounts[0]);

          // Check if new account is admin
          setIsAdmin(accounts[0].toLowerCase() === adminAddress.toLowerCase());

          // Reload game state
          loadGameState();
          setSelectedOutcome(null);
          setBetAmount(0);
      } else {
          setAccount(null);
          setIsAdmin(false);
      }
  }

    async function loadGameState() {
        try {

            const web3 = new Web3(window.ethereum);
            const contractInstance = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
            const currentRound = Number(await contractInstance.methods.currentRound().call());
            console.log("currentRound", currentRound);

            const { data } = await axios.get(`${BACKEND_URL}/game-state/${currentRound}`);
            setGameState(data);
            setCurrentRound(currentRound);

            const betsResponse = await axios.get(`${BACKEND_URL}/bets/${data.round}`);
            setBets(betsResponse.data);
        } catch (error) {
            console.error("Error loading game state:", error);
        }
    }

    async function placeBet() {
      console.log("selectedOutcome", selectedOutcome);

        if (!account || !betAmount || selectedOutcome == null || !contract) {
            alert("Please enter a valid bet amount and select an outcome.");
            return;
        }

        try {
            const amountInWei = web3.utils.toWei(betAmount, "ether");

            const tx = await contract.methods.placeBet(selectedOutcome).send({
                from: account,
                value: amountInWei
            });

            // Update database after transaction is confirmed
            await axios.post(`${BACKEND_URL}/bet`, {
                user: account,
                outcome: selectedOutcome,
                amount: betAmount,
                txHash: tx.transactionHash
            });

            alert("Bet placed successfully on-chain and recorded in DB!");
            loadGameState();
        } catch (error) {
            console.error("Error placing bet:", error);
        }
    }

    async function closeBetting() {
        if (!contract) return;

        try {
            const tx = await contract.methods.closeBetting().send({ from: account });

            await axios.post(`${BACKEND_URL}/close-betting`, { txHash: tx.transactionHash });

            alert("Betting closed on-chain and updated in DB!");
            loadGameState();
        } catch (error) {
            console.error("Error closing betting:", error);
        }
    }

    async function finalizeOutcome(outcome) {
        if (!contract) return;

        try {
            const tx = await contract.methods.finalizeOutcome(outcome).send({ from: account });

            await axios.post(`${BACKEND_URL}/finalize-outcome`, { 
                outcome,
                txHash: tx.transactionHash 
            });

            alert(`Outcome ${outcome} finalized on-chain and recorded in DB!`);
            loadGameState();
        } catch (error) {
            console.error("Error finalizing outcome:", error);
        }
    }

    async function withdrawWinnings() {
        if (!contract) return;

        try {
            const tx = await contract.methods.withdrawWinnings(currentRound).send({ from: account });

            await axios.post(`${BACKEND_URL}/withdraw/${currentRound}`, { txHash: tx.transactionHash });

            alert("Winnings withdrawn on-chain and updated in DB!");
            loadGameState();
        } catch (error) {
            console.error("Error withdrawing winnings:", error);
        }
    }

    async function startNewRound() {
        if (!contract) return;

        try {
            const tx = await contract.methods.startNewRound().send({ from: account });

            await axios.post(`${BACKEND_URL}/start-new-round`, { txHash: tx.transactionHash });

            alert("New round started on-chain and recorded in DB!");
            loadGameState();
        } catch (error) {
            console.error("Error starting new round:", error);
        }
    }

    return (
        <div style={{ textAlign: "center", padding: "20px" }}>
            <h1>Pari-Mutuel Betting Game</h1>

            {!account ? (
                <button onClick={connectWallet}>Connect Wallet</button>
            ) : (
                <p>Connected: {account}</p>
            )}

            <h2>Current Round: {currentRound}</h2>
            <h3>Betting Status: {gameState.isBettingOpen ? "Open" : "Closed"}</h3>
            <h3>Winning Outcome: {gameState.finalized ? gameState.winningOutcome + 1 : "Not finalized"}</h3>

            {!isAdmin && (
              <div>
                  <h2>Place a Bet</h2>
                  <input
                      type="number"
                      placeholder="Enter amount (ETH)"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)} disabled={!gameState.isBettingOpen}
                  />
                  <br />
                  <button onClick={() => setSelectedOutcome(0)} disabled={!gameState.isBettingOpen}>Bet on Outcome 1</button>
                  <button onClick={() => setSelectedOutcome(1)} disabled={!gameState.isBettingOpen}>Bet on Outcome 2</button>
                  <br />
                  <button onClick={placeBet} disabled={!gameState.isBettingOpen}>
                      Place Bet
                  </button>
              </div>
            )}

            <h2>Bets</h2>
            <ul>
                {bets.map((bet, index) => (
                    <li key={index}>
                        {bet.user} bet {bet.amount} ETH on Outcome {bet.outcome + 1}
                    </li>
                ))}
            </ul>
              
            {gameState.finalized && !isAdmin && (
                <div>
                    <h2>Claim Winnings</h2>
                    <button onClick={withdrawWinnings}>Withdraw Winnings</button>
                </div>
            )}

            {isAdmin && (
                <div>
                    <h2>Admin Controls</h2>
                    {!gameState.finalized && <button onClick={closeBetting} disabled={!gameState.isBettingOpen}>Close Betting</button>}
                    {!gameState.finalized && (
                        <div>
                            <button onClick={() => finalizeOutcome(0)}>Finalize Outcome 1</button>
                            <button onClick={() => finalizeOutcome(1)}>Finalize Outcome 2</button>
                        </div>
                    )}
                    {gameState.finalized && <button onClick={startNewRound}>Start New Round</button>}
                </div>
            )}
        </div>
    );
}

export default App;