// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title RoleRegistry
 * @notice Owner-managed authorization for supply-chain participants.
 * @dev Roles are enforced by inheriting contracts. The frontend is not a security boundary.
 */
contract RoleRegistry {
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Retailer
    }

    /// @notice Account that deployed the contract. This address is the administrator.
    address public owner;

    mapping(address => Role) internal participantRoles;
    address[] private participantAccounts;
    mapping(address => bool) private seenParticipant;

    event ParticipantRoleUpdated(address indexed account, uint8 role, address indexed updatedBy);

    /**
     * @dev The deployer becomes the owner. There is no separate admin key.
     */
    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        // Authorization: role changes, fee changes, and withdrawals are owner-only.
        require(msg.sender == owner, "Caller is not the contract owner");
        _;
    }

    /**
     * @notice Assign or revoke a participant role.
     * @param account Wallet to update. Must not be the zero address.
     * @param role 0 = None, 1 = Manufacturer, 2 = Distributor, 3 = Retailer.
     */
    function setParticipantRole(address account, uint8 role) external onlyOwner {
        // Valid receiving and acting addresses must be real accounts.
        require(account != address(0), "Invalid address");
        // Reject values outside the Role enum so an invalid cast cannot grant access.
        require(role <= uint8(Role.Retailer), "Invalid role");

        Role nextRole = Role(role);
        // Avoid a no-op write and make accidental repeat calls visible to the caller.
        require(participantRoles[account] != nextRole, "Role is unchanged");

        participantRoles[account] = nextRole;
        if (!seenParticipant[account]) {
            seenParticipant[account] = true;
            participantAccounts.push(account);
        }

        emit ParticipantRoleUpdated(account, role, msg.sender);
    }

    /// @notice Current role of an account. Returns 0 when the account has never been authorized.
    function getParticipantRole(address account) external view returns (uint8) {
        return uint8(participantRoles[account]);
    }

    /**
     * @notice Addresses that have ever been assigned a role, including later revocations.
     * @dev Revoked accounts remain in the list with role None so the admin can see history.
     */
    function getParticipants() external view returns (address[] memory accounts, uint8[] memory roles) {
        uint256 count = participantAccounts.length;
        accounts = new address[](count);
        roles = new uint8[](count);
        for (uint256 i = 0; i < count; i++) {
            accounts[i] = participantAccounts[i];
            roles[i] = uint8(participantRoles[accounts[i]]);
        }
    }
}
