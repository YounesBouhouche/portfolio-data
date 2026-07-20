import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, extname, basename } from 'path'
import sharp from 'sharp'

// ─── Config ───────────────────────────────────────────────────────────────────

const REPO = 'YounesBouhouche/portfolio-data'
const BRANCH = 'main'
const BASE_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const SVG_EXT = '.svg'

const SIZES = {
    hero: { width: 1440, height: null },   // constrain width, keep ratio
    screenshot: { width: 1024, height: null },
    thumbnail: { width: 640, height: 360, crop: true },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function toWebpName(filename, suffix = '') {
    const base = basename(filename, extname(filename))
    return suffix ? `${base}-${suffix}.webp` : `${base}.webp`
}

async function convertImage(inputPath, outputPath, { width, height, crop }) {
    let pipeline = sharp(inputPath)

    if (crop) {
        pipeline = pipeline.resize(width, height, { fit: 'cover', position: 'centre' })
    } else {
        pipeline = pipeline.resize(width, height || undefined, {
            fit: 'inside',
            withoutEnlargement: true,  // never upscale
        })
    }

    await pipeline.webp({ quality: 82 }).toFile(outputPath)
}

function toUrl(distRelativePath) {
    // Normalize Windows backslashes to forward slashes
    const normalized = distRelativePath.replace(/\\/g, '/')
    return `${BASE_URL}/${normalized}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const config = JSON.parse(readFileSync('portfolio.config.json', 'utf-8'))

const projects = await Promise.all(
    config.projects.map(async (project) => {
        if (!project.assets) {
            console.warn(`⚠️  No "assets" field for: ${project.repo} — skipping`)
            return { ...project, heroImage: null, thumbnail: null, screenshots: [] }
        }

        const srcFolder = join('assets', project.assets)
        const distFolder = join('dist', 'assets', project.assets)

        if (!existsSync(srcFolder)) {
            console.warn(`⚠️  No assets folder found at: ${srcFolder} — skipping`)
            return { ...project, heroImage: null, thumbnail: null, screenshots: [] }
        }

        ensureDir(distFolder)

        const files = readdirSync(srcFolder)
            .filter((f) => {
                const ext = extname(f).toLowerCase()
                return IMAGE_EXTS.includes(ext) || ext === SVG_EXT
            })
            .sort()

        const heroSrc = files.find((f) => f.toLowerCase().startsWith('hero.'))
        const screenshotSrcs = files.filter((f) => !f.toLowerCase().startsWith('hero.'))

        let heroImage = null
        let thumbnail = null
        const screenshots = []

        // ── Hero ──
        if (heroSrc) {
            const ext = extname(heroSrc).toLowerCase()

            if (ext === SVG_EXT) {
                // SVGs: copy as-is, no conversion
                const destName = heroSrc
                const destPath = join(distFolder, destName)
                const srcData = readFileSync(join(srcFolder, heroSrc))
                writeFileSync(destPath, srcData)
                heroImage = toUrl(join('dist', 'assets', project.assets, destName))
                console.log(`  ✓ hero (svg, unchanged): ${destName}`)
            } else {
                // Hero WebP
                const heroDestName = toWebpName(heroSrc)
                const heroDestPath = join(distFolder, heroDestName)
                await convertImage(join(srcFolder, heroSrc), heroDestPath, SIZES.hero)
                heroImage = toUrl(join('dist', 'assets', project.assets, heroDestName))
                console.log(`  ✓ hero → ${heroDestName}`)

                // Thumbnail WebP (generated from same hero source)
                const thumbDestName = toWebpName(heroSrc, 'thumb')
                const thumbDestPath = join(distFolder, thumbDestName)
                await convertImage(join(srcFolder, heroSrc), thumbDestPath, SIZES.thumbnail)
                thumbnail = toUrl(join('dist', 'assets', project.assets, thumbDestName))
                console.log(`  ✓ thumbnail → ${thumbDestName}`)
            }
        }

        // ── Screenshots ──
        for (const file of screenshotSrcs) {
            const ext = extname(file).toLowerCase()

            if (ext === SVG_EXT) {
                const destPath = join(distFolder, file)
                writeFileSync(destPath, readFileSync(join(srcFolder, file)))
                screenshots.push(toUrl(join('dist', 'assets', project.assets, file)))
                console.log(`  ✓ screenshot (svg, unchanged): ${file}`)
            } else {
                const destName = toWebpName(file)
                const destPath = join(distFolder, destName)
                await convertImage(join(srcFolder, file), destPath, SIZES.screenshot)
                screenshots.push(toUrl(join('dist', 'assets', project.assets, destName)))
                console.log(`  ✓ screenshot → ${destName}`)
            }
        }

        return { ...project, heroImage, thumbnail, screenshots }
    })
)

const output = {
    generatedAt: new Date().toISOString(),
    projects,
}

writeFileSync('data.json', JSON.stringify(output, null, 2))
console.log(`\n✅ data.json generated with ${projects.length} projects`)