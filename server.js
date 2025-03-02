require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

// Load environment variables
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error(err));

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// MongoDB Models
const Bet = mongoose.model("Bet", new mongoose.Schema({
    round: Number,
    user: String,
    outcome: Number,
    amount: Number,
    txHash: String, 
    timestamp: { type: Date, default: Date.now }
}));

const GameState = mongoose.model("GameState", new mongoose.Schema({
    round: Number,
    isBettingOpen: { type: Boolean, default: true },
    winningOutcome: { type: Number, default: null },
    finalized: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
}));

// Function to initialize default game state
async function initializeGameState() {
    try {
        const existingGameState = await GameState.findOne({});
        if (!existingGameState) {
            console.log("No game state found. Creating default game state...");
            const newGameState = new GameState({
                round: 1,
                isBettingOpen: true,
                finalized: false,
                winningOutcome: 0
            });
            await newGameState.save();
            console.log("Default game state created!");
        } else {
            console.log("Game state already exists.");
        }
    } catch (error) {
        console.error("Error initializing game state:", error);
    }
}

// Run game state initialization on server start
initializeGameState();

// Get current round
const getCurrentRound = async () => {
    const gameState = await GameState.findOne().sort({ round: -1 });
    return gameState ? gameState.round : 1;
};

// Place a bet (off-chain storage)
app.post("/bet", async (req, res) => {
    try {
        const { user, outcome, amount, txHash } = req.body;
        if (![0, 1].includes(outcome)) return res.status(400).send("Invalid outcome");

        const currentRound = await getCurrentRound();
        
        const gameState = await GameState.findOne({ round: currentRound });

        if (!gameState || !gameState.isBettingOpen) return res.status(400).send("Betting is closed");

        await Bet.create({ round: currentRound, user, outcome, amount, txHash });
        res.json({ message: `Bet placed successfully for round ${currentRound}` });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all bets for a specific round
app.get("/bets/:round", async (req, res) => {
    try {
        const bets = await Bet.find({ round: req.params.round });
        res.json(bets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin closes betting
app.post("/close-betting", async (req, res) => {
    try {
        const { txHash } = req.body;

        const currentRound = await getCurrentRound();
        await GameState.updateOne({ round: currentRound }, { isBettingOpen: false });

        res.json({ message: `Betting closed for round ${currentRound}`, txHash: txHash });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin finalizes outcome
app.post("/finalize-outcome", async (req, res) => {
    try {
        const { outcome, txHash } = req.body;
        if (![0, 1].includes(outcome)) return res.status(400).send("Invalid outcome");

        const currentRound = await getCurrentRound();
        await GameState.updateOne({ round: currentRound }, { winningOutcome: outcome, finalized: true });

        res.json({ message: `Outcome ${outcome} finalized for round ${currentRound}`, txHash: txHash });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Withdraw winnings
app.post("/withdraw/:round", async (req, res) => {
    try {
        const { txHash } = req.body;
        const { round } = req.params;

        res.json({ message: `Winnings withdrawn for round ${round}`, txHash: txHash });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin starts a new betting round
app.post("/start-new-round", async (req, res) => {
    try {
        const { txHash } = req.body;

        const currentRound = await getCurrentRound();
        const newRound = currentRound + 1;

        await GameState.create({ round: newRound, isBettingOpen: true });

        res.json({ message: `New round ${newRound} started`, txHash: txHash });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/set-game-state", async (req, res) => {
    try {
        const { round, isBettingOpen, finalized, winningOutcome } = req.body;

        // Find and update the current round state
        let gameState = await GameState.findOne({ round });

        if (!gameState) {
            gameState = new GameState({ round, isBettingOpen, finalized, winningOutcome });
        } else {
            gameState.isBettingOpen = isBettingOpen;
            gameState.finalized = finalized;
            gameState.winningOutcome = winningOutcome;
            gameState.updatedAt = new Date();
        }

        await gameState.save();
        res.json({ success: true, message: "Game state updated successfully!", gameState });

    } catch (error) {
        console.error("Error updating game state:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Get game state for a specific round
app.get("/game-state/:round", async (req, res) => {
    try {
        const state = await GameState.findOne({ round: req.params.round });
        res.json(state);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
