//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../interfaces/ISemaphoreZk3.sol";
import "../base/SemaphoreGroups.sol";
import "../interfaces/ISemaphoreVerifier.sol";

/// @title SemaphoreZK3 circles contract.
/// @dev The following code allows you to create circles, add members and allow them to double signal.
contract SemaphoreZk3 is Initializable, ISemaphoreZk3, SemaphoreGroups {
    /// @dev Gets a tree depth and returns its verifier address.
    ISemaphoreVerifier internal verifier;

    address public deployer;
    address public governance;

    /// @dev Gets a circle id and returns the circle data.
    mapping(uint256 => Circle) internal circles;


    constructor() {
        _disableInitializers();
        // verifier = _verifier;
    }

    /// @dev Checks if the circle coordinator is the transaction sender.
    /// @param circleId: Id of the circle.
    modifier onlyCoordinator(uint256 circleId) {
        if (circles[circleId].coordinator != _msgSender()) {
            revert Semaphore__CallerIsNotCoordinator();
        }

        _;
    }

    modifier onlyGovernance() {
        if (governance != _msgSender()) {
            revert Zk3__CallerIsNotGovernance();
        }

        _;
    }

    modifier onlyDeployer() {
        if (deployer != _msgSender()) {
            revert Zk3__CallerIsNotOwner();
        }

        _;
    }

    function initialize(ISemaphoreVerifier _verifier) public initializer {
        verifier = _verifier;
        deployer = _msgSender();
        governance = _msgSender();
    }

    function setGovernance(address _governance) public onlyDeployer {
        address currentGovernance = governance;
        governance = _governance;

        emit GovernanceUpdated(currentGovernance, _governance);
    }
    

    /// @dev See {ISemaphoreZk3-createcircle}.
    function createCircle(
        uint256 circleId,
        address coordinator,
        uint256 merkleTreeDepth,
        string calldata contentURI
    ) public override onlyGovernance {
        if (merkleTreeDepth < 16 || merkleTreeDepth > 32) {
            revert Semaphore__MerkleTreeDepthIsNotSupported();
        }

        if (circles[circleId].coordinator != address(0)) {
            revert Semaphore__GroupAlreadyExists();
        }

        _createGroup(circleId, merkleTreeDepth);

        circles[circleId].coordinator = coordinator;
        // don't store the nullifier hash so we can double spend the same note for now
        circles[circleId].doubleSpend = true;
        circles[circleId].contentURI = contentURI;

        emit CircleCreated(circleId, coordinator, contentURI);
    }

    /// @dev See {ISemaphoreZk3-addVoter}.
    function addIdentity(
        uint256 circleId,
        uint256 identityCommitment,
        string calldata contentURI
    ) public override onlyCoordinator(circleId) {
        _addMember(circleId, identityCommitment);
        updateContentURI(circleId, contentURI);
    }

    function revokeIdentity(
        uint256 circleId,
        uint256 identityCommitment,
        uint256[] calldata proofSiblings,
        uint8[] calldata proofPathIndices,
        string calldata contentURI
    ) public override onlyCoordinator(circleId) {
        _removeMember(circleId, identityCommitment, proofSiblings, proofPathIndices);
        updateContentURI(circleId, contentURI);
    }

    function updateContentURI(uint256 circleId, string calldata contentURI) public override onlyCoordinator(circleId) {
        circles[circleId].contentURI = contentURI;
        // todo: make sure the contentURI is valid and doesn't equal the current one.
        // (assuming it's content addressable)
        emit CircleURIUpdated(circleId, contentURI);
    }

    function getContentURI(uint256 circleId) public view virtual override returns (string memory) {
        return circles[circleId].contentURI;
    }

    /// @dev See {ISemaphoreZk3-broadcastSignal}.
    function broadcastSignal(
        uint256 signal,
        uint256 nullifierHash,
        uint256 circleId,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) public override {
        // note this will only revert if the doubleSpend flag is false even if the nullifierHash is already used
        if (circles[circleId].doubleSpend == false && circles[circleId].nullifierHashes[nullifierHash]) {
            revert Semaphore__YouAreUsingTheSameNillifierTwice();
        }

        uint256 merkleTreeDepth = getMerkleTreeDepth(circleId);
        uint256 merkleTreeRoot = getMerkleTreeRoot(circleId);

        verifier.verifyProof(merkleTreeRoot, nullifierHash, signal, externalNullifier, proof, merkleTreeDepth);

        circles[circleId].nullifierHashes[nullifierHash] = true;

        emit MembershipVerified(circleId, signal, proof);
    }

    /// @dev See {ISemaphoreZk3-isValidProof}.
    function isValidProof(
        uint256 signal,
        uint256 nullifierHash,
        uint256 circleId,
        uint256 externalNullifier,
        uint256[8] calldata proof
    ) public view virtual override returns (bool) {
        uint256 merkleTreeDepth = getMerkleTreeDepth(circleId);
        uint256 merkleTreeRoot = getMerkleTreeRoot(circleId);

        verifier.verifyProof(merkleTreeRoot, nullifierHash, signal, externalNullifier, proof, merkleTreeDepth);
        return true;
    }
}
