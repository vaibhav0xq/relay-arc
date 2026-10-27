// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {USDCSplitPay} from "../USDCSplitPay.sol";

/// @notice Deploys USDCSplitPay to Arc Testnet (or any configured RPC).
///
/// Required env vars
/// =================
///   PRIVATE_KEY   — deployer private key (0x-prefixed hex)
///
/// Optional env vars
/// =================
///   USDC_ADDRESS  — override the USDC token address
///                   (defaults to 0x3600000000000000000000000000000000000000,
///                    the USDC address on both Arc Testnet and Arc Mainnet)
///
/// Example (Arc Testnet)
/// =====================
///   forge script contracts/script/DeployUSDCSplitPay.s.sol \
///     --rpc-url https://rpc.testnet.arc.io \
///     --broadcast \
///     --private-key $PRIVATE_KEY
///
/// Do not use this script on mainnet without a full independent audit.
contract DeployUSDCSplitPay is Script {
    /// @dev Arc USDC address — identical on Arc Testnet and Arc Mainnet.
    address private constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (USDCSplitPay deployed) {
        // Allow overriding USDC address via env for non-Arc networks or testing.
        address usdcAddress = vm.envOr("USDC_ADDRESS", ARC_USDC);

        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        console.log("Deployer:     ", deployer);
        console.log("USDC address: ", usdcAddress);

        vm.startBroadcast(deployerKey);

        deployed = new USDCSplitPay(usdcAddress);

        vm.stopBroadcast();

        console.log("USDCSplitPay deployed at:", address(deployed));
    }
}
