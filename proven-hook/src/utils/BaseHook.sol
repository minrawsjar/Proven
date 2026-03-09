// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";
import {
    ModifyLiquidityParams,
    SwapParams
} from "v4-core/types/PoolOperation.sol";
import {ImmutableState} from "../base/ImmutableState.sol";

/// @title BaseHook
/// @notice Abstract base for v4 hooks. Override getHookPermissions() and the _* hook methods you use.
/// @dev See docs: https://docs.uniswap.org/contracts/v4/reference/periphery/utils/BaseHook
abstract contract BaseHook is IHooks, ImmutableState {
    error HookNotImplemented();

    constructor(IPoolManager _manager) ImmutableState(_manager) {
        validateHookAddress();
    }

    /// @notice Returns which hook callbacks this hook implements. Used at deployment to validate address.
    function getHookPermissions()
        public
        pure
        virtual
        returns (Hooks.Permissions memory);

    /// @notice Validates the deployed hook address matches getHookPermissions(). Override to no-op in tests.
    function validateHookAddress() internal view virtual {
        Hooks.validateHookPermissions(
            IHooks(address(this)),
            getHookPermissions()
        );
    }

    // -------- Initialize --------
    function beforeInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96
    ) external virtual onlyPoolManager returns (bytes4) {
        if (!getHookPermissions().beforeInitialize) revert HookNotImplemented();
        return _beforeInitialize(sender, key, sqrtPriceX96);
    }

    function _beforeInitialize(
        address,
        PoolKey calldata,
        uint160
    ) internal virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(
        address sender,
        PoolKey calldata key,
        uint160 sqrtPriceX96,
        int24 tick
    ) external virtual onlyPoolManager returns (bytes4) {
        if (!getHookPermissions().afterInitialize) revert HookNotImplemented();
        return _afterInitialize(sender, key, sqrtPriceX96, tick);
    }

    function _afterInitialize(
        address,
        PoolKey calldata,
        uint160,
        int24
    ) internal virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    // -------- Add liquidity --------
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external virtual onlyPoolManager returns (bytes4) {
        if (!getHookPermissions().beforeAddLiquidity)
            revert HookNotImplemented();
        return _beforeAddLiquidity(sender, key, params, hookData);
    }

    function _beforeAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta feesAccrued,
        bytes calldata hookData
    ) external virtual onlyPoolManager returns (bytes4, BalanceDelta) {
        if (!getHookPermissions().afterAddLiquidity)
            revert HookNotImplemented();
        return
            _afterAddLiquidity(
                sender,
                key,
                params,
                delta,
                feesAccrued,
                hookData
            );
    }

    function _afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) internal virtual returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    // -------- Remove liquidity --------
    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external virtual onlyPoolManager returns (bytes4) {
        if (!getHookPermissions().beforeRemoveLiquidity)
            revert HookNotImplemented();
        return _beforeRemoveLiquidity(sender, key, params, hookData);
    }

    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta,
        BalanceDelta feesAccrued,
        bytes calldata hookData
    ) external virtual onlyPoolManager returns (bytes4, BalanceDelta) {
        if (!getHookPermissions().afterRemoveLiquidity)
            revert HookNotImplemented();
        return
            _afterRemoveLiquidity(
                sender,
                key,
                params,
                delta,
                feesAccrued,
                hookData
            );
    }

    function _afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) internal virtual returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    // -------- Swap --------
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    )
        external
        virtual
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        if (!getHookPermissions().beforeSwap) revert HookNotImplemented();
        return _beforeSwap(sender, key, params, hookData);
    }

    function _beforeSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        bytes calldata
    ) internal virtual returns (bytes4, BeforeSwapDelta, uint24) {
        revert HookNotImplemented();
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external virtual onlyPoolManager returns (bytes4, int128) {
        if (!getHookPermissions().afterSwap) revert HookNotImplemented();
        return _afterSwap(sender, key, params, delta, hookData);
    }

    function _afterSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) internal virtual returns (bytes4, int128) {
        revert HookNotImplemented();
    }

    // -------- Donate --------
    function beforeDonate(
        address sender,
        PoolKey calldata key,
        uint256 amount0,
        uint256 amount1,
        bytes calldata hookData
    ) external virtual onlyPoolManager returns (bytes4) {
        if (!getHookPermissions().beforeDonate) revert HookNotImplemented();
        return _beforeDonate(sender, key, amount0, amount1, hookData);
    }

    function _beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) internal virtual returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(
        address sender,
        PoolKey calldata key,
        uint256 amount0,
        uint256 amount1,
        bytes calldata hookData
    ) external virtual onlyPoolManager returns (bytes4) {
        if (!getHookPermissions().afterDonate) revert HookNotImplemented();
        return _afterDonate(sender, key, amount0, amount1, hookData);
    }

    function _afterDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) internal virtual returns (bytes4) {
        revert HookNotImplemented();
    }
}
