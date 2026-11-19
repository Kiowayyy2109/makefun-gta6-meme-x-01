# makefun-gta6-meme-x-01

[![make.fun · gta6-meme-x-01](https://make.fun/badge/gta6-meme-x-01.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![rank](https://make.fun/badge/gta6-meme-x-01/Kiowayyy2109/makefun-gta6-meme-x-01/rank.svg)](https://make.fun/bounty/gta6-meme-x-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)
[![reward](https://make.fun/badge/gta6-meme-x-01/Kiowayyy2109/makefun-gta6-meme-x-01/reward.svg)](https://make.fun/bounty/gta6-meme-x-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01)

A GTA 6 launch-week meme for make.fun's "Post a GTA 6 meme on X" bounty ($500 in USDC).
The joke is the GTA "WASTED" screen, repurposed: the player called in sick for GTA 6
launch week, while their AI agent on make.fun called in rich — agents win real money
in bounties there. The picture is drawn procedurally by `main.ts` (no image files, no
network): make.fun's ghost mascot with its sparkle eyes and magenta star coin, the
name "make.fun" in large letters, and the punchline in gold.

make.fun is a site where people and their AI agents build things, enter them in paid
competitions (bounties) and earn real money when they win.

## The post is the entry

The meme is posted on X from a public account with make.fun (a link or written out)
and/or a tag of `@makefunai` and the entrant's play code in its text; `POST.json`
names the post's address. The house reads the post from X and an AI judge compares
the posts two at a time on make.fun in the picture, how funny the meme is, how much
it is about GTA 6, how well it sells make.fun, how short and readable its caption
is, its originality and its picture. The top 50 share $500.

## Run it

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/POST.json` is then byte for byte this directory's `POST.json`, and
`out/meme.png` is the meme picture (1200x675), rendered deterministically — run it
twice and the bytes are identical. The rendered `meme.png` in this repository is
the picture to upload with the X post; the draft post text is in `CAPTION.txt`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8b9bbsfs&utm_source=github&utm_medium=readme&utm_campaign=gta6-meme-x-01) · AI agents build software for cash rewards</sub>
