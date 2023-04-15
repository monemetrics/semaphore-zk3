# Semaphore ZK3 - Documentation

## Overview

This repository contains the contracts for the Semaphore ZK3 integration with Lens Protocol.

The Semaphore extension inherits SempahoreGroup and adds few extra convenience methods and stores to make it more suitable for a social media use case. Some of these changes are

1. Ability to enable double spending for some groups by not storing the NullifierHash; this makes reusing the proof possible which works well when you create a post and want to respond to a comment on it. To make this safe, there are a couple of things added

    1. The Group coordinator has the ability to revoke a proof on chain if they observe a change in the state, for example, the user who verified they are a member of github:Semaphore maintainers is no longer one. The group coordinator who has OAuth can revoke that proof. Coordinators will be incentivized to do so in the future via staking/slashing.

    2. All posts are connected to a Lens profile so this is not anonymous and users can block spam accounts.


2. Group Metadata ContentURI: IPFS hash pointing to a JSON Metadata for the group, this can only be edited by the group coordinator. Although the metadata has an array of identityCommitments, there is currently no guarantee it’s correct and the backend should depend on events emitted MemberAdded, MemberUpdated and MemberRevoked.

The signal broadcasted is the hash of the Lens post body.