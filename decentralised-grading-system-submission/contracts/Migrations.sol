pragma solidity ^0.5.0;

/**
 * @title Migrations
 * @dev Standard Truffle migrations contract — tracks which migrations have been run.
 *      Do not modify this file.
 */
contract Migrations {
    address public owner;
    uint    public last_completed_migration;

    modifier restricted() {
        require(msg.sender == owner, "Migrations: caller is not owner");
        _;
    }

    constructor() public {
        owner = msg.sender;
    }

    function setCompleted(uint completed) public restricted {
        last_completed_migration = completed;
    }

    function upgrade(address new_address) public restricted {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(last_completed_migration);
    }
}
