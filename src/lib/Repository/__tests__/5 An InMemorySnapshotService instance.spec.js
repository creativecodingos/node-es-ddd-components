import 'jest'

import { InMemorySnapshotService } from 'lib-export'

describe('An InMemorySnapshotService instance `mss`', () => {
  it('mss.saveAggregateSnapshot works as expected', async () => {
    const mss = InMemorySnapshotService()
    const key = `akey${Math.random()}`
    const snapshot = { serializedState: '{}', version: 100 }
    await mss.saveAggregateSnapshot(key, snapshot)

    const result = await mss.loadAggregateSnapshot(key)
    expect(result.isRight()).toBe(true)
    expect(result.value).toEqual(snapshot)
  })
  it('mss.loadAggregateSnapshot works as expected', async () => {
    const mss = InMemorySnapshotService()
    const key = `akey${Math.random()}`
    const result = await mss.loadAggregateSnapshot(key)
    expect(result.value).toBe(undefined)

    const newSnapshot = { serializedState: '{}', version: 100 }
    await mss.saveAggregateSnapshot(key, newSnapshot)

    const newResult = await mss.loadAggregateSnapshot(key)
    expect(newResult.value).toEqual(newSnapshot)
  })
})
