import { task, types } from "hardhat/config"
import { getDeployedContracts } from "../scripts/utils"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof, verifyProof } from "@semaphore-protocol/proof"
import { verify } from "crypto"

task("zk3:create-circle", "create a circle")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .addParam("id", "the circle id", "test", types.string)
    .addParam("uri", "the circle uri", "ipfs://testHash", types.string)
    .setAction(async ({ id, uri }, { ethers, hardhatArguments }): Promise<void> => {
        console.log("network Id: ", await ethers.provider.getNetwork())
        const deployedContracts = getDeployedContracts(hardhatArguments.network)
        if (!deployedContracts) {
            throw new Error("No deployed contracts found, check deployed-contracts folder")
        }

        const [signer, governance] = await ethers.getSigners()

        const SemaphoreZk3 = await ethers.getContractFactory("SemaphoreZk3", {
            libraries: {
                IncrementalBinaryTree: deployedContracts.IncrementalBinaryTree
            },
            signer: governance
        })

        const semaphoreZk3 = SemaphoreZk3.attach(deployedContracts.Semaphore)

        const tx = await semaphoreZk3.createCircle(id, signer.address, 20, uri)
        console.log("tx: ", tx)
        const receipt = await tx.wait()
        console.log("receipt: ", receipt)
    })

task("zk3:get-root", "get a circle root")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .addParam("id", "the circle id", "test", types.string)
    .setAction(async ({ id, uri }, { ethers, hardhatArguments }): Promise<void> => {
        console.log("network Id: ", await ethers.provider.getNetwork())
        const deployedContracts = getDeployedContracts(hardhatArguments.network)
        if (!deployedContracts) {
            throw new Error("No deployed contracts found, check deployed-contracts folder")
        }
        console.log("deployed Contract address: ", deployedContracts.Semaphore)
        const [signer] = await ethers.getSigners()

        const SemaphoreZk3 = await ethers.getContractFactory("SemaphoreZk3", {
            libraries: {
                IncrementalBinaryTree: deployedContracts.IncrementalBinaryTree
            }
        })

        const semaphoreZk3 = SemaphoreZk3.attach(deployedContracts.Semaphore)

        const tx = await semaphoreZk3.getMerkleTreeRoot(id)
        console.log("tx: ", tx)
    })

task("zk3:add-member", "adds a member to a circle.")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .addParam("id", "circle Id", undefined, types.string)
    .addParam("seed", "zk Identity seed", undefined, types.string)
    .setAction(async ({ logs, id, seed }, { ethers, hardhatArguments }): Promise<void> => {
        console.log("network Id: ", await ethers.provider.getNetwork())
        const deployedContracts = getDeployedContracts(hardhatArguments.network)
        if (!deployedContracts) {
            throw new Error("No deployed contracts found, check deployed-contracts folder")
        }
        console.log("deployed Contract address: ", deployedContracts.Semaphore)
        const [signer] = await ethers.getSigners()

        const SemaphoreZk3 = await ethers.getContractFactory("SemaphoreZk3", {
            libraries: {
                IncrementalBinaryTree: deployedContracts.IncrementalBinaryTree
            }
        })

        const semaphoreZk3 = SemaphoreZk3.attach(deployedContracts.Semaphore)

        const identity = new Identity(seed)
        const commitment = identity.getCommitment().toString()
        console.log("commitment", commitment)

        const resp = await semaphoreZk3.addIdentity(
            id,
            commitment,
            "ipfs://QmPe69VWkLUeev2VFoky66QoLb5GvE8c5nSTyC6E2NqtHT"
        )
        console.log("tx sent, waiting for confirmation...", resp.hash)
        await resp.wait()

        if (logs) {
            console.info(`SemaphoreZk3 add Member, id: ${commitment}, circleId: ${id}`, resp)
        }
    })

task("zk3:test-proof", "test zkProofs.")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .addParam("id", "circle Id", undefined, types.string)
    .addParam("seed", "zk Identity seed", undefined, types.string)
    .setAction(async ({ logs, id, seed }, { ethers, hardhatArguments }): Promise<void> => {
        console.log("network Id: ", await ethers.provider.getNetwork())
        const deployedContracts = getDeployedContracts(hardhatArguments.network)
        if (!deployedContracts) {
            throw new Error("No deployed contracts found, check deployed-contracts folder")
        }
        console.log("deployed Contract address: ", deployedContracts.Semaphore)
        const [signer] = await ethers.getSigners()

        const SemaphoreZk3 = await ethers.getContractFactory("SemaphoreZk3", {
            libraries: {
                IncrementalBinaryTree: deployedContracts.IncrementalBinaryTree
            }
        })

        const semaphoreZk3 = SemaphoreZk3.attach(deployedContracts.Semaphore)

        const identity = new Identity(seed)
        const commitment = identity.getCommitment().toString()
        console.log("commitment", commitment)

        const group = new Group(id)
        group.addMember(commitment)

        const proof = await generateProof(identity, group, id, 1, {
            wasmFilePath: "../../snark-artifacts/20/semaphore.wasm",
            zkeyFilePath: "../../snark-artifacts/20/semaphore.zkey"
        })
        console.log("proof", proof)

        const isValid = await verifyProof(proof, 20)
        console.log("isValid", isValid)

        const resp = await semaphoreZk3.broadcastSignal(1, proof.nullifierHash, id, id, proof.proof)
        console.log("tx sent, waiting for confirmation...", resp.hash)
        const receipt = await resp.wait()
        console.log("receipt: ", receipt)

        if (logs) {
            console.info(`SemaphoreZk3 broadcastSignal, id: ${commitment}, circleId: ${id}`, resp)
        }
    })

task("zk3:set-gov", "set governance.")
    .addOptionalParam<boolean>("logs", "Print the logs", true, types.boolean)
    .addParam("gov", "new governance address", undefined, types.string)
    .setAction(async ({ logs, gov }, { ethers, hardhatArguments }): Promise<void> => {
        console.log("network Id: ", await ethers.provider.getNetwork())
        const deployedContracts = getDeployedContracts(hardhatArguments.network)
        if (!deployedContracts) {
            throw new Error("No deployed contracts found, check deployed-contracts folder")
        }
        console.log("deployed Contract address: ", deployedContracts.Semaphore)

        const [signer] = await ethers.getSigners()

        const SemaphoreZk3 = await ethers.getContractFactory("SemaphoreZk3", {
            libraries: {
                IncrementalBinaryTree: deployedContracts.IncrementalBinaryTree
            },
            signer
        })

        const semaphoreZk3 = SemaphoreZk3.attach(deployedContracts.Semaphore)

        const resp = await semaphoreZk3.setGovernance(gov)

        if (logs) {
            console.info(`SemaphoreZk3 governance set, address: ${gov}\n`, resp)
        }
    })
