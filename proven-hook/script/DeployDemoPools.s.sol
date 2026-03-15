// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/DemoPool.sol";

contract DeployDemoPools is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1) Rugged pool: deploy with funds then owner withdraws everything
        DemoPool rugPool = new DemoPool{value: 1 ether}();
        rugPool.deposit{value: 0.5 ether}();
        rugPool.rugPull();

        // 2) Unlocked pool: pool is unlocked and available
        DemoPool unlockedPool = new DemoPool{value: 2 ether}();
        unlockedPool.unlock();

        // 3) All milestones achieved: high score + unlocked
        DemoPool allMilestones = new DemoPool{value: 3 ether}();
        allMilestones.increaseScore(100);
        allMilestones.unlock();

        // 4) Fully rage locked: irreversible locked state
        DemoPool rageLocked = new DemoPool{value: 2 ether}();
        rageLocked.rageLock();

        // 5) Score increased but still locked
        DemoPool scoreIncreased = new DemoPool{value: 1 ether}();
        scoreIncreased.increaseScore(50);

        // 6) Additional demo: unlocked then rug by owner-to-simulate
        DemoPool unlockedThenRug = new DemoPool{value: 1 ether}();
        unlockedThenRug.unlock();
        // owner rips out 0.5 ether
        unlockedThenRug.withdraw(0.5 ether);

        console.log("rugPool", address(rugPool));
        console.log("unlockedPool", address(unlockedPool));
        console.log("allMilestones", address(allMilestones));
        console.log("rageLocked", address(rageLocked));
        console.log("scoreIncreased", address(scoreIncreased));
        console.log("unlockedThenRug", address(unlockedThenRug));

        vm.stopBroadcast();
    }
}
