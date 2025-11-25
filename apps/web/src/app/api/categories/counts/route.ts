// 分类热点数量API路由 - 获取每个分类的预测事件数量
import { NextResponse } from 'next/server';
import { getClient } from '@/lib/supabase';

export async function GET() {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json({ success: false, message: 'Supabase 未配置' }, { status: 500 })
    }
    // 使用Supabase查询每个分类的预测事件数量（只统计活跃状态的事件）
    const { data: categories, error: categoriesError } = await client
      .from('categories')
      .select('name');
    
    if (categoriesError) {
      throw new Error(`获取分类列表失败: ${categoriesError.message}`);
    }
    
    // 为每个分类查询活跃事件数量
    const categoryCounts = [];
    
    for (const category of categories || []) {
      const { data: predictions, error: predictionsError } = await client
        .from('predictions')
        .select('id')
        .eq('category', category.name)
        .eq('status', 'active');
      
      if (predictionsError) {
        console.error(`查询分类 ${category.name} 事件数量失败:`, predictionsError);
        categoryCounts.push({
          category: category.name,
          count: 0
        });
      } else {
        categoryCounts.push({
          category: category.name,
          count: predictions?.length || 0
        });
      }
    }
    
    // 返回分类热点数量
    return NextResponse.json({
      success: true,
      data: categoryCounts,
      message: '获取分类热点数量成功'
    }, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
  } catch (error) {
    console.error('获取分类热点数量失败:', error);
    return NextResponse.json({ success: false, message: '获取分类热点数量失败' }, { status: 500 });
  }
}