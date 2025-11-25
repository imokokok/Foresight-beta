import { z } from 'zod'
import { ethers } from 'ethers'
import { supabaseAdmin } from './supabase.js'

const asBigInt = (pos: 'price' | 'amount' | 'expiry' | 'salt') =>
  z.preprocess((v) => (typeof v === 'string' ? BigInt(v) : v), z.bigint().refine((x) => x >= 0n))

export const OrderSchema = z.object({
  maker: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  outcomeIndex: z.number().int().min(0).max(255),
  isBuy: z.boolean(),
  price: asBigInt('price').refine((v) => v > 0n),
  amount: asBigInt('amount').refine((v) => v > 0n),
  expiry: asBigInt('expiry').optional(),
  salt: asBigInt('salt').refine((v) => v > 0n),
})

export const InputSchemaPlace = z.object({
  chainId: z.number().int().positive(),
  verifyingContract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  order: OrderSchema,
  signature: z.string(),
})

export const InputSchemaCancelSalt = z.object({
  chainId: z.number().int().positive(),
  verifyingContract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  maker: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  salt: asBigInt('salt'),
  signature: z.string(),
})

function normalizeAddr(a: string) { return a.toLowerCase() }

function domainFor(chainId: number, verifyingContract: string) {
  return { name: 'CLOBMarket', version: '1', chainId, verifyingContract }
}

const Types = {
  OrderRequest: [
    { name: 'maker', type: 'address' },
    { name: 'outcomeIndex', type: 'uint256' },
    { name: 'isBuy', type: 'bool' },
    { name: 'price', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
  ],
  CancelSaltRequest: [
    { name: 'maker', type: 'address' },
    { name: 'salt', type: 'uint256' },
  ],
}

export async function placeSignedOrder(input: z.infer<typeof InputSchemaPlace>) {
  if (!supabaseAdmin) throw new Error('Supabase not configured')
  const parsed = InputSchemaPlace.parse(input)
  const order = parsed.order
  const sig = parsed.signature
  const maker = normalizeAddr(order.maker)
  const vc = normalizeAddr(parsed.verifyingContract)
  const chainId = parsed.chainId

  const recovered = ethers.verifyTypedData(domainFor(chainId, vc), { OrderRequest: [...Types.OrderRequest] }, {
    maker: maker,
    outcomeIndex: order.outcomeIndex,
    isBuy: order.isBuy,
    price: order.price,
    amount: order.amount,
    expiry: order.expiry ?? 0n,
    salt: order.salt,
  }, sig)
  if (normalizeAddr(recovered) !== maker) throw new Error('Invalid signature')

  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  const expSec = order.expiry ?? 0n
  if (expSec !== 0n && expSec <= nowSec) throw new Error('Order expired')

  const { data, error } = await supabaseAdmin
    .from('orders')
    .upsert({
      verifying_contract: vc,
      chain_id: chainId,
      maker_address: maker,
      maker_salt: order.salt.toString(),
      outcome_index: order.outcomeIndex,
      is_buy: order.isBuy,
      price: order.price.toString(),
      amount: order.amount.toString(),
      remaining: order.amount.toString(),
      expiry: expSec === 0n ? null : new Date(Number(expSec) * 1000).toISOString(),
      signature: sig,
      status: 'open',
    }, { onConflict: 'verifying_contract,chain_id,maker_address,maker_salt' })
    .select()
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function cancelSalt(input: z.infer<typeof InputSchemaCancelSalt>) {
  if (!supabaseAdmin) throw new Error('Supabase not configured')
  const parsed = InputSchemaCancelSalt.parse(input)
  const maker = normalizeAddr(parsed.maker)
  const vc = normalizeAddr(parsed.verifyingContract)
  const chainId = parsed.chainId
  const sig = parsed.signature

  const recovered = ethers.verifyTypedData(domainFor(chainId, vc), { CancelSaltRequest: [...Types.CancelSaltRequest] }, {
    maker,
    salt: parsed.salt,
  }, sig)
  if (normalizeAddr(recovered) !== maker) throw new Error('Invalid signature')

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'canceled', remaining: '0' })
    .eq('verifying_contract', vc)
    .eq('chain_id', chainId)
    .eq('maker_address', maker)
    .eq('maker_salt', parsed.salt.toString())

  if (error) throw new Error(error.message)
  return { ok: true }
}

export async function getDepth(verifyingContract: string, chainId: number, outcomeIndex: number, isBuy: boolean, limit: number) {
  if (!supabaseAdmin) throw new Error('Supabase not configured')
  const vc = normalizeAddr(verifyingContract)
  const view = await supabaseAdmin
    .from('depth_levels')
    .select('price, qty')
    .eq('verifying_contract', vc)
    .eq('chain_id', chainId)
    .eq('outcome_index', outcomeIndex)
    .eq('is_buy', isBuy)
    .order(isBuy ? 'price' : 'price', { ascending: !isBuy })
    .limit(limit)
  if (!view.error && view.data && view.data.length > 0) return view.data
  const agg = await supabaseAdmin
    .from('orders')
    .select('price, remaining')
    .eq('verifying_contract', vc)
    .eq('chain_id', chainId)
    .eq('outcome_index', outcomeIndex)
    .eq('is_buy', isBuy)
    .in('status', ['open', 'filled_partial'])
  if (agg.error) throw new Error(agg.error.message)
  const map = new Map<string, bigint>()
  for (const row of (agg.data || [])) {
    const p = String((row as any).price)
    const r = BigInt(String((row as any).remaining))
    map.set(p, (map.get(p) || 0n) + r)
  }
  const entries = Array.from(map.entries()).map(([price, qty]) => ({ price, qty: qty.toString() }))
  entries.sort((a, b) => {
    const pa = BigInt(a.price), pb = BigInt(b.price)
    return isBuy ? Number(pb - pa) : Number(pa - pb)
  })
  return entries.slice(0, limit)
}

export async function getQueue(verifyingContract: string, chainId: number, outcomeIndex: number, isBuy: boolean, price: bigint, limit: number, offset: number) {
  if (!supabaseAdmin) throw new Error('Supabase not configured')
  const vc = normalizeAddr(verifyingContract)
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, maker_address, maker_salt, remaining, created_at, sequence')
    .eq('verifying_contract', vc)
    .eq('chain_id', chainId)
    .eq('outcome_index', outcomeIndex)
    .eq('is_buy', isBuy)
    .eq('price', price.toString())
    .in('status', ['open', 'filled_partial'])
    .order('sequence', { ascending: true })
    .range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return data
}

export function getOrderTypes() {
  return Types
}