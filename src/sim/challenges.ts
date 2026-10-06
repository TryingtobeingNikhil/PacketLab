import type { Level } from '../types'

export type Metric = 'p99' | 'errorPct' | 'goodput'

export interface Goal {
  metric: Metric
  max?: number
  min?: number
}

export interface Challenge {
  id: string
  title: string
  level: Level
  preset: string
  load: number
  brief: string
  goals: Goal[]
  hints: string[]
  lesson: string
}

/**
 * Each challenge ships failing; one findable change makes it pass.
 * The thresholds are checked against the engine by scripts/check-challenges.
 */
export const CHALLENGES: Challenge[] = [
  {
    id: 'hold-the-line',
    title: 'Hold the line',
    level: 'beginner',
    preset: 'single',
    load: 190,
    brief: 'Your server and database take 190 requests a second. Product wants 99 of every 100 answered within 300 ms. Right now you are way over.',
    goals: [{ metric: 'p99', max: 300 }, { metric: 'errorPct', max: 0.01 }],
    hints: [
      'Watch the boxes while it runs. Which one is busiest?',
      'The database can only work on 6 requests at a time.',
      'Click the database and raise its concurrency.',
    ],
    lesson: 'Requests were not slow to process; they were waiting in line. When work arrives nearly as fast as it can be served, the queue grows and the wait dominates latency. A little more capacity at the bottleneck removes almost all of it.',
  },
  {
    id: 'survive-the-flood',
    title: 'Survive the flood',
    level: 'beginner',
    preset: 'ddos',
    load: 200,
    brief: 'A botnet is sending 3,000 junk requests a second. Real users are failing. Get their error rate under 1%.',
    goals: [{ metric: 'errorPct', max: 0.01 }],
    hints: [
      'The servers cannot tell real users from bots, but something in front can.',
      'Click the firewall. What is its block rate?',
    ],
    lesson: 'Overload does not care who sent the traffic. Filtering at the edge, before the junk consumes capacity, is what protects real users. That is why DDoS defence lives as far upstream as possible.',
  },
  {
    id: 'mind-the-tail',
    title: 'Mind the tail',
    level: 'intermediate',
    preset: 'lossy',
    load: 120,
    brief: 'Average latency looks fine, but p99 is terrible on mobile. Get p99 under 200 ms without touching the servers.',
    goals: [{ metric: 'p99', max: 200 }],
    hints: [
      'Nothing here is busy. So the time must be going somewhere else.',
      'Click the link from the phones. Look at its loss rate.',
      'Each response is many packets; any one lost packet costs a 200 ms retransmit timeout. You need fewer than 1 in 200 responses to see a loss.',
    ],
    lesson: 'With 1.5% packet loss and ~18 packets per response, roughly a quarter of responses hit a retransmission timeout. Averages hide this; the tail does not. Smaller responses (fewer packets) or a cleaner link both shrink the odds.',
  },
  {
    id: 'unbloat',
    title: 'Unbloat the uplink',
    level: 'intermediate',
    preset: 'bufferbloat',
    load: 45,
    brief: 'The office sends 45 requests a second of 64 KB each, and the uplink router is buffering seconds of traffic. Get p99 under 300 ms with no errors.',
    goals: [{ metric: 'p99', max: 300 }, { metric: 'errorPct', max: 0.01 }],
    hints: [
      'Which link is red?',
      '45 × 64 KB is about 23.6 Mb/s. What is the uplink’s bandwidth?',
      'Shrinking the buffer trades delay for drops. Only more bandwidth fixes both.',
    ],
    lesson: 'When offered load exceeds link capacity, a deep buffer turns the excess into queueing delay; a shallow one turns it into loss. Neither is free. The real fix is capacity, or sending less.',
  },
  {
    id: 'feed-the-gpus',
    title: 'Feed the GPUs',
    level: 'intermediate',
    preset: 'llm',
    load: 110,
    brief: 'Launch day: 110 prompts a second. The GPUs are saturated and requests are piling up. Get p99 under 4 seconds with under 1% errors.',
    goals: [{ metric: 'p99', max: 4000 }, { metric: 'errorPct', max: 0.01 }],
    hints: [
      'Two replicas × 32 batch slots ÷ 0.9 s ≈ 71 prompts a second. How many reach them?',
      'Prefix cache hits never reach the GPUs. What is the hit rate?',
      'Or drag in a third inference server and connect the model router to it.',
    ],
    lesson: 'GPU capacity is expensive, so the cheapest capacity is work you do not have to do. Raising the prefix‑cache hit rate removes load before it reaches the GPUs; adding replicas adds capacity. Both work; one costs a lot more.',
  },
]
