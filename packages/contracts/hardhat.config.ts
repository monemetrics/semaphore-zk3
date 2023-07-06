import "@nomicfoundation/hardhat-chai-matchers"
import "@nomicfoundation/hardhat-verify"
import "@nomiclabs/hardhat-ethers"
import "@typechain/hardhat"
import { config as dotenvConfig } from "dotenv"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import { HardhatUserConfig } from "hardhat/config"
import { NetworksUserConfig } from "hardhat/types"
import { resolve } from "path"
import "solidity-coverage"
import { config } from "./package.json"
import "./tasks/accounts"
import "./tasks/deploy-semaphore"
import "./tasks/deploy-semaphore-voting"
import "./tasks/deploy-semaphore-whistleblowing"
import "./tasks/deploy-semaphore-zk3"
import "./tasks/zk3"

dotenvConfig({ path: resolve(__dirname, "../../.env") })
const BLOCK_EXPLORER_KEY = process.env.BLOCK_EXPLORER_KEY || ""

function getNetworks(): NetworksUserConfig {
    if (!process.env.BACKEND_PRIVATE_KEY) {
        return {}
    }

    // const infuraApiKey = process.env.INFURA_API_KEY
    const accounts = [`0x${process.env.BACKEND_PRIVATE_KEY}`]

    return {
        goerli: {
            url: `https://eth-goerli.public.blastapi.io`,
            chainId: 5,
            accounts
        },
        arbitrum: {
            url: "https://arb1.arbitrum.io/rpc",
            chainId: 42161,
            accounts
        },
        matic: {
            url: process.env.RPC_URL || "https://rpc-mainnet.maticvigil.com",
            chainId: 137,
            accounts
        },
        mumbai: {
            url: process.env.RPC_URL || "https://rpc-mumbai.maticvigil.com",
            chainId: 80001,
            accounts
        }
    }
}

const hardhatConfig: HardhatUserConfig = {
    solidity: config.solidity,
    paths: {
        sources: config.paths.contracts,
        tests: config.paths.tests,
        cache: config.paths.cache,
        artifacts: config.paths.build.contracts
    },
    networks: {
        hardhat: {
            allowUnlimitedContractSize: true
        },
        ...getNetworks()
    },
    gasReporter: {
        currency: "USD",
        enabled: process.env.REPORT_GAS === "true",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY
    },
    typechain: {
        outDir: config.paths.build.typechain,
        target: "ethers-v5"
    },
    etherscan: {
        apiKey: {
            matic: BLOCK_EXPLORER_KEY
        },
        customChains: [
            {
                network: "matic",
                chainId: 137,
                urls: {
                    apiURL: "https://api.polygonscan.com/api",
                    browserURL: "https://polygonscan.com/"
                }
            }
        ]
    }
}

export default hardhatConfig
