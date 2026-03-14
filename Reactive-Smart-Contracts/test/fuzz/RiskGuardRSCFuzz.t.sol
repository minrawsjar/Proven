// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {RiskGuardRSC} from "../../src/RiskGuardRSC.sol";
import {IReactive} from "reactive-lib/interfaces/IReactive.sol";

contract RiskGuardRSCFuzzTest is Test {
    RiskGuardRSC internal rsc;

    uint256 constant ORIGIN_CHAIN = 11155111;
    uint256 constant CALLBACK_CHAIN = 11155111;

    address constant TEAM = address(0xBEEF);
    bytes32 constant POOL_ID = bytes32(uint256(0x1234));

    function setUp() public {
        rsc = new RiskGuardRSC(ORIGIN_CHAIN, CALLBACK_CHAIN, address(0x1111), address(0x2222));

        // High thresholds to avoid milestone callbacks interfering with signal assertions
        rsc.registerMilestones(
            POOL_ID,
            TEAM,
            [uint256(0), uint256(1), uint256(2)],
            [uint256(type(uint128).max), uint256(type(uint128).max), uint256(type(uint128).max)],
            [uint8(34), uint8(33), uint8(33)]
        );
    }

    function testFuzz_priceCrashThreshold(uint8 dropPct) public {
        rsc.react(_buildCrashLog(dropPct));

        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(TEAM, 2);
        if (dropPct >= 30) {
            assertGt(triggeredAt, 0);
            assertEq(basePoints, 35);
        } else {
            assertEq(triggeredAt, 0);
            assertEq(basePoints, 0);
        }
    }

    function testFuzz_sellRatioThreshold(uint128 tvlRaw, uint128 volRaw) public {
        uint256 tvl = bound(uint256(tvlRaw), 1, type(uint128).max);
        uint256 vol = bound(uint256(volRaw), 0, type(uint128).max);

        rsc.react(_buildMetricsLog(tvl, vol, 0));

        (uint256 triggeredAt, uint16 basePoints, ) = rsc.getSignalState(TEAM, 3);
        if ((vol * 100) / tvl > 80) {
            assertGt(triggeredAt, 0);
            assertEq(basePoints, 25);
        } else {
            assertEq(triggeredAt, 0);
            assertEq(basePoints, 0);
        }
    }

    function testFuzz_riskScoreNeverExceedsCap(uint8 loops) public {
        uint256 n = bound(uint256(loops), 2, 20);

        for (uint256 i = 0; i < n; i++) {
            rsc.react(_buildCrashLog(50));
            rsc.react(_buildMetricsLog(100, 90, 0));
        }

        assertLe(rsc.getRiskScore(TEAM), 100);
    }

    function _buildMetricsLog(uint256 tvl, uint256 vol, uint256 users) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: address(0x1111),
            topic_0: uint256(keccak256("PoolMetricsUpdated(bytes32,uint256,uint256,uint256)")),
            topic_1: uint256(POOL_ID),
            topic_2: 0,
            topic_3: 0,
            data: abi.encode(tvl, vol, users),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }

    function _buildCrashLog(uint256 dropPct) internal view returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: ORIGIN_CHAIN,
            _contract: address(0x1111),
            topic_0: uint256(keccak256("CrashDetected(bytes32,uint256)")),
            topic_1: uint256(POOL_ID),
            topic_2: 0,
            topic_3: 0,
            data: abi.encode(dropPct),
            block_number: block.number,
            op_code: 0,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }
}
