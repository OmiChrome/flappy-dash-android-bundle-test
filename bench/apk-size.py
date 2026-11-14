#!/usr/bin/env python3
"""Break an APK/AAB down by what takes the space.  Usage: python3 bench/apk-size.py app.apk [more.apk ...]"""
import collections, os, sys, zipfile

for path in sys.argv[1:]:
    z = zipfile.ZipFile(path)
    groups = collections.Counter()
    libs = collections.Counter()
    for i in z.infolist():
        n = i.filename
        if n.startswith(('lib/', 'base/lib/')):
            parts = n.split('/')
            abi = parts[-2]
            groups[f'native libs ({abi})'] += i.compress_size
            libs[f'{abi}/{parts[-1]}'] += i.compress_size
        elif n.endswith('.dex'):
            groups['code (dex)'] += i.compress_size
        elif n.startswith(('assets/', 'base/assets/')):
            groups['assets (JS bundle, wasm, web files)'] += i.compress_size
        elif n.startswith(('res/', 'base/res/')) or n.endswith('.arsc'):
            groups['resources'] += i.compress_size
        else:
            groups['other'] += i.compress_size
    print(f'\n{os.path.basename(path)}: {os.path.getsize(path) / 1048576:.2f} MB')
    for k, v in groups.most_common():
        print(f'  {v / 1048576:8.2f} MB  {k}')
    if libs:
        print('  largest native libraries:')
        for k, v in libs.most_common(8):
            print(f'  {v / 1048576:8.2f} MB    {k}')
