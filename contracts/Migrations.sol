// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title Migrations
 * @notice Truffle uses this contract to remember which migration scripts have run.
 */
contract Migrations {
    address public owner;
    uint256 public last_completed_migration;

    modifier restricted() {
        require(msg.sender == owner, "Caller is not the contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setCompleted(uint256 completed) public restricted {
        last_completed_migration = completed;
    }
}
