# Night Better

Firefox 157 (Nova) add-on: a toolbar switch for the proxy you already set, plus helpers for copying chrome CSS (tighter tabs, a solid black top bar, adjustable Nova corners, hide Share Firefox).

Pair it with the [Night Neutral](https://github.com/JoelLisenby/firefox-night-neutral) theme. Firefox treats a static theme and an extension as two packages.

AMO listing: [Night Better](https://addons.mozilla.org/firefox/addon/night-better/) (name cannot include the Firefox trademark).

Chrome-only and theme+chrome installs are in the [better-firefox gist](https://gist.github.com/JoelLisenby/e8bb1dfa7fb2fef3377617b86e3de14b).

## What it does

Toolbar button (Customize Toolbar → drag it next to the hamburger menu):

- **Proxy** turns your existing Firefox proxy on and off. The options page is a Connection Settings form filled from the live Firefox proxy (`proxy.settings.get()`). Host, port, PAC URL, type, SOCKS, and bypass stay as you already had them until you change a control. Right-click the button for Toggle proxy or Proxy settings.
- **Chrome CSS setup** opens the options page. Corner radius (0 square through Nova full), copy buttons, and the profile install steps live there. A signed add-on cannot restyle browser chrome on Firefox Release, so this is a one-time profile install.

Share Firefox (`#appMenu-referrals-button`) sits in the app menu next to About Firefox. Hide it with `browser.referrals.enabled` = `false` in `about:config`, or with the CSS from options.

## Install (AMO)

After Mozilla review:

1. Install [Night Neutral](https://addons.mozilla.org/firefox/addon/night-neutral/) (theme).
2. Install [Night Better](https://addons.mozilla.org/firefox/addon/night-better/).
3. Pin **Night Better** on the toolbar.
4. In `about:addons`, next to Night Better open `...` → Manage. Set Run in Private Windows to Allow.

## Install (temporary, this session)

1. `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`.
2. Load the Night Neutral theme the same way from that repo.
3. Pin **Night Better** on the toolbar.
4. In `about:addons`, next to Night Better open `...` → Manage. Set Run in Private Windows to Allow.

Temporary add-ons go away when Firefox restarts.

## Chrome CSS (keeps Nova)

1. `about:config` → `toolkit.legacyUserProfileCustomizations.stylesheets` → `true`.
2. `about:support` → Profile Folder → Open Folder.
3. Create `chrome` if it is missing.
4. Copy `userChrome.css` from the options page into that folder (or copy `chrome/userChrome.css` and prepend the radius block from options).
5. Optional: copy `userContent.css` from the options page for the same radius on Settings and other `about:` pages.
6. Restart Firefox.

The options page has a corner-radius slider from 0 (square) to 100 (Nova’s defaults: xsmall 4px, small 8px, medium 12px, large 16px, xlarge 24px). Copy again after you move the slider.

That stylesheet:

- Scales Nova radius tokens to the slider value (tabs, urlbar, panels, buttons).
- Shrinks tab padding above, below, and between tabs.
- Replaces Nova’s violet→orange toolbox gradient with solid `#000000`.
- Lifts the current tab, hovered tabs, and hovered/open toolbar buttons just off black (`#2a2a2a` / `#1c1c1c`) with light text.
- Bookmark and panel menus use `#1a1a1a` with hover `#3a3a3a`.
- Hides Share Firefox.

Leave `browser.nova.enabled` on.

## Proxy

The switch follows the live Firefox proxy: on when type is Manual, PAC, system, or auto-detect; off when it is No proxy. Turning it on or off changes only `proxyType`. Host, port, PAC URL, SOCKS, and passthrough stay as Firefox already has them. Off is a direct connection (`proxyType: "none"`).

Because `proxy.settings.set()` is what moves the radios in Settings → Privacy & Security → Proxy settings, Firefox lists Night Better in Connection Settings and locks that dialog. The options page is the editor: it loads the current object with `get()` and does not write until you change a control.

The switch stays locked until Run in Private Windows is set to Allow. Temporary add-ons need that granted again after each load.

## Develop / publish

While developing, load this folder from `about:debugging`, or copy `chrome/userChrome.css` into the profile. Do not run `./sign.sh` until a version is ready to keep; AMO reviews listed uploads.

When publishing, bump `version` in `manifest.json` (listed cannot reuse an unlisted number), put AMO JWT credentials in `.amo-credentials` (gitignored) or the environment, then `./sign.sh`.

```
export WEB_EXT_API_KEY='user:########:##'
export WEB_EXT_API_SECRET='...'
./sign.sh
```

Unsigned zip: `./pack.sh` writes `dist/night-better.xpi`.

## License

[MPL-2.0](LICENSE)
