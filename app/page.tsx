"use client"

import { Web3Provider } from "@/app/Web3Provider"
import { SendUserOp } from "@/app/SendUserOp"

export default function Home() {
    return (
        <Web3Provider>
            <main className="flex flex-col items-center justify-between p-24 font-mono">
                <div className="z-10 w-full items-center justify-between text-lg lg:flex pt-3 pb-3">
                    <h1 className="underline">Clean example</h1>
                </div>
                <SendUserOp />
            </main>
        </Web3Provider>
    )
}
