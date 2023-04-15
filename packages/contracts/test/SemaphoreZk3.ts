/* eslint-disable jest/valid-expect */
import { expect } from "chai"
import { Signer, utils } from "ethers"
import { ethers, run } from "hardhat"
import { Group } from "@semaphore-protocol/group"
import { Identity } from "@semaphore-protocol/identity"
import { FullProof, Proof, generateProof } from "@semaphore-protocol/proof"
import { SemaphoreZk3, Pairing } from "../build/typechain"

describe("SemaphoreZk3", () => {
    let contract: SemaphoreZk3
    let pairingContract: Pairing
    let accounts: Signer[]
    let coordinator: string

    const treeDepth = Number(process.env.TREE_DEPTH) || 20
    const circleIds = [BigInt(1), BigInt(2), BigInt(3)]

    const wasmFilePath = `../../snark-artifacts/${treeDepth}/semaphore.wasm`
    const zkeyFilePath = `../../snark-artifacts/${treeDepth}/semaphore.zkey`

    before(async () => {
        // const { address: verifierAddress } = await run("deploy:verifier", { logs: false, depth: treeDepth })
        const { semaphoreZk3, pairingAddress } = await run("deploy:semaphore-zk3", {
            logs: false
        })
        contract = semaphoreZk3
        pairingContract = await ethers.getContractAt("Pairing", pairingAddress)

        accounts = await ethers.getSigners()
        coordinator = await accounts[1].getAddress()
    })

    describe("# createCircle", () => {
        it("Should not create a circle with a wrong depth", async () => {
            const transaction = contract.createCircle(circleIds[0], coordinator, 100, "ipfs://wrongHash")
            await expect(transaction).to.be.revertedWithCustomError(
                contract,
                "Semaphore__MerkleTreeDepthIsNotSupported"
            )
        })

        it("Should create a social circle", async () => {
            const transaction = contract.createCircle(circleIds[0], coordinator, treeDepth, "ipfs://wrongHash")

            await expect(transaction).to.emit(contract, "CircleCreated").withArgs(circleIds[0], coordinator)
        })

        it("Should not create a circle if it already exists", async () => {
            const transaction = contract.createCircle(circleIds[0], coordinator, treeDepth, "ipfs://wrongHash")

            await expect(transaction).to.be.revertedWithCustomError(contract, "Semaphore__GroupAlreadyExists")
        })
    })

    describe("# addIdentity", () => {
        before(async () => {
            await contract.createCircle(circleIds[1], coordinator, treeDepth, "ipfs://wrongHash")
            const grp = new Group(circleIds[1], treeDepth)
            grp.addMember(new Identity("test").getCommitment())
        })

        it("Should not add an identity if the caller is not the coordinator", async () => {
            const identity = new Identity()
            const identityCommitment = identity.getCommitment()

            const transaction = contract.addIdentity(circleIds[0], identityCommitment, "ipfs://wrongHash")

            await expect(transaction).to.be.revertedWithCustomError(contract, "Semaphore__CallerIsNotCoordinator")
        })

        it("Should add an identity to an existing circle", async () => {
            const identity = new Identity("test")
            const identityCommitment = identity.getCommitment()

            const transaction = contract
                .connect(accounts[1])
                .addIdentity(circleIds[1], identityCommitment, "ipfs://wrongHash")

            await expect(transaction)
                .to.emit(contract, "MemberAdded")
                .withArgs(
                    circleIds[1],
                    0,
                    identityCommitment,
                    "9125308785984045881313807686675154848275641495274553314315006193032323164819"
                )
        })

        it("Should return the correct number of circle members", async () => {
            const size = await contract.getNumberOfMerkleTreeLeaves(circleIds[1])

            expect(size).to.be.eq(1)
        })
    })

    describe("# revokeIdentity", () => {
        it("Should not remove an identity if the caller is not the coordinator", async () => {
            const identity = new Identity()
            const identityCommitment = identity.getCommitment()
            const group = new Group(treeDepth)

            group.addMember(identityCommitment)

            const { siblings, pathIndices } = group.generateMerkleProof(0)

            const transaction = contract.revokeIdentity(
                circleIds[0],
                identityCommitment,
                siblings,
                pathIndices,
                "ipfs://wrongHash"
            )

            await expect(transaction).to.be.revertedWithCustomError(contract, "Semaphore__CallerIsNotCoordinator")
        })

        it("Should remove a member from an existing circle", async () => {
            const groupId = 5
            const members = [BigInt(1), BigInt(2), BigInt(3)]
            const group = new Group(groupId, treeDepth)

            group.addMembers(members)

            group.removeMember(2)
            await contract.createCircle(groupId, coordinator, treeDepth, "ipfs://wrongHash")
            await contract.connect(accounts[1]).addIdentity(groupId, BigInt(1), "ipfs://wrongHash")
            await contract.connect(accounts[1]).addIdentity(groupId, BigInt(2), "ipfs://wrongHash")
            await contract.connect(accounts[1]).addIdentity(groupId, BigInt(3), "ipfs://wrongHash")

            const { siblings, pathIndices, root } = group.generateMerkleProof(2)

            const transaction = contract
                .connect(accounts[1])
                .revokeIdentity(groupId, BigInt(3), siblings, pathIndices, "ipfs://wrongHash")

            await expect(transaction).to.emit(contract, "MemberRemoved").withArgs(groupId, 2, BigInt(3), root)
        })
    })

    describe("# broadcastSignal", () => {
        const identity = new Identity("test")
        const identityCommitment = identity.getCommitment()
        const vote = "1"
        const bytes32Vote = utils.formatBytes32String(vote)
        let solidityProof: Proof
        let fullProof: FullProof

        before(async () => {
            const group = new Group(circleIds[2], treeDepth)
            group.addMembers([identityCommitment, BigInt(1)])
            await contract.createCircle(circleIds[2], coordinator, treeDepth, "ipfs://wrongHash")
            await contract.connect(accounts[1]).addIdentity(circleIds[2], identityCommitment, "ipfs://wrongHash")
            await contract.connect(accounts[1]).addIdentity(circleIds[2], BigInt(1), "ipfs://wrongHash")

            fullProof = await generateProof(identity, group, circleIds[2], vote, {
                wasmFilePath,
                zkeyFilePath
            })

            solidityProof = fullProof.proof
        })

        it("Should not verify a signal if the caller is not the coordinator [WILL DEPRECATE]", async () => {
            const transaction = contract.broadcastSignal(
                bytes32Vote,
                fullProof.nullifierHash,
                circleIds[0],
                fullProof.externalNullifier,
                solidityProof
            )

            await expect(transaction).to.be.revertedWithCustomError(contract, "Semaphore__CallerIsNotCoordinator")
        })

        it("Should not verify a signal if the proof is not valid", async () => {
            const transaction = contract
                .connect(accounts[1])
                .broadcastSignal(vote, 1, circleIds[2], fullProof.externalNullifier, solidityProof)

            await expect(transaction).to.be.revertedWithCustomError(pairingContract, "Semaphore__InvalidProof")
        })

        it("Should broadcast signal", async () => {
            const transaction = contract
                .connect(accounts[1])
                .broadcastSignal(
                    vote,
                    fullProof.nullifierHash,
                    circleIds[2],
                    fullProof.externalNullifier,
                    solidityProof
                )

            await expect(transaction).to.emit(contract, "MembershipVerified").withArgs(circleIds[2], vote)
        })

        it("Should verify signal", async () => {
            const transaction = await contract
                .connect(accounts[1])
                .isValidProof(vote, fullProof.nullifierHash, circleIds[2], fullProof.externalNullifier, solidityProof)

            await expect(transaction).to.equal(true)
        })

        it("Should be able to double signal by default", async () => {
            const transaction = contract
                .connect(accounts[1])
                .broadcastSignal(
                    vote,
                    fullProof.nullifierHash,
                    circleIds[1],
                    fullProof.externalNullifier,
                    solidityProof
                )

            await expect(transaction).not.to.be.revertedWithCustomError(
                contract,
                "Semaphore__YouAreUsingTheSameNillifierTwice"
            )
        })
    })
})
