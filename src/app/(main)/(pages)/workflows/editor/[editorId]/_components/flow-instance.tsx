'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useNodeConnections } from '@/providers/connections-provider'
import { usePathname } from 'next/navigation'

type Props = {
    children: React.ReactNode
    edges: any[]
    nodes: any[]
}

const FlowInstance = ({ children, edges, nodes }: Props) => {
    const pathname = usePathname()
    const [isFlow, setIsFlow] = useState([])
    const { nodeConnection } = useNodeConnections()




    const onAutomateFlow = async () => {
        const flows: any = []
        const connectedEdges = edges.map((edge) => edge.target)
        connectedEdges.map((target) => {
            nodes.map((node) => {
                if (node.id === target) {
                    flows.push(node.type)
                }
            })
        })

        setIsFlow(flows)
    }

    useEffect(() => {
        onAutomateFlow()
    }, [edges])

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-3 p-4">
                <Button
                    // onClick={onFlowAutomation}
                    disabled={isFlow.length < 1}
                >
                    Save
                </Button>
                <Button
                    disabled={isFlow.length < 1}
                // onClick={onPublishWorkflow}
                >
                    Publish
                </Button>
            </div>
            {children}
        </div>
    )
}

export default FlowInstance