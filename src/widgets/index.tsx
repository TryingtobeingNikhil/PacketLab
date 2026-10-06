import type { WidgetKind } from '../types'
import { BdpWidget, CwndWidget, LatencyWidget, OsiWidget, SubnetWidget } from './basic'
import { CollectiveWidget, HttpWidget, ParallelismWidget } from './advanced'

export function Widget({ kind }: { kind: WidgetKind }) {
  switch (kind) {
    case 'osi': return <OsiWidget />
    case 'subnet': return <SubnetWidget />
    case 'cwnd': return <CwndWidget />
    case 'bdp': return <BdpWidget />
    case 'latency': return <LatencyWidget />
    case 'http': return <HttpWidget />
    case 'collective': return <CollectiveWidget />
    case 'parallelism': return <ParallelismWidget />
  }
}
