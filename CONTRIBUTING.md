# Contributing to GitScope

Thanks for your interest in contributing!

## Getting Started

1. Fork and clone the repo
2. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project folder
3. Visit any GitHub profile to see the extension in action

## Development

- No build step required - edit files and reload the extension
- CSS uses GitHub's CSS custom properties for theme compatibility
- All API calls go through `js/api.js`
- Charts are pure CSS/SVG (no external libraries)

## Pull Requests

- Link your PR to an existing issue if applicable
- Test on both light and dark GitHub themes
- Keep changes focused - one feature per PR
- Match the existing code style (vanilla JS, `var`, no frameworks)

## Reporting Issues

Use the [issue tracker](https://github.com/Sagargupta16/gitscope/issues) to report bugs or request features.
