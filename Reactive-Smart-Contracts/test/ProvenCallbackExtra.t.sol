// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ProvenCallback} from "../src/ProvenCallback.sol";

contract MockHookForCallback {
    address public lastTeam;
    uint8 public lastMilestone;
    uint32 public lastDays;
    uint32 public lastHours;

    function authorizeUnlock(address team, uint8 milestoneId) external {
        lastTeam = team;
        lastMilestone = milestoneId;
    }

    function extendLock(address team, uint32 penaltyDays) external {
        lastTeam = team;
        lastDays = penaltyDays;
    }

    function pauseWithdrawals(address team, uint32 pauseHours) external {
        lastTeam = team;
        lastHours = pauseHours;
    }
}

contract ProvenCallbackExtraTest is Test {
    ProvenCallback internal callback;
    MockHookForCallback internal hook;

    address constant AUTH = address(0xA11CE);

    function setUp() public {
        hook = new MockHookForCallback();
        callback = new ProvenCallback(address(hook), AUTH);
    }

    function test_debugReactProbe_authorized() public {
        vm.prank(AUTH);
        callback.debugReactProbe(address(this), address(0xBEEF), 7, 0x1234, 11155111);
    }

    function test_debugReactProbe_rejectsUnauthorized() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert("Authorized sender only");
        callback.debugReactProbe(address(0), address(0xBEEF), 7, 0x1234, 11155111);
    }
}
