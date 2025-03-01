// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PariMutuelBetting is Ownable {

    uint256 public currentRound;

    enum Outcome {
        ONE,
        TWO
    }
    
    struct Round {
        bool isActive;
        bool isFinalized;
        Outcome winningOutcome;
        uint256 totalPool;
        mapping(Outcome => uint256) outcomePools; // Total amount bet per outcome
        mapping(address => uint256) userBets;
        mapping(address => Outcome) userChoices;
    }
    
    mapping(uint256 => Round) public rounds;

    event BetPlaced(uint256 indexed round, address indexed user, Outcome outcome, uint256 amount);
    event BettingClosed(uint256 indexed round);
    event OutcomeFinalized(uint256 indexed round, Outcome winningOutcome);
    event Withdrawal(uint256 indexed round, address indexed user, uint256 amount);

    modifier roundActive(uint256 roundId) {
        require(rounds[roundId].isActive, "Betting for this round is closed");
        _;
    }

    modifier roundFinalized(uint256 roundId) {
        require(rounds[roundId].isFinalized, "Outcome not finalized yet");
        _;
    }

    constructor() Ownable(msg.sender){
        currentRound = 1;
        rounds[currentRound].isActive = true; // Start first round
    }

    function placeBet(Outcome _outcome) external payable roundActive(currentRound) {
        require(msg.value > 0, "Bet amount must be greater than zero");
        require(_outcome == Outcome.ONE || _outcome == Outcome.TWO, "Invalid outcome");

        Round storage round = rounds[currentRound];
        round.userBets[msg.sender] += msg.value;
        round.userChoices[msg.sender] = _outcome;
        round.outcomePools[_outcome] += msg.value;
        round.totalPool += msg.value;

        emit BetPlaced(currentRound, msg.sender, _outcome, msg.value);
    }

    function closeBetting() external onlyOwner {
        require(rounds[currentRound].isActive, "Betting is already closed");
        
        rounds[currentRound].isActive = false;
        emit BettingClosed(currentRound);
    }

    function finalizeOutcome(Outcome _outcome) external onlyOwner {
        require(_outcome == Outcome.ONE || _outcome == Outcome.TWO, "Invalid outcome");
        require(!rounds[currentRound].isFinalized, "Outcome already finalized");
        require(!rounds[currentRound].isActive, "Round is active");

        rounds[currentRound].winningOutcome = _outcome;
        rounds[currentRound].isFinalized = true;

        emit OutcomeFinalized(currentRound, _outcome);
    }

    function withdrawWinnings(uint256 roundId) external roundFinalized(roundId) {
        Round storage round = rounds[roundId];
        require(round.userChoices[msg.sender] == round.winningOutcome, "Not a winning bet");
        require(round.userBets[msg.sender] > 0, "No winnings to withdraw");

        uint256 userBet = round.userBets[msg.sender];
        uint256 winnings = (userBet * round.totalPool) / round.outcomePools[round.winningOutcome];

        round.userBets[msg.sender] = 0;
        payable(msg.sender).transfer(winnings);

        emit Withdrawal(roundId, msg.sender, winnings);
    }

    function startNewRound() external onlyOwner {
        require(rounds[currentRound].isFinalized, "Previous round not finalized");
        
        currentRound++;
        rounds[currentRound].isActive = true;
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}

