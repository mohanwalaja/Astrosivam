# Required font files

Download these from Google Fonts (fonts.google.com) on your phone, unzip, and
copy the `.ttf` files into this folder using these EXACT filenames
(mpdf_fontconfig.php references them by these names):

| Google Font                       | Weight(s) needed        | Save as                     |
|-----------------------------------|--------------------------|------------------------------|
| Cinzel                            | SemiBold (600), Bold (700), ExtraBold (800) | `Cinzel-SemiBold.ttf`, `Cinzel-Bold.ttf`, `Cinzel-ExtraBold.ttf` |
| Baloo Thambi 2                    | SemiBold (600), Bold (700), ExtraBold (800) | `BalooThambi2-SemiBold.ttf`, `BalooThambi2-Bold.ttf`, `BalooThambi2-ExtraBold.ttf` |
| Yatra One                         | Regular                  | `YatraOne-Regular.ttf`       |
| Noto Sans                         | Regular, Medium, SemiBold, Bold | `NotoSans-Regular.ttf`, `NotoSans-Medium.ttf`, `NotoSans-SemiBold.ttf`, `NotoSans-Bold.ttf` |
| Noto Sans Tamil                   | Regular, Medium, SemiBold, Bold | `NotoSansTamil-Regular.ttf`, `NotoSansTamil-Medium.ttf`, `NotoSansTamil-SemiBold.ttf`, `NotoSansTamil-Bold.ttf` |
| Noto Sans Devanagari               | Regular, Medium, SemiBold, Bold | `NotoSansDevanagari-Regular.ttf`, `NotoSansDevanagari-Medium.ttf`, `NotoSansDevanagari-SemiBold.ttf`, `NotoSansDevanagari-Bold.ttf` |

How to get them on Android (no computer needed):
1. Go to fonts.google.com, search each family above.
2. Tap "Download family" (downloads a .zip of all weights).
3. Use a file manager app (or Termux `unzip`) to extract the .zip.
4. Move/rename the specific weight files into this folder to match the table exactly.

Once all files are here, run from Termux in the project root:

```
composer install
```

This downloads mPDF into `vendor/`. Since BigRock shared hosting usually has
no SSH/composer access, commit the `vendor/` folder to git (or zip it and
upload via cPanel File Manager) so it deploys along with the PHP files.
