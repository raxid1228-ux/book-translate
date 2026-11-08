# API ۋە ئىجرا قوللانمىسى

## ئالدىنقى شەرتلەر

- Node.js 20 ياكى ئۇنىڭدىن يېڭى نۇسخا
- Python 3.10 ياكى ئۇنىڭدىن يېڭى نۇسخا (تەكشۈرۈش سكرىپتى ئۈچۈن)
- PDF نىڭ تېكىست قەۋىتى بولۇشى؛ سكانېرلانغان بەتلەرگە OCR ياكى كۆرۈنۈش ئارقىلىق ئوقۇش كېرەك

ماھارەت قىسقۇچىدا بىر قېتىم `npm install` ئىجرا قىلىڭ. Windows PowerShell دا `npm.ps1` چەكلەنگەن بولسا `npm.cmd install` ئىشلىتىڭ.

## PDF نى بەتلەرگە ئايرىش

```sh
node scripts/convert.js extract "./document.pdf" "./document-uyghur"
```

ھەر بىر PDF بېتى `original_pages/page-0001/page-0001.pdf` قىلىپ ساقلىنىدۇ؛ شۇ بەتتىن چىقىرىلغان تېكىست `source.txt` قا يېزىلىدۇ. تېكىست يوق بەت OCR/كۆرۈنۈش ئارقىلىق ئوقۇشنى تەلەپ قىلىدۇ. ئەسلى PDF ئۆزگەرمەيدۇ. ھازىرقى چەك: PDF 250 MiB دىن، بەت سانى 5000 دىن ئېشىپ كەتمەسلىكى كېرەك.

## تەرجىمە لايىھەسى ۋە Markdown چىقىرىش

ھەر بىر بەتنىڭ تەرجىمىسىنى ئايرىم لايىھەگە يېزىڭ:

```text
translation_drafts/page-0001.md
translation_drafts/page-0002.md
```

لايىھەگە YAML frontmatter قوشماڭ؛ چىقىرىش سكرىپتى ئۇنى ئۆزى قوشىدۇ. ھەر بەتنىڭ تەرجىمىسى تولۇق بولغاندىن كېيىن:

```sh
node scripts/convert.js markdown "./document-uyghur" --title "ھۆججەت نامى" --source-language "English"
python scripts/validate.py "./document-uyghur"
```

چىقىرىش `translated_pages/page-0001/page-0001.md` قاتارلىق بەت رەقىمى بىلەن نام بېرىلگەن ئايرىم قىسقۇچ ۋە Markdown ھۆججەتلىرىدىن تەركىب تاپىدۇ. ھۆججەتتە `page`، `source_language`، `target_language` ۋە `uyghur-rtl` CSS سىنىپى بار frontmatter بولىدۇ. تەرجىمە لايىھىسى يوق بەت بولسا سكرىپت خاتالىق قايتۇرىدۇ؛ تاماملانمىغان تەرجىمىنى مۇۋەپپەقىيەت دەپ كۆرسەتمەيدۇ.

## Obsidian ئۇسلۇبى

`_assets/uyghur-rtl.css` نى Obsidian Vault نىڭ `.obsidian/snippets/uyghur-rtl.css` ئورنىغا كۆچۈرۈپ، Settings → Appearance → CSS snippets دىن قوزغىتىڭ. `UKIJ Tuz` نى سىستېمىغا قانۇنلۇق مەنبەدىن ئورنىتىڭ. ئۇ بولمىسا CSS دا كۆرسىتىلگەن شەكىللىك زاپاس serif فونت ئىشلىتىلىدۇ. فونت ھۆججىتى بۇ ماھارەتتە قايتا تارقىتىلمايدۇ.

Windows تا `scripts/build.sh` نى Git Bash/WSL دىن ئىشلىتىڭ. ياكى `node scripts/convert.js` بۇيرۇقىنى PowerShell دىن بىۋاسىتە ئىجرا قىلىڭ. Bash سكرىپتى `extract`، `markdown` ۋە `validate` نى قوبۇل قىلىدۇ.

## خاتالىقلار

- `Dependencies are missing`: ماھارەت قىسقۇچىدا `npm install` / `npm.cmd install` ئىجرا قىلىڭ.
- `Password-protected`: قۇلۇپى ئېچىلغان PDF تەمىنلەڭ.
- `no selectable text`: شۇ بەتنى PDF كۆرۈش/OCR ئارقىلىق ئوقۇپ، ئاندىن تەرجىمە قىلىڭ.
- `Missing translation drafts`: كۆرسىتىلگەن ھەر بەتنىڭ لايىھە ھۆججىتىنى تولدۇرۇپ قايتا ئىجرا قىلىڭ.
