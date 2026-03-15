// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title DemoPool
 * @notice Minimal demo pool used only for local/onchain demo scripts.
 * - owner can `rugPull()` to withdraw all funds (simulates a rug)
 * - owner can `unlock()`/`lock()` to allow withdrawals
 * - owner can `rageLock()` to permanently disable withdrawals
 * - owner can `increaseScore()` to simulate governance score changes
 */
contract DemoPool {
    address public owner;
    uint256 public score;
    bool public unlocked;
    bool public rageLocked;

    modifier onlyOwner() {
        require(msg.sender == owner, "DemoPool: only owner");
        _;
    }

    constructor() payable {
        owner = msg.sender;
        score = 0;
        unlocked = false;
        rageLocked = false;
    }

    receive() external payable {}

    function deposit() external payable {}

    function rugPull() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    function unlock() external onlyOwner {
        unlocked = true;
    }

    function lock() external onlyOwner {
        unlocked = false;
    }

    /// irreversible lock that prevents withdrawals
    function rageLock() external onlyOwner {
        rageLocked = true;
    }

    function increaseScore(uint256 amount) external onlyOwner {
        score += amount;
    }

    /// withdraw obeys lock states
    function withdraw(uint256 amount) external {
        require(!rageLocked, "DemoPool: rage locked");
        if (!unlocked) {
            require(msg.sender == owner, "DemoPool: locked");
        }
        payable(msg.sender).transfer(amount);
    }
}
