import 'jest'
import { every, isString, isObject, range } from 'lodash'

import { InMemoryEventStore } from 'lib-export'

const isSerializedDomainEvent = event =>
  isObject(event) && isString(event.name) && isString(event.payload)

const isPersistedDomainEvent = event =>
  isSerializedDomainEvent(event) &&
  isString(event.id) &&
  isString(event.correlationId) &&
  isObject(event.aggregate) &&
  isString(event.aggregate.context) &&
  isString(event.aggregate.type)

describe('An InMemoryEventStore instance `es`', () => {
  describe('es.appendEventsToAggregates(insertions: EventStoreInsertion[], correlationId: string)', () => {
    it('respects expectedAggregateVersion === -1 and expectedAggregateVersion === -2 meanings', async () => {
      const es = InMemoryEventStore()

      // We correctly expect aggregate.version is 0
      await es.appendEventsToAggregates([
        {
          aggregate: {
            context: 'C',
            type: 'D',
            identity: 'I',
          },
          eventsToAppend: [{ name: 'X', payload: '' }],
          expectedAggregateVersion: 0,
        },
      ])

      // We now expect the wrong version
      let result = await es.appendEventsToAggregates([
        {
          aggregate: {
            context: 'C',
            type: 'D',
            identity: 'I',
          },
          eventsToAppend: [{ name: 'X', payload: '' }],
          expectedAggregateVersion: 10,
        },
      ])
      expect(result.isLeft()).toBe(true)

      // We correctly expect aggregate exists
      result = await es.appendEventsToAggregates([
        {
          aggregate: {
            context: 'C',
            type: 'D',
            identity: 'I',
          },
          eventsToAppend: [{ name: 'X', payload: '' }],
          expectedAggregateVersion: -1,
        },
      ])
      expect(result.isRight()).toBe(true)

      // We have no expectations
      result = await es.appendEventsToAggregates([
        {
          aggregate: {
            context: 'C',
            type: 'DD',
            identity: undefined,
          },
          eventsToAppend: [{ name: 'X', payload: '' }],
          expectedAggregateVersion: -2,
        },
      ])
      expect(result.isRight()).toBe(true)

      // We expect the aggregate exists but it does not
      result = await es.appendEventsToAggregates([
        {
          aggregate: {
            context: 'C',
            type: 'Not Exists',
            identity: undefined,
          },
          eventsToAppend: [{ name: 'X', payload: '' }],
          expectedAggregateVersion: -1,
        },
      ])
      expect(result.isLeft()).toBe(true)
    })
    it('returns an error decorated with .type = "CONCURRENCY" if there is a concurrency issue', async () => {
      const es = InMemoryEventStore()

      // We correctly expect aggregate.version is 0
      await es.appendEventsToAggregates([
        {
          aggregate: {
            context: 'C',
            type: 'D',
            identity: 'I',
          },
          eventsToAppend: [{ name: 'X', payload: '' }],
          expectedAggregateVersion: 0,
        },
      ])

      // We now expect the wrong version
      let result = await es.appendEventsToAggregates([
        {
          aggregate: {
            context: 'C',
            type: 'D',
            identity: 'I',
          },
          eventsToAppend: [{ name: 'X', payload: '' }],
          expectedAggregateVersion: 0,
        },
      ])
      expect(result.isLeft()).toBe(true)
      expect(result.value.type).toBe('CONCURRENCY')
    })
    it('returns a "right" value wich is a PersistedDomainEvent[] collection', async () => {
      const es = InMemoryEventStore()

      const aggregateIndetifier1 = {
        context: 'C',
        type: 'D',
        identity: 'I',
      }
      const eventsToAppend1 = range(5).map((_, idx) => ({
        name: `Event${idx}`,
        payload: `${idx}`,
      }))
      const aggregateIndetifier2 = {
        context: 'C',
        type: 'D',
        identity: undefined,
      }
      const eventsToAppend2 = range(3).map((_, idx) => ({
        name: `Event${idx}`,
        payload: `${idx}`,
      }))

      const {
        value: persistedDomainEvents,
      } = await es.appendEventsToAggregates([
        {
          aggregate: aggregateIndetifier1,
          eventsToAppend: eventsToAppend1,
          expectedAggregateVersion: 0,
        },
        {
          aggregate: aggregateIndetifier2,
          eventsToAppend: eventsToAppend2,
          expectedAggregateVersion: 0,
        },
      ])

      const allEventsToAppend = eventsToAppend1.concat(eventsToAppend2)
      const expectedIds = allEventsToAppend.map((_, idx) => `${idx + 1}`)

      expect(every(persistedDomainEvents, isPersistedDomainEvent)).toBe(true)
      expect(persistedDomainEvents[4].aggregate).toEqual(aggregateIndetifier1)
      expect(persistedDomainEvents[5].aggregate).toEqual(aggregateIndetifier2)
      expect(persistedDomainEvents.map(({ id }) => id)).toEqual(expectedIds)
    })
  })

  describe('es.getEventsOfAggregate(aggregate: AggregateIdentifier, fromVersion: number)', () => {
    it("return the promise of the SerializedDomainEvent[] collection representing the aggregate's history", async () => {
      const es = InMemoryEventStore()
      const aggregate = {
        context: 'C',
        type: 'D',
        identity: 'I',
      }
      const eventsToAppend = range(5).map((_, idx) => ({
        name: `Event${idx}`,
        payload: `${idx}`,
      }))

      await es.appendEventsToAggregates([
        {
          aggregate,
          eventsToAppend,
          expectedAggregateVersion: 0,
        },
      ])

      const { value: events } = await es.getEventsOfAggregate(aggregate)

      expect(every(events, isSerializedDomainEvent)).toBe(true)
      expect(events).toEqual(eventsToAppend)
    })
    it('it retrieves only events which are in a position > `fromVersion`', async () => {
      const es = InMemoryEventStore()
      const aggregate = {
        context: 'C',
        type: 'D',
        identity: 'I',
      }
      const eventsToAppend = range(5).map((_, idx) => ({
        name: `Event${idx}`,
        payload: `${idx}`,
      }))

      await es.appendEventsToAggregates([
        {
          aggregate,
          eventsToAppend,
          expectedAggregateVersion: 0,
        },
      ])

      const { value: events } = await es.getEventsOfAggregate(aggregate, 2)
      expect(events).toEqual(eventsToAppend.slice(2))

      const { value: emptyList } = await es.getEventsOfAggregate(aggregate, 200)
      expect(emptyList.length).toBe(0)
    })
  })
})
