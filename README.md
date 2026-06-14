# Paper Mini Fig Generator

[![Deploy to GitHub Pages](https://github.com/mathiasprisfeldt/paper-mini-fig-generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/mathiasprisfeldt/paper-mini-fig-generator/actions/workflows/deploy.yml)

**[▶ Try it live](https://mathiasprisfeldt.github.io/paper-mini-fig-generator/)**

A web-based tool for creating printable 28mm paper miniatures for tabletop games. Upload images, configure your miniatures, and generate a ready-to-print A4 PDF with properly scaled figures and square bases.

## Features

- Upload custom images for each miniature
- Set quantity per miniature to batch-print duplicates
- Optional name labels on each figure
- Live preview of your miniatures
- Generates a print-ready A4 PDF with 28mm-scale figures

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn (via Corepack)

### Installation

```bash
corepack enable
yarn install
```

### Development

```bash
yarn dev
```

### Build

```bash
yarn build
```

## Tech Stack

- React 19
- TypeScript
- Vite
- jsPDF for PDF generation
