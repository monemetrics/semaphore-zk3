pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import { DataTypes as LensDataTypes } from "./libraries/LensDataTypes.sol";
import { ILensHub } from "./interfaces/ILensHub.sol";
import { ISemaphoreZk3 } from "./interfaces/ISemaphoreZk3.sol";
// import { Proxied } from "./vendor/EIP173/Proxied.sol";
// import { EIP173Proxy } from "./vendor/EIP173/EIP173Proxy.sol";



contract Zk3Dispatcher is 
  Initializable,
  PausableUpgradeable,
  AccessControlUpgradeable
  {
  
  ILensHub private lensHub;
  ISemaphoreZk3 private semaphoreZk3;

  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
  using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  
  // uint256 public immutable lensProfileId;
  // mapping (uint256 => bool) public isDispatchingEnabled;
  EnumerableSetUpgradeable.AddressSet private dispatchersList;
  EnumerableSetUpgradeable.UintSet private lensProfilesList;

  struct Zk3Metadata {
    uint256 signal;
    uint256 nullifierHash;
    uint256 circleId;
    uint256 externalNullifer;
    uint256[8] proof;
  }

  struct Zk3InitData {
    bool freeMirror;
    bool freeComment;
    uint256 signal;
    uint256 nullifierHash;
    uint256 circleId;
    uint256 externalNullifer;
    uint256[8] proof;
  }
  // constructor (
  //   ILensHub _lensHub
  // ) {
  //   _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  //   _grantRole(PAUSER_ROLE, msg.sender);
  //   _grantRole(OWNER_ROLE, msg.sender);
  //   lensHub = _lensHub;
  // }

  constructor () {
    _disableInitializers();
  }

  function initialize (
    ILensHub _lensHub,
    ISemaphoreZk3 _semaphoreZk3
  ) initializer public {
    __Pausable_init();
    __AccessControl_init();

    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(PAUSER_ROLE, msg.sender);
    _grantRole(OWNER_ROLE, msg.sender);
    lensHub = _lensHub;
    semaphoreZk3 = _semaphoreZk3;
  }

  modifier onlyOwner () {
    require(hasRole(OWNER_ROLE, msg.sender), "BotDispatcher: onlyOwner is allowed");
    _;
  }
  /**
    * @dev Pauses all token transfers.
    *
    *
    * Requirements:
    *
    * - the caller must have the `PAUSER_ROLE`.
    */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

  function setLensHub (ILensHub _lensHub) public onlyRole(OWNER_ROLE) {
    lensHub = _lensHub;
  }

  // ------------------------[ Dispatcher functions ]----------------------------
  function addDispatcher (address dispatcher) public onlyRole(OWNER_ROLE) {
    dispatchersList.add(dispatcher);
  }

  function removeDispatcher (address dispatcher) public onlyOwner {
    dispatchersList.remove(dispatcher);
  }

  function listDispatchers () public view returns (address[] memory) {
    return dispatchersList.values();
  }

  function isDispatcher (address dispatcher) internal view returns (bool) {
    return dispatchersList.contains(dispatcher);
  }

  modifier onlyDispatcher () {
    require(isDispatcher(msg.sender), "Only dispatchers can call this function");
    _;
  }

  function isBotEnabledForProfile (uint256 lensProfileId) internal view returns (bool) {
    // get it directly from lens
    address dOnLens = lensHub.getDispatcher(lensProfileId);
    return (dOnLens == address(this));
    // return lensProfilesList.contains(lensProfileId);
  }

  function getRoleOwner (bytes32 role) public view returns (bytes32) {
    return getRoleAdmin(role);
  }



  // --------------------------[ Lens External Functions ]---------------------
  function setDispatcherWithSig(LensDataTypes.SetDispatcherWithSigData calldata vars)
    external
    whenNotPaused
    onlyDispatcher
  {
    // if (isBotEnabledForProfile(vars.profileId)) {
    // }
    // require(isBotEnabledForProfile(vars.profileId),"profileId has already enabled dispatching");

    // if (vars.dispatcher != address(this) && vars.dispatcher != address(0x0)) {
    //   revert("Dispatcher address isn't this contract or 0x0");
    // }

    require(vars.dispatcher == address(this), "Dispatcher isn't this contract address");

    lensHub.setDispatcherWithSig(vars);
    if (vars.dispatcher == address(this)) {
      lensProfilesList.add(vars.profileId);
    } else if (vars.dispatcher == address(0x0)) {
      // disable dipatcher call
      lensProfilesList.remove(vars.profileId);
    }
  }

  function post(LensDataTypes.PostData calldata vars, Zk3InitData calldata zk3InitData)
      external
      whenNotPaused
      onlyDispatcher
      returns (uint256)
  {
    // if (!isBotEnabledForProfile(vars.profileId)) {
    //   revert("profileId has not enabled dispatching");
    // }

    require(isBotEnabledForProfile(vars.profileId), "BotDispatcher: profileId has not enabled dispatching");

    semaphoreZk3.broadcastSignal(zk3InitData.signal, zk3InitData.nullifierHash, zk3InitData.circleId, zk3InitData.externalNullifer, zk3InitData.proof);
    
    return lensHub.post(vars);
    // //todo: do some sanity checks here
    // try  returns (uint256 v) {
    //   return v;
    // } catch Error(string memory reason) {
    //   revert(reason);
    //   // return 0;
    // } catch Panic(uint errorCode ) {
    //   revert(StringsUpgradeable.toString(errorCode));
    //   // console.log('lensHub Post Panic: ', errorCode);
    //   // return 0;
    // } catch (bytes memory lowLevelData) {
    //   revert(string(lowLevelData));
    //   // console.log('lensHub Post lowLevelData: ', lowLevelData);
    //   // return 0;
    // }

    // return lensHub.post(vars);
  }

  function comment(LensDataTypes.CommentData calldata vars, Zk3Metadata calldata zk3Metadata)
      external
      whenNotPaused
      onlyDispatcher
      returns (uint256)
  {
    // if (!isBotEnabledForProfile(vars.profileId)) {
    //   revert("profileId has not enabled dispatching");
    // }

    require(isBotEnabledForProfile(vars.profileId), "BotDispatcher: profileId has not enabled dispatching");

    semaphoreZk3.broadcastSignal(zk3Metadata.signal, zk3Metadata.nullifierHash, zk3Metadata.circleId, zk3Metadata.externalNullifer, zk3Metadata.proof);
    //todo: do some sanity checks here
    // try lensHub.comment(vars) returns (uint256 v) {
    //   return v;
    // } catch Error(string memory reason) {
    //   revert(reason);
    //   // return 0;
    // } catch Panic(uint errorCode ) {
    //   revert(StringsUpgradeable.toString(errorCode));
    //   // console.log('lensHub Post Panic: ', errorCode);
    //   // return 0;
    // } catch (bytes memory lowLevelData) {
    //   revert(string(lowLevelData));
    //   // console.log('lensHub Post lowLevelData: ', lowLevelData);
    //   // return 0;
    // }

    return lensHub.comment(vars);
  }
  // --------------------------------------------------------------------------
}