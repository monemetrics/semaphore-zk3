//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @title SemaphoreVoting interface.
/// @dev Interface of SemaphoreVoting contract.
interface ISemaphoreZk3 {
    error Semaphore__CallerIsNotCoordinator();
    error Semaphore__MerkleTreeDepthIsNotSupported();
    error Semaphore__YouAreUsingTheSameNillifierTwice();

    struct Verifier {
        address contractAddress;
        uint256 merkleTreeDepth;
    }

    struct Circle {
        address coordinator;
        string contentURI;
        bool doubleSpend;
        mapping(uint256 => bool) nullifierHashes;
    }

    /// @dev Emitted when a new group is created.
    /// @param circleId: Id of the group.
    /// @param coordinator: Coordinator of the group.
    event CircleCreated(uint256 circleId, address indexed coordinator);

    /// @dev Emitted when a user is added to a group.
    /// @param circleId: Id of the group.
    /// @param identityCommitment: identity added.
    event IdentityAdded(uint256 indexed circleId, uint256 identityCommitment);

    /// @dev Emitted when a user verifies their membership.
    /// @param circleId: Id of the group.
    /// @param signal: the signal verified.
    event MembershipVerified(uint256 indexed circleId, uint256 signal);

    /// @dev Emitted when a coordinator updateds the URI for a circle.
    /// @param circleId: Id of the group.
    /// @param contentURI: the contentURI.
    event CircleURIUpdated(uint256 indexed circleId, string contentURI);

    /// @dev Creates a poll and the associated Merkle tree/group.
    /// @param circleId: Id of the group.
    /// @param coordinator: Coordinator of the poll.
    /// @param merkleTreeDepth: Depth of the tree.
    function createCircle(
        uint256 circleId,
        address coordinator,
        uint256 merkleTreeDepth,
        string calldata contentURI
    ) external;

    function updateContentURI(uint256 circleId, string calldata contentURI) external;

    /// @dev Adds a user to a group.
    /// @param circleId: Id of the group.
    /// @param identityCommitment: Identity commitment of the group member.
    function addIdentity(
        uint256 circleId,
        uint256 identityCommitment,
        string calldata contentURI
    ) external;

    /// @dev removes a user from a gorup.
    /// @param circleId: Id of the group.
    /// @param identityCommitment: Identity commitment of the group member.
    function revokeIdentity(
        uint256 circleId,
        uint256 identityCommitment,
        uint256[] calldata proofSiblings,
        uint8[] calldata proofPathIndices,
        string calldata contentURI
    ) external;

    function getContentURI(uint256 circleId) external view returns (string memory);

    /// @dev verify an identity membership in a circle.
    /// @param signal: signal.
    /// @param nullifierHash: Nullifier hash.
    /// @param circleId: Id of the group.
    /// @param externalNullifier: External nullifier.
    /// @param proof: Private zk-proof parameters.
    function broadcastSignal(
        uint256 signal,
        uint256 nullifierHash,
        uint256 circleId,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) external;

    /// @dev verify an identity membership in a circle.
    /// @param signal: signal.
    /// @param nullifierHash: Nullifier hash.
    /// @param circleId: Id of the group.
    /// @param externalNullifier: External nullifier.
    /// @param proof: Private zk-proof parameters.
    function isValidProof(
        uint256 signal,
        uint256 nullifierHash,
        uint256 circleId,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) external view returns (bool);
}
