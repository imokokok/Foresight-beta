#!/usr/bin/env python3
"""
优化所有翻译文件
- 删除 market.* 命名空间中冗余的子部分
- 删除数组被错误展平为对象键的问题
- 清理未使用的翻译键
"""

import json
import os
import re

def get_all_keys(obj, prefix=''):
    """递归获取所有键"""
    keys = set()
    for k, v in obj.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.update(get_all_keys(v, full_key))
        else:
            keys.add(full_key)
    return keys

def is_array_index_key(key):
    """检查键是否是数组索引格式，如 'keywords[1]'"""
    return bool(re.match(r'^[\w]+\[\d+\]$', key))

def cleanup_all():
    base_path = '/Users/imokokok/Documents/foresight-build/Foresight-beta/apps/web/messages'

    with open(os.path.join(base_path, 'en.json'), 'r', encoding='utf-8') as f:
        en = json.load(f)

    en_keys = get_all_keys(en)

    for lang in ['es', 'fr', 'ko', 'zh-CN']:
        lang_path = os.path.join(base_path, f'{lang}.json')
        
        with open(lang_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        lang_keys = get_all_keys(data)
        extra_keys = lang_keys - en_keys

        if not extra_keys:
            print(f"{lang}: ✓ 无需优化")
            continue

        print(f"\n{'=' * 60}")
        print(f"优化 {lang}.json")
        print(f"{'=' * 60}")

        # 按类型分类
        market_extra = [k for k in extra_keys if k.startswith('market.')]
        array_index_keys = [k for k in extra_keys if is_array_index_key(k)]
        other_extra = [k for k in extra_keys if k not in market_extra and k not in array_index_keys]

        # 统计被删除的键
        deleted_count = 0

        # 1. 清理 market.* 冗余子部分
        if market_extra:
            market = data.get('market', {})
            en_market = en.get('market', {})
            en_subsections = set(en_market.keys())
            fr_subsections = set(market.keys())
            extra_subsections = fr_subsections - en_subsections

            for subsection in extra_subsections:
                if subsection in market:
                    del market[subsection]
                    deleted_count += 1

            print(f"  删除 market.* 冗余子部分: {len(extra_subsections)} 个")

        # 2. 清理数组索引键
        if array_index_keys:
            for key in array_index_keys:
                # 找到并删除这个键
                parts = key.split('.')
                obj = data
                for i, part in enumerate(parts[:-1]):
                    if part in obj:
                        obj = obj[part]
                    else:
                        break
                last_part = parts[-1]
                if last_part in obj:
                    del obj[last_part]
                    deleted_count += 1

            print(f"  删除数组展平键: {len(array_index_keys)} 个")

        # 3. 处理其他额外键
        if other_extra:
            # 按命名空间分组
            from collections import defaultdict
            by_ns = defaultdict(list)
            for k in other_extra:
                ns = k.split('.')[0]
                by_ns[ns].append(k)

            for ns, keys in by_ns.items():
                print(f"  {ns}: {len(keys)} 个额外键")
                for key in keys:
                    parts = key.split('.')
                    obj = data
                    for part in parts[:-1]:
                        if part in obj:
                            obj = obj[part]
                        else:
                            break
                    last_part = parts[-1]
                    if last_part in obj:
                        del obj[last_part]
                        deleted_count += 1

        # 计算节省的空间
        original_size = os.path.getsize(lang_path)
        with open(lang_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        new_size = os.path.getsize(lang_path)

        print(f"\n  删除键数: {deleted_count}")
        print(f"  文件大小: {original_size} → {new_size} 字节 (节省 {original_size - new_size} 字节)")

if __name__ == '__main__':
    cleanup_all()
