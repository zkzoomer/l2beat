import { Bytes, EthereumAddress } from '@l2beat/shared-pure'
import { expect, mockObject } from 'earl'

import { DiscoveryLogger } from '../DiscoveryLogger'
import { DiscoveryProvider } from '../provider/DiscoveryProvider'
import { MulticallClient } from '../provider/multicall/MulticallClient'
import { ClassicHandler, HandlerResult } from './Handler'
import { executeHandlers } from './executeHandlers'
import { SimpleMethodHandler } from './system/SimpleMethodHandler'
import { ArrayHandler } from './user/ArrayHandler'
import { StorageHandler } from './user/StorageHandler'

describe(executeHandlers.name, () => {
  const BLOCK_NUMBER = 1234

  function providerWithStorage(layout: Record<string, number>) {
    return mockObject<DiscoveryProvider>({
      async getStorage(_, slot) {
        const number = Number(BigInt(slot.toString()))
        const value = layout[number]
        return Bytes.fromHex(value!.toString(16).padStart(64, '0'))
      },
    })
  }

  it('simple case with no dependencies', async () => {
    const provider = providerWithStorage({
      1: 123,
      2: 456,
    })
    const values = await executeHandlers(
      provider,
      mockObject<MulticallClient>(),
      [
        new StorageHandler(
          'foo',
          { type: 'storage', slot: 1, returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'bar',
          { type: 'storage', slot: 2, returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
      ],
      EthereumAddress.random(),
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )
    expect<unknown[]>(values).toEqual([
      { field: 'foo', value: 123, ignoreRelative: undefined },
      { field: 'bar', value: 456, ignoreRelative: undefined },
    ])
  })

  it('one level singular dependencies', async () => {
    const provider = providerWithStorage({
      1: 123,
      2: 456,
      123: 1001,
      456: 1002,
    })
    const values = await executeHandlers(
      provider,
      mockObject<MulticallClient>(),
      [
        new StorageHandler(
          'xxx',
          { type: 'storage', slot: '{{ foo }}', returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'yyy',
          { type: 'storage', slot: '{{ bar }}', returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'foo',
          { type: 'storage', slot: 1, returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'bar',
          { type: 'storage', slot: 2, returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
      ],
      EthereumAddress.random(),
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )
    expect<unknown[]>(values).toEqual([
      { field: 'foo', value: 123, ignoreRelative: undefined },
      { field: 'bar', value: 456, ignoreRelative: undefined },
      { field: 'xxx', value: 1001, ignoreRelative: undefined },
      { field: 'yyy', value: 1002, ignoreRelative: undefined },
    ])
  })

  it('multi level multiple dependencies', async () => {
    const provider = providerWithStorage({
      1: 100,
      2: 200,
      300: 30000,
      400: 40000,
      30100: 3010000,
      3050000: 305000000,
    })
    const values = await executeHandlers(
      provider,
      mockObject<MulticallClient>(),
      [
        new StorageHandler(
          'aab',
          {
            type: 'storage',
            slot: '{{ a }}',
            offset: '{{ ab }}',
            returnType: 'number',
          },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'ab',
          {
            type: 'storage',
            slot: '{{ a }}',
            offset: '{{ b }}',
            returnType: 'number',
          },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'bb',
          {
            type: 'storage',
            slot: '{{ b }}',
            offset: '{{ b }}',
            returnType: 'number',
          },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'a',
          { type: 'storage', slot: 1, returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'aabbb',
          {
            type: 'storage',
            slot: '{{ aab }}',
            offset: '{{ bb }}',
            returnType: 'number',
          },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'b',
          { type: 'storage', slot: 2, returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
      ],
      EthereumAddress.random(),
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )
    expect<unknown[]>(values).toEqual([
      { field: 'a', value: 100, ignoreRelative: undefined },
      { field: 'b', value: 200, ignoreRelative: undefined },
      { field: 'ab', value: 30000, ignoreRelative: undefined },
      { field: 'bb', value: 40000, ignoreRelative: undefined },
      { field: 'aab', value: 3010000, ignoreRelative: undefined },
      { field: 'aabbb', value: 305000000, ignoreRelative: undefined },
    ])
  })

  it('unresolvable self', async () => {
    const provider = mockObject<DiscoveryProvider>()
    const promise = executeHandlers(
      provider,
      mockObject<MulticallClient>(),
      [
        new StorageHandler(
          'a',
          { type: 'storage', slot: '{{ a }}' },
          DiscoveryLogger.SILENT,
        ),
      ],
      EthereumAddress.random(),
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )
    await expect(promise).toBeRejectedWith('Impossible to resolve dependencies')
  })

  it('unresolvable unknown', async () => {
    const provider = mockObject<DiscoveryProvider>()
    const promise = executeHandlers(
      provider,
      mockObject<MulticallClient>(),
      [
        new StorageHandler(
          'a',
          { type: 'storage', slot: '{{ foo }}' },
          DiscoveryLogger.SILENT,
        ),
      ],
      EthereumAddress.random(),
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )
    await expect(promise).toBeRejectedWith('Impossible to resolve dependencies')
  })

  it('unresolvable cycle', async () => {
    const provider = mockObject<DiscoveryProvider>()
    const promise = executeHandlers(
      provider,
      mockObject<MulticallClient>(),
      [
        new StorageHandler(
          'a',
          { type: 'storage', slot: '{{ b }}' },
          DiscoveryLogger.SILENT,
        ),
        new StorageHandler(
          'b',
          { type: 'storage', slot: '{{ a }}' },
          DiscoveryLogger.SILENT,
        ),
      ],
      EthereumAddress.random(),
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )
    await expect(promise).toBeRejectedWith('Impossible to resolve dependencies')
  })

  it('handles handlers with errors', async () => {
    class FunkyHandler implements ClassicHandler {
      dependencies: string[] = []
      field = 'foo'
      logger = DiscoveryLogger.SILENT
      async execute(): Promise<HandlerResult> {
        throw new Error('oops')
      }
    }

    const provider = mockObject<DiscoveryProvider>()
    const values = await executeHandlers(
      provider,
      mockObject<MulticallClient>(),
      [new FunkyHandler()],
      EthereumAddress.random(),
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )
    expect<unknown[]>(values).toEqual([{ field: 'foo', error: 'oops' }])
  })

  it('handles multicallable handlers', async () => {
    const ADDRESS = EthereumAddress.random()
    const method = 'function foo() external view returns (uint256)'
    const selector = 'c2985578'
    const provider = providerWithStorage({
      1: 123,
    })
    const multicall = mockObject<MulticallClient>({
      multicallNamed: async (requests) => {
        expect(requests).toEqual({
          foo: [
            {
              address: ADDRESS,
              data: Bytes.fromHex(selector),
            },
          ],
        })

        return {
          foo: [
            {
              success: true,
              data: Bytes.fromHex('0x' + '12345678'.padStart(64, '0')),
            },
          ],
        }
      },
    })
    const values = await executeHandlers(
      provider,
      multicall,
      [
        new StorageHandler(
          'a',
          { type: 'storage', slot: 1, returnType: 'number' },
          DiscoveryLogger.SILENT,
        ),
        new SimpleMethodHandler(method, DiscoveryLogger.SILENT),
      ],
      ADDRESS,
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )

    expect(values).toEqual([
      { field: 'foo', value: 0x12345678 },
      { field: 'a', value: 123, ignoreRelative: undefined },
    ])
  })

  it('handles multicallable handlers with dependencies', async () => {
    const ADDRESS = EthereumAddress.random()
    const method = 'function foo() external view returns (uint256)'
    const selector = 'c2985578'
    const provider = mockObject<DiscoveryProvider>({
      async call() {
        return Bytes.fromHex('0x' + '12345678'.padStart(64, '0'))
      },
    })
    const multicall = mockObject<MulticallClient>({
      multicallNamed: async (requests) => {
        expect(requests).toEqual({
          foo: [
            {
              address: ADDRESS,
              data: Bytes.fromHex(selector),
            },
          ],
        })

        return {
          foo: [
            {
              success: true,
              data: Bytes.fromHex('0x' + '3'.padStart(64, '0')),
            },
          ],
        }
      },
    })
    const values = await executeHandlers(
      provider,
      multicall,
      [
        new ArrayHandler(
          'bar',
          {
            type: 'array',
            method: 'bar',
            length: '{{ foo }}',
          },
          ['function bar(uint256) external view returns (uint256)'],
          DiscoveryLogger.SILENT,
        ),
        new SimpleMethodHandler(method, DiscoveryLogger.SILENT),
      ],
      ADDRESS,
      BLOCK_NUMBER,
      DiscoveryLogger.SILENT,
    )

    expect(values).toEqual([
      { field: 'foo', value: 3 },
      {
        field: 'bar',
        value: [0x12345678, 0x12345678, 0x12345678],
        ignoreRelative: undefined,
      },
    ])
  })
})
