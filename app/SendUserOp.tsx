import { useCallback, useState } from "react"
import { Address, encodeFunctionData, erc20Abi, Hex, PublicClient } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { useConnect, usePublicClient, useWalletClient } from "wagmi"
import { toMerklePolicy, toSignaturePolicy } from "@zerodev/modular-permission/policies"
import {
    chain,
    CLEARING_HOUSE_ADDRESS,
    ORDER_GATEWAY_V2_ADDRESS,
    PERP_UNIVERSAL_SIG_VALIDATOR_ADDRESS,
    UNIVERSAL_SIG_VALIDATOR_ADDRESS,
    USDT_ADDRESS,
    VAULT_ADDRESS,
} from "@/app/constant"
import { clearingHouseAbi, orderGatewayV2Abi, vaultAbi } from "@/app/types/wagmi/generated"
import { ZeroDevClient, ZeroDevWalletClient } from "@/app/ZeroDevClient"
import { big2Bigint } from "@/app/bn"
import Big from "big.js"
import { injected } from "@wagmi/connectors"

const zeroDevProjectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!
const isSerialized = false
const isUsingSessionKey = true

export const SendUserOp = () => {
    const [address, setAddress] = useState<Address>()
    const [userOpHash, setUserOpHash] = useState<Hex>()
    const [hash, setHash] = useState<Hex>()
    const [sessionPrivateKey, setSessionPrivateKey] = useState(generatePrivateKey())
    const publicClient = usePublicClient()
    const { data: signer } = useWalletClient()
    const { connect } = useConnect()

    const createPolicies = async () => {
        return [
            await toMerklePolicy({
                permissions: [
                    {
                        target: USDT_ADDRESS,
                        valueLimit: BigInt(0),
                        abi: erc20Abi,
                        functionName: "approve",
                        args: [null, null],
                    },
                    {
                        target: VAULT_ADDRESS,
                        valueLimit: BigInt(0),
                        // @ts-ignore
                        abi: vaultAbi,
                        // @ts-ignore
                        functionName: "deposit",
                        args: [null, null],
                    },
                    {
                        target: VAULT_ADDRESS,
                        valueLimit: BigInt(0),
                        // @ts-ignore
                        abi: vaultAbi,
                        // @ts-ignore
                        functionName: "withdraw",
                        args: [null],
                    },
                    {
                        target: VAULT_ADDRESS,
                        valueLimit: BigInt(0),
                        // @ts-ignore
                        abi: vaultAbi,
                        // @ts-ignore
                        functionName: "transferFundToMargin",
                        args: [null, null],
                    },
                    {
                        target: VAULT_ADDRESS,
                        valueLimit: BigInt(0),
                        // @ts-ignore
                        abi: vaultAbi,
                        // @ts-ignore
                        functionName: "transferMarginToFund",
                        args: [null, null],
                    },
                    {
                        target: VAULT_ADDRESS,
                        valueLimit: BigInt(0),
                        // @ts-ignore
                        abi: vaultAbi,
                        // @ts-ignore
                        functionName: "setAuthorization",
                        args: [null, null],
                    },
                    {
                        target: CLEARING_HOUSE_ADDRESS,
                        valueLimit: BigInt(0),
                        // @ts-ignore
                        abi: clearingHouseAbi,
                        // @ts-ignore
                        functionName: "setAuthorization",
                        args: [null, null],
                    },
                    {
                        target: ORDER_GATEWAY_V2_ADDRESS,
                        valueLimit: BigInt(0),
                        // @ts-ignore
                        abi: orderGatewayV2Abi,
                        // @ts-ignore
                        functionName: "cancelOrder",
                        args: [null, null],
                    },
                ],
            }),
            await toSignaturePolicy({
                allowedRequestors: [PERP_UNIVERSAL_SIG_VALIDATOR_ADDRESS, UNIVERSAL_SIG_VALIDATOR_ADDRESS],
            }),
        ]
    }

    function createZeroDevClient() {
        return new ZeroDevClient(
            `https://passkeys.zerodev.app/api/v2/${zeroDevProjectId}`,
            `https://rpc.zerodev.app/api/v2/bundler/${zeroDevProjectId}`,
            `https://rpc.zerodev.app/api/v2/paymaster/${zeroDevProjectId}`,
        )
    }

    async function createKernelClient(publicClient: PublicClient, walletClient: ZeroDevWalletClient, zeroDevClient: ZeroDevClient) {
        if (isUsingSessionKey) {
            const policies = await createPolicies()
            const kernelAccount = await zeroDevClient.createEoaSessionKeyKernelAccount(publicClient, walletClient, sessionPrivateKey, policies)
            if (isSerialized) {
                const serializedSessionKeyAccount = await zeroDevClient.serializeSessionKeyKernelClient(
                    kernelAccount,
                    sessionPrivateKey,
                )
                console.log("using serialized session key")
                console.log("serializedSessionKeyAccount", serializedSessionKeyAccount)
                return zeroDevClient.deserializeSessionKeyKernelClient(publicClient, serializedSessionKeyAccount, chain)
            } else {
                console.log("using session key")
                return zeroDevClient.createKernelClient(chain, kernelAccount)
            }
        } else {
            const kernelAccount = await zeroDevClient.createEoaKernelAccount(publicClient, walletClient)
            console.log("not using session key")
            return zeroDevClient.createKernelClient(chain, kernelAccount)
        }
    }

    const sendUserOps = useCallback(async () => {
        console.log("sendUserOps", publicClient, signer)
        if (!publicClient || !signer) {
            return
        }
        const zeroDevClient = createZeroDevClient()
        const kernelClient = await createKernelClient(publicClient, signer, zeroDevClient)
        setAddress(kernelClient.account?.address)

        const approveCallData = {
            to: USDT_ADDRESS,
            value: 0n,
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [VAULT_ADDRESS, big2Bigint(Big(10), 6)],
            }),
        }

        const userOperation = await zeroDevClient.prepareUserOperationRequest(kernelClient, [approveCallData])
        const userOpHash = await zeroDevClient.sendSimulatedUserOperation(kernelClient, userOperation)
        console.log("userOpHash", userOpHash)
        setUserOpHash(userOpHash)

        const receipt = await zeroDevClient.waitForUserOperationReceipt(kernelClient, userOpHash)
        console.log("receipt", receipt)
        setHash(receipt.receipt.transactionHash)
    }, [createKernelClient, publicClient, signer, sessionPrivateKey, setAddress, setUserOpHash, setHash])

    const connectWeb3Wallet = useCallback(() => {
        connect({ connector: injected(), chainId: chain.id })
    }, [connect])

    const handleSetSessionPrivateKey = useCallback((e: any) => setSessionPrivateKey(e.target.value as Hex), [setSessionPrivateKey])
    return (
        <>
            <div className="z-10 w-full items-center text-sm">
                <p>wallet: {address}</p>
                <p>userOpHash: {userOpHash}</p>
                <p>hash: {hash}</p>
            </div>
            <div className="z-10 w-full items-center justify-between text-sm lg:flex pt-4">
                <input className="text-gray-500 w-full p-2" value={sessionPrivateKey}
                       onChange={handleSetSessionPrivateKey}></input>
                <button
                    className="m-2 p-2 border-2 border-gray-300 rounded-sm"
                    onClick={() => setSessionPrivateKey(generatePrivateKey())}>
                    Regenerate Private Key
                </button>
            </div>
            <div className="z-10 w-full items-center justify-between text-sm lg:flex pt-4">
                {!signer && (
                    <button
                        className="p-2 border-2 border-gray-300 rounded-sm"
                        onClick={connectWeb3Wallet}>
                        Connect Web3 Wallet
                    </button>
                )}
                {signer && (
                    <button
                        className="p-2 border-2 border-gray-300 rounded-sm"
                        onClick={sendUserOps}>
                        Send User Ops
                    </button>
                )}
            </div>
        </>
    )
}