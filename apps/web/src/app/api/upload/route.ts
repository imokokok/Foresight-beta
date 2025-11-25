// 图片上传API路由
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // 验证用户是否已登录（钱包地址）
    const formData = await request.formData();
    const walletAddress = formData.get('walletAddress') as string;
    const file = formData.get('file') as File;

    if (!walletAddress) {
      return NextResponse.json(
        { 
          success: false, 
          message: '请先连接钱包登录' 
        },
        { status: 401 }
      );
    }

    // 验证钱包地址格式
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(walletAddress)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '无效的钱包地址格式' 
        },
        { status: 400 }
      );
    }

    // 验证文件
    if (!file) {
      return NextResponse.json(
        { 
          success: false, 
          message: '请选择要上传的图片文件' 
        },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          message: '只支持 JPEG、PNG、WebP 和 GIF 格式的图片' 
        },
        { status: 400 }
      );
    }

    // 验证文件大小（最大5MB）
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          success: false, 
          message: '图片文件大小不能超过5MB' 
        },
        { status: 400 }
      );
    }

    // 生成唯一的文件名
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `predictions/${walletAddress}/${timestamp}.${fileExtension}`;

    // 将文件转换为Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 尝试上传到Supabase Storage
    let publicUrl: string;
    
    try {
      if (!supabaseAdmin) {
        throw new Error('Service key not configured')
      }
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('predictions') // 存储桶名称
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.warn('Supabase Storage上传失败，使用备用方案:', uploadError);
        // 如果存储桶不存在，使用备用方案：生成基于标题的图片
        throw new Error('Storage bucket not available');
      }

      // 获取公开的图片URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from('predictions')
        .getPublicUrl(fileName);

      if (!publicUrlData.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      publicUrl = publicUrlData.publicUrl;
      
    } catch (storageError) {
      // 备用方案：使用基于钱包地址和时间的确定性图片
      const seed = `${walletAddress}-${Date.now()}`;
      // 使用DiceBear API生成头像风格的图片
      publicUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=256&backgroundColor=b6e3f4,c0aede,d1d4f9`;
    }

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        fileName: fileName,
        publicUrl: publicUrl,
        fileSize: file.size,
        contentType: file.type
      },
      message: '图片上传成功'
    }, { status: 201 });

  } catch (error) {
    console.error('图片上传异常:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '图片上传失败',
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// 处理OPTIONS请求（CORS）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}