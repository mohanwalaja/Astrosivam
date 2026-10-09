#!/usr/bin/env python3
import os
import zipfile
import shutil

def create_dist_zip():
    dist_dir = 'dist'
    api_dir = 'api'
    zip_name = 'dist.zip'
    
    # Clean up any existing zip
    if os.path.exists(zip_name):
        try:
            os.remove(zip_name)
        except Exception:
            pass
    
    # Ensure public/.htaccess is copied to dist/ if not already there
    if os.path.exists('public/.htaccess') and os.path.exists(dist_dir):
        shutil.copy2('public/.htaccess', os.path.join(dist_dir, '.htaccess'))

    print(f"Creating compact {zip_name} (target: ~7MB)...")
    
    # Excluded files and directories to keep the shared-host deployment lightweight.
    excluded_files = {'.DS_Store', 'Thumbs.db'}
    excluded_dirs = {'__pycache__', '.git', 'node_modules', 'vendor', '.github', 'tests'}

    def is_runtime_artifact(file_path):
        """api/storage holds transient, admin-staged preview PDFs (customer
        reports waiting to be emailed). They must never ship in a deployment
        zip - only the folder's .htaccess guards should."""
        normalized = file_path.replace(os.sep, '/')
        basename = os.path.basename(normalized)
        # Never ship the fallback HMAC signing key or an interrupted atomic-write
        # temp file, even when an ignored local runtime key exists in the checkout.
        if basename.startswith('app_secret_key.txt'):
            return True
        if '/storage/' not in normalized:
            return False
        return not basename.startswith('.ht')

    with zipfile.ZipFile(zip_name, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        # 1. Add all optimized static frontend files from dist/ to root of zip
        if os.path.exists(dist_dir):
            for root, dirs, files in os.walk(dist_dir):
                # Filter out excluded directories
                dirs[:] = [d for d in dirs if d not in excluded_dirs]
                for file in files:
                    file_path = os.path.join(root, file)
                    if file in excluded_files or file.endswith('.map'):
                        continue
                    if file.endswith('.cjs'):
                        raise RuntimeError(f'Unexpected executable server bundle in static cPanel deployment: {file_path}')
                    arcname = os.path.relpath(file_path, dist_dir)
                    zipf.write(file_path, arcname)
                    
        # 2. Add complete PHP backend API
        if os.path.exists(api_dir):
            for root, dirs, files in os.walk(api_dir):
                dirs[:] = [d for d in dirs if d not in excluded_dirs]
                for file in files:
                    file_path = os.path.join(root, file)
                    if file in excluded_files or file.endswith('.map'):
                        continue
                    if file.endswith('.cjs'):
                        raise RuntimeError(f'Unexpected executable server bundle in static cPanel deployment: {file_path}')
                    if is_runtime_artifact(file_path):
                        continue
                    arcname = os.path.relpath(file_path, '.')
                    zipf.write(file_path, arcname)

        # The PHP report needs the same ceremony-specific weekday / season
        # rules as the browser, including when deployed from this zip alone.
        rules_path = 'src/lib/muhurtham/rules.json'
        if os.path.exists(rules_path):
            zipf.write(rules_path, rules_path)

        # 3. Add root .htaccess if dist didn't contain it
        if os.path.exists('public/.htaccess') and '.htaccess' not in zipf.namelist():
            zipf.write('public/.htaccess', '.htaccess')

        # 4. Add the operator documentation referenced by the deployment guide
        for doc in (
            'BIGROCK_CPANEL_DEPLOYMENT_GUIDE.md',
            'RATE_LIMITING_AND_PAYMENT_RECOVERY.md',
            'PDF_DELIVERY_QUALITY.md'
        ):
            if os.path.exists(doc):
                zipf.write(doc, doc)

    size_mb = os.path.getsize(zip_name) / (1024 * 1024)
    print(f"Successfully generated {zip_name} - Size: {size_mb:.2f} MB")

if __name__ == '__main__':
    create_dist_zip()
