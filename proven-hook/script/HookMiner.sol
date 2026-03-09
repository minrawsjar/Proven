// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HookMiner
/// @notice Mines a CREATE2 salt so the deployed Uniswap v4 hook address has the
///         correct permission-flag bits set in its lowest 14 bits.
/// @dev    Uniswap v4 encodes hook permissions in the lowest 14 bits of the hook
///         contract address (ALL_HOOK_MASK = 0x3FFF). The address must satisfy:
///             uint160(hookAddress) & 0x3FFF == requiredFlags
///         This library brute-forces a salt for the CREATE2 address formula:
///             addr = keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))[12:]
library HookMiner {
    /// @notice Find a CREATE2 salt that produces a valid hook address.
    /// @param deployer     The address executing CREATE2 (broadcast EOA in Foundry scripts)
    /// @param flags        Required permission bits (e.g. 0x0640)
    /// @param creationCode Full init code: abi.encodePacked(type(Hook).creationCode, abi.encode(args))
    /// @return hookAddress The computed hook address matching the flag requirements
    /// @return salt        The salt to pass to `new Hook{salt: salt}(args)`
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode
    ) internal pure returns (address hookAddress, bytes32 salt) {
        uint160 mask = uint160(0x3FFF); // ALL_HOOK_MASK — lower 14 bits
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i = 0; i < 500_000; i++) {
            salt = bytes32(i);
            hookAddress = address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                deployer,
                                salt,
                                initCodeHash
                            )
                        )
                    )
                )
            );
            if (uint160(hookAddress) & mask == flags) {
                return (hookAddress, salt);
            }
        }
        revert("HookMiner: no valid salt found in 500k iterations");
    }
}
