// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../ProductAuthentication.sol";

/**
 * @title ReentrancyAttacker
 * @notice Test-only owner. It deploys ProductAuthentication so this contract is the owner,
 *         then tries to re-enter withdraw while receiving the withdrawn ETH.
 */
contract ReentrancyAttacker {
    ProductAuthentication public auth;
    uint256 public calls;

    constructor(uint256 fee) {
        auth = new ProductAuthentication(fee);
    }

    function prepare(string calldata name, string calldata batchNumber, string calldata serialNumber) external {
        auth.setParticipantRole(address(this), 1);
        auth.registerProduct(name, batchNumber, serialNumber);
    }

    function fundVerification(bytes32 productId) external payable {
        auth.verifyProduct{value: msg.value}(productId);
    }

    function attack(uint256 amount) external {
        auth.withdraw(payable(address(this)), amount);
    }

    receive() external payable {
        calls += 1;
        if (calls < 2) {
            auth.withdraw(payable(address(this)), 1);
        }
    }
}
