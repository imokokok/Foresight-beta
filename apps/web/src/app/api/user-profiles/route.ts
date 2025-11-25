import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabase } from '@/lib/supabase'
import { normalizeAddress, getSessionAddress, isAdminAddress } from '@/lib/serverUtils'

function isEthAddress(addr: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email)
}

function isValidUsername(name: string) {
  if (!name) return false
  if (name.length < 3 || name.length > 20) return false
  return /^\w+$/.test(name)
}


export async function GET(req: NextRequest) {
  try {
    const client = supabaseAdmin || supabase
    if (!client) return NextResponse.json({ profile: null, profiles: [] })
    const { searchParams } = new URL(req.url)
    let address = normalizeAddress(String(searchParams.get('address') || ''))
    const addressesStr = String(searchParams.get('addresses') || '')
    const list = addressesStr
      .split(',')
      .map(s => normalizeAddress(s.trim()))
      .filter(s => s)

    if (list.length > 0) {
      const { data, error } = await client
        .from('user_profiles')
        .select('wallet_address, username, email, is_admin')
        .in('wallet_address', list)
      if (error) return NextResponse.json({ profiles: [], error: error.message }, { status: 200 })
      const rows = (data || []).map((p: any) => ({
        ...p,
        is_admin: !!p?.is_admin || isAdminAddress(p?.wallet_address || '')
      }))
      return NextResponse.json({ profiles: rows }, { status: 200 })
    }

    if (!address) {
      const sess = getSessionAddress(req)
      address = normalizeAddress(String(sess || ''))
    }
    if (!address) return NextResponse.json({ profile: { wallet_address: '', username: '', email: '', is_admin: false } }, { status: 200 })
    const { data, error } = await client
      .from('user_profiles')
      .select('wallet_address, username, email, is_admin')
      .eq('wallet_address', address)
      .maybeSingle()
    if (error) {
      const fallback = { wallet_address: address, username: '', email: '', is_admin: isAdminAddress(address) }
      return NextResponse.json({ profile: fallback }, { status: 200 })
    }
    const profile = data ? { ...data, is_admin: !!data?.is_admin || isAdminAddress(address) } : { wallet_address: address, username: '', email: '', is_admin: isAdminAddress(address) }
    return NextResponse.json({ profile }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ profile: null, error: String(e?.message || e) }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const client = supabaseAdmin
    if (!client) {
      return NextResponse.json({ success: false, message: '缺少服务端密钥' }, { status: 500 })
    }
    const bodyText = await req.text()
    let payload: any = {}
    try { payload = JSON.parse(bodyText) } catch {}
    const walletAddress = normalizeAddress(String(payload?.walletAddress || ''))
    const username = String(payload?.username || '').trim()
    const email = String(payload?.email || '').trim()
    const remember = !!payload?.rememberMe

    const sessAddr = getSessionAddress(req)
    if (!sessAddr || sessAddr !== walletAddress) {
      return NextResponse.json({ success: false, message: '未认证或会话地址不匹配' }, { status: 401 })
    }

    if (!isEthAddress(walletAddress)) {
      return NextResponse.json({ success: false, message: '无效的钱包地址' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ success: false, message: '邮箱格式不正确' }, { status: 400 })
    }
    if (!isValidUsername(username)) {
      return NextResponse.json({ success: false, message: '用户名不合规' }, { status: 400 })
    }

    const { data: existing, error: existError } = await client
      .from('user_profiles')
      .select('wallet_address, username, email')
      .eq('wallet_address', walletAddress)
      .maybeSingle()
    if (existError) {
      return NextResponse.json({ success: false, message: '查询失败' }, { status: 500 })
    }

    if (!existing) {
      const { data, error } = await client
        .from('user_profiles')
        .insert({ wallet_address: walletAddress, username, email })
        .select('wallet_address, username, email')
        .maybeSingle()
      if (error) {
        const msg = (error.message || '').toLowerCase()
        if (msg.includes('unique') && msg.includes('email')) {
          return NextResponse.json({ success: false, message: '邮箱已被占用' }, { status: 409 })
        }
        return NextResponse.json({ success: false, message: '创建失败' }, { status: 500 })
      }
      const res = NextResponse.json({ success: true, profile: data })
      if (remember) {
        res.cookies.set('fs_remember', '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 })
      }
      return res
    } else {
      if (email.toLowerCase() !== String(existing.email || '').toLowerCase()) {
        const { data: emailOwner, error: emailErr } = await client
          .from('user_profiles')
          .select('wallet_address')
          .eq('email', email)
          .maybeSingle()
        if (emailErr) {
          return NextResponse.json({ success: false, message: '邮箱检查失败' }, { status: 500 })
        }
        if (emailOwner && emailOwner.wallet_address !== walletAddress) {
          return NextResponse.json({ success: false, message: '邮箱已被占用' }, { status: 409 })
        }
      }
      const { data, error } = await client
        .from('user_profiles')
        .update({ username, email })
        .eq('wallet_address', walletAddress)
        .select('wallet_address, username, email')
        .maybeSingle()
      if (error) {
        return NextResponse.json({ success: false, message: '更新失败' }, { status: 500 })
      }
      const res = NextResponse.json({ success: true, profile: data })
      if (remember) {
        res.cookies.set('fs_remember', '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 })
      }
      return res
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, message: String(e?.message || e) }, { status: 500 })
  }
}
