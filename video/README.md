# QC Installation Tutorial — 136.4 seconds, 1920×1080, 30 fps

Thai tutorial with motion graphics and synthetic Thai narration across seven installation steps. Voice: installed Microsoft Pattara (Windows), not a human voice recording. No music.
Run `npm ci` then `npm run dev -- --no-open` and open the Studio URL.
Composition: `QCInstallation`. Export: `npx remotion render src/index.ts QCInstallation out/qc-installation-th.mp4 --codec=h264 --crf=20`.
The `public/narration/` MP3 files are included for offline playback and rendering; no speech service account is required. `narration-th.json` holds the editable script. Scene lengths are in `src/narration-timing.json`.

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i --loglevel=error
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
