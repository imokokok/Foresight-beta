#!/usr/bin/env python3
"""
优化法语翻译文件
- 删除 errors 命名空间中未被代码使用的扁平独有键
- 删除 market.* 命名空间中冗余的子部分（因为代码使用主命名空间）
- 保留嵌套对象和必要的翻译
"""

import json
import os

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

def deep_merge(base, override):
    """深度合并两个字典"""
    result = dict(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result

def cleanup_french():
    base_path = '/Users/imokokok/Documents/foresight-build/Foresight-beta/apps/web/messages'
    en_path = os.path.join(base_path, 'en.json')
    fr_path = os.path.join(base_path, 'fr.json')

    with open(en_path, 'r', encoding='utf-8') as f:
        en = json.load(f)
    with open(fr_path, 'r', encoding='utf-8') as f:
        fr = json.load(f)

    en_keys = get_all_keys(en)
    fr_keys = get_all_keys(fr)
    fr_only = fr_keys - en_keys

    errors_only_keys = [k for k in fr_only if k.startswith('errors.')]
    errors_flat_keys = []

    for key in errors_only_keys:
        parts = key.split('.')
        if len(parts) == 2 or (len(parts) == 3 and parts[1].isdigit()):
            errors_flat_keys.append(key)

    print(f"步骤 1: 清理 errors 扁平独有键")
    print(f"  法语 errors 扁平独有键数量: {len(errors_flat_keys)}")

    original_errors = fr.get('errors', {})
    original_errors_count = len(get_all_keys(original_errors))

    def remove_flat_keys(obj):
        if not isinstance(obj, dict):
            return obj

        result = {}
        for key, value in obj.items():
            if isinstance(value, dict):
                result[key] = remove_flat_keys(value)
            elif key in ('wallet', 'api', 'network', 'business'):
                result[key] = value
            else:
                full_key = f"errors.{key}"
                if full_key not in errors_flat_keys:
                    result[key] = value

        return result

    new_errors = remove_flat_keys(original_errors)
    new_errors_count = len(get_all_keys(new_errors))
    fr['errors'] = new_errors

    print(f"  原始 errors 键数: {original_errors_count}")
    print(f"  优化后 errors 键数: {new_errors_count}")

    print(f"\n步骤 2: 清理 market.* 冗余子部分")
    market_en = en.get('market', {})
    market_fr = fr.get('market', {})
    en_subsections = set(market_en.keys())
    fr_subsections = set(market_fr.keys())
    extra_subsections = fr_subsections - en_subsections

    market_sizes = {}
    for subsection in extra_subsections:
        content = market_fr[subsection]
        market_sizes[subsection] = len(json.dumps(content))

    total_market_size = sum(market_sizes.values())
    print(f"  可删除的 market.* 子部分: {len(extra_subsections)} 个")
    print(f"  预计节省: {total_market_size} 字节 ({total_market_size/1024:.1f} KB)")

    for subsection in extra_subsections:
        del fr['market'][subsection]

    print(f"\n步骤 3: 处理特殊情况")

    if 'filters' in fr and 'status' in fr['filters']:
        if 'termine' not in fr['filters']['status']:
            fr['filters']['status']['termine'] = "Terminé"
            print(f"  已添加 filters.status.termine: 'Terminé'")

    print("\n" + "=" * 60)
    print("优化完成！")
    print("=" * 60)
    print(f"删除的 errors 扁平键: {len(errors_flat_keys)}")
    print(f"删除的 market.* 子部分: {len(extra_subsections)} 个")
    print(f"总节省空间: 约 {len(errors_flat_keys) * 50 + total_market_size} 字节")

    with open(fr_path, 'w', encoding='utf-8') as f:
        json.dump(fr, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    cleanup_french()
