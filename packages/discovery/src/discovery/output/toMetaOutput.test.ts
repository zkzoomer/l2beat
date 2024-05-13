import { UpgradeabilityParameters } from '@l2beat/discovery-types'
import { EthereumAddress, UnixTime } from '@l2beat/shared-pure'
import { expect } from 'earl'

import { AnalyzedContract } from '../analysis/AddressAnalyzer'
import { toMetaOutput } from './toMetaOutput'

const base = {
  type: 'Contract' as const,
  derivedName: undefined,
  errors: {},
  values: {},
  isVerified: true,
  deploymentTimestamp: new UnixTime(1234),
  deploymentBlockNumber: 9876,
  upgradeability: { type: 'immutable' } as UpgradeabilityParameters,
  implementations: [],
  abis: {},
  sourceBundles: [],
  matchingTemplates: {},
}

const ADDRESS_A = EthereumAddress('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa')
const ADDRESS_B = EthereumAddress('0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB')

const CONTRACT_A: AnalyzedContract = {
  ...base,
  address: ADDRESS_A,
  name: 'A',
  isVerified: false,
}

const CONTRACT_B: AnalyzedContract = {
  ...base,
  address: ADDRESS_B,
  name: 'B',
  values: { foo: 'foo', bar: 'bar' },
}

describe(toMetaOutput.name, () => {
  it('returns a meta for a single contract with values and using old meta', () => {
    const result = toMetaOutput([CONTRACT_B], {
      contracts: [
        {
          name: 'B',
          description: 'old description',
          values: {
            foo: { description: 'foo', severity: 'LOW', type: 'L2' },
            baz: { description: 'baz', severity: 'HIGH', type: 'PERMISSION' },
          },
        },
      ],
    })

    expect(result).toEqual({
      $schema:
        'https://raw.githubusercontent.com/l2beat/tools/main/schemas/meta.schema.json',
      contracts: [
        {
          description: 'old description',
          extends: undefined,
          name: 'B',
          values: {
            foo: { description: 'foo', severity: 'LOW', type: 'L2' },
            bar: {},
          },
        },
      ],
    })
  })

  it('returns a meta for a single contract with values', () => {
    const result = toMetaOutput([CONTRACT_B], undefined)
    expect(result).toEqual({
      $schema:
        'https://raw.githubusercontent.com/l2beat/tools/main/schemas/meta.schema.json',
      contracts: [
        {
          description: undefined,
          extends: undefined,
          name: 'B',
          values: {
            foo: {},
            bar: {},
          },
        },
      ],
    })

    // Assert sorted order of values
    expect(Object.entries(result.contracts[0]?.values ?? {})).toEqual([
      ['bar', {}],
      ['foo', {}],
    ])
  })

  it('sorts contracts', () => {
    const result = toMetaOutput([CONTRACT_B, CONTRACT_A], undefined)
    expect(result.contracts.map((c) => c.name)).toEqual(['A', 'B'])
  })

  it('returns a meta for a single contract without values', () => {
    const result = toMetaOutput([CONTRACT_A], undefined)
    expect(result).toEqual({
      $schema:
        'https://raw.githubusercontent.com/l2beat/tools/main/schemas/meta.schema.json',
      contracts: [
        {
          name: 'A',
          description: undefined,
          extends: undefined,
          values: undefined,
        },
      ],
    })
  })

  it('returns an empty meta for empty analysis', () => {
    const result = toMetaOutput([], undefined)
    expect(result).toEqual({
      $schema:
        'https://raw.githubusercontent.com/l2beat/tools/main/schemas/meta.schema.json',
      contracts: [],
    })
  })
})
